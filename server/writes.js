'use strict';

/**
 * Yazma katmanı (Faz 3) — DB mutasyonları + event-sourcing.
 * Her mutasyon tek transaction'da: tabloyu güncelle + events'e kayıt bırak (source ile).
 * - source: 'dashboard' | 'slack' | 'system'  → echo-koruması (drainer sadece dashboard'ı Slack'e yansıtır)
 * - slack_ts: Slack-kökenli yazımlarda idempotency (events_idem_idx UNIQUE (slack_ts,verb))
 * Doğrulama: Zod. Bilinmeyen/eksik alanlar net hata döndürür (LLM tahmini yok).
 */

const { z } = require('zod');
const { pool, tx } = require('./db');
const { notify } = require('./notify');
const NOTIFY_V2 = process.env.BNS_NOTIFY_V2 === '1';
const slack = require('./slack');
const calc = require('./calc-penalty.js'); // deadline uzatma cezası (API kökü server/; dashboard calc.js imajda yok)

const DURUMLAR = ['yeni', 'calisiliyor', 'basladi', 'incelemede', 'beklemede', 'revizyon', 'blokeli', 'musteride', 'tamamlandi'];

// ── Zod şemaları ─────────────────────────────────────────────
// U... = Slack kullanıcısı, FR... = freelancer (Slack'te yok, sadece takip için sentetik id)
const zUserId = z.string().regex(/^(U|FR)[A-Z0-9]+$/, 'geçersiz kullanıcı id');
const zDate = z.union([z.string(), z.number()]).nullable().optional(); // ISO/ms

const briefCreate = z.object({
  marka: z.string().min(1),
  baslik: z.string().min(1),
  deadline: zDate,
  worker_ids: z.array(zUserId).min(1, 'en az bir işi yapan kişi gerekli'),  // = contributor rolü; dept buradan türetilir
  lead_ids: z.array(zUserId).optional(),       // = lead rolü (çoklu); boşsa [by]
  gozlemci_ids: z.array(zUserId).optional(),   // = gozlemci rolü (gözlemciler)
  priority: z.string().optional(),
  akis: z.enum(['sirali', 'paralel']).optional(),
  maliyet: z.number().nullable().optional(),
  satis: z.number().nullable().optional(),
  musteri_notu: z.string().optional(),
  is_tipi: z.string().max(40).optional(),      // iş tipi (is_tipleri.kod); yoksa başlıktan tahmin → 'diger'
  tags: z.array(z.string()).optional(),
  no: z.number().int().optional(),
  by: zUserId.optional(),                       // işlemi yapan
  source: z.enum(['dashboard', 'slack', 'system']).default('dashboard'),
  slack_ts: z.string().optional(),
}).strict();

const briefPatch = z.object({
  marka: z.string().min(1).optional(),
  is_tipi: z.string().max(40).nullable().optional(),   // iş tipi değişikliği (drawer)
  baslik: z.string().min(1).optional(),
  deadline: zDate,
  priority: z.string().optional(),
  akis: z.enum(['sirali', 'paralel']).optional(),
  musteri_notu: z.string().optional(),
  worker_ids: z.array(zUserId).optional(),     // verilirse contributor TAM değiştirilir (dept yeniden türetilir)
  lead_ids: z.array(zUserId).optional(),       // verilirse lead TAM değiştirilir
  gozlemci_ids: z.array(zUserId).optional(),   // verilirse gozlemci TAM değiştirilir
  by: zUserId.optional(),
  source: z.enum(['dashboard', 'slack', 'system']).default('dashboard'),
  slack_ts: z.string().optional(),
}).strict();

const statusBody = z.object({
  durum: z.enum(DURUMLAR),
  by: zUserId.optional(),
  hedef: zUserId.optional(),   // sıralı zincirde revizyonun döneceği halka (revize: @kişi)
  source: z.enum(['dashboard', 'slack', 'system']).default('dashboard'),
  slack_ts: z.string().optional(),
}).strict();

const financialsBody = z.object({
  maliyet: z.number().nullable().optional(),
  satis: z.number().nullable().optional(),
  fatura: z.boolean().optional(),
  odeme: z.boolean().optional(),
  ucret_tipi: z.enum(['kapsamda', 'ek']).optional(),   // fatura-v2: retainer kapsamı / ayrıca faturalanır
  by: zUserId.optional(),
  source: z.enum(['dashboard', 'slack', 'system']).default('dashboard'),
  slack_ts: z.string().optional(),
}).refine(o => ['maliyet', 'satis', 'fatura', 'odeme'].some(k => o[k] !== undefined),
  { message: 'en az bir finans alanı gerekli (maliyet/satis/fatura/odeme)' }).and(z.object({}));

// ── yardımcılar ──────────────────────────────────────────────
const toTs = (v) => (v == null ? null : (typeof v === 'number' ? new Date(v) : new Date(Date.parse(v))));

async function brandIdByName(client, name) {
  // Önce büyük/küçük harf + boşluk duyarsız eşle — "JNJ Acuvue ME" gibi
  // yazım varyantları mükerrer marka yaratmasın (kanal haritası da kopar).
  const ex = await client.query(
    `SELECT id FROM brands WHERE lower(regexp_replace(name,'\\s+',' ','g')) = lower(regexp_replace($1,'\\s+',' ','g')) LIMIT 1`, [name]);
  if (ex.rows[0]) return ex.rows[0].id;
  // yoksa oluştur (dashboard'dan gerçekten yeni marka gelebilir)
  await client.query(`INSERT INTO brands(name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [name]);
  const r = await client.query(`SELECT id FROM brands WHERE name=$1`, [name]);
  return r.rows[0] && r.rows[0].id;
}

// events'e idempotent kayıt (slack_ts+verb UNIQUE çakışmasını yut)
async function logEvent(client, { brief_id, user_id, verb, detail, source, slack_ts }) {
  await client.query(
    `INSERT INTO events(brief_id,user_id,verb,detail,source,slack_ts)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (slack_ts, verb) WHERE slack_ts IS NOT NULL DO NOTHING`,
    [brief_id || null, user_id || null, verb, detail ? JSON.stringify(detail) : null, source || null, slack_ts || null]
  );
}

/**
 * Bilinmeyen Slack kullanıcı ID'lerini placeholder kayıtla oluşturur.
 * brief_assignees.user_id REFERENCES users(id) NOT NULL — FK ihlalini önler.
 * name placeholder = Slack ID; gerçek ad kullanıcı senkronizasyonuyla güncellenir.
 */
async function ensureUsers(client, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return;
  const vals = unique.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
  await client.query(
    `INSERT INTO users(id, name) VALUES ${vals} ON CONFLICT (id) DO NOTHING`,
    unique.flatMap(id => [id, id])
  );
}

async function setAssignees(client, briefId, { worker_ids, lead_ids, gozlemci_ids }) {
  // Bilinmeyen kullanıcılar için FK koruması (placeholder upsert, mevcut kayıtlara dokunmaz)
  await ensureUsers(client, [...(worker_ids || []), ...(lead_ids || []), ...(gozlemci_ids || [])]);
  // her verilen rol grubunu TAM değiştir (verilmeyene dokunma)
  const apply = async (ids, role) => {
    if (!Array.isArray(ids)) return;
    await client.query(`DELETE FROM brief_assignees WHERE brief_id=$1 AND role=$2`, [briefId, role]);
    for (let i = 0; i < ids.length; i++) await client.query(
      `INSERT INTO brief_assignees(brief_id,user_id,role,sira) VALUES ($1,$2,$3,$4)
       ON CONFLICT (brief_id,user_id,role) DO NOTHING`, [briefId, ids[i], role, i]);
  };
  if (worker_ids   !== undefined) await apply(worker_ids,   'contributor');  // işi yapanlar
  if (lead_ids     !== undefined) await apply(lead_ids,     'lead');         // lead(ler)
  if (gozlemci_ids !== undefined) await apply(gozlemci_ids, 'gozlemci');     // gözlemciler
}

// Üst yönetim: bu kişiler bir işe atanırsa iş KENDİ departmanlarına değil, açanın departmanına yazılır.
// (Erdem/İpek gibi departman liderleri kapsam DIŞI — onlar kendi departmanlarında çalışır.)
const MGMT_IDS = new Set(['U030C48PL23' /* Görkem */, 'UD96GH76E' /* Reyhan */, 'U4XCE3532' /* Cansu */]);

// İşi yapanların dept'lerinden brief dept'i türet (distinct, virgül-join).
// Üst yönetim kuralı: MGMT_IDS'ten biri ATANIRSA dept katkısı kendi departmanı değil,
// işi AÇANIN departmanı olur. (Üst yönetim iş açarsa zaten atananların dept'i türetilir.)
// Hem açan hem atanan üst yönetimse: diğer atananların dept'i; o da yoksa kendi dept'leri.
async function deriveDept(client, worker_ids, creatorId) {
  if (!Array.isArray(worker_ids) || !worker_ids.length) return null;
  const r = await client.query(
    `SELECT id, dept FROM users WHERE id = ANY($1) AND dept IS NOT NULL AND dept <> ''`, [worker_ids]);
  const normal = r.rows.filter(x => !MGMT_IDS.has(x.id)).map(x => x.dept);
  const mgr    = r.rows.filter(x => MGMT_IDS.has(x.id)).map(x => x.dept);
  let mgrSub = [];   // üst yönetim atananların yerine geçecek dept
  if (mgr.length) {
    const cr = creatorId ? await client.query(
      `SELECT id, dept FROM users WHERE id=$1 AND dept IS NOT NULL AND dept <> ''`, [creatorId]) : { rows: [] };
    const c = cr.rows[0];
    if (c && !MGMT_IDS.has(c.id)) mgrSub = [c.dept];   // açan normal → onun dept'i
    else if (normal.length)       mgrSub = [];          // açan da üst yönetim → diğer atananlar belirler
    else                          mgrSub = mgr;         // herkes üst yönetim → kendi dept'leri (son çare)
  }
  const depts = [...new Set([...normal, ...mgrSub])].sort();
  return depts.length ? depts.join(',') : null;
}

// Yöneticisi DB'de tanımlı olmayan departmanlar için elle eşleme (gözlemci olarak eklenir).
// AI departmanının kendi yöneticisi yok → Görkem yönetici sayılır.
const DEPT_MANAGER_FALLBACK = { ai: 'U030C48PL23' };

// İlgili departman(lar)ın yöneticileri (yetki='yonetici' + fallback) — gözlemciye otomatik eklenir.
// Freelance işlerin kendi yöneticisi yok → işi açan kişinin (creatorId) departman yöneticisi sayılır.
async function deptManagers(client, worker_ids, creatorId) {
  if (!Array.isArray(worker_ids) || !worker_ids.length) return [];
  const dr = await client.query(
    `SELECT DISTINCT dept FROM users WHERE id = ANY($1) AND dept IS NOT NULL AND dept <> ''`, [worker_ids]);
  let depts = dr.rows.map(x => x.dept);
  if (depts.includes('freelance') && creatorId) {
    const cr = await client.query(
      `SELECT dept FROM users WHERE id=$1 AND dept IS NOT NULL AND dept <> ''`, [creatorId]);
    depts = [...new Set([...depts.filter(x => x !== 'freelance'), ...cr.rows.map(x => x.dept)])];
  } else {
    depts = depts.filter(x => x !== 'freelance');
  }
  if (!depts.length) return [];
  const r = await client.query(
    `SELECT id FROM users WHERE active AND yetki='yonetici' AND dept = ANY($1)`, [depts]);
  const ids = r.rows.map(x => x.id);
  for (const d of depts) if (DEPT_MANAGER_FALLBACK[d]) ids.push(DEPT_MANAGER_FALLBACK[d]);
  return [...new Set(ids)];
}

// ── operasyonlar ─────────────────────────────────────────────
async function createBrief(raw) {
  const d = briefCreate.parse(raw);
  // Kapasite v2 kuralı: deadline zorunlu — terminsiz iş zamana yayılmış yükte hesaplanamaz.
  if (d.deadline == null || d.deadline === '') {
    const e = new Error('termin (deadline) zorunlu — terminsiz iş açılamaz'); e.status = 400; throw e;
  }
  const result = await tx(async (client) => {
    const markaId = await brandIdByName(client, d.marka);
    // no: verilmemişse max+1
    let no = d.no;
    if (no == null) {
      const r = await client.query(`SELECT COALESCE(max(no),0)+1 AS n FROM briefs`);
      no = r.rows[0].n;
    }
    // İşi açan HER ZAMAN lead'dir (co-lead) — ayrıca seçilen lead'ler de eklenir.
    // Böylece açan, başkasını lead yapsa bile lead kalır ve silme yetkisi korunur.
    const leadIds = [...new Set([...(d.lead_ids || []), ...(d.by ? [d.by] : [])])];
    const dept = await deriveDept(client, d.worker_ids, d.by);
    // fatura-v2: retainer'lı markada yeni iş varsayılan 'kapsamda', değilse 'ek'.
    const mu = await client.query('SELECT aylik_ucret FROM brands WHERE id=$1', [markaId]);
    const ucretTipi = (mu.rows[0] && mu.rows[0].aylik_ucret != null) ? 'kapsamda' : 'ek';
    // iş tipi: formlar zorunlu tutar; API'ye tipsiz düşen (eski kuyruk, dış istemci) başlıktan
    // tahmin edilir, o da tutmazsa 'diger'. Verilen değer is_tipleri'nde olmalı (400).
    let isTipi = d.is_tipi || null;
    if (isTipi) {
      const chk = await client.query('SELECT 1 FROM is_tipleri WHERE kod=$1 AND aktif', [isTipi]);
      if (!chk.rows.length) { const e = new Error('geçersiz iş tipi: ' + isTipi); e.status = 400; throw e; }
    } else {
      isTipi = require('./is-tipi-tahmin').tahminEt(d.baslik) || 'diger';
    }
    const r = await client.query(
      `INSERT INTO briefs(no,marka_id,baslik,dept,deadline,deadline_orig,priority,akis,maliyet,satis,musteri_notu,slack_ts,slack_url,created_by,ucret_tipi,is_tipi)
       VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [no, markaId, d.baslik, dept, toTs(d.deadline), d.priority || null,
       d.akis || 'paralel', d.maliyet ?? null, d.satis ?? null, d.musteri_notu || null,
       d.slack_ts || null, null, d.by || null, ucretTipi, isTipi]);
    const id = r.rows[0].id;
    // gözlemci = manuel seçilenler ∪ ilgili dept yöneticileri (her zaman)
    // Auto-yöneticiler: zaten işi yapan/lead olanları gözlemciye ekleme (tek kişi iki listede görünmesin).
    const inWork = new Set([...d.worker_ids, ...leadIds]);
    const mgrs = (await deptManagers(client, d.worker_ids, d.by)).filter(m => !inWork.has(m));
    const observerIds = [...new Set([...(d.gozlemci_ids || []), ...mgrs])];
    await setAssignees(client, id, { worker_ids: d.worker_ids, lead_ids: leadIds, gozlemci_ids: observerIds });
    if (Array.isArray(d.tags)) for (const t of d.tags)
      await client.query(`INSERT INTO brief_tags(brief_id,tag) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, t]);
    await logEvent(client, { brief_id: id, user_id: d.by, verb: 'olusturuldu',
      detail: { marka: d.marka, baslik: d.baslik, no }, source: d.source, slack_ts: d.slack_ts });
    return { id, no };
  });

  // Bildirim reformu: yeni atanan/lead → ACİL (anlık DM hakkı). createBrief'te tüm lead+worker yenidir.
  if (NOTIFY_V2) {
    try {
      const yeniAtananlar = new Set([...(d.worker_ids || []), ...(d.lead_ids || []), ...(d.by ? [d.by] : [])]);
      const briefId = result.id;
      const bi = (await pool.query(`SELECT no, baslik, slack_url FROM briefs WHERE id=$1`, [briefId])).rows[0] || {};
      for (const uid of yeniAtananlar) if (/^U/.test(uid)) await notify(uid, { tip: 'atama', aciliyet: 'acil', text: `📌 #${bi.no} ${bi.baslik || ''} işine atandın`, link: bi.slack_url, briefId });
    } catch (e) { console.error('[writes] atama bildirimi:', e.message); }
  }

  // Slack çıkışı (b1.2) — dashboard-kökenli oluşturmalarda markanın kanalına post et.
  // Slack-kökenli (source='slack') olanlarda ECHO yapma. Best-effort: hata create'i bozmaz.
  if (d.source !== 'slack' && slack.hasToken()) {
    try {
      const leadIdsForPost = [...new Set([...(d.lead_ids || []), ...(d.by ? [d.by] : [])])];  // açan her zaman lead
      const workerIds = (d.worker_ids || []).filter(Boolean);
      // Gözlemciler (manuel + otomatik dept yöneticileri) — brief'teki HERKES mention'lansın
      const obsQ = await pool.query(
        `SELECT user_id FROM brief_assignees WHERE brief_id=$1 AND role='gozlemci'`, [result.id]);
      const observerIds = obsQ.rows.map(r => r.user_id);
      let leadName = null, contribNames = [], observerNames = [], acanName = null;
      const allIds = [...new Set([...leadIdsForPost, ...workerIds, ...observerIds, ...(d.by ? [d.by] : [])])];
      if (allIds.length) {
        const u = await pool.query('SELECT id,name FROM users WHERE id = ANY($1)', [allIds]);
        const byId = Object.fromEntries(u.rows.map(r => [r.id, r.name]));
        // Slack üyeleri <@id> mention; freelancerlar (FR*) sadece isim
        const mention = (i) => /^U/.test(i) ? `<@${i}>` : (byId[i] || i);
        leadName = leadIdsForPost.map(mention).join(', ') || null;
        contribNames = workerIds.map(mention);
        observerNames = observerIds.filter(i => !leadIdsForPost.includes(i) && !workerIds.includes(i)).map(mention);
        if (d.by) acanName = mention(d.by);
      }
      const deadlineMs = d.deadline ? (typeof d.deadline === 'number' ? d.deadline : Date.parse(d.deadline)) : null;
      const post = await slack.postBrief({ marka: d.marka, baslik: d.baslik, no: result.no,
        deadlineMs, dept: null, akis: d.akis, leadName, contribNames, observerNames, not: d.musteri_notu || null, acan: acanName });
      if (post.ok) {
        await pool.query('UPDATE briefs SET slack_ts=$1, slack_channel=$2, slack_url=$3 WHERE id=$4',
          [post.ts, post.channel, post.permalink || null, result.id]);
        await pool.query(`INSERT INTO events(brief_id,verb,detail,source) VALUES ($1,'slack:gönderildi',$2,'system')`,
          [result.id, JSON.stringify({ channel: post.channel, ts: post.ts })]);
        result.slack = { ts: post.ts, channel: post.channel, permalink: post.permalink };
        // "Yeni brief" DM'i bilinçli olarak YOK: ilk thread yanıtındaki mention'lar
        // brief'teki herkese zaten bildirim üretir — DM aynı haberin ikinci kopyasıydı.
      } else if (!post.skipped) {
        await pool.query(`INSERT INTO events(brief_id,verb,detail,source) VALUES ($1,'slack:hata',$2,'system')`,
          [result.id, JSON.stringify({ error: post.error })]);
        result.slack = { error: post.error };
      } else {
        result.slack = { skipped: post.error };
      }
    } catch (e) {
      console.error('[writes] slack post hata:', e.message);
      result.slack = { error: e.message };
    }
  }
  return result;
}

async function patchBrief(id, raw) {
  const d = briefPatch.parse(raw);
  // Rol değişikliği bildirimi için: mutasyondan ÖNCE atanan kümesini al (çıkarılanları yakalamak için).
  const roleChange = d.worker_ids !== undefined || d.lead_ids !== undefined || d.gozlemci_ids !== undefined;
  const before = roleChange ? await assigneeMap(id) : null;
  let deadlineChange = null;   // {eski,yeni,ileri} — thread notunu özelleştirmek için
  const res = await tx(async (client) => {
    const sets = [], vals = [];
    const put = (col, v) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
    if (d.marka !== undefined) put('marka_id', await brandIdByName(client, d.marka));
    if (d.baslik !== undefined) put('baslik', d.baslik);
    if (d.is_tipi !== undefined) {
      if (d.is_tipi) {
        const chk = await client.query('SELECT 1 FROM is_tipleri WHERE kod=$1 AND aktif', [d.is_tipi]);
        if (!chk.rows.length) { const e = new Error('geçersiz iş tipi: ' + d.is_tipi); e.status = 400; throw e; }
      }
      put('is_tipi', d.is_tipi);
    }
    if (d.deadline !== undefined) {
      // Uzatma takibi: eski deadline'ı al; orijinali bir kez sabitle; daha GEÇ tarihe taşıma = uzatma → ceza.
      const cur = await client.query('SELECT deadline, deadline_orig, termin_oneri_at FROM briefs WHERE id=$1', [id]);
      const oldRow = cur.rows[0] || {};
      const oldMs = oldRow.deadline ? new Date(oldRow.deadline).getTime() : null;
      const newDl = toTs(d.deadline);
      const newMs = newDl ? new Date(newDl).getTime() : null;
      const muaf = !!oldRow.termin_oneri_at;            // işe-dönüş hatırlatıcısı AÇIK → bu uzatma muaf (gecikme/ceza sayılmaz)
      if (!oldRow.deadline_orig && oldRow.deadline) put('deadline_orig', oldRow.deadline);
      put('deadline', newDl);
      if (oldMs && newMs && newMs > oldMs) {            // deadline ileri taşındı → uzatma
        if (muaf) {                                     // MUAF: ceza yok, uzatıldı rozeti tetiklenmez; izi uzatma_muaf'ta
          sets.push('uzatma_muaf = uzatma_muaf + 1');
        } else {
          const ceza = calc.bnsUzatmaCezaFromTimes(Date.now(), oldMs);
          sets.push('uzatma_sayisi = uzatma_sayisi + 1');
          vals.push(ceza); sets.push(`uzatma_ceza = GREATEST(uzatma_ceza, $${vals.length})`);
        }
      }
      // Hatırlatıcı açıkken deadline HER değiştiğinde (ileri veya geri) temizle — öne çekme muaf sayılmaz ama hatırlatıcı kapanır (O8).
      if (muaf && oldMs && newMs && newMs !== oldMs) {
        sets.push('termin_oneri_at = NULL'); sets.push('termin_oneri_ms = NULL');  // hatırlatıcı kapanır
      }
      if (oldMs && newMs && newMs !== oldMs) {          // her deadline değişimini geçmişe yaz (eski→yeni)
        const hist = JSON.stringify({ eski: oldRow.deadline, yeni: newDl, at: new Date().toISOString(), by: d.by || null, ileri: newMs > oldMs, muaf: muaf && newMs > oldMs });
        vals.push(hist); sets.push(`deadline_history = COALESCE(deadline_history,'[]'::jsonb) || $${vals.length}::jsonb`);
        deadlineChange = { eski: oldRow.deadline, yeni: newDl, ileri: newMs > oldMs, muaf: muaf && newMs > oldMs };  // thread notu için
      }
    }
    if (d.priority !== undefined) put('priority', d.priority);
    if (d.akis !== undefined) put('akis', d.akis);
    if (d.musteri_notu !== undefined) put('musteri_notu', d.musteri_notu);
    if (sets.length) {
      vals.push(id);
      const r = await client.query(`UPDATE briefs SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING id`, vals);
      if (!r.rows[0]) throw new Error('brief bulunamadı: ' + id);
    }
    await setAssignees(client, id, d);
    // işi yapanlar değiştiyse: dept yeniden türet + dept yöneticilerini gözlemciye ekle (silmeden, idempotent)
    if (d.worker_ids !== undefined) {
      const dept = await deriveDept(client, d.worker_ids, d.by);
      await client.query(`UPDATE briefs SET dept=$1 WHERE id=$2`, [dept, id]);
      // Auto-yöneticiler: briefteki herhangi bir non-gözlemci rolündeyse gözlemciye ekleme (çift listeyi önle).
      // setAssignees zaten çalıştı → brief_assignees güncel; lead dahil tüm çalışanları dışla.
      const inWorkQ = await client.query(
        `SELECT DISTINCT user_id FROM brief_assignees WHERE brief_id=$1 AND role<>'gozlemci'`, [id]);
      const inWork = new Set(inWorkQ.rows.map(r => r.user_id));
      const mgrs = (await deptManagers(client, d.worker_ids, d.by)).filter(m => !inWork.has(m));
      for (const m of mgrs) await client.query(
        `INSERT INTO brief_assignees(brief_id,user_id,role,sira) VALUES ($1,$2,'gozlemci',NULL)
         ON CONFLICT (brief_id,user_id,role) DO NOTHING`, [id, m]);
    }
    await logEvent(client, { brief_id: id, user_id: d.by, verb: 'düzenlendi',
      detail: { alanlar: Object.keys(d).filter(k => !['by', 'source', 'slack_ts'].includes(k)).map(k => FIELD_TR[k] || k) },
      source: d.source, slack_ts: d.slack_ts });
    return { id };
  });
  const fields = Object.keys(d).filter(k => !['by', 'source', 'slack_ts'].includes(k));
  const roleKeys = ['worker_ids', 'lead_ids', 'gozlemci_ids'];
  const contentChanged = fields.some(k => !roleKeys.includes(k));   // başlık/not/termin vb.
  const friendly = fields.map(k => FIELD_TR[k] || k).join(', ');
  // Rol değişimi varsa bulk DM'i kapat — notifyRoleDiff hedefli atar; thread notu her zaman düşer.
  // Mixed (içerik+rol) patch'te de aynı: çift DM'i önler, mevcut atananlar thread'den görür.
  let summary = `✏️ güncellendi: ${friendly}`;
  if (deadlineChange) {   // termin değiştiyse thread'e eski→yeni'yi açıkça yaz
    const f = (x) => { try { return new Date(x).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return '—'; } };
    const yon = deadlineChange.ileri ? (deadlineChange.muaf ? 'uzatıldı (gecikme sayılmaz)' : 'uzatıldı') : 'öne çekildi';
    const dlNote = `📅 Termin ${yon}: ${f(deadlineChange.eski)} → ${f(deadlineChange.yeni)}`;
    const other = fields.filter(k => k !== 'deadline' && !roleKeys.includes(k));
    summary = other.length ? `✏️ güncellendi: ${other.map(k => FIELD_TR[k] || k).join(', ')}\n${dlNote}` : dlNote;
  }
  let after = null;
  if (roleChange) {
    // Thread notuna mention'lı ekleme/çıkarma satırı — dashboard'dan eklenen kişi
    // Slack thread'inde @mention ile görünür ve mention sayesinde bildirim alır.
    after = await assigneeMap(id);
    const diff = roleDiffNote(before, after);
    if (diff) summary += `\n${diff}`;
  }
  await reflectChange(id, summary, d.source, { dm: contentChanged && !roleChange, by: d.by });
  // Rol eklenen/çıkarılan/değişen kişilere hedefli DM (çıkarılanlar dahil).
  if (roleChange && after) await notifyRoleDiff(id, before, after, d.source);
  // Bildirim reformu: yeni atanan/lead → ACİL (anlık DM hakkı). patchBrief'te sadece FARK (önce yoktu, şimdi var).
  if (NOTIFY_V2 && roleChange && after) {
    try {
      const wasAssignee = (uid) => {   // önce contributor/lead miydi?
        const roles = before && before.get(uid);
        return !!(roles && (roles.has('contributor') || roles.has('lead')));
      };
      const yeniAtananlar = new Set();
      for (const [uid, roles] of after) {
        if ((roles.has('contributor') || roles.has('lead')) && !wasAssignee(uid)) yeniAtananlar.add(uid);
      }
      if (yeniAtananlar.size) {
        const bi = (await pool.query(`SELECT no, baslik, slack_url FROM briefs WHERE id=$1`, [id])).rows[0] || {};
        for (const uid of yeniAtananlar) if (/^U/.test(uid)) await notify(uid, { tip: 'atama', aciliyet: 'acil', text: `📌 #${bi.no} ${bi.baslik || ''} işine atandın`, link: bi.slack_url, briefId: id });
      }
    } catch (e) { console.error('[writes] atama bildirimi:', e.message); }
  }
  return res;
}

// before/after assigneeMap'ten thread'e yazılacak mention'lı diff satırı üretir.
// Ör: "➕ gözlemci: <@U123> · ➕ işi yapan: <@U456> · ➖ <@U789>"
function roleDiffNote(before, after) {
  if (!before || !after) return '';
  const rolesStr = (set) => [...set].map(x => ROLE_TR[x] || x).join(' + ');
  const parts = [];
  const users = new Set([...before.keys(), ...after.keys()]);
  for (const uid of users) {
    const was = before.get(uid), now = after.get(uid);
    if (!was && now)        parts.push(`➕ ${rolesStr(now)}: <@${uid}>`);
    else if (was && !now)   parts.push(`➖ <@${uid}>`);
    else if (was && now && [...was].sort().join() !== [...now].sort().join())
                            parts.push(`🔄 <@${uid}> → ${rolesStr(now)}`);
  }
  return parts.join(' · ');
}

// Sıralı onay zinciri yalnızca bu tarihten SONRA açılan brieflerde işler —
// devam eden işlerin davranışı geriye dönük değişmesin (kanal-özet EPOCH deseniyle aynı).
const ZINCIR_EPOCH = Date.parse('2026-06-11T16:00:00+03:00');

// Brief'in zincir bağlamı: akış tipi + sıralı halkalar (contributor'lar, sira sıralı, onay durumlu).
async function zincirCtx(client, id) {
  const r = await client.query(
    `SELECT b.akis, b.created_at, b.completed_at,
       COALESCE((SELECT json_agg(json_build_object(
           'user_id', a.user_id, 'sira', a.sira, 'onay_at', a.onay_at, 'name', u.name, 'dept', u.dept)
           ORDER BY a.sira NULLS LAST)
         FROM brief_assignees a JOIN users u ON u.id = a.user_id
         WHERE a.brief_id = b.id AND a.role = 'contributor'), '[]'::json) AS halkalar
     FROM briefs b WHERE b.id = $1`, [id]);
  const b = r.rows[0];
  if (!b) return null;
  const halkalar = b.halkalar || [];
  const zincirli = b.akis === 'sirali' && halkalar.length > 1
    && new Date(b.created_at).getTime() >= ZINCIR_EPOCH;
  return { ...b, halkalar, zincirli };
}

async function setStatus(id, raw, _depth = 0) {
  const d = statusBody.parse(raw);
  let zincirNote = null, dmNext = null, resumeMs = null;   // resumeMs: işe-dönüş hatırlatıcısı için bekleme süresi
  const res = await tx(async (client) => {
    const ctx = await zincirCtx(client, id);
    if (!ctx) throw new Error('brief bulunamadı: ' + id);
    const prevRow = await client.query('SELECT durum FROM briefs WHERE id=$1', [id]);
    const prevDurum = prevRow.rows[0] && prevRow.rows[0].durum;
    // Idempotency: aynı Slack olayı (slack_ts) daha önce durum değiştirmişse tekrar uygulama
    // (kuyruk replay'inde sayaç/zincir mükerrer ilerlemesini önler)
    if (d.slack_ts) {
      const dup = await client.query(
        `SELECT 1 FROM events WHERE slack_ts = $1 AND verb LIKE 'durum:%' LIMIT 1`, [d.slack_ts]);
      if (dup.rows.length) {
        const cur = await client.query(
          'SELECT id, durum, rev_ic, rev_musteri, gonderim_sayisi, musteri_bekliyor FROM briefs WHERE id=$1', [id]);
        return cur.rows[0] || null;
      }
    }
    let durum = d.durum;

    // ── Sıralı onay zinciri (akis='sirali', 2+ işi yapan) ──
    // ✅ aktif halkayı onaylar; halkalar bitmeden iş tamamlanmaz. Son halka işi kapatır.
    if (ctx.zincirli && durum === 'tamamlandi') {
      const aktif = ctx.halkalar.find(h => !h.onay_at);
      if (aktif) {
        await client.query(
          `UPDATE brief_assignees SET onay_at = now(), onay_by = $1
           WHERE brief_id = $2 AND user_id = $3 AND role = 'contributor'`,
          [d.by || null, id, aktif.user_id]);
        const kalan = ctx.halkalar.filter(h => !h.onay_at && h.user_id !== aktif.user_id);
        const onayli = ctx.halkalar.length - kalan.length;
        const vekil = d.by && d.by !== aktif.user_id ? ' _(vekâleten)_' : '';
        if (kalan.length) {
          // ara halka: iş kapanmaz, sıradaki halkaya geçer; cevapsız uyarısı yeni halka için yeniden işler
          durum = 'yeni';
          const next = kalan[0];
          dmNext = next.user_id;
          zincirNote = `⛓️ *${aktif.name}* halkası onaylandı${vekil} (${onayli}/${ctx.halkalar.length}) — sıradaki: *${next.name}*`;
          await client.query(`UPDATE briefs SET uyari_at = NULL, uyari2_at = NULL WHERE id = $1`, [id]);
        } else {
          zincirNote = `⛓️ son halka *${aktif.name}* onaylandı${vekil} — zincir tamamlandı, iş müşteriye teslim edildi. 📦`;
        }
      }
    }

    // ✏️ zincirde geri sarar: hedef verilmişse (revize: @kişi) o halkaya, yoksa son onaylı halkaya.
    // Hedef ve sonrasındaki tüm onaylar düşer — iş o halkadan yeniden akar.
    if (ctx.zincirli && durum === 'revizyon') {
      const onaylilar = ctx.halkalar.filter(h => h.onay_at);
      let hedef = d.hedef ? ctx.halkalar.find(h => h.user_id === d.hedef) || null : null;
      if (!hedef && onaylilar.length) hedef = onaylilar[onaylilar.length - 1];
      if (hedef) {
        await client.query(
          `UPDATE brief_assignees SET onay_at = NULL, onay_by = NULL
           WHERE brief_id = $1 AND role = 'contributor'
             AND COALESCE(sira, 999999) >= COALESCE($2::int, 999999)`,
          [id, hedef.sira]);
        zincirNote = `↩️ zincir *${hedef.name}* halkasına geri sarıldı — o halka ve sonrası yeniden onay bekliyor.`;
      }
    }

    // 🔃 tamamlanmış zincirli iş yeniden açılırsa son halkanın onayı düşer (oradan devam eder)
    if (ctx.zincirli && durum === 'calisiliyor' && ctx.completed_at) {
      const onaylilar = ctx.halkalar.filter(h => h.onay_at);
      const son = onaylilar[onaylilar.length - 1];
      if (son) {
        await client.query(
          `UPDATE brief_assignees SET onay_at = NULL, onay_by = NULL
           WHERE brief_id = $1 AND user_id = $2 AND role = 'contributor'`, [id, son.user_id]);
        zincirNote = `🔃 yeniden açıldı — zincir *${son.name}* halkasından devam eder.`;
      }
    }

    const completed = durum === 'tamamlandi';
    // Müşteri onayı akışı (✈️):
    //  - musteride → gönderim sayacı +1, son_gonderim_at, "müşteri dönüşü bekleniyor" bayrağı AÇIK
    //  - revizyon  → bayrak AÇIKSA müşteri revizyonu, KAPALIYSA iç revizyon; bayrak kapanır
    //  Kural: "✈️'dan sonraki İLK ✏️ müşteri revizyonudur; gerisi içtir."
    const r = await client.query(
      `UPDATE briefs SET durum=$1,
         completed_at = CASE WHEN $2 THEN COALESCE(completed_at, now()) ELSE NULL END,
         started_at   = CASE WHEN $1='calisiliyor' THEN COALESCE(started_at, now()) ELSE started_at END,
         basladi_at   = CASE WHEN $1='basladi' THEN COALESCE(basladi_at, now()) ELSE basladi_at END,
         gonderim_sayisi = gonderim_sayisi + CASE WHEN $1='musteride' THEN 1 ELSE 0 END,
         son_gonderim_at = CASE WHEN $1='musteride' THEN now() ELSE son_gonderim_at END,
         rev_musteri = rev_musteri + CASE WHEN $1='revizyon' AND musteri_bekliyor     THEN 1 ELSE 0 END,
         rev_ic      = rev_ic      + CASE WHEN $1='revizyon' AND NOT musteri_bekliyor THEN 1 ELSE 0 END,
         rev         = COALESCE(rev,0) + CASE WHEN $1='revizyon' THEN 1 ELSE 0 END,
         musteri_bekliyor = CASE WHEN $1='musteride' THEN true
                                 WHEN $1='revizyon'  THEN false
                                 ELSE musteri_bekliyor END
       WHERE id=$3 RETURNING id, durum, rev_ic, rev_musteri, gonderim_sayisi, musteri_bekliyor`,
      [durum, completed, id]);
    if (!r.rows[0]) throw new Error('brief bulunamadı: ' + id);
    await logEvent(client, { brief_id: id, user_id: d.by, verb: 'durum:' + durum,
      detail: { durum, istenen: d.durum, hedef: d.hedef }, source: d.source, slack_ts: d.slack_ts });
    // İşe dönüş hatırlatıcısı: beklemede/müşteride → aktif (tamamlanma değil) ise termin uzatma öner.
    const RESUME_ACTIVE = ['basladi', 'calisiliyor', 'incelemede', 'revizyon'];
    if (['beklemede', 'musteride'].includes(prevDurum) && RESUME_ACTIVE.includes(durum)) {
      const pe = await client.query(
        `SELECT EXTRACT(EPOCH FROM max(ts)) * 1000 AS ts FROM events
         WHERE brief_id=$1 AND verb IN ('durum:beklemede','durum:musteride')`, [id]);
      const ps = pe.rows[0] && pe.rows[0].ts ? Math.round(+pe.rows[0].ts) : null;
      const beklemeMs = ps ? Math.max(0, Date.now() - ps) : 0;
      // ms=0 kilidi: bekleme süresi 0/falsy ise hatırlatıcıyı HİÇ açma — "açık ama çalışmaz" durumu oluşmasın (O6).
      if (beklemeMs > 0) {
        resumeMs = beklemeMs;
        await client.query('UPDATE briefs SET termin_oneri_at = now(), termin_oneri_ms = $2 WHERE id=$1', [id, resumeMs]);
      }
    } else if (['tamamlandi', 'beklemede', 'musteride'].includes(durum)) {
      await client.query('UPDATE briefs SET termin_oneri_at = NULL, termin_oneri_ms = NULL WHERE id=$1', [id]);
    }
    return r.rows[0];
  });
  // Thread notu — müşteri akışına özel, anlaşılır metinler
  let note;
  if (d.durum === 'musteride') {
    note = `✈️ *müşteriye yollandı* — müşteri dönüşü bekleniyor (${res.gonderim_sayisi}. gönderim). Dönüşteki ilk ✏️ müşteri revizyonu sayılır.`;
  } else if (d.durum === 'revizyon') {
    note = `✏️ revizyon kaydedildi — iç: *${res.rev_ic}* · müşteri: *${res.rev_musteri}*`;
    if (zincirNote) note += `\n${zincirNote}`;
  } else if (zincirNote) {
    note = zincirNote;
  } else if (d.source === 'system' && d.durum === 'basladi') {
    // Otomatik kuyruk ilerlemesi — insan imzası yok, Ody imzalı (yanıltıcı atıf düzeltmesi).
    note = `🤖 *Ody:* önceki işin kapandı — sıradaki işin otomatik başlatıldı (kuyruk ilerlemesi).`;
  } else {
    note = `🔄 durum güncellendi: *${d.durum}*`;
  }
  if (resumeMs != null) {
    const saat = Math.round(resumeMs / 3600000);
    note += `\n↩️ *İşe geri dönüldü* — ${saat > 0 ? saat + ' saat' : 'bir süre'} beklemede/müşterideydi. Termini uzatman gerekiyorsa thread'e \`termin uzat\` yaz (bekleme kadar uzatır) ya da \`termin 15.06 17:00\` ile tarih ver; bu uzatma **gecikme sayılmaz**. (Dashboard'da da tek tıkla var.)`;
  }
  await reflectChange(id, note, d.source, { by: d.by });
  // Finans dürtüsü: tamamlanan EK işte maliyet+satış boşsa thread'e hatırlat (best-effort).
  // fatura-v2: retainer kapsamındaki işler ayrıca faturalanmaz → dürtü SUSAR.
  if (d.durum === 'tamamlandi') {
    try {
      const fb = (await pool.query(
        `SELECT b.no, b.maliyet, b.satis, b.ucret_tipi, br.aylik_ucret, b.slack_channel, b.slack_ts
         FROM briefs b LEFT JOIN brands br ON br.id = b.marka_id WHERE b.id=$1`, [id])).rows[0];
      const ekIs = fb && (fb.ucret_tipi === 'ek' || (fb.ucret_tipi == null && fb.aylik_ucret == null));
      if (ekIs && fb.maliyet == null && fb.satis == null) {
        await slack.postThread({ channel: fb.slack_channel, thread_ts: fb.slack_ts,
          text: `💰 #${fb.no} tamamlandı — maliyet/satış girilmedi (ek iş). Dashboard → iş → Finans, ya da \`/maliyet ${fb.no}\`` });
      }
    } catch (e) { console.error('[setStatus] finans dürtüsü:', e.message); }
  }
  // Dashboard çanı: işe dönüş hatırlatıcısını atananlara da düşür (brief açmadan görsün).
  if (resumeMs != null) {
    try {
      const a = await pool.query(
        `SELECT DISTINCT a.user_id FROM brief_assignees a WHERE a.brief_id=$1 AND a.role IN ('contributor','lead')`, [id]);
      const b = await pool.query(`SELECT no, baslik, slack_url FROM briefs WHERE id=$1`, [id]);
      const bi = b.rows[0] || {};
      const txt = `↩️ #${bi.no} ${bi.baslik || ''} işine geri dönüldü — termin uzatmak ister misin? (uzatma gecikme sayılmaz)`;
      for (const row of a.rows) {
        if (!row.user_id) continue;
        // V2: notify()'a bağla (tip 'musteri', brief_id etiketli → iş rozeti + dijest); flag kapalıyken eski ham insert.
        if (NOTIFY_V2) await notify(row.user_id, { tip: 'musteri', aciliyet: 'normal', text: txt, link: bi.slack_url || null, briefId: id });
        else await pool.query('INSERT INTO notifications (user_id, text, link) VALUES ($1,$2,$3)', [row.user_id, txt, bi.slack_url || null]);
      }
    } catch (e) { console.error('[setStatus] işe-dönüş bildirimi:', e.message); }
  }
  // Zincir el değişimi: sıradaki halkaya DM (best-effort)
  if (dmNext && slack.hasToken()) {
    try {
      const r = await pool.query(
        `SELECT b.no, b.baslik, b.slack_url, br.name AS marka
         FROM briefs b LEFT JOIN brands br ON br.id = b.marka_id WHERE b.id=$1`, [id]);
      const b = r.rows[0];
      if (b) await slack.dm(dmNext,
        `⏭️ *#${b.no} ${b.marka || ''} — ${b.baslik}* zincirinde sıra sende: önceki halka onaylandı.\n` +
        `İşi planına almak için thread'e emoji bırak (🎨/✍️/🤖)${b.slack_url && b.slack_url !== '#' ? ` — <${b.slack_url}|thread'i aç>` : ''}.`);
    } catch (e) { console.error('[writes] zincir DM hata:', e.message); }
  }
  // Otomatik ilerleme: bu brief tamamlandi/musteride olduysa, onu aktif işi yapan
  // contributor'lar için sıradaki kuyruk işini aktive et. source:'system' → echo/loop koruması.
  // Depth-cap: birbirine referanslı kuyruklarda sonsuz/aşırı özyineleme koruması (source:'system' echo koruması + zincir derinliği ≤ 3).
  if ((d.durum === 'tamamlandi' || d.durum === 'musteride') && d.source !== 'system' && _depth < 3) {
    const cont = await pool.query(
      `SELECT user_id FROM brief_assignees WHERE brief_id=$1 AND role='contributor'`, [id]);
    for (const row of cont.rows) {
      const nextId = await (async () => { const c = await pool.connect(); try { return await userActiveBriefId(c, row.user_id); } finally { c.release(); } })();
      if (nextId && nextId !== id) {
        const nb = await pool.query('SELECT durum FROM briefs WHERE id=$1', [nextId]);
        // Yalnız iş planındaki (calisiliyor) ve beklemedeki kuyruk-başı otomatik başlatılır.
        // yeni (henüz kabul edilmemiş), revizyon/incelemede/blokeli/basladi DOKUNULMAZ —
        // eski activateTarget kuralı revizyonu/blokeyi eziyordu (#188/#189 vakası).
        if (nb.rows[0] && ['calisiliyor', 'beklemede'].includes(nb.rows[0].durum)) {
          await setStatus(nextId, { durum: 'basladi', by: null, source: 'system' }, _depth + 1);
        }
      }
    }
  }
  return res;
}

// ── Kişisel iş kuyruğu ───────────────────────────────────────
// Bir kullanıcının AKTİF brief'i = contributor olduğu, durumu kuyruk-uygun (tamamlandi/musteride
// DEĞİL) briefler içinde en küçük kisi_sira'lı olan. Yoksa null.
async function userActiveBriefId(client, uid) {
  const r = await client.query(
    `SELECT b.id FROM brief_assignees a JOIN briefs b ON b.id = a.brief_id
     WHERE a.user_id = $1 AND a.role = 'contributor' AND b.deleted_at IS NULL
       AND b.durum NOT IN ('tamamlandi','musteride')
     ORDER BY a.kisi_sira NULLS LAST, b.id LIMIT 1`, [uid]);
  return r.rows[0] ? r.rows[0].id : null;
}

// briefId, exceptUid DIŞINDA bir contributor için aktif (kuyruk başı) mı?
async function briefHasOtherActive(client, briefId, exceptUid) {
  const r = await client.query(
    `SELECT a.user_id FROM brief_assignees a
     WHERE a.brief_id = $1 AND a.role = 'contributor' AND a.user_id <> $2`, [briefId, exceptUid]);
  for (const row of r.rows) {
    if (await userActiveBriefId(client, row.user_id) === briefId) return true;
  }
  return false;
}


// Bir kullanıcının kuyruğunu yeniden sırala + aktif/demote hesapla.
// order: briefId dizisi (yalnız uid'in contributor olduğu işler dikkate alınır). by: işlemi yapan.
async function setQueue(uid, raw) {
  const order = Array.isArray(raw.order) ? raw.order.map(Number).filter(Boolean) : [];
  const by = raw.by || null;
  const { oldActive, newActive } = await tx(async (client) => {
    const owned = await client.query(
      `SELECT a.brief_id FROM brief_assignees a JOIN briefs b ON b.id = a.brief_id
       WHERE a.user_id = $1 AND a.role = 'contributor' AND b.deleted_at IS NULL`, [uid]);
    const ownedIds = new Set(owned.rows.map(r => r.brief_id));
    const oldActive = await userActiveBriefId(client, uid);
    let i = 0;
    for (const bid of order) {
      if (!ownedIds.has(bid)) continue;
      await client.query(
        `UPDATE brief_assignees SET kisi_sira = $1 WHERE user_id = $2 AND brief_id = $3 AND role = 'contributor'`,
        [i++, uid, bid]);
    }
    const newActive = await userActiveBriefId(client, uid);
    return { oldActive, newActive };
  });
  // kişi_sira commit'i ile durum geçişleri AYRI tx'lerde (setStatus kendi tx+reflectChange'ini yönetir).
  // Geçiş başarısız olursa sıra yine de kaydedildi; durum bir sonraki sıralamada userActiveBriefId'den
  // yeniden hesaplanır (self-heal). Bu yüzden geçiş hatasını loglayıp yutuyoruz, sıralamayı 400'e çevirmiyoruz.
  try {
    // Kuyruk başı = "işe başlandı": ön-çalışma durumundaysa (yeni/calisiliyor/beklemede) başlandı yap.
    // Aktif DEĞİŞMESE bile çalışır — iş zaten en üstte ama beklemede ise sürükleyince başlandı olsun.
    // incelemede/revizyon/blokeli gibi bilinçli durumlara dokunma (yalnız sıralama yüzünden geri almayalım).
    if (newActive) {
      const cur = await pool.query('SELECT durum FROM briefs WHERE id=$1', [newActive]);
      const d = cur.rows[0] && cur.rows[0].durum;
      // Kuyruk başı = aktif çalışılan iş → başlandı (yeni/iş-planında/beklemede/revizyon/blokeli).
      // 'basladi' zaten doğru; 'incelemede' ve 'musteride' bilinçli devir durumları → dokunma.
      if (d && !['basladi', 'incelemede', 'musteride'].includes(d)) {
        await setStatus(newActive, { durum: 'basladi', by, source: 'dashboard' });
      }
    }
    // Aktif değişti → önceki başlandı işi, başka aktif contributor yoksa beklemeye çek.
    if (oldActive && oldActive !== newActive) {
      const o = await pool.query('SELECT durum FROM briefs WHERE id=$1', [oldActive]);
      if (o.rows[0] && o.rows[0].durum === 'basladi') {
        const hasOther = await (async () => { const c = await pool.connect(); try { return await briefHasOtherActive(c, oldActive, uid); } finally { c.release(); } })();
        if (!hasOther) await setStatus(oldActive, { durum: 'beklemede', by, source: 'system' });
      }
    }
  } catch (e) {
    console.error('[setQueue] durum geçişi başarısız (sıra kaydedildi, self-heal):', e.message);
  }
  return { ok: true, oldActive, newActive };
}

// ── Kanban kolon içi iş-sırası ───────────────────────────────────────────────
// Bir kolondaki (durum) brief'leri verilen order'a göre sıralar: her brief'in TÜM
// contributor'larına pozisyonu kisi_sira olarak yazar → profil kuyruğuna da yansır.
// actor.scope: 'all' → her brief; '<dept>' → yalnız o departmanı içeren brief'ler; yoksa hiçbiri.
async function briefInScope(client, briefId, scope) {
  if (scope === 'all') return true;
  if (!scope) return false;
  const r = await client.query(
    `SELECT 1 FROM briefs b
       LEFT JOIN brief_assignees a ON a.brief_id = b.id
       LEFT JOIN users u ON u.id = a.user_id
      WHERE b.id = $1 AND (b.dept = $2 OR u.dept = $2) LIMIT 1`, [briefId, scope]);
  return !!r.rows[0];
}
// Bir kullanıcının kuyruk-başını başladı'ya çek + eski başladı işini (başka aktif yoksa) beklemeye al.
// kisi_sira değiştiren her yol (setQueue/setKanbanOrder) bunu çağırarak "kuyruk başı = başladı" tutarlılığını korur.
async function reconcileUserHead(uid, by) {
  try {
    const head = await (async () => { const c = await pool.connect(); try { return await userActiveBriefId(c, uid); } finally { c.release(); } })();
    if (head) {
      const cur = await pool.query('SELECT durum FROM briefs WHERE id=$1', [head]);
      const d = cur.rows[0] && cur.rows[0].durum;
      if (d && !['basladi', 'incelemede', 'musteride'].includes(d)) {
        await setStatus(head, { durum: 'basladi', by, source: 'dashboard' });
      }
    }
    // Bu kullanıcının başka başladı işleri: kuyruk başı değilse ve başka aktif contributor yoksa beklemeye.
    const others = await pool.query(
      `SELECT b.id FROM brief_assignees a JOIN briefs b ON b.id=a.brief_id
       WHERE a.user_id=$1 AND a.role='contributor' AND b.deleted_at IS NULL AND b.durum='basladi' AND b.id<>$2`,
      [uid, head || 0]);
    for (const row of others.rows) {
      const hasOther = await (async () => { const c = await pool.connect(); try { return await briefHasOtherActive(c, row.id, uid); } finally { c.release(); } })();
      if (!hasOther) await setStatus(row.id, { durum: 'beklemede', by, source: 'system' });
    }
  } catch (e) {
    console.error('[reconcileUserHead] hata (sıra kaydedildi, self-heal):', e.message);
  }
}

async function setKanbanOrder(rawOrder, actor) {
  const ids = (Array.isArray(rawOrder) ? rawOrder : []).map(Number).filter(Boolean);
  const scope = actor && actor.scope;
  const affected = new Set();
  await tx(async (client) => {
    let pos = 0;
    for (const bid of ids) {
      if (!(await briefInScope(client, bid, scope))) continue;
      const c = await client.query(
        `UPDATE brief_assignees SET kisi_sira = $1 WHERE brief_id = $2 AND role = 'contributor' RETURNING user_id`,
        [pos, bid]);
      c.rows.forEach(r => affected.add(r.user_id));
      pos++;
    }
  });
  // kisi_sira commit'inden sonra: etkilenen her kişinin kuyruk-başını başladı'ya reconcile et (ayrı tx).
  for (const uid of affected) await reconcileUserHead(uid, actor && actor.id);
  return { ok: true };
}

// ── Fatura v2: retainer (aylık sabit ücret) ─────────────────────────────────
// Tutar set edilirken GEÇİŞ TETİĞİ çalışır: markanın tipsiz (NULL) işleri 'kapsamda' olur.
async function setBrandRetainer(name, aylikUcret) {
  return tx(async (client) => {
    const markaId = await brandIdByName(client, name);
    await client.query('UPDATE brands SET aylik_ucret=$2 WHERE id=$1', [markaId, aylikUcret]);
    let gecis = 0;
    if (aylikUcret != null) {
      const g = await client.query(
        `UPDATE briefs SET ucret_tipi='kapsamda' WHERE marka_id=$1 AND ucret_tipi IS NULL`, [markaId]);
      gecis = g.rowCount;
    }
    return { ok: true, marka: name, aylik_ucret: aylikUcret, kapsamda_isaretlenen: gecis };
  });
}
// Ay×marka retainer fatura/ödeme kaydı (upsert). tutar verilmemişse markanın güncel aylık ücreti.
async function upsertMarkaFaturaAy(name, ay, patch) {
  if (!/^\d{4}-\d{2}$/.test(String(ay || ''))) { const e = new Error("ay 'YYYY-MM' olmalı"); e.status = 400; throw e; }
  return tx(async (client) => {
    const markaId = await brandIdByName(client, name);
    const mu = await client.query('SELECT aylik_ucret FROM brands WHERE id=$1', [markaId]);
    const tutar = patch.tutar != null ? patch.tutar : (mu.rows[0] ? mu.rows[0].aylik_ucret : null);
    const r = await client.query(
      `INSERT INTO marka_fatura (marka_id, ay, tutar, fatura, odeme)
       VALUES ($1,$2,$3,COALESCE($4,false),COALESCE($5,false))
       ON CONFLICT (marka_id, ay) DO UPDATE SET
         tutar = COALESCE($3, marka_fatura.tutar),
         fatura = COALESCE($4, marka_fatura.fatura),
         odeme  = COALESCE($5, marka_fatura.odeme)
       RETURNING ay, tutar, fatura, odeme`,
      [markaId, ay, tutar, patch.fatura ?? null, patch.odeme ?? null]);
    return { ok: true, marka: name, ...r.rows[0] };
  });
}

async function setFinancials(id, raw) {
  const d = financialsBody.parse(raw);
  const res = await tx(async (client) => {
    const sets = [], vals = [];
    const put = (c, v) => { vals.push(v); sets.push(`${c}=$${vals.length}`); };
    if (d.maliyet !== undefined) put('maliyet', d.maliyet);
    if (d.satis !== undefined) put('satis', d.satis);
    if (d.fatura !== undefined) put('fatura', d.fatura);
    if (d.odeme !== undefined) put('odeme', d.odeme);
    if (d.ucret_tipi !== undefined) put('ucret_tipi', d.ucret_tipi);
    vals.push(id);
    const r = await client.query(`UPDATE briefs SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING id`, vals);
    if (!r.rows[0]) throw new Error('brief bulunamadı: ' + id);
    await logEvent(client, { brief_id: id, user_id: d.by, verb: 'finans',
      detail: { maliyet: d.maliyet, satis: d.satis, fatura: d.fatura, odeme: d.odeme },
      source: d.source, slack_ts: d.slack_ts });
    return { id };
  });
  const fin = ['maliyet', 'satis', 'fatura', 'odeme'].filter(k => d[k] !== undefined).join(', ');
  // Thread'den girilen finansalda bot zaten detaylı onay yanıtı atıyor → notu atla (çift mesaj olmasın).
  await reflectChange(id, `💰 finans güncellendi (${fin})`, d.source, { thread: d.source !== 'slack', by: d.by });
  return res;
}

// Brief'i alternatif tanımlayıcılarla çöz (Slack tarafı no/slack_ts bilir, DB id bilmez).
async function noToId(no) {
  const r = await pool.query('SELECT id FROM briefs WHERE no=$1', [no]);
  if (!r.rows[0]) throw new Error('brief bulunamadı (no): ' + no);
  return r.rows[0].id;
}
async function tsToId(ts) {
  const r = await pool.query('SELECT id FROM briefs WHERE slack_ts=$1', [ts]);
  if (!r.rows[0]) throw new Error('brief bulunamadı (slack_ts): ' + ts);
  return r.rows[0].id;
}

// b2 — değişikliği Slack thread'ine yansıt + (opts.dm!==false ise) ilgili kişilere DM.
// Best-effort, echo-korumalı: Slack-kökenli değişiklikte DM atılmaz (yapan zaten orada)
// ama thread notu DÜŞER — emoji/kelime koyanın işlemin alındığını görmesi için.
// Rol-only değişimlerde DM'i notifyRoleDiff yapar → opts.dm=false ile çift DM önlenir.
// opts.thread=false → hiçbir şey yapma (ör. thread finansalında bot kendi onayını atıyor).
async function reflectChange(briefId, summary, source, opts) {
  if (!slack.hasToken()) return;
  if (opts && opts.thread === false) return;
  const dmAll = source !== 'slack' && (!opts || opts.dm !== false);
  try {
    const r = await pool.query(
      `SELECT b.slack_ts, b.slack_channel, b.no, br.name AS marka
       FROM briefs b LEFT JOIN brands br ON br.id = b.marka_id WHERE b.id=$1`, [briefId]);
    const b = r.rows[0]; if (!b) return;
    // Güncellemeyi yapan kişi (dashboard veya Slack farketmez) — notun sonuna eklenir.
    let byName = '';
    const byId = opts && opts.by;
    if (byId) {
      try {
        const ur = await pool.query(`SELECT name FROM users WHERE id=$1`, [byId]);
        const nm = ur.rows[0] && ur.rows[0].name;
        if (nm && nm !== byId) byName = `  ·  👤 ${nm}`;
      } catch (e) {}
    }
    // Çok satırlı özetlerde isim İLK satırın sonuna gelir (rol satırları altta kalır).
    const [ozet1, ...ozetRest] = String(summary).split('\n');
    const text = `*#${b.no} ${b.marka || ''}* — ${ozet1}${byName}${ozetRest.length ? '\n' + ozetRest.join('\n') : ''}`;
    let replyTs = null;   // thread'e düşen notun ts'i — bildirim tam o mesaja gitsin
    if (b.slack_ts && b.slack_channel) {
      const tr = await slack.postThread({ channel: b.slack_channel, thread_ts: b.slack_ts, text });
      if (tr && tr.ok) replyTs = tr.ts;
    }
    if (!dmAll) return;
    // Bildirim linki: thread içindeki İLGİLİ mesaj (p{replyTs}); not atılamadıysa thread kökü.
    const ws = process.env.BNS_SLACK_WORKSPACE || 'benseno';
    const msgTs = replyTs || b.slack_ts;
    const threadLink = (b.slack_ts && b.slack_channel)
      ? `https://${ws}.slack.com/archives/${b.slack_channel}/p${String(msgTs).replace('.', '')}?thread_ts=${b.slack_ts}&cid=${b.slack_channel}`
      : null;
    // DM YOK: thread notu zaten takipçilere Slack bildirimi üretiyor (çift bildirim önlenir).
    // Dashboard çanı beslenmeye devam etsin diye yalnız notifications tablosuna yazılır.
    const u = await pool.query(`SELECT DISTINCT user_id FROM brief_assignees WHERE brief_id=$1`, [briefId]);
    for (const row of u.rows) {
      if (!/^U/.test(row.user_id || '')) continue;
      if (NOTIFY_V2) await notify(row.user_id, { tip: 'statu', aciliyet: 'normal', text, link: threadLink, briefId });
      else await slack.logNotification(row.user_id, text, threadLink);
    }
  } catch (e) { console.error('[writes] reflect hata:', e.message); }
}

const ROLE_TR = { contributor: 'işi yapan', lead: 'lead', gozlemci: 'gözlemci' };
// Kullanıcıya gösterilen alan adları (ham anahtar yerine — DM/thread sızıntısını önler).
const FIELD_TR = { marka: 'marka', baslik: 'başlık', deadline: 'termin', priority: 'öncelik',
  akis: 'akış', musteri_notu: 'müşteri notu', worker_ids: 'işi yapanlar', lead_ids: 'lead', gozlemci_ids: 'gözlemciler' };

// brief_assignees → Map(user_id → Set(role))
async function assigneeMap(briefId) {
  const r = await pool.query(`SELECT user_id, role FROM brief_assignees WHERE brief_id=$1 AND user_id IS NOT NULL`, [briefId]);
  const m = new Map();
  for (const row of r.rows) { if (!m.has(row.user_id)) m.set(row.user_id, new Set()); m.get(row.user_id).add(row.role); }
  return m;
}

// Rol değişimini (eklenen/çıkarılan/rolü değişen) ilgili kişilere DM'le. Echo-korumalı (slack hariç).
async function notifyRoleDiff(briefId, before, after, source) {
  if (source === 'slack' || !slack.hasToken() || !before) return;
  try {
    const r = await pool.query(
      `SELECT b.no, b.slack_url, br.name AS marka, b.baslik FROM briefs b LEFT JOIN brands br ON br.id=b.marka_id WHERE b.id=$1`, [briefId]);
    const b = r.rows[0]; if (!b) return;
    const head = `*#${b.no} ${b.marka || ''}* — ${b.baslik || ''}`;
    const link = b.slack_url && b.slack_url !== '#' ? `\n${b.slack_url}` : '';
    const rolesStr = (set) => [...set].map(x => ROLE_TR[x] || x).join(' + ');
    const users = new Set([...before.keys(), ...after.keys()]);
    for (const uid of users) {
      const was = before.get(uid), now = after.get(uid);
      const notifLink = b.slack_url && b.slack_url !== '#' ? b.slack_url : null;
      if (!was && now)        await slack.dm(uid, `➕ ${head}\nBu briefe *${rolesStr(now)}* olarak eklendin.${link}`, notifLink);
      else if (was && !now)   await slack.dm(uid, `➖ ${head}\nBu briefteki görevden çıkarıldın.`, notifLink);
      else if (was && now && [...was].sort().join() !== [...now].sort().join())
                              await slack.dm(uid, `🔄 ${head}\nRolün güncellendi: *${rolesStr(now)}*.${link}`, notifLink);
    }
  } catch (e) { console.error('[writes] rol diff DM hata:', e.message); }
}

// Soft delete — brief'i gizle (kalıcı silme yok)
async function deleteBrief(id, by) {
  const r = await pool.query(
    `UPDATE briefs SET deleted_at=NOW(), deleted_by=$1 WHERE id=$2 AND deleted_at IS NULL
     RETURNING id, no, slack_ts, slack_channel`,
    [by || null, id]
  );
  if (!r.rows[0]) throw new Error('brief bulunamadı veya zaten silindi: ' + id);
  await pool.query(
    `INSERT INTO events(brief_id, user_id, verb, detail, source)
     VALUES ($1, (SELECT id FROM users WHERE id=$2 LIMIT 1), 'silindi', '{}', 'slack')`,
    [id, by || null]
  );
  // Thread'e silindi notu — thread'in kendisi silindiyse (slack:deleted) hedef mesaj yok, atla.
  const b = r.rows[0];
  if (by !== 'slack:deleted' && b.slack_ts && b.slack_channel) {
    try {
      let who = '';
      if (by) {
        const u = await pool.query('SELECT name FROM users WHERE id=$1', [by]);
        who = u.rows[0] ? ` (${u.rows[0].name} tarafından)` : '';
      }
      await slack.postThread({ channel: b.slack_channel, thread_ts: b.slack_ts,
        text: `🗑️ *#${b.no}* silindi${who} — bu thread artık takip edilmiyor. Dashboard → Silinenler'den geri alınabilir.` });
    } catch (e) { console.error('[writes] silindi notu hata:', e.message); }
  }
  return { id, no: r.rows[0].no };
}

// Kalıcı silme — sadece zaten soft-deleted olan briefler için
async function permanentDeleteBrief(id, by) {
  const check = await pool.query(
    'SELECT id, no FROM briefs WHERE id=$1 AND deleted_at IS NOT NULL', [id]
  );
  if (!check.rows[0]) throw new Error('brief bulunamadı veya önce silinenler listesine alınmamış: ' + id);
  // Tek transaction: kısmi başarısızlıkta orphan (assignees/events silinip brief kalması) olmaz.
  await tx(async (client) => {
    await client.query('DELETE FROM brief_assignees WHERE brief_id=$1', [id]);
    await client.query('DELETE FROM events WHERE brief_id=$1', [id]);
    await client.query('DELETE FROM briefs WHERE id=$1', [id]);
  });
  return { id, no: check.rows[0].no };
}

// Soft delete geri al
async function restoreBrief(id, by) {
  const r = await pool.query(
    `UPDATE briefs SET deleted_at=NULL, deleted_by=NULL WHERE id=$1 AND deleted_at IS NOT NULL
     RETURNING id, no, slack_ts, slack_channel`,
    [id]
  );
  if (!r.rows[0]) throw new Error('brief bulunamadı veya silinmiş değil: ' + id);
  await pool.query(
    `INSERT INTO events(brief_id, user_id, verb, detail, source)
     VALUES ($1, (SELECT id FROM users WHERE id=$2 LIMIT 1), 'geri alındı', '{}', 'dashboard')`,
    [id, by || null]
  );
  // Thread'e geri alındı notu (best-effort — thread silinmişse Slack hatası yutulur).
  const b = r.rows[0];
  if (b.slack_ts && b.slack_channel) {
    try {
      await slack.postThread({ channel: b.slack_channel, thread_ts: b.slack_ts,
        text: `↩️ *#${b.no}* geri alındı — takip devam ediyor.` });
    } catch (e) { console.error('[writes] geri alındı notu hata:', e.message); }
  }
  return { id, no: r.rows[0].no };
}

// İşe-dönüş termin hatırlatıcısını kapat (dashboard "Kapat" → uzatmadan kapatır).
async function clearTerminOneri(id) {
  await pool.query('UPDATE briefs SET termin_oneri_at = NULL, termin_oneri_ms = NULL WHERE id = $1', [id]);
  return { ok: true };
}

// "Bekleme kadar uzat": hatırlatıcı açıksa termini önerilen miktar (termin_oneri_ms) kadar ileri taşır.
// patchBrief üzerinden gider → hatırlatıcı açık olduğu için MUAF uygulanır + hatırlatıcı kapanır.
async function applyTerminOneri(id, by, source) {
  const r = await pool.query('SELECT deadline, termin_oneri_at, termin_oneri_ms FROM briefs WHERE id = $1', [id]);
  const row = r.rows[0];
  if (!row) throw new Error('brief bulunamadı: ' + id);
  if (!row.termin_oneri_at || !row.termin_oneri_ms) throw new Error('uzatma hatırlatıcısı açık değil');
  const base = row.deadline ? new Date(row.deadline).getTime() : Date.now();
  const yeni = new Date(base + Number(row.termin_oneri_ms)).toISOString();
  await patchBrief(id, { deadline: yeni, by, source: source || 'system' });
  // Garanti kapanış: deadline NULL iken patchBrief'in temizlik dalı atlanabilir (oldMs yok) → hatırlatıcıyı burada idempotent kapat (O5, sonsuz uzatma önlenir).
  await pool.query('UPDATE briefs SET termin_oneri_at = NULL, termin_oneri_ms = NULL WHERE id = $1', [id]);
  return { ok: true, yeni_deadline: yeni };
}

module.exports = { createBrief, patchBrief, setStatus, setFinancials, setBrandRetainer, upsertMarkaFaturaAy, setQueue, setKanbanOrder, clearTerminOneri, applyTerminOneri, deleteBrief, restoreBrief, permanentDeleteBrief, noToId, tsToId, DURUMLAR };
