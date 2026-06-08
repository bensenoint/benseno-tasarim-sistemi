'use strict';

/**
 * Benseno read API (Faz 1 iskelet). Dashboard Faz 2'de buraya bağlanır.
 * GET /health        → ayakta mı
 * GET /api/state     → dashboard'ın ihtiyacı: briefs/completed/users/brands/deptStats/brandStats/events
 * Auth: Faz 2'de eklenecek (rol+dept token). Şimdilik açık (sadece read, staging).
 */

const express = require('express');
const { getState, getEmbedded } = require('./queries');
const writes = require('./writes');
const slack = require('./slack');
const { pool } = require('./db');

const app = express();
app.use(express.json({ limit: '25mb' }));   // dosya ekleri base64 ile gelir

// CORS — dashboard GitHub Pages origin'ine kısıtlı (wildcard kaldırıldı)
const ALLOWED_ORIGINS = new Set(['https://bensenoint.github.io']);
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) res.set('Access-Control-Allow-Origin', origin);
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-bns-token');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.get('/api/state', async (req, res) => {
  try {
    res.json(await getState());
  } catch (e) {
    console.error('[api] /api/state hata:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Dashboard'ın doğrudan tükettiği HAM bns_* shape (poll buraya bağlanacak; Faz 2).
app.get('/api/embedded', async (req, res) => {
  try {
    res.json(await getEmbedded());
  } catch (e) {
    console.error('[api] /api/embedded hata:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Yazma yolu (Faz 3) ───────────────────────────────────────
// Opsiyonel guard: BNS_WRITE_TOKEN set ise x-bns-token eşleşmeli. Set değilse açık (staging).
function writeGuard(req, res, next) {
  const want = process.env.BNS_WRITE_TOKEN;
  if (!want) return next();
  if (req.get('x-bns-token') === want) return next();
  return res.status(401).json({ error: 'yetkisiz (x-bns-token gerekli)' });
}

// Zod/iş hatalarını okunaklı 400/404'e çevir
function handleWrite(fn) {
  return async (req, res) => {
    try {
      res.json({ ok: true, ...(await fn(req)) });
    } catch (e) {
      if (e && e.name === 'ZodError') return res.status(400).json({ error: 'doğrulama', issues: e.issues });
      const code = /bulunamadı/.test(e.message || '') ? 404 : 400;
      console.error('[api] write hata:', e.message);
      res.status(code).json({ error: e.message });
    }
  };
}

// ── Auth ─────────────────────────────────────────────────────────────────────
const auth = require('./auth');

// POST /api/auth/login — { slack_id, password } → { token, user }
app.post('/api/auth/login', async (req, res) => {
  const { slack_id, password } = req.body || {};
  if (!slack_id || !password) return res.status(400).json({ error: 'slack_id ve password gerekli' });
  try {
    const r = await pool.query('SELECT * FROM dashboard_users WHERE slack_id=$1', [slack_id]);
    const user = r.rows[0];
    if (!user || !auth.bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'kullanıcı adı veya şifre hatalı' });
    }
    await pool.query('UPDATE dashboard_users SET last_login=NOW() WHERE id=$1', [user.id]);
    const token = auth.signToken({ id: user.id, slack_id: user.slack_id, name: user.name, role: user.role });
    res.json({ token, user: { id: user.id, slack_id: user.slack_id, name: user.name, role: user.role } });
  } catch (e) {
    console.error('[auth] login hata:', e.message);
    res.status(500).json({ error: 'sunucu hatası' });
  }
});

// GET /api/auth/me — token doğrula, user bilgisi döner
app.get('/api/auth/me', auth.authGuard, (req, res) => {
  res.json({ user: req.user });
});

// ── Kullanıcı yönetimi (admin only) ─────────────────────────────────────────
// GET /api/users
app.get('/api/users', auth.authGuard, auth.adminGuard, async (req, res) => {
  try {
    const r = await pool.query('SELECT id, slack_id, name, role, created_at, last_login FROM dashboard_users ORDER BY id');
    res.json({ users: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users — { slack_id, name, role, password }
app.post('/api/users', auth.authGuard, auth.adminGuard, async (req, res) => {
  const { slack_id, name, role = 'member', password } = req.body || {};
  if (!slack_id || !name || !password) return res.status(400).json({ error: 'slack_id, name, password gerekli' });
  if (!['admin','member'].includes(role)) return res.status(400).json({ error: 'geçersiz rol' });
  try {
    const hash = auth.bcrypt.hashSync(password, 12);
    const r = await pool.query(
      'INSERT INTO dashboard_users (slack_id, name, role, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, slack_id, name, role',
      [slack_id, name, role, hash]
    );
    res.json({ ok: true, user: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'bu slack_id zaten kayıtlı' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/users/:id — { password?, role? }
app.patch('/api/users/:id', auth.authGuard, auth.adminGuard, async (req, res) => {
  const { password, role } = req.body || {};
  const updates = [], params = [];
  if (password) { updates.push(`password_hash=$${params.push(auth.bcrypt.hashSync(password, 12))}`); }
  if (role) {
    if (!['admin','member'].includes(role)) return res.status(400).json({ error: 'geçersiz rol' });
    updates.push(`role=$${params.push(role)}`);
  }
  if (!updates.length) return res.status(400).json({ error: 'güncellenecek alan yok' });
  params.push(+req.params.id);
  try {
    await pool.query(`UPDATE dashboard_users SET ${updates.join(',')} WHERE id=$${params.length}`, params);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/briefs', writeGuard, handleWrite(req => writes.createBrief(req.body)));
app.patch('/api/briefs/:id', writeGuard, handleWrite(req => writes.patchBrief(+req.params.id, req.body)));
app.post('/api/briefs/:id/status', writeGuard, handleWrite(req => writes.setStatus(+req.params.id, req.body)));
app.post('/api/briefs/:id/financials', writeGuard, handleWrite(req => writes.setFinancials(+req.params.id, req.body)));

// Slack tarafı için: brief'i no / slack_ts ile hedefle (b3/cutover bot bunları çağırır).
app.post('/api/briefs/by-no/:no/status', writeGuard, handleWrite(async req => writes.setStatus(await writes.noToId(+req.params.no), req.body)));
app.post('/api/briefs/by-no/:no/financials', writeGuard, handleWrite(async req => writes.setFinancials(await writes.noToId(+req.params.no), req.body)));
app.patch('/api/briefs/by-no/:no', writeGuard, handleWrite(async req => writes.patchBrief(await writes.noToId(+req.params.no), req.body)));
app.post('/api/briefs/by-ts/:ts/status', writeGuard, handleWrite(async req => writes.setStatus(await writes.tsToId(req.params.ts), req.body)));
app.post('/api/briefs/by-ts/:ts/financials', writeGuard, handleWrite(async req => writes.setFinancials(await writes.tsToId(req.params.ts), req.body)));
app.patch('/api/briefs/by-ts/:ts', writeGuard, handleWrite(async req => writes.patchBrief(await writes.tsToId(req.params.ts), req.body)));

// Dosya ekleri (dashboard) — base64 JSON: { files:[{name,mime,b64}], by }. Slack thread'e yükler + DB.
app.post('/api/briefs/:id/attachments', writeGuard, async (req, res) => {
  try {
    const id = +req.params.id;
    const r = await pool.query('SELECT slack_ts, slack_channel FROM briefs WHERE id=$1', [id]);
    const brief = r.rows[0];
    if (!brief) return res.status(404).json({ error: 'brief bulunamadı: ' + id });
    if (!brief.slack_channel || !brief.slack_ts) return res.status(409).json({ error: 'brief Slack thread yok (henüz post edilmedi)' });
    const files = Array.isArray(req.body.files) ? req.body.files : [];
    const out = [];
    for (const f of files) {
      if (!f || !f.b64 || !f.name) continue;
      const buf = Buffer.from(f.b64, 'base64');
      const u = await slack.uploadFile({ channel: brief.slack_channel, thread_ts: brief.slack_ts, filename: f.name, buf });
      if (!u.ok) { out.push({ name: f.name, error: u.error || 'upload_fail' }); continue; }
      await pool.query(
        `INSERT INTO brief_attachments(brief_id,url,filename,mime,uploaded_by,source) VALUES ($1,$2,$3,$4,$5,'slack')`,
        [id, u.permalink || '', f.name, f.mime || null, req.body.by || null]);
      out.push({ name: f.name, permalink: u.permalink });
    }
    res.json({ ok: true, attachments: out });
  } catch (e) { console.error('[api] attachments hata:', e.message); res.status(400).json({ error: e.message }); }
});

// Sadece-meta ekle (Slack tarafı: dosya ZATEN Slack'te, tekrar yüklemeden DB'ye kaydet).
app.post('/api/briefs/:id/attachments-meta', writeGuard, async (req, res) => {
  try {
    const id = +req.params.id;
    await pool.query(`INSERT INTO brief_attachments(brief_id,url,filename,mime,uploaded_by,source) VALUES ($1,$2,$3,$4,$5,'slack')`,
      [id, req.body.url || '', req.body.filename || null, null, req.body.by || null]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => console.log(`[api] dinleniyor :${PORT}`));
module.exports = { app, server };
