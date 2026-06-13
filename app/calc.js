// calc.js — SAF HESAP FORMÜLLERİ (tek doğruluk kaynağı).
// DOM/React/window bağımlılığı YOK → hem tarayıcıda (klasik script → global fonksiyonlar)
// hem node'da (module.exports) çalışır. scripts/formula-test.js bunları node'da test eder.
// index.html'de data.js'ten ÖNCE yüklenir; data.js ve bundle.js global olarak çağırır.
//
// KURAL: kapasite/süre/gecikme gibi metrikleri BAŞKA yerde yeniden tanımlama — buradan çağır.

var BNS_H = 3600 * 1000; // 1 saat (ms)

// ── Departman kapasite yüzdesi (active / capacity) ──────────────────────────
function bnsCapPct(s) {
  if (!s || !s.capacity) return 0;
  if (s.capacity_pct != null) return s.capacity_pct;
  return Math.min(100, Math.round((s.active / s.capacity) * 100));
}

// ── Kişi başı kapasite limiti (eşzamanlı taşınabilir aktif iş) ──────────────
// Yöneticiler koordinasyon yükü için daha yüksek limitli. Profil + Departman AYNI çağırır.
function bnsPersonCapLimit(u) {
  if (!u) return 6;
  if (u.yetki === "yonetici" || u.rol === "yonetici") return 10;
  var d = u.dept || u.rol || "";
  return ({ tasarim: 6, editor: 8, ai: 6, freelance: 6 })[d] || 6;
}
function bnsPersonCapPct(u, activeCount) {
  return Math.min(100, Math.round((activeCount / bnsPersonCapLimit(u)) * 100));
}

// ── Net süre (saat) — beklemede geçen süre DÜŞÜLÜR; negatif olamaz ──────────
function bnsSureH(bitis, baslangic, beklemeMs) {
  var bek = beklemeMs || 0;
  if (!(bitis && baslangic) || isNaN(bitis) || isNaN(baslangic)) return null;
  return Math.max(0, bitis - baslangic - bek) / BNS_H;
}

// ── Gecikme (saat) — yalnız NET bitiş (bekleme düşülmüş) deadline'ı aşınca >0 ─
function bnsGecikmeH(bitis, beklemeMs, deadline) {
  var bek = beklemeMs || 0;
  if (bitis && deadline && (bitis - bek) > deadline) {
    return Math.round((bitis - bek - deadline) / BNS_H * 10) / 10;
  }
  return 0;
}

// ── Termin riski — teslime az kaldı AMA iş hâlâ aktif (henüz inceleme/teslim değil) ─────
// Hem dashboard rozeti hem scheduler thread-uyarısı AYNI kuralı kullanır (tek kaynak).
var BNS_RISK_H = 24; // teslime kalan saat eşiği
function bnsIsRisk(durum, deltaH) {
  if (deltaH == null) return false;
  // inceleme/müşteri/tamamlanan = riskli sayılmaz (iş esasen bitmiş/elimizde değil)
  if (["incelemede", "musteride", "tamamlandi"].indexOf(durum) !== -1) return false;
  return deltaH <= BNS_RISK_H; // 24sa içinde veya geçmiş, iş hâlâ devam ediyor
}

// ── Çıktı hızı — son N hafta tamamlanan iş / hafta (düşük örneklemde uyarır) ──────────
// bitisListMs: tamamlanma zaman damgaları (ms, NORMALİZE edilmiş). nowMs: şimdi. weeks: pencere.
// lowSample=true → örneklem küçük, sayı yanıltıcı olabilir (sistem yeni, veri ince).
function bnsThroughput(bitisListMs, nowMs, weeks) {
  weeks = weeks || 4;
  var cutoff = nowMs - weeks * 7 * 24 * 3600 * 1000;
  var n = 0;
  for (var i = 0; i < (bitisListMs || []).length; i++) {
    var t = bitisListMs[i];
    if (t && t >= cutoff) n++;
  }
  return { count: n, perWeek: Math.round((n / weeks) * 10) / 10, weeks: weeks, lowSample: n < 3 };
}

// node test ortamı için dışa aktar (tarayıcıda module tanımsız → atlanır)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { bnsCapPct, bnsPersonCapLimit, bnsPersonCapPct, bnsSureH, bnsGecikmeH, bnsIsRisk, bnsThroughput, BNS_H, BNS_RISK_H };
}
