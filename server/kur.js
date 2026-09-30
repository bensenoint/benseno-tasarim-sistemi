'use strict';
/**
 * kur.js — TCMB günlük döviz kuru (döviz faturalama, 2026-09-30).
 * Kaynak: https://www.tcmb.gov.tr/kurlar/today.xml — VUK uygulamasına paralel olarak
 * DÖVİZ ALIŞ (ForexBuying) kullanılır. 30 dk bellek önbelleği; TCMB erişilemezse hata
 * fırlatır (çağıran 400 döndürür — sessizce yanlış kur kullanılmaz).
 */
const _cache = { ts: 0, kurlar: null };

async function tcmbKurlar() {
  if (_cache.kurlar && Date.now() - _cache.ts < 30 * 60 * 1000) return _cache.kurlar;
  const r = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', { headers: { 'user-agent': 'benseno-sistem' } });
  if (!r.ok) throw new Error('TCMB kur servisi yanıt vermedi (' + r.status + ')');
  const xml = await r.text();
  const kurlar = {};
  for (const kod of ['USD', 'EUR']) {
    const m = xml.match(new RegExp(`CurrencyCode="${kod}"[\\s\\S]*?<ForexBuying>([\\d.]+)</ForexBuying>`));
    if (m) kurlar[kod] = parseFloat(m[1]);
  }
  if (!kurlar.USD || !kurlar.EUR) throw new Error('TCMB kuru ayrıştırılamadı');
  _cache.kurlar = kurlar; _cache.ts = Date.now();
  return kurlar;
}

// doviz: 'USD' | 'EUR' → günün TCMB döviz alış kuru
async function gununKuru(doviz) {
  const k = await tcmbKurlar();
  const kur = k[doviz];
  if (!kur) throw new Error('desteklenmeyen döviz: ' + doviz);
  return kur;
}

module.exports = { gununKuru, tcmbKurlar };
