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

// ── Bir departmanın AKTİF brief'leri — TEK KURAL (Genel bakış ↔ Departman sayfası aynı) ──
// Aktif (müşteride + tamamlanmış hariç) ve lead.dept / brief.dept / herhangi bir contributor.dept eşleşen briefler.
// deptKey: 'tasarim' | 'editor' | 'ai' | 'freelance'. (u.dept yoksa u.rol'e düşer — eski davranışla uyumlu.)
function bnsDeptActive(briefs, deptKey) {
  if (!Array.isArray(briefs) || !deptKey) return [];
  return briefs.filter(function (b) {
    if (!b || b.durum === 'musteride' || b.durum === 'tamamlandi') return false;
    if (b.lead && (b.lead.dept || b.lead.rol) === deptKey) return true;
    if (b.dept === deptKey) return true;
    return Array.isArray(b.contributors) && b.contributors.some(function (c) { return c && (c.dept || c.rol) === deptKey; });
  });
}
// ── Rol bazlı iş yükü katsayıları ───────────────────────────────────────────
// Bir işte: işi yapan (worker/contributor)=5, lead=2, gözlemci=0. Yük bu ağırlıkların
// toplamıdır. Kapasite yüzdesinde ağırlıklı yük "işçi-eşdeğeri iş sayısına" çevrilir
// (yük/5): saf işçi N iş = N (eski davranışla birebir), lead N iş = 0.4N.
// gözlemcilik gözetimdir, ÜRETİM yükü değil → katsayı 0. Genel bakış/Departman
// kapasitesi de gözlemcileri dışlar (bnsDeptActive + sunucu a.role<>'gozlemci'); kişi
// kapasitesi de aynı olsun ki yöneticiler "her işe gözlemci" diye %100 görünmesin.
var BNS_ROLE_W = { worker: 5, lead: 2, observer: 0 };
// Bir kişinin tek bir briefteki rol ağırlığı (en yüksek rol geçerli: işçi > lead > gözlemci).
function bnsBriefLoadWeight(b, userId) {
  if (!b || !userId) return 0;
  var has = function (arr) { return Array.isArray(arr) && arr.some(function (p) { return p && p.id === userId; }); };
  if (has(b.workers || b.contributors)) return BNS_ROLE_W.worker;
  if (has(b.leads) || (b.lead && b.lead.id === userId)) return BNS_ROLE_W.lead;
  if (has(b.observers)) return BNS_ROLE_W.observer;
  return 0;
}
// Kişinin verilen briefler üzerindeki AĞIRLIKLI yükü (müşteride/tamamlandı hariç).
function bnsPersonLoad(briefs, userId) {
  if (!Array.isArray(briefs) || !userId) return 0;
  var sum = 0;
  for (var i = 0; i < briefs.length; i++) {
    var b = briefs[i];
    if (!b || b.durum === 'musteride' || b.durum === 'tamamlandi') continue;
    sum += bnsBriefLoadWeight(b, userId);
  }
  return sum;
}
// Departmanın AĞIRLIKLI yükü — her aktif briefte o departmana ait tüm atananların
// rol ağırlıkları toplanır (işçi 5 + lead 2; gözlemci 0 = kapasiteye katılmaz).
function bnsDeptLoad(briefs, deptKey) {
  if (!Array.isArray(briefs) || !deptKey) return 0;
  var inDept = function (p) { return p && (p.dept || p.rol) === deptKey; };
  var sum = 0;
  briefs.forEach(function (b) {
    if (!b || b.durum === 'musteride' || b.durum === 'tamamlandi') return;
    (b.workers || b.contributors || []).forEach(function (p) { if (inDept(p)) sum += BNS_ROLE_W.worker; });
    (b.leads || (b.lead ? [b.lead] : [])).forEach(function (p) { if (inDept(p)) sum += BNS_ROLE_W.lead; });
    (b.observers || []).forEach(function (p) { if (inDept(p)) sum += BNS_ROLE_W.observer; });
  });
  return sum;
}
// Departman kapasite yüzdesi — pay: ağırlıklı yükün işçi-eşdeğeri (bnsDeptLoad/5),
// payda: stats.capacity. Her iki sayfa da bunu çağırır.
function bnsDeptCapPct(briefs, s, deptKey) {
  if (!s || !s.capacity) return 0;
  return Math.min(100, Math.round(((bnsDeptLoad(briefs, deptKey) / 5) / s.capacity) * 100));
}

// ── Tarihe duyarlı "o gün açık olan işler" (geri-hesaplama) ─────────────────
// cutoffMs anında AÇIK olan brief kümesini zaman damgalarından üretir:
//   • Halen aktif briefler: oluşturma ≤ cutoff (cutoff'tan sonra açılanlar hariç).
//   • O tarihte açıkken sonradan tamamlananlar: doğum ≤ cutoff VE bitiş > cutoff
//     → bunlar durum:'devam' klonuyla döner ki dept/yük guard'ları saysın.
// Yaklaşıktır: geçmiş departman/rol ataması yerine GÜNCEL atama kullanılır,
// durum geçmişi yoktur (güncel müşteride/tamamlandı durumu uygulanır).
function bnsBriefsAsOf(briefs, completed, cutoffMs) {
  if (cutoffMs == null) return briefs || [];
  var out = [];
  var bornOf = function (x) { return (x && x.created_at != null) ? x.created_at : (x && x.baslangic != null ? x.baslangic : null); };
  (briefs || []).forEach(function (b) {
    if (!b) return;
    var born = bornOf(b);
    // Zaman damgası yoksa GEÇMİŞ kesitte "açıktı" diyemeyiz → dışla (created_at canlıda hep dolu).
    if (born != null && born <= cutoffMs) out.push(b);
  });
  (completed || []).forEach(function (c) {
    if (!c || typeof c.bitis !== 'number') return;
    var born = bornOf(c);
    if (born != null && born <= cutoffMs && c.bitis > cutoffMs) {
      // tamamlanmış kaydı "o gün açık iş" gibi say: terminal durumu nötrle.
      var clone = {}; for (var k in c) clone[k] = c[k]; clone.durum = 'devam';
      out.push(clone);
    }
  });
  return out;
}

// ── Yarım gün / part-time çalışanlar — kapasite çarpanı (1 = tam gün) ───────
// Serhat Tokmak yarım gün çalışıyor (08:00-13:00) → kapasitesi 0.5. dept bilgisi
// departman kapasite indiriminde kullanılır (roster sırasından bağımsız, deterministik).
var BNS_PARTTIME = { 'U08HLMHTGEL': { factor: 0.5, dept: 'tasarim' } }; // Serhat Tokmak
function bnsCapFactor(u) {
  if (!u || !u.id) return 1;
  var p = BNS_PARTTIME[u.id];
  return (p && p.factor != null) ? p.factor : 1;
}
// Bir departmandaki part-time çalışanların eksik kapasitesi (kişi başı 6 slot bazında).
function bnsDeptCapDeduction(deptKey) {
  var ded = 0;
  for (var id in BNS_PARTTIME) {
    var p = BNS_PARTTIME[id];
    if (p && p.dept === deptKey) ded += (1 - p.factor) * 6;
  }
  return ded;
}

// ── Kişi başı kapasite limiti (eşzamanlı taşınabilir aktif iş) ──────────────
// Yöneticiler koordinasyon yükü için daha yüksek limitli. Profil + Departman AYNI çağırır.
// Yarım gün çalışanlarda limit çarpanla küçülür (ör. tasarım 6 → 3).
function bnsPersonCapLimit(u) {
  if (!u) return 6;
  var base;
  if (u.yetki === "yonetici" || u.rol === "yonetici") base = 10;
  else { var d = u.dept || u.rol || ""; base = ({ tasarim: 6, editor: 8, ai: 6, freelance: 6 })[d] || 6; }
  return Math.max(1, Math.round(base * bnsCapFactor(u)));
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

// ── Döngü-bazlı iş süresi (saat) — statü geçmişinden (events) net çalışma ──────
// Çalışma sayılan statüler: basladi, incelemede, revizyon. Ölü (sayılmayan): yeni,
// calisiliyor, beklemede, musteride, blokeli. "İşe başlandı" atlanmışsa o döngüde
// calisiliyor da çalışma sayılır (de-facto başlangıç). Her 'tamamlandi' bir döngüyü
// kapatır; tamamlandı'dan tekrar dönüş YENİ döngüdür (her döngü ayrı, + toplam).
// events: [{ts(ms), durum}]; nowMs: açık döngüyü kapatır; fallback:{baslangic,bitis,beklemeMs}.
function bnsCycleSure(events, nowMs, fallback) {
  var ACTIVE = { basladi: 1, incelemede: 1, revizyon: 1 };
  var ev = (events || []).filter(function (e) { return e && e.ts != null && e.durum; })
    .slice().sort(function (a, b) { return a.ts - b.ts; });
  if (!ev.length) {
    var fb = fallback || {};
    var h = bnsSureH(fb.bitis, fb.baslangic, fb.beklemeMs || 0);
    var c0 = (h != null) ? [{ n: 1, basladi: fb.baslangic || null, bitis: fb.bitis || null, sureH: h }] : [];
    return { cycles: c0, sonH: h, toplamH: h };
  }
  var now = nowMs || 0;
  var segs = [], seg = [];
  for (var i = 0; i < ev.length; i++) {
    seg.push(ev[i]);
    if (ev[i].durum === 'tamamlandi') { segs.push(seg); seg = []; }
  }
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
      if (startTs == null) {
        if (e.durum === 'basladi') startTs = e.ts;
        else if (!hasBasladi && e.durum !== 'yeni') startTs = e.ts;
      }
      if (isActive(e.durum)) netMs += Math.max(0, nextTs - e.ts);
      if (e.durum === 'tamamlandi') endTs = e.ts;
    }
    if (startTs == null) startTs = s[0].ts;
    out.push({ n: c + 1, basladi: startTs, bitis: endTs, sureH: Math.max(0, netMs) / BNS_H });
  }
  var toplamH = out.reduce(function (a, x) { return a + (x.sureH || 0); }, 0);
  return { cycles: out, sonH: out.length ? out[out.length - 1].sureH : null, toplamH: toplamH };
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

// ── Deadline uzatma cezası (puan etkisi) ───────────────────────────────────
// Uzatma, o an geçerli deadline'a NE KADAR yakın yapıldıysa o kadar çok ceza.
// gapH = (eski_deadline - uzatma_anı) saat. Negatifse uzatma deadline GEÇTİKTEN sonra yapılmış.
// Orta eğri: >48sa → 0.5 · 24-48sa → 1.0 · <24sa → 1.5 · deadline geçmiş → 2.0.
function bnsUzatmaCeza(gapH) {
  if (gapH == null || isNaN(gapH)) return 0;
  if (gapH < 0) return 2.0;     // deadline geçtikten sonra uzatıldı
  if (gapH <= 24) return 1.5;   // son 24 saat
  if (gapH <= 48) return 1.0;   // 24-48 saat
  return 0.5;                   // 48 saatten erken
}
// Zaman damgalarından ceza (uzatma anı + o an geçerli/eski deadline, ms).
function bnsUzatmaCezaFromTimes(uzatmaAniMs, eskiDeadlineMs) {
  if (!uzatmaAniMs || !eskiDeadlineMs) return 0;
  return bnsUzatmaCeza((eskiDeadlineMs - uzatmaAniMs) / BNS_H);
}
// AI puanına uzatma cezasını uygula (1-5 arası kırp, 0.5 hassasiyet). Yönetici override'a uygulanmaz.
function bnsRatingWithPenalty(aiRating, uzatmaCeza) {
  if (aiRating == null) return null;
  var r = aiRating - (uzatmaCeza || 0);
  if (r < 1) r = 1; if (r > 5) r = 5;
  return Math.round(r * 2) / 2;
}
// Teslim durumu: gecikmeli (en ağır) > uzatılarak teslim > zamanında.
function bnsDeliveryStatus(bitisMs, deadlineMs, beklemeMs, uzatildi) {
  if (!bitisMs || !deadlineMs) return null;
  if (bnsGecikmeH(bitisMs, beklemeMs, deadlineMs) > 0) return 'gec';
  if (uzatildi) return 'uzatildi';
  return 'zamaninda';
}

// ── "Bugün"/aksiyon katmanı — ileri statü haritası + yetki kararı (saf, UI için) ──
var BNS_NEXT_STATUS = {
  yeni: 'calisiliyor', calisiliyor: 'basladi', basladi: 'incelemede',
  incelemede: 'tamamlandi', revizyon: 'incelemede', beklemede: 'basladi', blokeli: 'basladi'
};
// Brief satırında hangi aksiyonlar gösterilsin? Salt-veri (window bağımlılığı yok → node'da test edilir).
function bnsBriefActionPerms(b, u) {
  var out = { basla: false, ilerlet: false, termin: false, hatirlat: false };
  if (!b || !u || !u.id) return out;
  var uid = u.id;
  var leads = Array.isArray(b.leads) ? b.leads : (b.lead ? [b.lead] : []);
  var isLead = leads.some(function (l) { return l && l.id === uid; });
  var workers = Array.isArray(b.workers) ? b.workers : (Array.isArray(b.contributors) ? b.contributors : []);
  var isWorker = workers.some(function (w) { return w && w.id === uid; });
  var isAssignee = isLead || isWorker;
  var isMgr = u.yetki === 'yonetici' || u.rol === 'yonetici';
  var isCreator = b.created_by === uid;
  var durum = b.durum;
  out.basla = isAssignee && (durum === 'yeni' || durum === 'calisiliyor');
  out.ilerlet = isAssignee && !!BNS_NEXT_STATUS[durum] && durum !== 'tamamlandi' && durum !== 'musteride';
  // "Termini uzat" yalnız bekleme/müşteride durumundan dönüşte set edilen bir öneri (termin_oneri_ms)
  // varsa gösterilir — aksi halde sunucu "uzatma hatırlatıcısı açık değil" hatası verir ve süre yazılamaz.
  out.termin = !!b.termin_oneri_ms && (isLead || isCreator || isMgr);
  out.hatirlat = isLead || isMgr;
  return out;
}

// node test ortamı için dışa aktar (tarayıcıda module tanımsız → atlanır)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { bnsCapPct, bnsDeptActive, bnsDeptCapPct, bnsDeptLoad, bnsBriefsAsOf, bnsPersonLoad, bnsBriefLoadWeight, bnsPersonCapLimit, bnsPersonCapPct, bnsSureH, bnsCycleSure, bnsGecikmeH, bnsIsRisk, bnsThroughput, bnsUzatmaCeza, bnsUzatmaCezaFromTimes, bnsRatingWithPenalty, bnsDeliveryStatus, BNS_H, BNS_RISK_H, bnsBriefActionPerms, BNS_NEXT_STATUS };
}
