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

const DURUMLAR = ['yeni', 'calisiliyor', 'incelemede', 'blokeli', 'tamamlandi'];

// ── Zod şemaları ─────────────────────────────────────────────
const zUserId = z.string().regex(/^U[A-Z0-9]+$/, 'geçersiz Slack user id');
const zDate = z.union([z.string(), z.number()]).nullable().optional(); // ISO/ms

const briefCreate = z.object({
  marka: z.string().min(1),
  baslik: z.string().min(1),
  dept: z.string().optional(),
  deadline: zDate,
  atanan_ids: z.array(zUserId).optional(),     // [lead, ...contributors]
  editor_ids: z.array(zUserId).optional(),
  gozlemci_ids: z.array(zUserId).optional(),
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
  dept: z.string().optional(),
  deadline: zDate,
  priority: z.string().optional(),
  akis: z.enum(['sirali', 'paralel']).optional(),
  musteri_notu: z.string().optional(),
  atanan_ids: z.array(zUserId).optional(),     // verilirse lead+contributor TAM değiştirilir
  editor_ids: z.array(zUserId).optional(),
  gozlemci_ids: z.array(zUserId).optional(),
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
  // varsa al, yoksa oluştur (dashboard'dan yeni marka gelebilir)
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

async function setAssignees(client, briefId, { atanan_ids, editor_ids, gozlemci_ids }) {
  // verilen rol gruplarını TAM değiştir (verilmeyene dokunma)
  const apply = async (ids, role, withSira) => {
    if (!Array.isArray(ids)) return;
    const roles = role === 'lead+contrib' ? ['lead', 'contributor'] : [role];
    await client.query(`DELETE FROM brief_assignees WHERE brief_id=$1 AND role = ANY($2)`, [briefId, roles]);
    if (role === 'lead+contrib') {
      if (ids[0]) await client.query(
        `INSERT INTO brief_assignees(brief_id,user_id,role,sira) VALUES ($1,$2,'lead',0)
         ON CONFLICT (brief_id,user_id,role) DO NOTHING`, [briefId, ids[0]]);
      for (let i = 1; i < ids.length; i++) await client.query(
        `INSERT INTO brief_assignees(brief_id,user_id,role,sira) VALUES ($1,$2,'contributor',$3)
         ON CONFLICT (brief_id,user_id,role) DO NOTHING`, [briefId, ids[i], i]);
    } else {
      for (let i = 0; i < ids.length; i++) await client.query(
        `INSERT INTO brief_assignees(brief_id,user_id,role,sira) VALUES ($1,$2,$3,$4)
         ON CONFLICT (brief_id,user_id,role) DO NOTHING`, [briefId, ids[i], role, withSira ? i : null]);
    }
  };
  if (atanan_ids !== undefined) await apply(atanan_ids, 'lead+contrib', true);
  if (editor_ids !== undefined) await apply(editor_ids, 'editor', false);
  if (gozlemci_ids !== undefined) await apply(gozlemci_ids, 'gozlemci', false);
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
    const r = await client.query(
      `INSERT INTO briefs(no,marka_id,baslik,dept,deadline,priority,akis,maliyet,satis,musteri_notu,slack_ts,slack_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [no, markaId, d.baslik, d.dept || null, toTs(d.deadline), d.priority || null,
       d.akis || 'sirali', d.maliyet ?? null, d.satis ?? null, d.musteri_notu || null,
       d.slack_ts || null, null]);
    const id = r.rows[0].id;
    await setAssignees(client, id, d);
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
      const ids = (d.atanan_ids || []).filter(Boolean);
      let leadName = null, contribNames = [];
      if (ids.length) {
        const u = await pool.query('SELECT id,name FROM users WHERE id = ANY($1)', [ids]);
        const byId = Object.fromEntries(u.rows.map(r => [r.id, r.name]));
        leadName = byId[ids[0]] || null;
        contribNames = ids.slice(1).map(i => byId[i]).filter(Boolean);
      }
      const deadlineMs = d.deadline ? (typeof d.deadline === 'number' ? d.deadline : Date.parse(d.deadline)) : null;
      const post = await slack.postBrief({ marka: d.marka, baslik: d.baslik, no: result.no,
        deadlineMs, dept: d.dept, akis: d.akis, leadName, contribNames });
      if (post.ok) {
        await pool.query('UPDATE briefs SET slack_ts=$1, slack_channel=$2, slack_url=$3 WHERE id=$4',
          [post.ts, post.channel, post.permalink || null, result.id]);
        await pool.query(`INSERT INTO events(brief_id,verb,detail,source) VALUES ($1,'slack:gönderildi',$2,'system')`,
          [result.id, JSON.stringify({ channel: post.channel, ts: post.ts })]);
        result.slack = { ts: post.ts, channel: post.channel, permalink: post.permalink };
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
  const res = await tx(async (client) => {
    const sets = [], vals = [];
    const put = (col, v) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
    if (d.marka !== undefined) put('marka_id', await brandIdByName(client, d.marka));
    if (d.baslik !== undefined) put('baslik', d.baslik);
    if (d.dept !== undefined) put('dept', d.dept);
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
    await logEvent(client, { brief_id: id, user_id: d.by, verb: 'düzenlendi',
      detail: { alanlar: Object.keys(d).filter(k => !['by', 'source', 'slack_ts'].includes(k)) },
      source: d.source, slack_ts: d.slack_ts });
    return { id };
  });
  const fields = Object.keys(d).filter(k => !['by', 'source', 'slack_ts'].includes(k));
  await reflectChange(id, `✏️ düzenlendi: ${fields.join(', ')}`, d.source);
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
  await reflectChange(id, `💰 finans güncellendi (${fin})`, d.source);
  return res;
}

// b2 — değişikliği Slack thread'ine yansıt + ilgili briefteki kişilere DM. Best-effort, echo-korumalı.
async function reflectChange(briefId, summary, source) {
  if (source === 'slack' || !slack.hasToken()) return;
  try {
    const r = await pool.query(
      `SELECT b.slack_ts, b.slack_channel, b.no, br.name AS marka
       FROM briefs b LEFT JOIN brands br ON br.id = b.marka_id WHERE b.id=$1`, [briefId]);
    const b = r.rows[0]; if (!b) return;
    const text = `*#${b.no} ${b.marka || ''}* — ${summary}`;
    if (b.slack_ts && b.slack_channel) {
      await slack.postThread({ channel: b.slack_channel, thread_ts: b.slack_ts, text });
    }
    const u = await pool.query(`SELECT DISTINCT user_id FROM brief_assignees WHERE brief_id=$1`, [briefId]);
    for (const row of u.rows) await slack.dm(row.user_id, text);
  } catch (e) { console.error('[writes] reflect hata:', e.message); }
}

module.exports = { createBrief, patchBrief, setStatus, setFinancials, DURUMLAR };
