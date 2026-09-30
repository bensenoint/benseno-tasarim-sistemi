'use strict';

/**
 * portal.js — Müşteri Portalı Faz 1 (2026-09-30).
 * Dış müşteri (marka tarafındaki yönetici) kendi markasının işlerini takip eder.
 *
 * SEC-P kuralları:
 *  - /api/embedded ve diğer personel uçları müşteri token'ına KAPALI (auth.authGuard reddeder).
 *  - Marka kimliği HER ZAMAN JWT'den (req.musteri.marka_id) — parametreden asla.
 *  - Alan BEYAZ LİSTESİ: portalSatir()/portalDetay() dışında hiçbir alan çıkmaz.
 *    Yasaklar: maliyet, kâr, rating_by, HAM thread_ozet / rating_sebep (yalnız *_musteri
 *    yumuşatılmış versiyonlar), kişi puanları, diğer markalar. Satış TL+döviz GÖRÜNÜR (karar).
 *  - Login rate-limit: e-posta+IP başına 15 dk'da 5 deneme.
 */
const { pool } = require('./db');
const auth = require('./auth');

const TTL_PORTAL = '12h';

// ── login rate limit (bellek içi; tek instance) ──
const _den = new Map();   // anahtar → { n, ilk }
function loginLimit(anahtar) {
  const now = Date.now(), k = _den.get(anahtar);
  if (!k || now - k.ilk > 15 * 60e3) { _den.set(anahtar, { n: 1, ilk: now }); return true; }
  k.n++; return k.n <= 5;
}

// ── Beyaz liste: liste satırı (SAF fonksiyon — portal.test.js sızıntı kapısı bunu test eder) ──
function portalSatir(b) {
  return {
    no: b.no, baslik: b.baslik || '', durum: b.durum,
    faz_no: b.faz_no || 1, parent_no: b.parent_no || null,
    deadline: b.deadline ? new Date(b.deadline).getTime() : null,
    acilis: b.created_at ? new Date(b.created_at).getTime() : null,
    teslim: b.completed_at ? new Date(b.completed_at).getTime() : null,
    rev: b.rev || 0,
    rating: b.rating != null ? Number(b.rating) : null,
    satis: b.satis != null ? Number(b.satis) : null,                    // TL (karar: satış görünür)
    satis_doviz: b.satis_doviz || 'TL',
    satis_orij: b.satis_orij != null ? Number(b.satis_orij) : null,
  };
}
// Detay = satır + yumuşatılmış metinler + ekip adları + durum geçmişi (dışarıda hesaplanır)
function portalDetay(b, atananlar, gecmis) {
  return {
    ...portalSatir(b),
    musteri_notu: b.musteri_notu || null,
    ozet: b.thread_ozet_musteri || null,           // YALNIZ müşteri versiyonu — ham özet asla
    rating_sebep: b.rating_sebep_musteri || null,  // YALNIZ müşteri versiyonu
    atananlar: atananlar || [],                    // [{ad, rol}]
    gecmis: gecmis || [],                          // [{t, durum}]
  };
}
// Sızıntı kapısı: bu alanlar portal yanıtında ASLA olamaz (test + savunma katmanı).
const YASAK_ALANLAR = ['maliyet', 'satis_kur', 'rating_by', 'thread_ozet', 'rating_sebep_ham',
  'thread_ton', 'insight', 'fatura', 'odeme', 'slack_ts', 'slack_channel', 'created_by'];

function mountPortal(app) {
  // ── Giriş ──
  app.post('/api/portal/login', async (req, res) => {
    try {
      const email = String((req.body || {}).email || '').trim().toLowerCase();
      const sifre = String((req.body || {}).sifre || '');
      if (!email || !sifre) return res.status(400).json({ error: 'e-posta ve şifre gerekli' });
      const ip = req.headers['x-forwarded-for'] || req.ip || '?';
      if (!loginLimit(email + '|' + ip)) return res.status(429).json({ error: 'çok fazla deneme — 15 dk sonra tekrar deneyin' });
      const r = await pool.query(
        `SELECT m.*, br.name AS marka FROM musteri_kullanicilar m JOIN brands br ON br.id=m.marka_id
         WHERE m.email=$1 AND m.aktif`, [email]);
      const u = r.rows[0];
      if (!u || !(await auth.bcrypt.compare(sifre, u.sifre_hash)))
        return res.status(401).json({ error: 'e-posta veya şifre hatalı' });
      await pool.query('UPDATE musteri_kullanicilar SET last_login=now() WHERE id=$1', [u.id]);
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ role: 'musteri', mid: u.id, marka_id: u.marka_id, email: u.email },
        process.env.BNS_JWT_SECRET, { expiresIn: TTL_PORTAL });
      res.json({ token, ad: u.ad, marka: u.marka, sifre_degistir: !!u.sifre_degistir });
    } catch (e) { console.error('[portal] login:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
  });

  // ── İlk giriş / şifre değişimi ──
  app.post('/api/portal/sifre', auth.musteriGuard, async (req, res) => {
    try {
      const yeni = String((req.body || {}).yeni || '');
      if (yeni.length < 8) return res.status(400).json({ error: 'şifre en az 8 karakter olmalı' });
      const hash = await auth.bcrypt.hash(yeni, 10);
      await pool.query('UPDATE musteri_kullanicilar SET sifre_hash=$2, sifre_degistir=false WHERE id=$1',
        [req.musteri.mid, hash]);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'sunucu hatası' }); }
  });

  // ── İş listesi (yalnız kendi markası) ──
  app.get('/api/portal/isler', auth.musteriGuard, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT b.no, b.baslik, b.durum, b.faz_no, pb.no AS parent_no, b.deadline, b.created_at,
                b.completed_at, b.rev, b.rating, b.satis, b.satis_doviz, b.satis_orij
         FROM briefs b LEFT JOIN briefs pb ON pb.id=b.parent_id
         WHERE b.marka_id=$1 AND b.deleted_at IS NULL
         ORDER BY (b.completed_at IS NOT NULL), b.deadline NULLS LAST`, [req.musteri.marka_id]);
      const marka = (await pool.query('SELECT name FROM brands WHERE id=$1', [req.musteri.marka_id])).rows[0];
      res.json({ marka: marka ? marka.name : null, isler: r.rows.map(portalSatir) });
    } catch (e) { console.error('[portal] isler:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
  });

  // ── İş detayı ──
  app.get('/api/portal/isler/:no', auth.musteriGuard, async (req, res) => {
    try {
      const no = parseInt(req.params.no, 10);
      // MARKA KİLİDİ: iş, token'daki markaya ait değilse 404 (varlığı bile sızdırma).
      const r = await pool.query(
        `SELECT b.*, pb.no AS parent_no FROM briefs b LEFT JOIN briefs pb ON pb.id=b.parent_id
         WHERE b.no=$1 AND b.marka_id=$2 AND b.deleted_at IS NULL`, [no, req.musteri.marka_id]);
      const b = r.rows[0];
      if (!b) return res.status(404).json({ error: 'iş bulunamadı' });
      const a = await pool.query(
        `SELECT u.name AS ad, a.role AS rol FROM brief_assignees a JOIN users u ON u.id=a.user_id
         WHERE a.brief_id=$1 AND a.role IN ('contributor','lead') ORDER BY a.role`, [b.id]);
      const g = await pool.query(
        `SELECT EXTRACT(EPOCH FROM ts)*1000 AS t, replace(verb,'durum:','') AS durum
         FROM events WHERE brief_id=$1 AND verb LIKE 'durum:%' ORDER BY ts`, [b.id]);
      const out = portalDetay(b,
        a.rows.map(x => ({ ad: x.ad, rol: x.rol === 'lead' ? 'lead' : 'tasarımcı' })),
        g.rows.map(x => ({ t: Math.round(+x.t), durum: x.durum })));
      // Savunma katmanı: yasak alan sızarsa yanıtı hiç gönderme.
      for (const k of YASAK_ALANLAR) if (k in out) { console.error('[portal] SIZINTI ENGELLENDİ:', k); return res.status(500).json({ error: 'sunucu hatası' }); }
      res.json(out);
    } catch (e) { console.error('[portal] detay:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
  });
}

// ── Müşteri-uyumlu metin üretimi (Haiku) ─────────────────────────────────────
// İç özet/sebep metinleri müşteriye HAM gösterilmez; bu fonksiyon yumuşatılmış
// versiyonu üretir (Görkem kuralı 30 Eyl: sert/iç ifadeler yumuşar, olgu korunur).
async function yumusat(metin, tur) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !metin) return null;
  const sys = 'Bir tasarım ajansının İÇ iş notunu, o işi yaptıran MÜŞTERİNİN kendisinin okuyacağı hale çeviriyorsun. ' +
    'Kurallar: (1) müşteriyle ilgili olumsuz/sert ifadeleri (baskı, gerginlik, şikayet, suçlama) yumuşat ya da çıkar; ' +
    '(2) iç mutfak detaylarını (ekip içi tartışma, kişi eleştirisi, ton analizi) çıkar; ' +
    '(3) olgusal ilerleme/durum bilgisini AYNEN koru — yeni bilgi UYDURMA; ' +
    '(4) profesyonel, nötr, kısa Türkçe. YALNIZ dönüştürülmüş metni yaz, başka hiçbir şey yazma. ' +
    (tur === 'sebep' ? 'Bu bir iş kalite puanının gerekçesidir — gecikme/revizyon olgularını nazikçe koru.' : 'Bu bir iş süreç özetidir.');
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 400, system: sys,
        messages: [{ role: 'user', content: metin.slice(0, 3000) }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return null;
    const t = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
    return t || null;
  } catch { return null; }
}

// Fire-and-forget: özet/sebep yazıldığında müşteri versiyonunu üret ve kaydet (best-effort).
function musteriMetinGuncelle(briefId, { ozet, sebep }) {
  (async () => {
    try {
      if (ozet) {
        const m = await yumusat(ozet, 'ozet');
        if (m) await pool.query('UPDATE briefs SET thread_ozet_musteri=$1 WHERE id=$2', [m.slice(0, 2000), briefId]);
      }
      if (sebep) {
        const m = await yumusat(sebep, 'sebep');
        if (m) await pool.query('UPDATE briefs SET rating_sebep_musteri=$1 WHERE id=$2', [m.slice(0, 600), briefId]);
      }
    } catch (e) { console.error('[portal] müşteri metin üretimi:', e.message); }
  })();
}

module.exports = { mountPortal, portalSatir, portalDetay, YASAK_ALANLAR, yumusat, musteriMetinGuncelle };
