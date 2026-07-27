'use strict';
// ── ODY-CORE — bağımsız asistan servisi ─────────────────────────────────────
// Uçlar:
//   POST /chat       dashboard (JWT — benseno ile paylaşılan BNS_JWT_SECRET)
//   POST /dm         Slack köprüsü (x-ody-token servis sırrı)
//   GET  /health     sağlık
//   GET  /kaynaklar  kayıtlı MCP kaynakları (servis token)
// Kimlik (DM): KIMLIK_KAYNAK (vars. 'tasarim') MCP kaynağındaki _kimlik aracıyla çözülür.
const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');
const { odyChatRun } = require('./chat');
const kaynaklar = require('./kaynaklar');

const app = express();
app.use(express.json({ limit: '2mb' }));

// CORS — dashboard (GitHub Pages) tarayıcıdan çağırır; kimlik JWT ile zaten doğrulanıyor.
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ody-token');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
const PORT = process.env.PORT || 3000;
const SERVIS_TOKEN = process.env.ODY_SERVICE_TOKEN;
const JWT_SECRET = process.env.BNS_JWT_SECRET;

// Basit hız sınırı: kullanıcı başına dakikada 30 istek (LLM maliyet koruması; eval seti sığar)
const _limiter = new Map();
function llmLimiter(key) {
  const now = Date.now();
  const l = _limiter.get(key) || { count: 0, ts: now };
  if (now - l.ts > 60e3) { l.count = 0; l.ts = now; }
  l.count++; _limiter.set(key, l);
  return l.count <= 30;
}

function servisGuard(req, res, next) {
  if (!SERVIS_TOKEN) {
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'ODY_SERVICE_TOKEN prod ortamında zorunlu' });
    return next();
  }
  if (req.get('x-ody-token') === SERVIS_TOKEN) return next();
  return res.status(401).json({ error: 'yetkisiz' });
}

app.get('/health', (_req, res) => res.json({ ok: true, servis: 'ody-core' }));

app.get('/kaynaklar', servisGuard, async (_req, res) => {
  try {
    const ks = await kaynaklar.yukle();
    res.json({ kaynaklar: ks.map(k => ({ ad: k.ad, arac_sayisi: k.tools.length })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Dashboard sohbeti — benseno JWT'si doğrulanır (aynı sır; kullanıcı yeniden login olmaz)
app.post('/chat', async (req, res) => {
  try {
    if (!JWT_SECRET) return res.status(503).json({ error: 'BNS_JWT_SECRET yapılandırılmamış' });
    const authz = req.get('Authorization') || '';
    const tok = authz.startsWith('Bearer ') ? authz.slice(7) : null;
    let user;
    try { user = jwt.verify(tok, JWT_SECRET); } catch (e) { return res.status(401).json({ error: 'geçersiz oturum' }); }
    if (!llmLimiter(user.slack_id || String(user.id))) return res.status(429).json({ error: 'çok sık istek — biraz bekle' });
    const msgs = Array.isArray(req.body?.messages) ? req.body.messages.slice(-12) : [];
    if (!msgs.length) return res.status(400).json({ error: 'messages gerekli' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'asistan yapılandırılmamış' });
    const rb = req.body?.range;
    const range = (rb && typeof rb.from === 'number' && typeof rb.to === 'number') ? { from: rb.from, to: rb.to } : null;
    const reply = await odyChatRun({ user, isAdmin: user.role === 'admin', msgs, range, kanal: 'dashboard' });
    res.json({ reply });
  } catch (e) {
    console.error('[chat] hata:', e.message);
    res.status(e.status || 500).json({ error: e.status === 502 ? 'asistan şu an yanıt veremiyor' : 'sunucu hatası' });
  }
});

// Slack DM köprüsü — kişi başına son 10 mesaj, 2 saat TTL (api.js ile birebir)
const _dmGecmis = new Map();
app.post('/dm', servisGuard, async (req, res) => {
  try {
    const slackId = String(req.body?.slack_id || '');
    const text = String(req.body?.text || '').trim().slice(0, 4000);
    if (!/^U/.test(slackId) || !text) return res.status(400).json({ error: 'slack_id ve text gerekli' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'asistan yapılandırılmamış' });
    if (!llmLimiter(slackId)) return res.status(429).json({ error: 'çok sık istek' });
    // Kimlik çözümü: kimlik kaynağının _kimlik aracı
    const kk = process.env.KIMLIK_KAYNAK || 'tasarim';
    let kim = { bulundu: false };
    try { kim = await kaynaklar.calistir(`${kk}___kimlik`, { slack_id: slackId }, { kullanici: { slack_id: slackId } }); }
    catch (e) { console.warn('[dm] kimlik çözülemedi:', e.message); }
    if (!kim.bulundu) return res.json({ reply: 'Merhaba! Seni sistemde tanıyamadım — Görkem ile iletişime geçebilirsin. 🙏' });
    const isAdmin = !!kim.admin;
    const user = { id: slackId, slack_id: slackId, name: kim.name, role: isAdmin ? 'admin' : 'user' };
    const g = _dmGecmis.get(slackId);
    const gecmis = (g && Date.now() - g.ts < 2 * 60 * 60 * 1000) ? g.msgs : [];
    const msgs = [...gecmis, { role: 'user', content: text }].slice(-10);
    const reply = await odyChatRun({ user, isAdmin, msgs, range: null, kanal: 'slack-dm' });
    _dmGecmis.set(slackId, { msgs: [...msgs, { role: 'assistant', content: reply }].slice(-10), ts: Date.now() });
    res.json({ reply });
  } catch (e) {
    console.error('[dm] hata:', e.message);
    res.status(e.status || 500).json({ error: 'sunucu hatası' });
  }
});

// Boot: migration → dinle (başarısızsa çık; Railway eski container'ı korur)
(async () => {
  try {
    await require('./migrate').up();
    console.log('[ody-core] migrations güncel');
  } catch (e) {
    console.error('[ody-core] migration başarısız — boot iptal:', e.message);
    process.exit(1);
  }
  app.listen(PORT, () => console.log(`[ody-core] dinleniyor :${PORT}`));
})();
