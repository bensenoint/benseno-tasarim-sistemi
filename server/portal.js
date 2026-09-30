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

  // ── Dashboard-uyumlu embedded (SEC-P2): marka sayfası portalda birebir çalışır ──
  app.get('/api/portal/embedded', auth.musteriGuard, async (req, res) => {
    try {
      const { getPortalEmbedded } = require('./queries');
      res.json(await getPortalEmbedded(req.musteri.marka_id));
    } catch (e) { console.error('[portal] embedded:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
  });

  // ── Marka karnesi (HaftalikKarne kartı) — özetler müşteri versiyonu (lazy Haiku + cache) ──
  app.get('/api/portal/karne', auth.musteriGuard, async (req, res) => {
    try {
      const br = await pool.query('SELECT name FROM brands WHERE id=$1', [req.musteri.marka_id]);
      const marka = br.rows[0] && br.rows[0].name;
      const r = await pool.query(
        `SELECT id, to_char(hafta,'YYYY-MM-DD') hafta, ad, yildiz_hafta::float, yildiz_genel::float,
                is_sayisi_hafta, is_sayisi_genel, ozet_hafta, ozet_genel, ozet_hafta_musteri, ozet_genel_musteri
         FROM haftalik_karne WHERE tip='marka' AND kimlik=$1 ORDER BY hafta DESC LIMIT 12`, [marka]);
      // Eksik müşteri özetlerini lazy üret + önbelleğe yaz (yalnız ilk istekte maliyet).
      for (const row of r.rows) {
        if (row.ozet_hafta && !row.ozet_hafta_musteri) {
          const m = await yumusat(row.ozet_hafta, 'ozet');
          if (m) { await pool.query('UPDATE haftalik_karne SET ozet_hafta_musteri=$1 WHERE id=$2', [m.slice(0, 1500), row.id]); row.ozet_hafta_musteri = m; }
        }
        if (row.ozet_genel && !row.ozet_genel_musteri) {
          const m = await yumusat(row.ozet_genel, 'ozet');
          if (m) { await pool.query('UPDATE haftalik_karne SET ozet_genel_musteri=$1 WHERE id=$2', [m.slice(0, 1500), row.id]); row.ozet_genel_musteri = m; }
        }
      }
      // HAM özetler yanıtta YOK — yalnız müşteri versiyonları, /api/karne shape'iyle.
      res.json({ karneler: r.rows.map(x => ({ hafta: x.hafta, ad: x.ad,
        yildiz_hafta: x.yildiz_hafta, ozet_hafta: x.ozet_hafta_musteri || null, is_sayisi_hafta: x.is_sayisi_hafta,
        yildiz_genel: x.yildiz_genel, ozet_genel: x.ozet_genel_musteri || null, is_sayisi_genel: x.is_sayisi_genel })) });
    } catch (e) { console.error('[portal] karne:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
  });

  // ── Brief talebi (Faz 3, ONAYLI akış): talep kaydı + marka kanalına Slack + yöneticilere bildirim ──
  app.post('/api/portal/talep', auth.musteriGuard, async (req, res) => {
    try {
      const b = req.body || {};
      const baslik = String(b.baslik || '').trim().slice(0, 160);
      const aciklama = String(b.aciklama || '').trim().slice(0, 2000);
      if (!baslik) return res.status(400).json({ error: 'başlık gerekli' });
      // Taşkın koruması: hesap başına günde en fazla 10 talep
      const say = await pool.query(
        `SELECT count(*)::int c FROM musteri_talepler WHERE musteri_id=$1 AND created_at > now() - interval '24 hours'`,
        [req.musteri.mid]);
      if (say.rows[0].c >= 10) return res.status(429).json({ error: 'günlük talep sınırına ulaşıldı' });
      const tarih = b.istenen_tarih && /^\d{4}-\d{2}-\d{2}$/.test(b.istenen_tarih) ? b.istenen_tarih : null;
      // Dosya ekleri (base64): en fazla 3 dosya, dosya başına ≤5MB — marka kanalındaki
      // talep mesajının THREAD'ine yüklenir (sistemde ayrıca saklanmaz).
      const dosyalar = Array.isArray(b.dosyalar) ? b.dosyalar.slice(0, 3) : [];
      for (const d of dosyalar) {
        if (!d || typeof d.b64 !== 'string' || typeof d.ad !== 'string') return res.status(400).json({ error: 'dosya biçimi geçersiz' });
        if (d.b64.length > 7 * 1024 * 1024) return res.status(413).json({ error: `dosya çok büyük (≤5MB): ${d.ad}` });
      }
      const ins = await pool.query(
        `INSERT INTO musteri_talepler (marka_id, musteri_id, baslik, aciklama, istenen_tarih)
         VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
        [req.musteri.marka_id, req.musteri.mid, baslik, aciklama || null, tarih]);
      // Bildirimler (best-effort — talep kaydını bozmaz)
      try {
        const mk = await pool.query(
          `SELECT br.name AS marka, m.ad, m.email FROM brands br, musteri_kullanicilar m
           WHERE br.id=$1 AND m.id=$2`, [req.musteri.marka_id, req.musteri.mid]);
        const { marka, ad, email } = mk.rows[0] || {};
        const kim = ad || email;
        const txt = `📩 *Müşteri brief talebi* — *${marka}*\n*${baslik}*` +
          (aciklama ? `\n${aciklama.slice(0, 500)}` : '') +
          (tarih ? `\n⏰ İstenen teslim: ${tarih}` : '') +
          `\n✍️ Talep eden: ${kim} (portal)\n_Onaylamak için dashboard'dan "Yeni brief" ile açın — talep #${ins.rows[0].id}_`;
        const slack = require('./slack');
        const ch = slack.channelForBrand(marka);
        if (ch) {
          const pm = await slack.postChannel(ch, txt);
          // Ekler talep mesajının thread'ine (best-effort; biri düşse diğerleri denenir)
          if (pm && pm.ok && dosyalar.length) {
            for (const d of dosyalar) {
              try {
                const buf = Buffer.from(d.b64, 'base64');
                await slack.uploadFile({ channel: pm.channel, thread_ts: pm.ts,
                  filename: String(d.ad).slice(0, 120).replace(/[\/\\]/g, '_'), buf, title: d.ad });
              } catch (e) { console.error('[portal] talep eki yüklenemedi:', d.ad, e.message); }
            }
          }
        }
        const { notify } = require('./notify');
        const mgr = await pool.query(`SELECT id FROM users WHERE (rol='yonetici' OR yetki='yonetici') AND active IS NOT FALSE`);
        for (const m of mgr.rows)
          await notify(m.id, { tip: 'talep', aciliyet: 'acil', text: `📩 ${marka} — müşteri brief talebi: ${baslik}`, link: null });
      } catch (e) { console.error('[portal] talep bildirimi:', e.message); }
      res.json({ ok: true, id: ins.rows[0].id });
    } catch (e) { console.error('[portal] talep:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
  });

  // Müşterinin kendi talepleri (durum takibi)
  app.get('/api/portal/talepler', auth.musteriGuard, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT t.id, t.baslik, t.durum, t.brief_id, to_char(t.created_at,'DD.MM.YYYY') tarih,
                to_char(t.istenen_tarih,'DD.MM.YYYY') istenen, b.no AS brief_no
         FROM musteri_talepler t LEFT JOIN briefs b ON b.id=t.brief_id
         WHERE t.marka_id=$1 ORDER BY t.id DESC LIMIT 30`, [req.musteri.marka_id]);
      res.json({ talepler: r.rows });
    } catch (e) { res.status(500).json({ error: 'sunucu hatası' }); }
  });

  // ── Faz 2: iş yorumları — müşteri yazar → Slack thread + sorumlulara bildirim ──
  app.get('/api/portal/isler/:no/yorumlar', auth.musteriGuard, async (req, res) => {
    try {
      const b = await pool.query(`SELECT id FROM briefs WHERE no=$1 AND marka_id=$2 AND deleted_at IS NULL`,
        [parseInt(req.params.no, 10), req.musteri.marka_id]);
      if (!b.rows[0]) return res.status(404).json({ error: 'iş bulunamadı' });
      const r = await pool.query(
        `SELECT y.metin, m.ad, m.email, to_char(y.created_at,'DD.MM.YYYY HH24:MI') tarih
         FROM musteri_yorumlar y JOIN musteri_kullanicilar m ON m.id=y.musteri_id
         WHERE y.brief_id=$1 ORDER BY y.id DESC LIMIT 20`, [b.rows[0].id]);
      res.json({ yorumlar: r.rows.map(x => ({ kim: x.ad || x.email, metin: x.metin, tarih: x.tarih })) });
    } catch (e) { res.status(500).json({ error: 'sunucu hatası' }); }
  });

  app.post('/api/portal/isler/:no/yorum', auth.musteriGuard, async (req, res) => {
    try {
      const metin = String((req.body || {}).metin || '').trim().slice(0, 1000);
      if (!metin) return res.status(400).json({ error: 'yorum boş olamaz' });
      const b = await pool.query(
        `SELECT b.id, b.no, b.baslik, b.slack_ts, b.slack_channel, br.name AS marka
         FROM briefs b JOIN brands br ON br.id=b.marka_id
         WHERE b.no=$1 AND b.marka_id=$2 AND b.deleted_at IS NULL`,
        [parseInt(req.params.no, 10), req.musteri.marka_id]);
      const brief = b.rows[0];
      if (!brief) return res.status(404).json({ error: 'iş bulunamadı' });
      // Taşkın koruması: hesap başına saatte 20 yorum
      const say = await pool.query(
        `SELECT count(*)::int c FROM musteri_yorumlar WHERE musteri_id=$1 AND created_at > now() - interval '1 hour'`,
        [req.musteri.mid]);
      if (say.rows[0].c >= 20) return res.status(429).json({ error: 'çok fazla yorum — biraz sonra tekrar deneyin' });
      await pool.query(`INSERT INTO musteri_yorumlar (brief_id, musteri_id, metin) VALUES ($1,$2,$3)`,
        [brief.id, req.musteri.mid, metin]);
      // Slack thread'i + sorumlulara bildirim (best-effort)
      try {
        const mk = await pool.query('SELECT ad, email FROM musteri_kullanicilar WHERE id=$1', [req.musteri.mid]);
        const kim = (mk.rows[0] && (mk.rows[0].ad || mk.rows[0].email)) || 'Müşteri';
        const slack = require('./slack');
        let threadLink = null;
        if (brief.slack_ts && brief.slack_channel) {
          const tr = await slack.postThread({ channel: brief.slack_channel, thread_ts: brief.slack_ts,
            text: `💬 *Müşteri yorumu* — ${kim} (portal):\n${metin}` });
          const ws = process.env.BNS_SLACK_WORKSPACE || 'benseno';
          const ts = (tr && tr.ts) || brief.slack_ts;
          threadLink = `https://${ws}.slack.com/archives/${brief.slack_channel}/p${String(ts).replace('.', '')}?thread_ts=${brief.slack_ts}&cid=${brief.slack_channel}`;
        }
        const { notify } = require('./notify');
        const u = await pool.query(
          `SELECT DISTINCT user_id FROM brief_assignees WHERE brief_id=$1 AND role IN ('contributor','lead')`, [brief.id]);
        for (const row of u.rows) if (/^U/.test(row.user_id || ''))
          await notify(row.user_id, { tip: 'musteri-yorum', aciliyet: 'acil',
            text: `💬 Müşteri yorumu — #${brief.no} "${(brief.baslik || '').slice(0, 60)}" ${brief.marka}: ${metin.slice(0, 120)}`,
            link: threadLink, briefId: brief.id });
      } catch (e) { console.error('[portal] yorum bildirimi:', e.message); }
      res.json({ ok: true });
    } catch (e) { console.error('[portal] yorum:', e.message); res.status(500).json({ error: 'sunucu hatası' }); }
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
