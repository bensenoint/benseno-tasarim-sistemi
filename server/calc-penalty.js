// server/calc-penalty.js — Deadline uzatma cezası (yalnız Node/API).
// NEDEN AYRI: API servisi kök dizini = server/ olarak deploy ediliyor; dashboard/app/calc.js
// API imajında YOK (require patlıyordu → API çöküyordu). Tarayıcı tarafı dashboard/app/calc.js'i
// kullanır; bu dosya onun AYNASIDIR — bu 3 fonksiyon DEĞİŞİRSE ikisini BİRLİKTE güncelle.
var BNS_H = 3600 * 1000;

// Uzatma cezası: o an geçerli deadline'a yakınlık (gapH saat) — Orta eğri, en kötü uzatma sayılır.
function bnsUzatmaCeza(gapH) {
  if (gapH == null || isNaN(gapH)) return 0;
  if (gapH < 0) return 2.0;     // deadline geçtikten sonra
  if (gapH <= 24) return 1.5;   // son 24 saat
  if (gapH <= 48) return 1.0;   // 24-48 saat
  return 0.5;                   // 48 saatten erken
}
function bnsUzatmaCezaFromTimes(uzatmaAniMs, eskiDeadlineMs) {
  if (!uzatmaAniMs || !eskiDeadlineMs) return 0;
  return bnsUzatmaCeza((eskiDeadlineMs - uzatmaAniMs) / BNS_H);
}
// AI puanına ceza uygula (1-5 kırp, 0.5 hassasiyet). Yönetici override'a uygulanmaz.
function bnsRatingWithPenalty(aiRating, uzatmaCeza) {
  if (aiRating == null) return null;
  var r = aiRating - (uzatmaCeza || 0);
  if (r < 1) r = 1; if (r > 5) r = 5;
  return Math.round(r * 2) / 2;
}

// Döngü-bazlı iş süresi — dashboard/app/calc.js'teki bnsCycleSure'ün AYNASIDIR.
// DEĞİŞİRSE iki dosyayı da güncelle (formula-test.js dashboard sürümünü kilitler).
function bnsCycleSure(events, nowMs, fallback) {
  var ACTIVE = { basladi: 1, incelemede: 1, revizyon: 1 };
  var ev = (events || []).filter(function (e) { return e && e.ts != null && e.durum; })
    .slice().sort(function (a, b) { return a.ts - b.ts; });
  if (!ev.length) {
    var fb = fallback || {};
    var h = (fb.bitis && fb.baslangic) ? Math.max(0, fb.bitis - fb.baslangic - (fb.beklemeMs || 0)) / BNS_H : null;
    var c0 = (h != null) ? [{ n: 1, basladi: fb.baslangic || null, bitis: fb.bitis || null, sureH: h }] : [];
    return { cycles: c0, sonH: h, toplamH: h };
  }
  var now = nowMs || 0;
  var segs = [], seg = [];
  for (var i = 0; i < ev.length; i++) { seg.push(ev[i]); if (ev[i].durum === 'tamamlandi') { segs.push(seg); seg = []; } }
  if (seg.length) segs.push(seg);
  var out = [];
  for (var c = 0; c < segs.length; c++) {
    var s = segs[c];
    var hasBasladi = s.some(function (e) { return e.durum === 'basladi'; });
    var isActive = function (d) { return !!ACTIVE[d] || (!hasBasladi && d === 'calisiliyor'); };
    var startTs = null, endTs = null, netMs = 0;
    for (var j = 0; j < s.length; j++) {
      var e = s[j];
      var nextTs = (j + 1 < s.length) ? s[j + 1].ts : (e.durum === 'tamamlandi' ? e.ts : now);
      if (startTs == null) { if (e.durum === 'basladi') startTs = e.ts; else if (!hasBasladi && e.durum !== 'yeni') startTs = e.ts; }
      if (isActive(e.durum)) netMs += Math.max(0, nextTs - e.ts);
      if (e.durum === 'tamamlandi') endTs = e.ts;
    }
    if (startTs == null) startTs = s[0].ts;
    out.push({ n: c + 1, basladi: startTs, bitis: endTs, sureH: Math.max(0, netMs) / BNS_H });
  }
  var toplamH = out.reduce(function (a, x) { return a + (x.sureH || 0); }, 0);
  return { cycles: out, sonH: out.length ? out[out.length - 1].sureH : null, toplamH: toplamH };
}

module.exports = { bnsUzatmaCeza, bnsUzatmaCezaFromTimes, bnsRatingWithPenalty, bnsCycleSure, BNS_H };
