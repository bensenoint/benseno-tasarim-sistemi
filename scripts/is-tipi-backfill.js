// scripts/is-tipi-backfill.js — geçmiş işlere iş tipi ataması.
// Kural sözlüğü + EL_ATAMALARI (sözlüğün tutmadığı, elle incelenen no'lar).
// Kullanım: node scripts/is-tipi-backfill.js          → kuru koşu (liste basar)
//           node scripts/is-tipi-backfill.js --yaz    → API'ye yazar (yalnız NULL olanlar)
const { tahminEt } = require('../server/is-tipi-tahmin');
const API = (process.env.BNS_API_BASE || 'https://benseno-api-production.up.railway.app').replace(/\/+$/, '');

// Elle atamalar (Claude'un 239 iş analizi — sözlüğün yakalayamadığı/yanlış yakalayacağı no'lar).
const EL_ATAMALARI = {
  // Bauhaus günlük ürün kampanyası görselleri (başlıkta anahtar kelime yok)
  12:'sm-gorsel', 29:'sm-gorsel', 69:'sm-gorsel', 70:'sm-gorsel', 71:'sm-gorsel', 79:'sm-gorsel',
  82:'sm-gorsel', 83:'sm-gorsel', 84:'sm-gorsel', 91:'sm-gorsel', 124:'sm-gorsel', 127:'sm-gorsel',
  149:'sm-gorsel', 163:'sm-gorsel', 167:'sm-gorsel', 168:'sm-gorsel', 169:'sm-gorsel', 171:'sm-gorsel',
  198:'sm-gorsel', 200:'sm-gorsel', 220:'sm-gorsel', 222:'sm-gorsel', 224:'sm-gorsel', 231:'sm-gorsel',
  234:'sm-gorsel', 235:'sm-gorsel', 138:'sm-gorsel',
  // Elle yorum gerektirenler (Görkem düzeltebilir — drawer'dan tek tık)
  37:'baski-pop',        // Acuboo & Pouch üretim-teslimat takibi (promosyon materyali)
  64:'strateji',         // ECLP iletişimi
  78:'web-gorsel',       // canlı cerrahi ekran çerçevesi (dijital ekran görseli)
  106:'baski-pop',       // kutu içi gönderim kartı
  108:'web-gorsel',      // B2B web article design
  206:'ambalaj',         // Vetcoul yara kremi ambalaj revizeleri
  221:'baski-pop',       // pazarlama materyal düzenlemeleri
  24:'sm-gorsel', 85:'sm-gorsel', 133:'sm-gorsel', 135:'sm-gorsel', 154:'sm-gorsel',  // SM içerik/asset işleri
  186:'idari-operasyon', // adres değişikliği bildirimi
  188:'baski-pop',       // göz kapama bandı tasarımı (fiziksel materyal)
  193:'baski-pop',       // optisyenlik sertifikası tasarımı
  205:'idari-operasyon', // commercial readiness ihtiyaç listesi
  185:'idari-operasyon', // Instagram DM'den gelen bilgi talebi yanıtı
};

(async () => {
  const r = await fetch(`${API}/api/embedded`, { headers: { 'x-bns-token': process.env.BNS_WRITE_TOKEN || '' } });
  if (!r.ok) { console.error('embedded çekilemedi:', r.status); process.exit(1); }
  const ed = await r.json();
  const isler = [...(ed.bns_briefs || []), ...(ed.bns_completed || [])];
  const kesin = [], belirsiz = [];
  for (const b of isler) {
    if (b.is_tipi) continue;                       // zaten atanmış
    const tip = EL_ATAMALARI[b.no] || tahminEt(b.baslik);
    if (tip) kesin.push({ no: b.no, tip, baslik: b.baslik, marka: b.marka });
    else belirsiz.push({ no: b.no, baslik: b.baslik, marka: b.marka });
  }
  console.log(`toplam ${isler.length} · atanacak ${kesin.length} · belirsiz ${belirsiz.length}\n`);
  if (belirsiz.length) { console.log('── BELİRSİZ ──'); belirsiz.forEach(b => console.log(`#${b.no} [${b.marka}] ${b.baslik}`)); }
  if (process.argv.includes('--yaz')) {
    const w = await fetch(`${API}/api/is-tipi-backfill`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-bns-token': process.env.BNS_WRITE_TOKEN || '' },
      body: JSON.stringify({ atamalar: kesin.map(k => ({ no: k.no, tip: k.tip })) }),
    });
    console.log('\nyazma:', w.status, JSON.stringify(await w.json().catch(() => ({}))));
  } else {
    console.log('\n(kuru koşu — --yaz ile yazılır)');
    const say = {}; kesin.forEach(k => say[k.tip] = (say[k.tip] || 0) + 1);
    console.log('tip dağılımı:', JSON.stringify(say, null, 0));
  }
})();
