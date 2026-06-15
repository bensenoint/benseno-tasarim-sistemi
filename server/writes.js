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
const slack = require('./slack');
const calc = require('./calc-penalty.js'); // deadline uzatma cezası (API kökü server/; dashboard calc.js imajda yok)

const DURUMLAR = ['yeni', 'calisiliyor', 'incelemede', 'beklemede', 'revizyon', 'blokeli', 'musteride', 'tamamlandi'];

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
  tags: z.array(z.string()).optional(),
  no: z.number().int().optional(),
  by: zUserId.optional(),                       // işlemi yapan
  source: z.enum(['dashboard', 'slack', 'system']).default('dashboard'),
  slack_ts: z.string().optional(),
}).strict();

const briefPatch = z.object({
  marka: z.string().min(1).optional(),
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
  const result = await tx(async (client) => {
    const markaId = await brandIdByName(client, d.marka);
    // no: verilmemişse max+1
    let no = d.no;
    if (no == null) {
      const r = await client.query(`SELECT COALESCE(max(no),0)+1 AS n FROM briefs`);
      no = r.rows[0].n;
    }
    // lead default = oluşturan; dept işi yapanlardan türetilir
    const leadIds = (d.lead_ids && d.lead_ids.length) ? d.lead_ids : (d.by ? [d.by] : []);
    const dept = await deriveDept(client, d.worker_ids, d.by);
    const r = await client.query(
      `INSERT INTO briefs(no,marka_id,baslik,dept,deadline,deadline_orig,priority,akis,maliyet,satis,musteri_notu,slack_ts,slack_url)
       VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [no, markaId, d.baslik, dept, toTs(d.deadline), d.priority || null,
       d.akis || 'paralel', d.maliyet ?? null, d.satis ?? null, d.musteri_notu || null,
       d.slack_ts || null, null]);
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

  // Slack çıkışı (b1.2) — dashboard-kökenli oluşturmalarda markanın kanalına post et.
  // Slack-kökenli (source='slack') olanlarda ECHO yapma. Best-effort: hata create'i bozmaz.
  if (d.source !== 'slack' && slack.hasToken()) {
    try {
      const leadIdsForPost = (d.lead_ids && d.lead_ids.length) ? d.lead_ids : (d.by ? [d.by] : []);
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
  const res = await tx(async (client) => {
    const sets = [], vals = [];
    const put = (col, v) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
    if (d.marka !== undefined) put('marka_id', await brandIdByName(client, d.marka));
    if (d.baslik !== undefined) put('baslik', d.baslik);
    if (d.deadline !== undefined) {
      // Uzatma takibi: eski deadline'ı al; orijinali bir kez sabitle; daha GEÇ tarihe taşıma = uzatma → ceza.
      const cur = await client.query('SELECT deadline, deadline_orig FROM briefs WHERE id=$1', [id]);
      const oldRow = cur.rows[0] || {};
      const oldMs = oldRow.deadline ? new Date(oldRow.deadline).getTime() : null;
      const newDl = toTs(d.deadline);
      const newMs = newDl ? new Date(newDl).getTime() : null;
      if (!oldRow.deadline_orig && oldRow.deadline) put('deadline_orig', oldRow.deadline);
      put('deadline', newDl);
      if (oldMs && newMs && newMs > oldMs) {            // deadline ileri taşındı → uzatma
        const ceza = calc.bnsUzatmaCezaFromTimes(Date.now(), oldMs);
        sets.push('uzatma_sayisi = uzatma_sayisi + 1');
        vals.push(ceza); sets.push(`uzatma_ceza = GREATEST(uzatma_ceza, $${vals.length})`);
      }
      if (oldMs && newMs && newMs !== oldMs) {          // her deadline değişimini geçmişe yaz (eski→yeni)
        const hist = JSON.stringify({ eski: oldRow.deadline, yeni: newDl, at: new Date().toISOString(), by: d.by || null, ileri: newMs > oldMs });
        vals.push(hist); sets.push(`deadline_history = COALESCE(deadline_history,'[]'::jsonb) || $${vals.length}::jsonb`);
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

async function setStatus(id, raw) {
  const d = statusBody.parse(raw);
  let zincirNote = null, dmNext = null;
  const res = await tx(async (client) => {
    const ctx = await zincirCtx(client, id);
    if (!ctx) throw new Error('brief bulunamadı: ' + id);
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
  } else {
    note = `🔄 durum güncellendi: *${d.durum}*`;
  }
  await reflectChange(id, note, d.source, { by: d.by });
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
  return res;
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
    for (const row of u.rows) if (/^U/.test(row.user_id || '')) await slack.logNotification(row.user_id, text, threadLink);
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
  await pool.query('DELETE FROM brief_assignees WHERE brief_id=$1', [id]);
  await pool.query('DELETE FROM events WHERE brief_id=$1', [id]);
  await pool.query('DELETE FROM briefs WHERE id=$1', [id]);
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

module.exports = { createBrief, patchBrief, setStatus, setFinancials, deleteBrief, restoreBrief, permanentDeleteBrief, noToId, tsToId, DURUMLAR };
