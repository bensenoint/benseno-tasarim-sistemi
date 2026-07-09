'use strict';

/**
 * Benseno read API (Faz 1 iskelet). Dashboard Faz 2'de buraya bağlanır.
 * GET /health        → ayakta mı
 * GET /api/state     → dashboard'ın ihtiyacı: briefs/completed/users/brands/deptStats/brandStats/events
 * Auth: Faz 2'de eklenecek (rol+dept token). Şimdilik açık (sadece read, staging).
 */

const express = require('express');
const { getState, getEmbedded, getEvents } = require('./queries');
const writes = require('./writes');
const slack = require('./slack');
const { pool } = require('./db');
const calc = require('./calc-penalty.js'); // deadline uzatma cezası (API kökü server/; dashboard calc.js imajda yok)
const odyTools = require('./ody-tools');
const { notify } = require('./notify');

const app = express();
app.disable('x-powered-by');   // Express sürüm parmak izini gizle
app.use(express.json({ limit: '25mb' }));   // dosya ekleri base64 ile gelir (attachment endpoint'leri gerektirir)

// Güvenlik başlıkları (helmet'siz, minimal — bağımlılık eklemeden). Railway HTTPS sonlandırır → HSTS uygun.
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');                 // API çerçevelenmemeli
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// CORS — dashboard GitHub Pages origin'ine kısıtlı (wildcard kaldırıldı)
const ALLOWED_ORIGINS = new Set(['https://bensenoint.github.io']);
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) res.set('Access-Control-Allow-Origin', origin);
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-bns-token');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// SEC-4: duyarlı veri (finans/puan) izni. KULLANICI KARARI (2026-07-07): girişli TÜM üyeler
// finans/puanı görebilir — sakınca görülmedi. Süzgeç altyapısı (stripBriefSensitive + sensitive
// parametresi) ileride kısıtlamak istenirse hazır durur; kimliksiz erişim zaten 401 (readGuard).
async function canSeeSensitive(req) { return true; }

// SEC-10: LLM maliyet koruması — kullanıcı başına 10 dk'da en çok 20 istek (bellek içi, restart'ta sıfırlanır).
const llmHits = new Map();
function llmLimiter(req, res, next) {
  const uid = (req.user && req.user.slack_id) || req.ip;
  const now = Date.now(), win = 10 * 60 * 1000;
  const arr = (llmHits.get(uid) || []).filter(t => now - t < win);
  if (arr.length >= 20) return res.status(429).json({ error: 'çok fazla istek — 10 dk sonra tekrar dene' });
  arr.push(now); llmHits.set(uid, arr);
  if (llmHits.size > 5000) { for (const [k, v] of llmHits) if (!v.some(t => now - t < win)) llmHits.delete(k); }
  next();
}

app.get('/api/state', readGuard, async (req, res) => {
  try {
    // SEC-4: bot/admin/yönetici tam veri; düz üyeler finans/puan görmez (UI ile hizalı).
    const sensitive = await canSeeSensitive(req);
    res.json(await getState({ sensitive }));
  } catch (e) {
    console.error('[api] /api/state hata:', e.message);
    res.status(500).json({ error: 'sunucu hatası' });
  }
});

// Dashboard'ın doğrudan tükettiği HAM bns_* shape (poll buraya bağlanacak; Faz 2).
app.get('/api/embedded', readGuard, async (req, res) => {
  try {
    // SEC-4: bot/admin/yönetici tam veri; düz üyeler finans/puan görmez (UI ile hizalı).
    const sensitive = await canSeeSensitive(req);
    res.json(await getEmbedded({ sensitive }));
  } catch (e) {
    console.error('[api] /api/embedded hata:', e.message);
    res.status(500).json({ error: 'sunucu hatası' });
  }
});

// Geçmiş (aktivite log) — sayfalı. ?limit=100&before=<ts>&archive=0|1. Varsayılan son 30 gün.
app.get('/api/events', readGuard, async (req, res) => {
  try {
    res.json(await getEvents({
      before: req.query.before,
      limit: req.query.limit,
      archive: req.query.archive === '1' || req.query.archive === 'true',
      from: req.query.from,
      to: req.query.to,
    }));
  } catch (e) {
    console.error('[api] /api/events hata:', e.message);
    res.status(500).json({ error: 'sunucu hatası' });
  }
});

// ── Döneme özel yıldız değerlendirmesi (LAZY) ───────────────────────────────
// Yıldız karnesi accordion'u AÇILDIĞINDA çağrılır (sayfa/tarih değişiminde DEĞİL).
// Seçili [from,to] dönemindeki TAMAMLANAN işlerin DB verisinden (sayılar deterministik)
// kısa bir değerlendirme üretir; aynı dönem için 6 saat bellek-içi cache'lenir.
const _sebepPeriodCache = new Map();
app.get('/api/sebep-period', readGuard, llmLimiter, async (req, res) => {
  try {
    const type = String(req.query.type || 'firma');
    const key = String(req.query.key || '');
    const fromMs = Number(req.query.from) || 0;
    const toMs = Number(req.query.to) || Date.now();
    const ck = `${type}:${key}:${Math.floor(fromMs / 864e5)}:${Math.floor(toMs / 864e5)}`;
    const hit = _sebepPeriodCache.get(ck);
    if (hit && (Date.now() - hit.ts) < 6 * 3600 * 1000) {
      // LRU: isabette anahtarı en-son-kullanılan konumuna taşı (eviction en az kullanılanı atsın, FIFO değil).
      _sebepPeriodCache.delete(ck); _sebepPeriodCache.set(ck, hit);
      return res.json({ sebep: hit.text, cached: true });
    }

    const ed = await getEmbedded();
    const deptOf = {};
    for (const u of (ed.bns_users || [])) deptOf[u.id] = u.dept || u.rol || '';
    const people = (c) => [...(c.leads || []), ...(c.workers || []), ...(c.lead ? [c.lead] : []), ...(c.contributors || [])];
    const onDept = (c) => people(c).some(p => p && deptOf[p.id] === key);
    const onKisi = (c) => people(c).some(p => p && (p.id === key || p.name === key));
    let comp = (ed.bns_completed || []).filter(c => typeof c.bitis === 'number' && c.bitis >= fromMs && c.bitis <= toMs);
    if (type === 'dept') comp = comp.filter(onDept);
    else if (type === 'kisi') comp = comp.filter(onKisi);
    else if (type === 'marka') comp = comp.filter(c => c.marka === key);
    if (!comp.length) return res.json({ sebep: null, bos: true });

    // Deterministik özet (DB) — model SAYI uydurmaz, yalnız ifadelendirir.
    const rated = comp.filter(c => c.rating > 0);
    const avg = rated.length ? (rated.reduce((s, c) => s + c.rating, 0) / rated.length).toFixed(2) : null;
    const revOf = (c) => (typeof c.rev_ic === 'number' || typeof c.rev_musteri === 'number') ? (c.rev_ic || 0) + (c.rev_musteri || 0) : (c.rev || c.revision || 0);
    const revs = comp.map(revOf);
    const avgRev = revs.length ? (revs.reduce((a, v) => a + v, 0) / revs.length).toFixed(2) : '0';
    const markaSay = {}; comp.forEach(c => { if (c.marka) markaSay[c.marka] = (markaSay[c.marka] || 0) + 1; });
    const topMarka = Object.entries(markaSay).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m, n]) => `${m}(${n})`).join(', ');
    const sebepOrnek = comp.map(c => c.rating_sebep).filter(Boolean).slice(0, 6);
    const insightOrnek = comp.map(c => c.insight).filter(Boolean).slice(0, 4);

    const etiket = type === 'firma' ? 'tüm firma (Benseno)' : type === 'dept' ? (key + ' departmanı') : key;
    const fmt = (m) => { try { return new Date(m).toLocaleDateString('tr-TR'); } catch (e) { return '' + m; } };
    const prompt = `Aşağıda ${etiket} için ${fmt(fromMs)}–${fmt(toMs)} döneminde TAMAMLANAN işlerin verisi var. Bu verilere dayanarak 2-3 cümlelik, somut ve yapıcı bir performans değerlendirmesi yaz. SADECE verilen sayıları kullan, YENİ sayı uydurma. Türkçe, akıcı, abartısız yönetici diliyle.\n\nVERİ:\n- Tamamlanan iş: ${comp.length}\n- Puanlı iş: ${rated.length}, ortalama puan: ${avg ?? 'yok'} / 5\n- Ortalama revize: ${avgRev}\n- En çok çalışılan markalar: ${topMarka || '—'}\n- Yıldız yorum örnekleri: ${sebepOrnek.join(' | ') || 'yok'}\n- İş insight örnekleri: ${insightOrnek.join(' | ') || 'yok'}`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 400,
        system: 'Sen Benseno tasarım stüdyosunun veri-temelli değerlendirme yazarısın. Kısa, somut, abartısız yaz. Verilmeyen sayıyı kullanma. DÜZ METİN yaz: Markdown KULLANMA — başlık (#), kalın (**), madde işareti veya liste YOK; tek akıcı paragraf (2-3 cümle).',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.error('[sebep-period] AI hata:', j.error?.message || r.status); return res.status(502).json({ error: 'değerlendirme üretilemedi' }); }
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
    if (text) {
      // OOM koruması: süresi geçenleri at + en fazla 300 girdi (en eskiyi düşür).
      const _now2 = Date.now();
      for (const [k, v] of _sebepPeriodCache) { if (_now2 - v.ts > 6 * 3600 * 1000) _sebepPeriodCache.delete(k); }
      while (_sebepPeriodCache.size >= 300) _sebepPeriodCache.delete(_sebepPeriodCache.keys().next().value);
      _sebepPeriodCache.set(ck, { text, ts: _now2 });
    }
    res.json({ sebep: text || null, adet: comp.length });
  } catch (e) { console.error('[sebep-period] hata:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
});

// ── Yazma yolu (Faz 3) ───────────────────────────────────────
// Opsiyonel guard: BNS_WRITE_TOKEN set ise x-bns-token eşleşmeli. Set değilse açık (staging).
function writeGuard(req, res, next) {
  const want = process.env.BNS_WRITE_TOKEN;
  if (!want) {
    // Savunma-derinliği: prod'da token set edilmemişse fail-closed (veri/finans/PII sızıntısını önler).
    // Dev/staging'de (NODE_ENV!=='production') açık kalır — yerel geliştirme kolaylığı.
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'yapılandırma: BNS_WRITE_TOKEN prod ortamında zorunlu' });
    }
    return next();
  }
  // Bot: paylaşılan write token (server-to-server)
  if (req.get('x-bns-token') === want) return next();
  // Dashboard: geçerli JWT (write token tarayıcıda tutulamaz)
  const authz = req.get('Authorization') || '';
  const jwtTok = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  if (jwtTok) {
    try {
      req.user = auth.verifyToken(jwtTok);
      // SEC-7: dashboard yazımında 'by' spoof edilemez — kimliği JWT'den zorla ez.
      // (Bot yolu req.user set etmez → body.by olduğu gibi kalır; script meşru vekâleten yazar.)
      if (req.body && typeof req.body === 'object') req.body.by = req.user.slack_id;
      return next();
    } catch { /* geçersiz JWT → 401 */ }
  }
  return res.status(401).json({ error: 'yetkisiz (giriş veya write token gerekli)' });
}

// SEC-3a: Yalnız bot (server-to-server) yazabilir — dashboard/JWT KABUL EDİLMEZ.
// Yalnız script'lerin yazdığı uçlar (kanal özeti, insight, KPI vb.) iç phishing/veri kirletme
// yüzeyini daraltmak için JWT ile çağrılamamalı.
function botGuard(req, res, next) {
  const want = process.env.BNS_WRITE_TOKEN;
  if (!want) { // writeGuard ile aynı dev/prod davranışı
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'yapılandırma: BNS_WRITE_TOKEN prod\'da zorunlu' });
    return next();
  }
  if (req.get('x-bns-token') === want) return next();
  return res.status(403).json({ error: 'yalnız sistem (bot) erişimi' });
}

// Okuma guard'ı — write guard ile AYNI mantık (JWT veya x-bns-token; BNS_WRITE_TOKEN yoksa açık).
// /api/embedded + /api/state TÜM veriyi (brief/müşteri/kişi/finans/özet) sunar → token'sız bırakılamaz.
// Fonksiyon bildirimi → hoist edilir, yukarıdaki route'larda kullanılabilir.
function readGuard(req, res, next) { return writeGuard(req, res, next); }

// Zod/iş hatalarını okunaklı 400/404'e çevir
function handleWrite(fn) {
  return async (req, res) => {
    try {
      res.json({ ok: true, ...(await fn(req)) });
    } catch (e) {
      if (e && e.name === 'ZodError') return res.status(400).json({ error: 'doğrulama', issues: e.issues });
      const code = e.status || (/bulunamadı/.test(e.message || '') ? 404 : 400);
      console.error('[api] write hata:', e.message);
      res.status(code).json({ error: e.message });
    }
  };
}

// ── Auth ─────────────────────────────────────────────────────────────────────
const auth = require('./auth');

// Brute-force koruması: hesap (slack_id) bazlı kilit — IP spoof'tan etkilenmez,
// doğrudan şifre denemesini sınırlar. Bellek-içi (tek instance; restart'ta sıfırlanır — kabul).
const LOGIN_MAX = 5;                 // ardışık başarısız deneme
const LOGIN_WINDOW = 15 * 60 * 1000; // 15 dk pencere/kilit
const loginFails = new Map();        // slack_id → { fails, until }
function loginBlocked(id) {
  const e = loginFails.get(id);
  if (e && e.until && e.until > Date.now()) return Math.ceil((e.until - Date.now()) / 60000);
  return 0;
}
function loginFail(id) {
  const e = loginFails.get(id) || { fails: 0, until: 0 };
  e.fails += 1;
  if (e.fails >= LOGIN_MAX) { e.until = Date.now() + LOGIN_WINDOW; e.fails = 0; }
  loginFails.set(id, e);
  // SEC-13: güvenlik valfi (bellek) — clear() tüm aktif kilitleri sıfırlıyordu (saldırgan 5000 hesap
  // deneyerek kendi kilidini açabilirdi). Önce süresi/penceresi geçmiş girdiler silinir; hâlâ >5000 ise
  // en eski eklenenler atılır (Map ekleme sıralı). Gerçek (aktif) kilitler korunur.
  if (loginFails.size > 5000) {
    const now = Date.now();
    for (const [k, v] of loginFails) {
      if ((!v.until || v.until <= now) && v.fails < LOGIN_MAX) loginFails.delete(k);
    }
    while (loginFails.size > 5000) loginFails.delete(loginFails.keys().next().value);
  }
}

// POST /api/auth/login — { slack_id, password } → { token, user }
app.post('/api/auth/login', async (req, res) => {
  const { slack_id, password } = req.body || {};
  if (!slack_id || !password) return res.status(400).json({ error: 'slack_id ve password gerekli' });
  const mins = loginBlocked(slack_id);
  if (mins > 0) return res.status(429).json({ error: `çok fazla başarısız deneme — ${mins} dk sonra tekrar dene` });
  try {
    const r = await pool.query('SELECT * FROM dashboard_users WHERE slack_id=$1', [slack_id]);
    const user = r.rows[0];
    if (!user || !auth.bcrypt.compareSync(password, user.password_hash)) {
      loginFail(slack_id);
      return res.status(401).json({ error: 'kullanıcı adı veya şifre hatalı' });
    }
    loginFails.delete(slack_id); // başarı → sayaç sıfırla
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

// ── v2 "Panom" kişiye özel pano düzeni ──────────────────────────────────────
// authGuard → kişinin slack_id'sinden okur/yazar. dashboard_layouts(user_id PK, layout jsonb).
app.get('/api/layout', auth.authGuard, async (req, res) => {
  try {
    const r = await pool.query('SELECT layout FROM dashboard_layouts WHERE user_id=$1', [req.user.slack_id]);
    res.json({ layout: r.rows[0] ? r.rows[0].layout : null });
  } catch (e) { console.error('[api] layout get hata:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
});
app.post('/api/layout', auth.authGuard, async (req, res) => {
  try {
    const layout = req.body && req.body.layout;
    if (!Array.isArray(layout)) return res.status(400).json({ error: 'layout dizi olmalı' });
    if (layout.length > 50) return res.status(400).json({ error: 'çok fazla widget' });
    await pool.query(
      `INSERT INTO dashboard_layouts(user_id, layout, updated_at) VALUES ($1,$2,now())
       ON CONFLICT (user_id) DO UPDATE SET layout=$2, updated_at=now()`,
      [req.user.slack_id, JSON.stringify(layout)]);
    res.json({ ok: true });
  } catch (e) { console.error('[api] layout put hata:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
});

// ── Kullanıcı yönetimi (admin only) ─────────────────────────────────────────
// GET /api/users
app.get('/api/users', auth.authGuard, auth.adminGuard, async (req, res) => {
  try {
    const r = await pool.query('SELECT id, slack_id, name, role, created_at, last_login FROM dashboard_users ORDER BY id');
    res.json({ users: r.rows });
  } catch (e) { res.status(500).json({ error: 'sunucu hatası' }); }
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
    res.status(500).json({ error: 'sunucu hatası' });
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
  } catch (e) { res.status(500).json({ error: 'sunucu hatası' }); }
});

// SEC-3c: JWT kullanıcı finansal yazıyorsa yönetici olmalı; bot (req.user yok) serbest.
async function assertCanWriteFinancials(req) {
  if (!req.user) return; // bot
  if (req.user.role === 'admin') return;
  const r = await pool.query('SELECT rol FROM users WHERE id=$1', [req.user.slack_id]);
  if ((r.rows[0] || {}).rol === 'yonetici') return;
  const e = new Error('finansal veri için yönetici yetkisi gerekli'); e.status = 403; throw e;
}

app.post('/api/briefs', writeGuard, handleWrite(req => writes.createBrief(req.body)));
app.patch('/api/briefs/:id', writeGuard, handleWrite(req => writes.patchBrief(+req.params.id, req.body)));
app.post('/api/briefs/:id/status', writeGuard, handleWrite(req => writes.setStatus(+req.params.id, req.body)));
app.post('/api/briefs/:id/financials', writeGuard, handleWrite(async req => { await assertCanWriteFinancials(req); return writes.setFinancials(+req.params.id, req.body); }));
// fatura-v2: retainer tutarı (geçiş tetiğiyle) + ay×marka fatura/ödeme işareti — yönetici.
app.post('/api/brands/by-name/:name/retainer', writeGuard, handleWrite(async req => { await assertCanWriteFinancials(req); return writes.setBrandRetainer(req.params.name, req.body?.aylik_ucret ?? null); }));
app.post('/api/brands/by-name/:name/retainer-ay', writeGuard, handleWrite(async req => { await assertCanWriteFinancials(req); return writes.upsertMarkaFaturaAy(req.params.name, req.body?.ay, req.body || {}); }));
app.post('/api/briefs/:id/termin-oneri-kapat', writeGuard, handleWrite(req => writes.clearTerminOneri(+req.params.id)));   // işe-dönüş hatırlatıcısını uzatmadan kapat
app.post('/api/briefs/:id/termin-oneri-uzat', writeGuard, handleWrite(req => writes.applyTerminOneri(+req.params.id, (req.user && (req.user.slack_id || String(req.user.id))) || req.body?.by, 'dashboard')));   // bekleme kadar muaf uzat
app.post('/api/briefs/by-ts/:ts/termin-oneri-uzat', writeGuard, handleWrite(async req => writes.applyTerminOneri(await writes.tsToId(req.params.ts), req.body?.by, 'slack')));   // Slack "termin uzat"

// Slack tarafı için: brief'i no / slack_ts ile hedefle (b3/cutover bot bunları çağırır).
app.post('/api/briefs/by-no/:no/status', writeGuard, handleWrite(async req => writes.setStatus(await writes.noToId(+req.params.no), req.body)));
app.post('/api/briefs/by-no/:no/financials', writeGuard, handleWrite(async req => { await assertCanWriteFinancials(req); return writes.setFinancials(await writes.noToId(+req.params.no), req.body); }));
app.patch('/api/briefs/by-no/:no', writeGuard, handleWrite(async req => writes.patchBrief(await writes.noToId(+req.params.no), req.body)));
app.post('/api/briefs/by-ts/:ts/status', writeGuard, handleWrite(async req => writes.setStatus(await writes.tsToId(req.params.ts), req.body)));
app.post('/api/briefs/by-ts/:ts/financials', writeGuard, handleWrite(async req => { await assertCanWriteFinancials(req); return writes.setFinancials(await writes.tsToId(req.params.ts), req.body); }));
// Soft-delete yetkisi: admin + yönetici + işin LEAD'i (dashboard butonuyla aynı kural).
// Slack'in ana mesaj silme sinyali (by:'slack:deleted') Slack'in kendi yetkisiyle gelir → kabul.
// İki yol: dashboard JWT (req.user) veya Slack bot token (actor = body.by, ör. event.user).
async function assertCanDeleteBrief(req, briefId) {
  if (req.user && req.user.role === 'admin') return;             // JWT admin
  // Bot yolu: x-bns-token ile gelen server-to-server istek (req.user yok). Yalnız bu yolda
  // body.by bir kimlik kanıtı sayılır (Slack event.user, bot tarafından set edilir) ve
  // 'slack:deleted' Slack'in kendi yetkilendirmesiyle kabul edilir. JWT kullanıcısı body.by
  // veya 'slack:deleted' göndererek yetki YÜKSELTEMEZ — kimliği yalnız req.user'dan gelir.
  const want = process.env.BNS_WRITE_TOKEN;
  const isBot = !req.user && !!want && req.get('x-bns-token') === want;
  const by = req.body && req.body.by;
  if (isBot && by === 'slack:deleted') return;                   // Slack ana mesaj silindi (Slack gated, yalnız bot yolu)
  const actor = req.user ? (req.user.slack_id || req.user.id) : (isBot ? by : null);
  if (actor) {
    const u = await pool.query("SELECT rol, yetki FROM users WHERE id=$1 LIMIT 1", [actor]);
    const r = u.rows[0];
    if (r && (r.rol === 'yonetici' || r.yetki === 'yonetici')) return;   // yönetici
    if (briefId) {
      const l = await pool.query("SELECT 1 FROM brief_assignees WHERE brief_id=$1 AND user_id=$2 AND role='lead' LIMIT 1", [briefId, actor]);
      if (l.rowCount > 0) return;                                // işin lead'i
      const c = await pool.query("SELECT 1 FROM briefs WHERE id=$1 AND created_by=$2 LIMIT 1", [briefId, actor]);
      if (c.rowCount > 0) return;                                // işi açan (created_by)
    }
  }
  const e = new Error('yetkisiz: bu işi silme yetkiniz yok (yalnız yönetici, işin lead\'i veya işi açan)');
  e.name = 'ZodError'; e.issues = [{ path: ['yetki'], message: 'yetkisiz' }];
  throw e;
}

// Soft delete + geri alma + kalıcı silme
// Kalıcı silme geri alınamaz → writeGuard JWT'yi doğrular, adminGuard rol=admin şartı koyar (bot token'ı yetmez)
app.delete('/api/briefs/:id/permanent', writeGuard, auth.adminGuard, handleWrite(req => writes.permanentDeleteBrief(+req.params.id, req.body?.by)));
app.delete('/api/briefs/:id',          writeGuard, handleWrite(async req => { await assertCanDeleteBrief(req, +req.params.id); return writes.deleteBrief(+req.params.id, req.body?.by); }));
app.delete('/api/briefs/by-ts/:ts',    writeGuard, handleWrite(async req => { const id = await writes.tsToId(req.params.ts); await assertCanDeleteBrief(req, id); return writes.deleteBrief(id, req.body?.by); }));
// SEC-8: restore de silme kadar yetki ister (aynı assertCanDeleteBrief kuralı).
app.post('/api/briefs/:id/restore',    writeGuard, handleWrite(async req => { await assertCanDeleteBrief(req, +req.params.id); return writes.restoreBrief(+req.params.id, req.body?.by); }));
app.post('/api/briefs/by-ts/:ts/restore', writeGuard, handleWrite(async req => { const id = await writes.tsToId(req.params.ts); await assertCanDeleteBrief(req, id); return writes.restoreBrief(id, req.body?.by); }));

// Kişisel iş kuyruğu sırası — yalnız kişinin kendisi veya admin. Body: { order: [briefId,...] }.
app.post('/api/users/:uid/queue', auth.authGuard, handleWrite(async req => {
  const uid = req.params.uid;
  const isSelf = req.user && (req.user.id === uid || req.user.slack_id === uid);
  // Kapsam: actor.sched_scope === 'all' → herkes; '<dept>' → yalnız o departman üyeleri; ayrıca kişinin kendisi.
  let allowed = !!isSelf;
  if (!allowed && req.user) {
    const me = await pool.query('SELECT sched_scope FROM users WHERE id=$1 OR id=$2 LIMIT 1', [req.user.id, req.user.slack_id || req.user.id]);
    const scope = me.rows[0] && me.rows[0].sched_scope;
    if (scope === 'all') allowed = true;
    else if (scope) { const t = await pool.query('SELECT dept FROM users WHERE id=$1', [uid]); allowed = !!(t.rows[0] && t.rows[0].dept === scope); }
  }
  if (!allowed) { const e = new Error('yetkisiz: bu kişinin iş sırasını değiştirme yetkiniz yok'); e.name = 'ZodError'; e.issues = [{ path: ['yetki'], message: 'yetkisiz' }]; throw e; }
  // by: setStatus şema STRING bekler; JWT'de id numerik (dashboard PK) olabilir → geçerli string users.id (slack_id) kullan.
  return writes.setQueue(uid, { order: req.body?.order, by: req.user && (req.user.slack_id || String(req.user.id)) });
}));

// Kanban kolon içi iş-sırası. Kapsam backend'de uygulanır: yalnız actor'ün yetkili olduğu brief'ler yazılır.
app.post('/api/kanban/reorder', auth.authGuard, handleWrite(async req => {
  let scope = null;
  if (req.user) {
    const me = await pool.query('SELECT sched_scope FROM users WHERE id=$1 OR id=$2 LIMIT 1', [req.user.id, req.user.slack_id || req.user.id]);
    scope = me.rows[0] && me.rows[0].sched_scope;
  }
  return writes.setKanbanOrder(req.body?.order, { id: req.user && (req.user.slack_id || String(req.user.id)), scope });
}));

// Onay anındaki son görseli kaydet (Slack bot ✅ handler'ından çağrılır, best-effort)
app.patch('/api/briefs/by-ts/:ts/set-image', botGuard, async (req, res) => {  // SEC-3b: yalnız Slack bot ✅ handler'ı yazar
  try {
    const { image_url } = req.body || {};
    if (!image_url) return res.status(400).json({ error: 'image_url gerekli' });
    const r = await pool.query(
      'UPDATE briefs SET image_url=$1 WHERE slack_ts=$2 RETURNING id',
      [image_url, req.params.ts]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'brief bulunamadı: ' + req.params.ts });
    res.json({ ok: true, id: r.rows[0].id });
  } catch (e) { console.error('[api] set-image hata:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
});

// Final teslim(ler): 📎 ile işaretlenen mesajın dosyaları → brief_attachments(is_final=true).
// Yeniden işaretleme = bu brief'in eski final'larını değiştir (idempotent).
app.post('/api/briefs/by-ts/:ts/final-deliverables', writeGuard, async (req, res) => {
  try {
    const id = await writes.tsToId(req.params.ts);
    if (!id) return res.status(404).json({ error: 'brief bulunamadı: ' + req.params.ts });
    const items = Array.isArray(req.body && req.body.items) ? req.body.items : [];
    await pool.query(`DELETE FROM brief_attachments WHERE brief_id=$1 AND is_final=true`, [id]);
    let n = 0;
    for (const it of items) {
      if (!it || !it.url) continue;
      // uploaded_by users(id) FK'li — geçerli U/FR id değilse NULL (backfill/bilinmeyen reactor FK'yi bozmasın).
      const by = (req.body && req.body.by && /^(U|FR)[A-Z0-9]+$/.test(req.body.by)) ? req.body.by : null;
      await pool.query(
        `INSERT INTO brief_attachments(brief_id,url,filename,mime,uploaded_by,source,is_final)
         VALUES ($1,$2,$3,$4,$5,'final',true)`,
        [id, it.url, it.filename || 'dosya', it.mime || '', by]);
      n++;
    }
    res.json({ ok: true, id, count: n });
  } catch (e) { console.error('[api] final-deliverables hata:', e.message); res.status(400).json({ error: e.message }); }
});
app.patch('/api/briefs/by-ts/:ts', writeGuard, handleWrite(async req => writes.patchBrief(await writes.tsToId(req.params.ts), req.body)));

// Thread özeti (AI) — thread-ozet.js scripti yazar. Bilinçli olarak sessiz: DM/thread notu YOK.
app.patch('/api/briefs/:id/thread-ozet', botGuard, async (req, res) => {  // SEC-3b: thread-ozet.js scripti yazar
  try {
    const { ozet, last_ts, ton } = req.body || {};
    if (!ozet) return res.status(400).json({ error: 'ozet gerekli' });
    const ton_ok = ['notr', 'gergin', 'memnun', 'acil'].includes(ton) ? ton : null;
    const r = await pool.query(
      'UPDATE briefs SET thread_ozet=$1, thread_ozet_at=now(), thread_ozet_ts=$2, thread_ton=$3 WHERE id=$4 RETURNING id',
      [String(ozet).slice(0, 4000), last_ts || null, ton_ok, +req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'brief bulunamadı: ' + req.params.id });
    res.json({ ok: true, id: r.rows[0].id });
  } catch (e) { console.error('[api] thread-ozet hata:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
});

// İş insight'ı (AI) — tamamlanan işler için; ileride marka/iş değerlendirmelerinde kullanılacak. Sessiz.
// puan (1-5) AI değerlendirmesinden gelir; yönetici elle verdiyse (rating_by≠'ai') AI üzerine yazamaz.
app.patch('/api/briefs/:id/insight', botGuard, async (req, res) => {  // SEC-3b: insight scripti yazar
  try {
    const { insight, puan, puan_sebep } = req.body || {};
    if (!insight) return res.status(400).json({ error: 'insight gerekli' });
    const aiPuan = Number.isInteger(puan) && puan >= 1 && puan <= 5 ? puan : null;
    // Deadline uzatma cezasını AI puanına uygula (formül calc.js'te tek kaynak). Yönetici override'ı etkilenmez.
    let p = aiPuan, sebep = puan_sebep ? String(puan_sebep).slice(0, 500) : null;
    if (aiPuan != null) {
      const cz = await pool.query('SELECT uzatma_ceza, uzatma_sayisi FROM briefs WHERE id=$1', [+req.params.id]);
      const ceza = cz.rows[0] ? (Number(cz.rows[0].uzatma_ceza) || 0) : 0;
      if (ceza > 0) {
        p = calc.bnsRatingWithPenalty(aiPuan, ceza);
        const ek = `(deadline ${cz.rows[0].uzatma_sayisi}× uzatıldı → puan ${aiPuan}'den ${p}'e: -${ceza})`;
        sebep = (sebep ? sebep + ' ' : '') + ek;
        sebep = sebep.slice(0, 500);
      }
    }
    const r = await pool.query(
      `UPDATE briefs SET insight=$1, insight_at=now(),
         rating    = CASE WHEN $3::real IS NOT NULL AND (rating_by IS NULL OR rating_by='ai') THEN $3 ELSE rating END,
         rating_by = CASE WHEN $3::real IS NOT NULL AND (rating_by IS NULL OR rating_by='ai') THEN 'ai' ELSE rating_by END,
         rating_at = CASE WHEN $3::real IS NOT NULL AND (rating_by IS NULL OR rating_by='ai') THEN now() ELSE rating_at END,
         rating_sebep = CASE WHEN $4::text IS NOT NULL AND (rating_by IS NULL OR rating_by='ai') THEN $4 ELSE rating_sebep END
       WHERE id=$2 RETURNING id`,
      [String(insight).slice(0, 4000), +req.params.id, p, sebep]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'brief bulunamadı: ' + req.params.id });
    res.json({ ok: true, id: r.rows[0].id });
  } catch (e) { console.error('[api] insight hata:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
});

// Yönetici puan override'ı — AI puanının üzerine yazar, AI bir daha dokunamaz.
app.patch('/api/briefs/:id/rating', auth.authGuard, auth.adminGuard, async (req, res) => {
  try {
    const { rating } = req.body || {};
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating 1-5 olmalı' });
    const r = await pool.query(
      'UPDATE briefs SET rating=$1, rating_by=$2, rating_at=now() WHERE id=$3 RETURNING id',
      [rating, req.user.slack_id, +req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'brief bulunamadı: ' + req.params.id });
    res.json({ ok: true });
  } catch (e) { console.error('[api] rating hata:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
});

// Avatar senkronu — bot açılışta Slack profil fotoğraflarını buraya yazar.
app.patch('/api/users-avatar/:id', botGuard, async (req, res) => {  // SEC-3b: bot açılışta Slack avatar'larını yazar
  try {
    const { avatar_url } = req.body || {};
    if (!avatar_url) return res.status(400).json({ error: 'avatar_url gerekli' });
    const r = await pool.query('UPDATE users SET avatar_url=$1 WHERE id=$2 RETURNING id', [String(avatar_url).slice(0, 600), req.params.id]);
    res.json({ ok: true, updated: !!r.rows[0] });
  } catch (e) { res.status(500).json({ error: 'sunucu hatası' }); }
});

// ── Sistem Asistanı (dashboard chatbot) ─────────────────────────────────────
// Kullanım bilgisi (chat-bilgi.md) + canlı veri bağlamıyla Haiku. JWT zorunlu;
// kişi yıldız puanları bağlama SADECE admin ise girer (UI gizlilik kuralıyla aynı).
const CHAT_BILGI = (() => {
  try { return require('fs').readFileSync(require('path').join(__dirname, 'chat-bilgi.md'), 'utf8'); }
  catch (e) { console.error('[chat] bilgi dosyası okunamadı:', e.message); return ''; }
})();
const chatReqSeq = new Map();   // ody-gönderim onay sırası (kullanıcı başına)
// ── ODY SOHBET ÇEKİRDEĞİ ────────────────────────────────────────────────────
// Dashboard (/api/chat) ve Slack DM (/api/ody-dm) aynı beyni paylaşır.
// Davranış /api/chat'in eski gövdesiyle birebir; yalnız req/res bağımlılığı çıkarıldı.
async function odyChatRun({ user, isAdmin, msgs, range, kanal }) {
    const ed = await getEmbedded();   // tek fetch; tüm tool çağrıları paylaşır
    // Ody-gönderim onay garantisi: kullanıcı başına istek sırası — onay ancak önizlemeden
    // SONRAKİ istekte geçerli (ody-tools slack_gonder_onayla reqSeq karşılaştırır).
    const _seqKey = user.slack_id || String(user.id);
    const reqSeq = (chatReqSeq.get(_seqKey) || 0) + 1; chatReqSeq.set(_seqKey, reqSeq);
    const ctx = { user, isAdmin, range, ed, reqSeq };

    // ── SUNUCU-TARAFI ONAY TESPİTİ (Ody-gönderim) ──────────────────────
    // Bekleyen gönderi varken kullanıcının SON mesajı kısa bir onay ifadesiyse ctx.onay=true.
    // Onayı LLM değil SUNUCU tespit eder: LLM onay turunda önizlemeyi yeniden üretse/metni
    // değiştirse bile döngü oluşmaz, gönderim tek "evet" ile tamamlanır.
    try {
      const sonMesaj = String([...msgs].reverse().find(m => m.role !== 'assistant')?.content || '').trim();
      ctx.onay = odyTools.gonderBekliyor(user.slack_id)
        && sonMesaj.length <= 60
        && /(^|\s)(evet|onay(l[ıi]yorum|la)?|g[öo]nder(ebil[a-zçğıöşü]*)?|olur|tamam(d[ıi]r)?|yes|ok(ey)?|send)\b/i.test(sonMesaj)
        && !/(g[öo]nderme|onaylam[ıi]yorum|hay[ıi]r|iptal|dur|vazge[çc])/i.test(sonMesaj);
    } catch (e) { ctx.onay = false; }

    // ── KİŞİ-BAZLI ÖĞRENME ─────────────────────────────────────────────
    // Bu kişinin geçmiş soruları (sık ilgilendiği konular) + olumsuz geri bildirim dersleri →
    // prompt'a beslenir ki kendine has tekrar eden sorulara daha hızlı/isabetli yardım edilsin.
    // YALNIZ kendi geçmişi (çapraz kişi sızıntısı yok; hiyerarşiyle uyumlu).
    let userMemory = '';
    try {
      const [lg, fb] = await Promise.all([
        // Yalnız kesin kimlik eşleşmesi (user_id / slack_id). user_name benzersiz olmadığından
        // eşleştirmeye DAHİL EDİLMEZ — aynı isimli kişiler arası çapraz sızıntıyı önler.
        pool.query(`SELECT soru FROM ody_chat_log WHERE (user_id=$1 OR user_id=$2) AND soru IS NOT NULL
                    ORDER BY created_at DESC LIMIT 20`, [String(user.id || ''), user.slack_id || '']),
        pool.query(`SELECT reason FROM ody_advice_feedback WHERE user_id=$1 AND vote='down' AND reason IS NOT NULL
                    ORDER BY created_at DESC LIMIT 3`, [user.slack_id || '']),
      ]);
      const sorular = [...new Set(lg.rows.map(r => String(r.soru).trim()).filter(Boolean))].slice(0, 10);
      if (sorular.length) {
        userMemory += `\n\n## BU KİŞİYE ÖZEL ÖĞRENME (gizli, ${user.name})\n` +
          `${user.name} geçmişte şunları sordu — sık ilgilendiği konuları TANI; bunlardan birine benzer bir soru gelirse hızlı ve isabetli davran, doğru tool'u doğrudan çağır, gereksiz soru sorma:\n- ` +
          sorular.join('\n- ');
      }
      if (fb.rows.length) {
        userMemory += `\nGeçmiş olumsuz geri bildirimden DERS (tekrarlama, daha iyisini yap):\n- ` +
          fb.rows.map(r => String(r.reason).slice(0, 160)).join('\n- ');
      }
    } catch (e) { /* öğrenme bağlamı best-effort; başarısızsa sessiz geç */ }

    // ── GENEL FEEDBACK ÖĞRENME (P3.2 V1) ───────────────────────────────
    // Tüm kullanıcıların downvote'ladığı öneri tarzlarını (son 20) prompt'a beslenir:
    // "şu tarz beğenilmedi, tekrarlama". Kişiden bağımsız; best-effort.
    let fbBlok = '';
    try {
      const fb = await pool.query(`SELECT advice_text, reason FROM ody_advice_feedback WHERE vote='down' ORDER BY created_at DESC LIMIT 20`);
      const oz = odyTools.bnsFeedbackOzet(fb.rows);
      if (oz) fbBlok = `\n## GEÇMİŞ GERİ BİLDİRİM\nKullanıcılar şu tarz önerileri beğenmedi — tekrarlama, daha somut/farklı yaklaş: ${oz}\n`;
    } catch (e) {}

    const system =
      `Senin adın Ody. Sadece bir yapay zekâ asistanı değil; aynı zamanda Benseno Tasarım Sistemi'nin bir ÇALIŞANI ve DANIŞMANISIN. (Slack botunun adı WT'dir.) ` +
      `Şu an seninle GİRİŞ YAPMIŞ kişi: ${user.name}${isAdmin ? ' (yönetici)' : ''}. Onunla bu kişiye özel, ismiyle, sıcak ve yardımsever konuş — kiminle konuştuğunu bil ve ona göre cevap ver. ` +
      `Türkçe, net ve öz konuş; gerektiğinde adım adım yönlendir, fırsat varsa proaktif öneri sun. İnsanlara yardım etmeye isteklisin.\n\n` +
      `## SAYILAR DAİMA VERİTABANINDAN\n` +
      `Sayısal her şey (iş sayıları, listeler, puanlar, kapasite, gecikme, olgular) SADECE sana verilen TOOL'lardan gelir. Bir sayı/olgu söylemeden ÖNCE ilgili tool'u çağır; sonucu BİREBİR kullan — asla kendin sayma, tahmin etme, uydurma. Tool boş/0 dönerse açıkça "yok" de.\n\n` +
      `## YORUM/ÖNERİ İÇİN NİTEL VERİYİ HARMANLA\n` +
      `Özet, öneri, yorum, değerlendirme istendiğinde sadece kuru sayı verme. Nitel tool'ları (is_detay → thread özeti/insight/puan sebebi; insightlar → işlerin özet/insight metinleri; yildiz_karne → puan + yorum; marka_dokumu → kanal özeti/son insight/yorum) çağır ve bunları sayısal verilerle HARMANLA: bağlam kat, neden-sonuç kur, somut öneri sun. Sayısal kısım hep DB'den; yorum kısmı bu nitel kaynaklardan beslenir. Bir işi/markayı/kişiyi değerlendirirken önce ilgili nitel tool'u çağırmayı düşün.\n\n` +
      `## SLACK'TEN CANLI BİLGİ\n` +
      `Slack'te olan TAZE bilgi gerektiğinde (bir markanın kanalında bugün ne konuşuldu, bir işin ham Slack thread'i, bir konuyu tüm kanallarda arama, bir kişinin tatil/izin/çevrimiçi durumu) slack_sorgu tool'unu çağır ve dönen ham veriyi YORUMLA — özetle, bağlam kat. Kullanıcı YALNIZ eriştiği Slack kanallarının bilgisini görür; tool "erişimin yok" derse bunu kibarca ilet. Arama kapalıysa (tool öyle derse) kullanıcıya belirt.\n\n` +
      `Kullanıcı Slack'e mesaj GÖNDERMENİ açıkça isterse slack_gonder'ı çağır; dönen önizlemeyi kullanıcıya AYNEN göster ve onay iste. Kullanıcı açık onay (evet/gönder) verdikten sonra YALNIZ slack_gonder_onayla'yı çağır (elindeki onay koduyla) — slack_gonder'ı TEKRAR ÇAĞIRMA, önizlemeyi yeniden gösterme, ikinci kez onay isteme. Onay = tek adım: kullanıcı bir kez evet dedi mi mesaj gider. Onay almadan onaylama aracını ASLA çağırma; kullanıcı istemeden gönderim teklif etme.\n\n` +
      `## HİYERARŞİ AMA BİLGİSİZ BIRAKMA\n` +
      (isAdmin
        ? `Bu kişi yönetici: tüm kişi/departman/marka puanlarına ve kıyaslara erişebilir.\n`
        : `Bu kişi yönetici DEĞİL: başka kişilerin puanı, performans kıyası gibi yönetici-özel bilgileri PAYLAŞMA. Ama kişiyi bilgisiz bırakma — kendi işlerini, kapasitesini, genel durumu ve genel bilgileri serbestçe ver. Veremediğinde "bu bilgi yöneticilere özel" diye NEDENİYLE açıkla, sonra yapabileceğini öner.\n`) +
      `Kişiye özel sorularda ("benim işlerim", "bugün ne yapmalıyım") kisi olarak "${user.name}" ile tool çağır. Genel soruları ("kaç iş gecikti") genel tool'larla yanıtla.\n\n` +
      `## BELİRSİZLİK & YARDIM EDEMEME\n` +
      `Bir tool {belirsiz:true, adaylar:[...]} dönerse kendin seçme — hangisini kastettiğini SOR. Bir isteği karşılayamıyorsan (veri yok / yetki yok / kapsam dışı), "karşılayamadım" gibi BOŞ bir cevap verme; NEDENİNİ net söyle ve mümkünse alternatif/yapabileceğini öner. Her zaman yardımcı olmaya çalış.\n\n` +
      `# SİSTEM KULLANIM BİLGİSİ\n` + CHAT_BILGI + userMemory + fbBlok;

    const convo = msgs.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 4000) }));

    // ── NİYET-BAZLI MODEL SEÇİMİ ───────────────────────────────────────
    // Rutin/sayısal sorular → Sonnet (hızlı/ucuz). Sentez-ağır (analiz/değerlendir/öneri/özet/
    // karşılaştır/strateji/neden) → Opus (daha zengin yorum). Sayılar her iki halde de tool'dan = aynı doğruluk.
    const SONNET = 'claude-sonnet-4-6';
    const OPUS = process.env.ODY_OPUS_MODEL || 'claude-opus-4-7';   // thread-ozet.js'te kullanılan, hesapta erişilebilir Opus
    const lastUserMsg = String([...msgs].reverse().find(m => m.role !== 'assistant')?.content || '');
    const SYNTH_RE = /(analiz|değerlendir|degerlendir|yorumla|\byorum\b|öner|oner|tavsiye|özetle|ozetle|\bözet\b|\bozet\b|strateji|karşılaştır|karsilastir|kıyas|kiyas|sentez|neden|niçin|nicin|niye|durumu.*(özetle|degerlendir|değerlendir|yorumla))/i;
    let model = SYNTH_RE.test(lastUserMsg) ? OPUS : SONNET;
    let modelUsed = model;

    let final = '';
    let blocks = [];        // son AI yanıt blokları (döngü sonrası boş-cevap güvenliği için kapsam dışına taşındı)
    const toolsUsed = [];   // sohbet logu için çağrılan tool adları (sırayla)
    let turnsUsed = 0;
    const MAX_TURNS = 5;
    // think === false → düşünme KAPALI (boş-cevap retry'ında metni zorlamak için).
    const aiCall = (mdl, withTools, think) => fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: mdl, max_tokens: 4000, system,
        ...(think === false ? {} : { thinking: { type: 'adaptive' } }),
        ...(withTools ? { tools: odyTools.TOOLS } : {}),
        messages: convo,
      }),
    });
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      turnsUsed = turn + 1;
      const withTools = turn < MAX_TURNS - 1;
      let r = await aiCall(model, withTools);
      let j = await r.json().catch(() => ({}));
      // Opus erişilemez/hatalıysa Sonnet'e GÜVENLİ DÜŞÜŞ (kullanıcı yine cevap alsın).
      if (!r.ok && model !== SONNET) {
        console.warn('[chat] opus(' + model + ') düştü → sonnet:', j.error?.message || r.status);
        model = SONNET; modelUsed = SONNET;
        r = await aiCall(model, withTools);
        j = await r.json().catch(() => ({}));
      }
      if (!r.ok) { console.error('[chat] AI hata:', j.error?.message || r.status); const err = new Error('asistan şu an yanıt veremiyor'); err.status = 502; throw err; }
      blocks = j.content || [];
      final = blocks.filter(c => c.type === 'text').map(c => c.text).join('').trim();
      if (j.stop_reason !== 'tool_use') break;
      // Tool çağrılarını çalıştır, sonuçları konuşmaya ekle.
      convo.push({ role: 'assistant', content: blocks });
      const toolResults = [];
      for (const b of blocks) {
        if (b.type !== 'tool_use') continue;
        toolsUsed.push(b.name);
        const out = await odyTools.runTool(b.name, b.input, ctx);
        toolResults.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out) });
      }
      convo.push({ role: 'user', content: toolResults });
    }
    // Boş-cevap güvenliği: model yalnız düşünme bloğu döndürüp metin vermediyse (final boş),
    // convo zaten 'user' ile biter (kırılan tur asistanı convo'ya eklenmez) → asistan/thinking
    // bloğu GERİ GÖNDERME (signature uyuşmazlığı 400'e yol açardı). Düşünme KAPALI + tool yok
    // ile bir kez daha çağır → model metni üretmek ZORUNDA.
    if (!final) {
      try {
        const r2 = await aiCall(SONNET, false, false);
        const j2 = await r2.json().catch(() => ({}));
        if (r2.ok) { final = (j2.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim(); modelUsed = SONNET; }
        else console.error('[chat] boş-cevap retry başarısız:', j2.error?.message || r2.status);
      } catch (e) { console.error('[chat] boş-cevap retry hata:', e.message); }
    }
    const reply = final || 'İsteğini tam karşılayamadım, tekrar dener misin?';
    // Sohbet logu — best-effort, yanıtı bloklamaz (doğruluk gözlemlenebilirliği).
    const soru = String(msgs[msgs.length - 1]?.content || '').slice(0, 2000);
    pool.query(
      `INSERT INTO ody_chat_log(user_id, user_name, role, soru, tools, tool_sayisi, turlar, yanit, kanal)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)`,
      [user.id || user.slack_id || null, user.name || null, user.role || null,
       soru, JSON.stringify(toolsUsed), toolsUsed.length, turnsUsed, reply.slice(0, 4000), kanal || 'dashboard']
    ).catch(e => console.error('[chat] log yazılamadı:', e.message));
    return reply;
}

app.post('/api/chat', auth.authGuard, llmLimiter, async (req, res) => {
  try {
    const msgs = Array.isArray(req.body?.messages) ? req.body.messages.slice(-12) : [];
    if (!msgs.length) return res.status(400).json({ error: 'messages gerekli' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'asistan yapılandırılmamış' });
    const rb = req.body?.range;
    const range = (rb && typeof rb.from === 'number' && typeof rb.to === 'number') ? { from: rb.from, to: rb.to } : null;
    const reply = await odyChatRun({ user: req.user, isAdmin: req.user.role === 'admin', msgs, range, kanal: 'dashboard' });
    res.json({ reply });
  } catch (e) {
    console.error('[chat] hata:', e.message);
    res.status(e.status || 500).json({ error: e.status === 502 ? 'asistan şu an yanıt veremiyor' : 'sunucu hatası' });
  }
});

// ── ODY SLACK DM DİYALOĞU ───────────────────────────────────────────────────
// Bot'a gelen DM'leri Ody beynine bağlar: okur, kaydeder (kanal='slack-dm'),
// yetki dahilinde aksiyon alır. Kimlik = Slack'in doğruladığı event.user.
// Sunucu-bellek DM geçmişi: kişi başına son 10 mesaj, 2 saat TTL.
const _dmGecmis = new Map();   // slackId → { msgs: [{role,content}], ts }
app.post('/api/ody-dm', writeGuard, llmLimiter, async (req, res) => {
  try {
    const slackId = String(req.body?.slack_id || '');
    const text = String(req.body?.text || '').trim().slice(0, 4000);
    if (!/^U/.test(slackId) || !text) return res.status(400).json({ error: 'slack_id ve text gerekli' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'asistan yapılandırılmamış' });
    const ed = await getEmbedded();
    const kisi = (ed.bns_users || []).find(x => x.id === slackId);
    if (!kisi) return res.json({ reply: 'Merhaba! Seni sistemde tanıyamadım — Görkem ile iletişime geçebilirsin. 🙏' });
    const isAdmin = kisi.rol === 'yonetici' || kisi.yetki === 'yonetici';
    const user = { id: slackId, slack_id: slackId, name: kisi.name, role: isAdmin ? 'admin' : 'user' };
    const g = _dmGecmis.get(slackId);
    const gecmis = (g && Date.now() - g.ts < 2 * 60 * 60 * 1000) ? g.msgs : [];
    const msgs = [...gecmis, { role: 'user', content: text }].slice(-10);
    const reply = await odyChatRun({ user, isAdmin, msgs, range: null, kanal: 'slack-dm' });
    _dmGecmis.set(slackId, { msgs: [...msgs, { role: 'assistant', content: reply }].slice(-10), ts: Date.now() });
    res.json({ reply });
  } catch (e) {
    console.error('[ody-dm] hata:', e.message);
    res.status(e.status || 500).json({ error: 'sunucu hatası' });
  }
});

// ── Bildirimler (dashboard zili) ────────────────────────────────────────────
// Kendi bildirimlerim — JWT'deki slack_id ile; başkasınınki okunamaz.
app.get('/api/notifications', auth.authGuard, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, text, link, created_at, read_at FROM notifications
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`, [req.user.slack_id]);
    // unread: son-30 listesinden değil, tablodan tam sayı (LIMIT'ten bağımsız; okundu kolonu: read_at).
    const c = await pool.query(
      `SELECT count(*)::int AS unread FROM notifications WHERE user_id=$1 AND read_at IS NULL`, [req.user.slack_id]);
    res.json({ notifications: r.rows, unread: c.rows[0].unread });
  } catch (e) { res.status(500).json({ error: 'sunucu hatası' }); }
});
app.post('/api/notifications/read', auth.authGuard, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL', [req.user.slack_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'sunucu hatası' }); }
});
// authGuard → kişinin slack_id'sinden okur/yazar. notify_prefs(user_id PK, ...bool, sessiz_bas/bit smallint).
app.get('/api/notify-prefs', auth.authGuard, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM notify_prefs WHERE user_id=$1', [req.user.slack_id]);
    res.json(r.rows[0] || { ogle_dijest: true, tip_termin: true, tip_atama: true, tip_bloke: true, sessiz_bas: 19, sessiz_bit: 8, ody_icgoru: true });
  } catch (e) { res.status(500).json({ error: 'sunucu hatası' }); }
});

app.post('/api/notify-prefs', auth.authGuard, async (req, res) => {
  try {
    const b = req.body || {};
    const bool = (v, d) => typeof v === 'boolean' ? v : d;
    const hour = (v, d) => (Number.isInteger(v) && v >= 0 && v <= 23) ? v : d;
    // Kısmi gövde mevcut ayarları EZMESİN: önce mevcut satırı oku, gelmeyen alan mevcut değeri (yoksa varsayılanı) korur.
    const cur = (await pool.query('SELECT * FROM notify_prefs WHERE user_id=$1', [req.user.slack_id])).rows[0] || {};
    await pool.query(
      `INSERT INTO notify_prefs (user_id, ogle_dijest, tip_termin, tip_atama, tip_bloke, sessiz_bas, sessiz_bit, ody_icgoru, tip_firma_sinyal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (user_id) DO UPDATE SET ogle_dijest=$2, tip_termin=$3, tip_atama=$4, tip_bloke=$5, sessiz_bas=$6, sessiz_bit=$7, ody_icgoru=$8, tip_firma_sinyal=$9`,
      [req.user.slack_id,
       bool(b.ogle_dijest, cur.ogle_dijest ?? true), bool(b.tip_termin, cur.tip_termin ?? true),
       bool(b.tip_atama, cur.tip_atama ?? true), bool(b.tip_bloke, cur.tip_bloke ?? true),
       hour(b.sessiz_bas, cur.sessiz_bas ?? 19), hour(b.sessiz_bit, cur.sessiz_bit ?? 8),
       bool(b.ody_icgoru, cur.ody_icgoru ?? true), bool(b.tip_firma_sinyal, cur.tip_firma_sinyal ?? true)]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// İşe/markaya göre TEKİL bildirim sayıları — kişinin seen zamanından sonrası.
app.get('/api/notif-counts', auth.authGuard, async (req, res) => {
  try {
    const uid = req.user.slack_id;
    const r = await pool.query(`
      WITH tekil AS (
        SELECT DISTINCT ON (n.brief_id, n.tip, n.text) n.brief_id, n.marka, n.created_at
        FROM notifications n
        WHERE n.brief_id IS NOT NULL AND n.user_id = $1  -- yalnız kişinin KENDİ bildirimleri sayılır
        ORDER BY n.brief_id, n.tip, n.text, n.created_at DESC
      )
      SELECT t.brief_id, t.marka, count(*) AS cnt, max(t.created_at) AS last_at
      FROM tekil t
      LEFT JOIN brief_notif_seen s ON s.user_id=$1 AND s.brief_id=t.brief_id
      WHERE t.created_at > COALESCE(s.seen_at, now() - interval '7 days')
      GROUP BY t.brief_id, t.marka`, [uid]);
    const briefs = {}, markalar = {};
    for (const row of r.rows) {
      briefs[row.brief_id] = { count: +row.cnt, last_at: row.last_at };
      if (row.marka) {
        markalar[row.marka] = markalar[row.marka] || { count: 0, last_at: null };
        markalar[row.marka].count += +row.cnt;
        if (!markalar[row.marka].last_at || row.last_at > markalar[row.marka].last_at) markalar[row.marka].last_at = row.last_at;
      }
    }
    res.json({ briefs, markalar });
  } catch (e) { res.status(500).json({ error: 'sunucu hatası' }); }
});

// Bir işin tekil bildirim listesi (son 30) — kişinin KENDİ bildirimleri.
app.get('/api/briefs/:id/notifications', auth.authGuard, async (req, res) => {
  try {
    // unread = bu kullanıcının bu işe ait seen_at'inden SONRA oluşan bildirim (okunmamış).
    const r = await pool.query(`
      SELECT DISTINCT ON (tip, text) tip, text, link, created_at,
        (created_at > COALESCE((SELECT seen_at FROM brief_notif_seen WHERE user_id=$2 AND brief_id=$1), 'epoch'::timestamptz)) AS unread
      FROM notifications WHERE brief_id=$1 AND user_id=$2
      ORDER BY tip, text, created_at DESC LIMIT 30`, [+req.params.id, req.user.slack_id]);
    res.json({ notifications: r.rows.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)) });
  } catch (e) { res.status(500).json({ error: 'sunucu hatası' }); }
});

// Görüldü işaretle (rozet söner).
app.post('/api/briefs/:id/notif-seen', auth.authGuard, async (req, res) => {
  try {
    await pool.query(`INSERT INTO brief_notif_seen (user_id, brief_id, seen_at) VALUES ($1,$2,now())
      ON CONFLICT (user_id, brief_id) DO UPDATE SET seen_at=now()`, [req.user.slack_id, +req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Hatırlat/dürt — işin lead+worker'larına (isteği yapan hariç) bildirim.
app.post('/api/briefs/:id/remind', auth.authGuard, async (req, res) => {
  try {
    const id = +req.params.id;
    const actor = req.user.slack_id;
    const bi = (await pool.query(`SELECT no, baslik, slack_url, slack_channel, slack_ts, created_by FROM briefs WHERE id=$1`, [id])).rows[0];
    if (!bi) return res.status(404).json({ error: 'brief bulunamadı' });
    // Yetki (P3.4c): yönetici, işin HERHANGİ bir atananı (lead/worker) veya işi açan hatırlatabilir (UI perms ile aynı).
    const u = (await pool.query(`SELECT rol, yetki FROM users WHERE id=$1 LIMIT 1`, [actor])).rows[0];
    const isMgr = !!(u && (u.rol === 'yonetici' || u.yetki === 'yonetici'));
    const isAssignee = (await pool.query(`SELECT 1 FROM brief_assignees WHERE brief_id=$1 AND user_id=$2 LIMIT 1`, [id, actor])).rowCount > 0;
    if (!isMgr && !isAssignee && bi.created_by !== actor) return res.status(403).json({ error: 'yetki yok' });
    // Tekrar koruması: son 10 dakikada aynı işe hatırlatma gittiyse tekrar spam'leme.
    const dup = await pool.query(
      `SELECT 1 FROM notifications WHERE brief_id=$1 AND text LIKE '%hatırlattı%' AND created_at > now() - interval '10 minutes' LIMIT 1`, [id]);
    if (dup.rowCount > 0) return res.status(429).json({ error: 'az önce hatırlatıldı' });
    const who = (await pool.query(`SELECT name FROM users WHERE id=$1`, [actor])).rows[0];
    const adi = who ? who.name : 'Biri';
    const txt = `🔔 ${adi} hatırlattı: #${bi.no} ${bi.baslik || ''}`;
    const a = await pool.query(`SELECT DISTINCT user_id FROM brief_assignees WHERE brief_id=$1 AND role IN ('contributor','lead')`, [id]);
    let sent = 0;
    for (const row of a.rows) {
      if (!/^U/.test(row.user_id || '') || row.user_id === actor) continue;   // kendine gönderme
      await notify(row.user_id, { tip: 'genel', aciliyet: 'acil', text: txt, link: bi.slack_url || null, briefId: id });
      sent++;
    }
    // İş'in Slack thread'ine de görünür bir not düş (best-effort — thread yoksa/hata olursa yut).
    if (bi.slack_channel && bi.slack_ts && slack.hasToken()) {
      try { await slack.postThread({ channel: bi.slack_channel, thread_ts: bi.slack_ts, text: txt }); }
      catch (e) { console.error('[remind] thread notu hata:', e.message); }
    }
    res.json({ ok: true, sent });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Script'lerin (uyarı DM'leri) bildirim düşmesi için — writeGuard.
app.post('/api/notifications', botGuard, async (req, res) => {  // SEC-2: script uyarı DM'leri yazar; dashboard erişmemeli (iç phishing yüzeyi)
  try {
    const { user_id, text, link } = req.body || {};
    if (!user_id || !text) return res.status(400).json({ error: 'user_id ve text gerekli' });
    await pool.query('INSERT INTO notifications (user_id, text, link) VALUES ($1,$2,$3)',
      [user_id, String(text).slice(0, 1000), link || null]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'sunucu hatası' }); }
});

// ── Kapasite v2 saatlik arşivi (hibrit) ─────────────────────────────────────
// Hesap SCRIPT'te (scheduler imajında calc var; server imajında YOK — 502 dersi).
// Server yalnız saklar/sunar. POST: scripts/kapasite-snapshot.js saatlik batch yazar.
app.post('/api/kapasite-snapshot', writeGuard, async (req, res) => {
  try {
    const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error: 'rows boş' });
    // Saatlik dedup: aynı saat penceresinde firma kaydı varsa (manuel/çift koşu) toptan atla.
    const dup = await pool.query(
      `SELECT 1 FROM kapasite_snapshot WHERE scope='firma' AND ts > now() - interval '50 minutes' LIMIT 1`);
    if (dup.rowCount) return res.json({ ok: true, skipped: true });
    const vals = [], ph = [];
    rows.slice(0, 200).forEach((r, i) => {
      if (!r || typeof r.scope !== 'string' || !Number.isFinite(+r.pct)) return;
      vals.push(r.scope.slice(0, 60), Math.round(+r.pct));
      ph.push(`($${vals.length - 1}, $${vals.length})`);
    });
    if (!ph.length) return res.status(400).json({ error: 'geçerli satır yok' });
    await pool.query(`INSERT INTO kapasite_snapshot (scope, pct) VALUES ${ph.join(',')}`, vals);
    res.json({ ok: true, inserted: ph.length });
  } catch (e) { console.error('[api] kapasite-snapshot:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
});
// Arşiv okuma (dashboard/Ody/raporlar): ?scope=firma&days=30
app.get('/api/kapasite-arsiv', readGuard, async (req, res) => {
  try {
    const scope = String(req.query.scope || 'firma').slice(0, 60);
    const days = Math.min(180, Math.max(1, parseInt(req.query.days, 10) || 30));
    const r = await pool.query(
      `SELECT ts, pct FROM kapasite_snapshot WHERE scope=$1 AND ts > now() - ($2 || ' days')::interval ORDER BY ts`,
      [scope, days]);
    res.json({ scope, rows: r.rows });
  } catch (e) { res.status(500).json({ error: 'sunucu hatası' }); }
});

// Ody öneri geri bildirimi (beğen/beğenme + sebep + yeniden-değerlendirme sonucu).
// Giriş yapan kişiye bağlı; ileride Ody'nin öğrenmesi/raporlama için saklanır.
app.post('/api/ody/advice-feedback', auth.authGuard, async (req, res) => {
  try {
    const { notifId, vote, reason, adviceText, outcome } = req.body || {};
    if (vote !== 'up' && vote !== 'down') return res.status(400).json({ error: 'vote up|down olmalı' });
    if (outcome && outcome !== 'kept' && outcome !== 'revised') return res.status(400).json({ error: 'outcome kept|revised olmalı' });
    const r = await pool.query(
      `INSERT INTO ody_advice_feedback (user_id, notif_id, advice_text, vote, reason, reevaluated, outcome)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [req.user.slack_id, Number.isInteger(notifId) ? notifId : null,
       adviceText ? String(adviceText).slice(0, 4000) : null, vote,
       reason ? String(reason).slice(0, 1000) : null, !!outcome, outcome || null]);
    res.json({ ok: true, id: r.rows[0].id });
  } catch (e) { res.status(500).json({ error: 'sunucu hatası' }); }
});

// Yıldız karnesi sebep açıklaması (AI) — gün-sonu turu yazar. Sessiz upsert.
app.post('/api/rating-sebep', botGuard, async (req, res) => {  // SEC-3b: gün-sonu turu yazar
  try {
    const { type, key, sebep, rating_avg, rating_count } = req.body || {};
    if (!type || !key || !sebep) return res.status(400).json({ error: 'type, key, sebep gerekli' });
    const s = String(sebep).slice(0, 1000);
    // En güncel snapshot (geriye uyum).
    await pool.query(`
      INSERT INTO entity_sebep (type, key, sebep, rating_avg, rating_count, updated_at)
      VALUES ($1,$2,$3,$4,$5,now())
      ON CONFLICT (type, key) DO UPDATE SET sebep=$3, rating_avg=$4, rating_count=$5, updated_at=now()`,
      [type, key, s, rating_avg ?? null, rating_count ?? null]);
    // Tarihli arşiv — bugünün (TR) satırı; gün içinde tekrar üretilirse son hali kalır.
    await pool.query(`
      INSERT INTO entity_sebep_history (type, key, gun, sebep, rating_avg, rating_count)
      VALUES ($1,$2,(now() AT TIME ZONE 'Europe/Istanbul')::date,$3,$4,$5)
      ON CONFLICT (type, key, gun) DO UPDATE SET sebep=$3, rating_avg=$4, rating_count=$5, created_at=now()`,
      [type, key, s, rating_avg ?? null, rating_count ?? null]);
    res.json({ ok: true });
  } catch (e) { console.error('[api] rating-sebep hata:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
});

// Marka günlük arşivi — tarih filtresiyle geçmiş kanal özetleri + gün-sonu insight'ları
app.get('/api/brands/by-name/:name/daily', readGuard, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT d.tarih, d.ozet, d.insight
      FROM brand_daily d JOIN brands b ON b.id = d.brand_id
      WHERE b.name = $1 ORDER BY d.tarih DESC LIMIT 90`, [req.params.name]);
    res.json({ daily: r.rows });
  } catch (e) { res.status(500).json({ error: 'sunucu hatası' }); }
});

// Marka kanal özeti (AI) — kanal-ozet.js scripti yazar. Sessiz.
app.patch('/api/brands/by-name/:name/kanal-ozet', botGuard, async (req, res) => {  // SEC-3b: kanal-ozet.js scripti yazar
  try {
    const { ozet, last_ts } = req.body || {};
    if (!ozet) return res.status(400).json({ error: 'ozet gerekli' });
    const r = await pool.query(
      'UPDATE brands SET kanal_ozet=$1, kanal_ozet_at=now(), kanal_ozet_ts=$2 WHERE name=$3 RETURNING id',
      [String(ozet).slice(0, 4000), last_ts || null, req.params.name]);
    if (!r.rows[0]) return res.status(404).json({ error: 'marka bulunamadı: ' + req.params.name });
    res.json({ ok: true });
  } catch (e) { console.error('[api] kanal-ozet hata:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
});

// Marka gün-sonu insight'ı — günde bir, brand_daily'ye arşivlenir (ileride marka değerlendirmeleri için).
app.post('/api/brands/by-name/:name/gun-sonu', botGuard, async (req, res) => {  // SEC-3b: gün-sonu turu yazar
  try {
    const { insight, ozet } = req.body || {};
    if (!insight) return res.status(400).json({ error: 'insight gerekli' });
    const r = await pool.query(`
      INSERT INTO brand_daily (brand_id, tarih, ozet, insight)
      SELECT id, (now() AT TIME ZONE 'Europe/Istanbul')::date, $2, $3 FROM brands WHERE name=$1
      ON CONFLICT (brand_id, tarih) DO UPDATE SET ozet=COALESCE(EXCLUDED.ozet, brand_daily.ozet), insight=EXCLUDED.insight
      RETURNING id`,
      [req.params.name, ozet ? String(ozet).slice(0, 4000) : null, String(insight).slice(0, 4000)]);
    if (!r.rows[0]) return res.status(404).json({ error: 'marka bulunamadı: ' + req.params.name });
    res.json({ ok: true });
  } catch (e) { console.error('[api] gun-sonu hata:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
});

// KPI anlık görüntüsü — saatlik thread bakımı tetikler; Overview spark grafiklerinin gerçek verisi.
app.post('/api/kpi-snapshot', botGuard, async (req, res) => {  // SEC-3b: saatlik thread bakımı tetikler
  try {
    const r = await pool.query(`
      INSERT INTO kpi_history (active, overdue, today, review, stale, musteride)
      SELECT
        count(*) FILTER (WHERE durum <> 'musteride')::int,
        count(*) FILTER (WHERE durum <> 'musteride' AND deadline < now())::int,
        count(*) FILTER (WHERE (deadline AT TIME ZONE 'Europe/Istanbul')::date = (now() AT TIME ZONE 'Europe/Istanbul')::date)::int,
        count(*) FILTER (WHERE durum = 'incelemede')::int,
        count(*) FILTER (WHERE stale)::int,
        count(*) FILTER (WHERE durum = 'musteride')::int
      FROM briefs WHERE completed_at IS NULL AND deleted_at IS NULL
      RETURNING id, ts, active, overdue`);
    res.json({ ok: true, snapshot: r.rows[0] });
  } catch (e) { console.error('[api] kpi-snapshot hata:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
});

// Hareketsizlik bayrağı + cevapsız uyarı işareti — thread-ozet.js yazar. Sessiz (DM/thread notu yok).
app.patch('/api/briefs/:id/stale', botGuard, async (req, res) => {  // SEC-3b: thread-ozet.js yazar
  try {
    const r = await pool.query('UPDATE briefs SET stale=$1 WHERE id=$2 RETURNING id', [!!req.body?.stale, +req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'brief bulunamadı: ' + req.params.id });
    res.json({ ok: true });
  } catch (e) { console.error('[api] stale hata:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
});
app.post('/api/briefs/:id/uyari', botGuard, async (req, res) => {  // SEC-3b: uyarı bayrağını script yazar
  try {
    const col = req.body?.level === 2 ? 'uyari2_at' : 'uyari_at';
    const r = await pool.query(`UPDATE briefs SET ${col}=now() WHERE id=$1 RETURNING id`, [+req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'brief bulunamadı: ' + req.params.id });
    res.json({ ok: true });
  } catch (e) { console.error('[api] uyari hata:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
});

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
    // SEC-1 (savunma derinliği): yalnız Slack-barındırılmış dosya URL'i kabul et — yabancı host DB'ye girmesin.
    if (!isSlackUrl(req.body.url)) return res.status(400).json({ error: 'yalnız Slack dosya URL\'i kabul edilir' });
    await pool.query(`INSERT INTO brief_attachments(brief_id,url,filename,mime,uploaded_by,source) VALUES ($1,$2,$3,$4,$5,'slack')`,
      [id, req.body.url || '', req.body.filename || null, null, req.body.by || null]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// SEC-1: Bot token YALNIZCA Slack host'larına gönderilir. attachments-meta url'i doğrulamasız
// yazıldığından (herhangi bir JWT üyesi), saldırgan url=https://evil.com koyup bu proxy'yi
// çağırırsa token dışarı sızardı. Fetch öncesi host'u allowlist'e sabitle.
function isSlackUrl(u) {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h === 'slack.com' || h === 'files.slack.com' || h.endsWith('.slack.com');
  } catch (e) { return false; }
}

// Slack görsel proxy — galeri için. Slack private URL → bot token ile çek → tarayıcıya ilet.
// NOT: /api/img bilinçli olarak PUBLIC — dashboard <img src> ile çağırır ve tarayıcı
// <img> isteğine Authorization başlığı EKLEYEMEZ. Düşük risk: yalnız briefe iliştirilmiş
// tasarım görselleri (finans/PII yok); id enumerasyonu en fazla görseli sızdırır.
app.get('/api/img/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT image_url FROM briefs WHERE id = $1', [+req.params.id]);
    const row = r.rows[0];
    if (!row || !row.image_url) return res.status(404).end();
    if (!isSlackUrl(row.image_url)) return res.status(400).end();   // SEC-1: token yalnız Slack host'una
    const slackRes = await fetch(row.image_url, {
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    });
    if (!slackRes.ok) return res.status(slackRes.status).end();
    res.set('Content-Type', slackRes.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    // global fetch web-stream döndürür — .pipe() yok; buffer'layıp gönder
    res.send(Buffer.from(await slackRes.arrayBuffer()));
  } catch (e) {
    console.error('[img-proxy] hata:', e.message);
    res.status(500).end();
  }
});

// Ek/teslim dosyası proxy'si (brief_attachments.id ile). /api/img gibi bilinçli PUBLIC —
// <img src>/indirme linki Authorization yollayamaz. Resimleri inline, diğerlerini indirme olarak servis eder.
app.get('/api/attachment/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT url, filename, mime FROM brief_attachments WHERE id=$1', [+req.params.id]);
    const row = r.rows[0];
    if (!row || !row.url) return res.status(404).end();
    if (!isSlackUrl(row.url)) return res.status(400).end();   // SEC-1: token yalnız Slack host'una
    const sres = await fetch(row.url, { headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` } });
    if (!sres.ok) return res.status(sres.status).end();
    const ct = sres.headers.get('content-type') || row.mime || 'application/octet-stream';
    res.set('Content-Type', ct);
    res.set('Cache-Control', 'public, max-age=86400');
    // Resim değilse indirme olarak sun (tarayıcı açmaya çalışmasın)
    if (!/^image\//.test(ct)) res.set('Content-Disposition', `inline; filename="${(row.filename || 'dosya').replace(/[^\w.\-]/g, '_')}"`);
    res.send(Buffer.from(await sres.arrayBuffer()));
  } catch (e) {
    console.error('[attachment-proxy] hata:', e.message);
    res.status(500).end();
  }
});

const PORT = process.env.PORT || 3001;
let server;
// Boot'ta bekleyen migration'ları uygula (idempotent). Başarısızsa DİNLEME — process çık;
// Railway yeni container'ı sağlıksız sayıp ESKİ (çalışan) sürümü korur → prod kırılmaz.
// Bu, ssh ile elle migrate zorunluluğunu kaldırır (0014 gibi kolon-şart bağımlılıkları güvenli).
(async () => {
  try {
    await require('./scripts/migrate').up();
    console.log('[api] migrations güncel');
  } catch (e) {
    console.error('[api] migration başarısız — boot iptal:', e.message);
    process.exit(1);
  }
  server = app.listen(PORT, () => console.log(`[api] dinleniyor :${PORT}`));
})();
module.exports = { app, get server() { return server; } };
