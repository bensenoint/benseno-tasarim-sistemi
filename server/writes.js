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

const DURUMLAR = ['yeni', 'calisiliyor', 'incelemede', 'beklemede', 'revizyon', 'blokeli', 'tamamlandi'];

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

// İşi yapanların dept'lerinden brief dept'i türet (distinct, virgül-join).
async function deriveDept(client, worker_ids) {
  if (!Array.isArray(worker_ids) || !worker_ids.length) return null;
  const r = await client.query(
    `SELECT DISTINCT dept FROM users WHERE id = ANY($1) AND dept IS NOT NULL AND dept <> ''`, [worker_ids]);
  const depts = r.rows.map(x => x.dept).sort();
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
    const dept = await deriveDept(client, d.worker_ids);
    const r = await client.query(
      `INSERT INTO briefs(no,marka_id,baslik,dept,deadline,priority,akis,maliyet,satis,musteri_notu,slack_ts,slack_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [no, markaId, d.baslik, dept, toTs(d.deadline), d.priority || null,
       d.akis || 'sirali', d.maliyet ?? null, d.satis ?? null, d.musteri_notu || null,
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
      let leadName = null, contribNames = [], observerNames = [];
      const allIds = [...new Set([...leadIdsForPost, ...workerIds, ...observerIds])];
      if (allIds.length) {
        const u = await pool.query('SELECT id,name FROM users WHERE id = ANY($1)', [allIds]);
        const byId = Object.fromEntries(u.rows.map(r => [r.id, r.name]));
        // Slack üyeleri <@id> mention; freelancerlar (FR*) sadece isim
        const mention = (i) => /^U/.test(i) ? `<@${i}>` : (byId[i] || i);
        leadName = leadIdsForPost.map(mention).join(', ') || null;
        contribNames = workerIds.map(mention);
        observerNames = observerIds.filter(i => !leadIdsForPost.includes(i) && !workerIds.includes(i)).map(mention);
      }
      const deadlineMs = d.deadline ? (typeof d.deadline === 'number' ? d.deadline : Date.parse(d.deadline)) : null;
      const post = await slack.postBrief({ marka: d.marka, baslik: d.baslik, no: result.no,
        deadlineMs, dept: null, akis: d.akis, leadName, contribNames, observerNames, not: d.musteri_notu || null });
      if (post.ok) {
        await pool.query('UPDATE briefs SET slack_ts=$1, slack_channel=$2, slack_url=$3 WHERE id=$4',
          [post.ts, post.channel, post.permalink || null, result.id]);
        await pool.query(`INSERT INTO events(brief_id,verb,detail,source) VALUES ($1,'slack:gönderildi',$2,'system')`,
          [result.id, JSON.stringify({ channel: post.channel, ts: post.ts })]);
        result.slack = { ts: post.ts, channel: post.channel, permalink: post.permalink };
        // Brief'teki herkese (işi yapan + lead + gözlemci) DM — yeni brief bildirimi. Best-effort.
        try {
          const dmText = [
            `🆕 Yeni brief *#${result.no}* — ${d.marka}: ${d.baslik}`,
            d.musteri_notu ? `📝 ${d.musteri_notu}` : null,
            post.permalink || null,
          ].filter(Boolean).join('\n');
          const au = await pool.query(`SELECT DISTINCT user_id FROM brief_assignees WHERE brief_id=$1 AND user_id IS NOT NULL`, [result.id]);
          for (const row of au.rows) await slack.dm(row.user_id, dmText);
        } catch (e) { console.error('[writes] yeni brief DM hata:', e.message); }
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
    if (d.deadline !== undefined) put('deadline', toTs(d.deadline));
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
      const dept = await deriveDept(client, d.worker_ids);
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
  await reflectChange(id, `✏️ güncellendi: ${friendly}`, d.source, { dm: contentChanged && !roleChange });
  // Rol eklenen/çıkarılan/değişen kişilere hedefli DM (çıkarılanlar dahil).
  if (roleChange) { const after = await assigneeMap(id); await notifyRoleDiff(id, before, after, d.source); }
  return res;
}

async function setStatus(id, raw) {
  const d = statusBody.parse(raw);
  const res = await tx(async (client) => {
    const completed = d.durum === 'tamamlandi';
    const r = await client.query(
      `UPDATE briefs SET durum=$1,
         completed_at = CASE WHEN $2 THEN COALESCE(completed_at, now()) ELSE NULL END
       WHERE id=$3 RETURNING id, durum`, [d.durum, completed, id]);
    if (!r.rows[0]) throw new Error('brief bulunamadı: ' + id);
    await logEvent(client, { brief_id: id, user_id: d.by, verb: 'durum:' + d.durum,
      detail: { durum: d.durum }, source: d.source, slack_ts: d.slack_ts });
    return r.rows[0];
  });
  await reflectChange(id, `🔄 durum güncellendi: *${d.durum}*`, d.source);
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
  await reflectChange(id, `💰 finans güncellendi (${fin})`, d.source, { thread: d.source !== 'slack' });
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
    const text = `*#${b.no} ${b.marka || ''}* — ${summary}`;
    if (b.slack_ts && b.slack_channel) {
      await slack.postThread({ channel: b.slack_channel, thread_ts: b.slack_ts, text });
    }
    if (!dmAll) return;
    const u = await pool.query(`SELECT DISTINCT user_id FROM brief_assignees WHERE brief_id=$1`, [briefId]);
    for (const row of u.rows) await slack.dm(row.user_id, text);
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
      if (!was && now)        await slack.dm(uid, `➕ ${head}\nBu briefe *${rolesStr(now)}* olarak eklendin.${link}`);
      else if (was && !now)   await slack.dm(uid, `➖ ${head}\nBu briefteki görevden çıkarıldın.`);
      else if (was && now && [...was].sort().join() !== [...now].sort().join())
                              await slack.dm(uid, `🔄 ${head}\nRolün güncellendi: *${rolesStr(now)}*.${link}`);
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
