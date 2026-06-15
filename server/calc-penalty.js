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

module.exports = { bnsUzatmaCeza, bnsUzatmaCezaFromTimes, bnsRatingWithPenalty, BNS_H };
