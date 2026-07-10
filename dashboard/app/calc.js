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
// Bir işte: işi yapan (worker/contributor)=5, lead=1, gözlemci=0. Yük bu ağırlıkların
// toplamıdır. Kapasite yüzdesinde ağırlıklı yük "işçi-eşdeğeri iş sayısına" çevrilir
// (yük/5): saf işçi N iş = N (eski davranışla birebir), lead N iş = 0.4N.
// gözlemcilik gözetimdir, ÜRETİM yükü değil → katsayı 0. Genel bakış/Departman
// kapasitesi de gözlemcileri dışlar (bnsDeptActive + sunucu a.role<>'gozlemci'); kişi
// kapasitesi de aynı olsun ki yöneticiler "her işe gözlemci" diye %100 görünmesin.
var BNS_ROLE_W = { worker: 5, lead: 1, observer: 0 };
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
// rol ağırlıkları toplanır (işçi 5 + lead 1; gözlemci 0 = kapasiteye katılmaz).
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
  // P3.4c (Ç6): atanan (worker) kendi işinde termin uzatabilir/hatırlatabilir — lead bağımlılığı kalkar.
  out.termin = !!b.termin_oneri_ms && (isAssignee || isCreator || isMgr);
  out.hatirlat = isAssignee || isCreator || isMgr;
  return out;
}

function bnsKarMarj(b) {
  var m = (typeof b.maliyet === 'number') ? b.maliyet : null;
  var s = (typeof b.satis === 'number') ? b.satis : null;
  if (m == null && s == null) return { kar: null, marj: null };
  var kar = (s || 0) - (m || 0);
  var marj = (s && s > 0) ? Math.round((kar / s) * 100) : null;
  return { kar: kar, marj: marj };
}
function bnsFinansOzet(briefs) {
  // fatura-v2: 'kapsamda' (retainer içi) işlerin SATIŞ tarafı sayılmaz — ayrıca faturalanmazlar;
  // MALİYET her işte sayılır (iç maliyet takibi). kar = ek-satış toplamı − tüm maliyet.
  var satis = 0, maliyet = 0, faturalanmamis = 0, tahsilEdilmemis = 0;
  (briefs || []).forEach(function (b) {
    var ek = b.ucret_tipi !== 'kapsamda';
    if (ek && typeof b.satis === 'number') { satis += b.satis; if (!b.fatura) faturalanmamis += b.satis; else if (!b.odeme) tahsilEdilmemis += b.satis; }
    if (typeof b.maliyet === 'number') maliyet += b.maliyet;
  });
  var kar = satis - maliyet;
  var marj = satis > 0 ? Math.round((kar / satis) * 100) : null;
  return { satis: satis, maliyet: maliyet, kar: kar, marj: marj, faturalanmamis: faturalanmamis, tahsilEdilmemis: tahsilEdilmemis };
}

// ── P3.3a firma-seviyesi proaktif sinyaller (deterministik; push motoru scripts/firma-sinyal.js) ──
// Her fonksiyon 0..n sinyal nesnesi döndürür: { tip, aciliyet, key, text }. key=dedup anahtarı (firma=null, marka=marka adı, kişi=ad).
function bnsSinyalKapasite(capPct) {
  if (capPct == null || capPct <= 85) return [];
  return [{ tip: 'firma_kapasite', aciliyet: 'acil', key: null,
    text: '⚠️ Firma kapasitesi %' + Math.round(capPct) + ' — yük dengelemesi gerekebilir.' }];
}
function bnsSinyalGeciken(briefs, now) {
  var gec = (briefs || []).filter(function (b) {
    return b.deadline != null && b.deadline < now &&
      ['tamamlandi', 'musteride'].indexOf(b.durum) === -1;
  });
  if (gec.length <= 5) return [];
  gec.sort(function (a, b) { return (a.deadline || 0) - (b.deadline || 0); });
  var top = gec[0];
  return [{ tip: 'firma_geciken', aciliyet: 'acil', key: null,
    text: '🔴 ' + gec.length + ' iş gecikmede (>5 eşik). En kritik: #' + top.no + ' ' + (top.marka || '') + '.' }];
}
function bnsSinyalMarkaRisk(briefs, riskMap) {
  var rm = riskMap || {};
  var byMarka = {};
  (briefs || []).forEach(function (b) {
    if (!b.marka) return;
    var yuksek = rm[b.marka] === 'yuksek';
    var kotuTon = ['gergin', 'acil'].indexOf(b.thread_ton) !== -1;
    if (yuksek || kotuTon) {
      if (!byMarka[b.marka]) byMarka[b.marka] = rm[b.marka] || b.thread_ton;
    }
  });
  return Object.keys(byMarka).map(function (marka) {
    return { tip: 'marka_risk', aciliyet: 'acil', key: marka,
      text: '📉 ' + marka + ' müşteri-risk sinyali: ' + byMarka[marka] + '. İlişkiye göz at.' };
  });
}
function bnsSinyalKisiKalite(kisiler) {
  var out = [];
  (kisiler || []).forEach(function (k) {
    var r = k.ratings || [];
    if (r.length < 10) return; // yeterli veri yok
    var son5 = r.slice(-5), onceki5 = r.slice(-10, -5);
    var avg = function (a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; };
    var sonAvg = avg(son5), onckAvg = avg(onceki5);
    if (onckAvg - sonAvg >= 1.0 && sonAvg < 4.0) {
      out.push({ tip: 'kisi_kalite', aciliyet: 'normal', key: k.ad,
        text: '📊 ' + k.ad + ' son işlerde puan düşüşü (' +
          (Math.round(onckAvg * 10) / 10) + '→' + (Math.round(sonAvg * 10) / 10) +
          '). Kısa bir mentörlük görüşmesi iyi gelebilir.' });
    }
  });
  return out;
}

// ── P3.3b tahmin katmanı (gözlemlenen veriden; tahmini_sure_h kullanılmaz) ──
function bnsBaselineCycle(completed, marka) {
  var arr = (completed || []).filter(function (b) { return b.marka === marka && typeof b.sureH === 'number'; })
    .map(function (b) { return b.sureH; }).sort(function (a, b) { return a - b; });
  if (arr.length < 3) return null;
  var mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}
function bnsGecikmeOngoru(b, baselineH, now) {
  if (['incelemede', 'musteride', 'tamamlandi'].indexOf(b.durum) !== -1) return { risk: false, sebep: null };
  if (b.deadline == null) return { risk: false, sebep: null };
  var timeLeftH = (b.deadline - now) / BNS_H;
  if (baselineH != null && (baselineH - (b.elapsedH || 0)) > timeLeftH) return { risk: true, sebep: 'projeksiyon' };
  var revize = (b.rev_ic || 0) + (b.rev_musteri || 0);
  if (revize >= 2 && ['yeni', 'calisiliyor', 'revizyon'].indexOf(b.durum) !== -1 && timeLeftH < 48) {
    return { risk: true, sebep: 'davranissal' };
  }
  return { risk: false, sebep: null };
}
function bnsKisiPerformans(completed, now) {
  var arr = completed || [];
  var n = arr.length;
  if (!n) return { tamamlanan: 0, ortDonguH: null, zamanindaPct: null, ortRevize: null, ortPuan: null, tipDagilim: {}, throughputHaftalik: 0 };
  var r1 = function (x) { return Math.round(x * 10) / 10; };
  var donguler = arr.filter(function (b) { return typeof b.sureH === 'number'; }).map(function (b) { return b.sureH; });
  var ortDonguH = donguler.length ? r1(donguler.reduce(function (a, x) { return a + x; }, 0) / donguler.length) : null;
  var dlOlan = arr.filter(function (b) { return b.deadline != null && b.bitis != null; });
  var zamaninda = dlOlan.filter(function (b) { return b.bitis <= b.deadline; }).length;
  var zamanindaPct = dlOlan.length ? Math.round((zamaninda / dlOlan.length) * 100) : null;
  var ortRevize = r1(arr.reduce(function (a, b) { return a + (b.rev_ic || 0) + (b.rev_musteri || 0); }, 0) / n);
  var puanlar = arr.filter(function (b) { return b.rating != null; }).map(function (b) { return b.rating; });
  var ortPuan = puanlar.length ? r1(puanlar.reduce(function (a, x) { return a + x; }, 0) / puanlar.length) : null;
  var tipDagilim = {};
  arr.forEach(function (b) { if (b.marka) tipDagilim[b.marka] = (tipDagilim[b.marka] || 0) + 1; });
  var dortHaftaOnce = (now || 0) - 28 * 24 * BNS_H;
  var son4 = arr.filter(function (b) { return b.bitis != null && b.bitis >= dortHaftaOnce; }).length;
  return { tamamlanan: n, ortDonguH: ortDonguH, zamanindaPct: zamanindaPct, ortRevize: ortRevize,
    ortPuan: ortPuan, tipDagilim: tipDagilim, throughputHaftalik: r1(son4 / 4) };
}
function bnsSinyalGecikme(atRiskBriefs) {
  // Marka başına toplulaştır — dedup anahtarı marka olduğu için aynı markanın
  // birden çok at-risk işini tek sinyalde topla (bilgi kaybı olmasın).
  var byMarka = {};
  (atRiskBriefs || []).forEach(function (b) {
    var m = b.marka || '(marka yok)';
    if (!byMarka[m]) byMarka[m] = { marka: b.marka || null, adet: 0, ilk: b.no };
    byMarka[m].adet++;
  });
  return Object.keys(byMarka).map(function (m) {
    var g = byMarka[m];
    var text = g.adet === 1
      ? '⏳ #' + g.ilk + ' ' + (g.marka || '') + ' — öngörülen gecikme (deadline yetişmeyebilir).'
      : '⏳ ' + (g.marka || m) + ' — ' + g.adet + ' iş öngörülen gecikmede (örn #' + g.ilk + ').';
    return { tip: 'gecikme_ongoru', aciliyet: 'acil', key: g.marka || null, text: text };
  });
}
function bnsSinyalBurnout(kisiler) {
  return (kisiler || []).map(function (k) {
    return { tip: 'burnout', aciliyet: 'normal', key: k.ad || null,
      text: '🔥 ' + k.ad + (k.gun ? ' ' + k.gun + ' günü' : ' gelecek 5 günde') + ' %' + k.pct + ' yüklü — burnout riski, yük dengelemesi düşün.' };
  });
}

// ── P3.4b kişisel trend — son 6 ay (İstanbul takvimi); her kova bnsKisiPerformans'tan geçer ──
function bnsKisiTrend(completed, now) {
  var AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  var keyOf = function (ms) {
    return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit' }).slice(0, 7);
  };
  var nowKey = keyOf(now);
  var y = parseInt(nowKey.slice(0, 4), 10), m = parseInt(nowKey.slice(5, 7), 10);
  var kovalar = [];
  for (var i = 5; i >= 0; i--) {
    var mm = m - i, yy = y;
    while (mm < 1) { mm += 12; yy -= 1; }
    kovalar.push({ key: yy + '-' + String(mm).padStart(2, '0'), ay: AYLAR[mm - 1], yil: yy });
  }
  var byKey = {};
  (completed || []).forEach(function (b) {
    if (b.bitis == null) return;
    var k = keyOf(b.bitis);
    (byKey[k] = byKey[k] || []).push(b);
  });
  return kovalar.map(function (kv) {
    var p = bnsKisiPerformans(byKey[kv.key] || [], now);
    return { ay: kv.ay, yil: kv.yil, tamamlanan: p.tamamlanan, ortPuan: p.ortPuan,
      zamanindaPct: p.zamanindaPct, ortDonguH: p.ortDonguH };
  });
}

// ── Kapasite v2 — zamana yayılmış yük (spec: 2026-07-08-zamana-yayilmis-kapasite) ──
// Sınıflar: BASLANMAMIS pay biner R sabit · CALISAN pay biner R-=pay · DURAN/BITTI pay 0 R sabit.
// Reopen (BITTI→aktif) R=V. Overdue kalan gün=1. İş günü: Pzt-Cum Europe/Istanbul.
var BNS_V2_CALISAN = { basladi: 1, revizyon: 1, incelemede: 1 };
var BNS_V2_DURAN = { beklemede: 1, musteride: 1, blokeli: 1 };
// PERFORMANS: İstanbul 2016'dan beri SABİT UTC+3 (DST yok) → gün matematiği saf aritmetik.
// Eski sürüm hot-loop'ta toLocaleDateString (Intl) çağırıyordu → departman ekranı ~24sn'ye çıkmıştı.
var BNS_TR_OFF = 3 * BNS_H, BNS_GUN_MS = 24 * BNS_H;
function bnsEpochGun(ms) { return Math.floor((ms + BNS_TR_OFF) / BNS_GUN_MS); }   // İstanbul gün no
function bnsGunFromKey(k) { return bnsEpochGun(Date.parse(k + 'T12:00:00+03:00')); }
function bnsKeyFromGun(day) { return new Date(day * BNS_GUN_MS).toISOString().slice(0, 10); }
function bnsGunIsMi(day) { var w = (day + 4) % 7; return w !== 6 && w !== 0; }     // 1970-01-01=Per; Cmt=6, Paz=0
function bnsGunKey(ms) { return bnsKeyFromGun(bnsEpochGun(ms)); }                  // YYYY-MM-DD (İstanbul)
function bnsIsGunuMu(gunKey) { return bnsGunIsMi(bnsGunFromKey(gunKey)); }
function bnsSonrakiGun(gunKey) { return bnsKeyFromGun(bnsGunFromKey(gunKey) + 1); }
// gunKey'den deadline gününe (dahil) kalan iş günü; overdue → 1.
function bnsKalanIsGunu(gunKey, deadlineMs) {
  var g = bnsGunFromKey(gunKey), dl = bnsEpochGun(deadlineMs);
  if (g > dl) return 1;
  var n = 0;
  for (; g <= dl; g++) if (bnsGunIsMi(g)) n++;
  return Math.max(1, n);
}
// Simülatör önbelleği: pay V'de LİNEER (pay=R/kalan, R=V ölçekli) → iş başına V=1 ile TEK simülasyon,
// rol ağırlığıyla çarpılır. Anahtar veri parmak izi + hedef gün → ekranlar/render'lar arası paylaşılır;
// poll ile veri değişince (olay sayısı/son ts) anahtar değişir, kendiliğinden tazelenir.
var _bnsV2Cache = {}, _bnsV2CacheN = 0;
function bnsYayilimBirimPay(b, hedefGun) {
  var ev = (b.durum_olaylari || []);
  var son = ev.length ? ev[ev.length - 1] : null;
  var ck = (b.id != null ? b.id : b.no) + ':' + b.created_at + ':' + b.deadline + ':' + ev.length + ':' + (son ? son.ts : 0) + ':' + hedefGun;
  if (ck in _bnsV2Cache) return _bnsV2Cache[ck];
  var evs = ev.filter(function (e) { return e && e.ts != null && e.durum; })
    .slice().sort(function (a, c) { return a.ts - c.ts; });
  var g = bnsEpochGun(b.created_at), dl = bnsEpochGun(b.deadline);
  var R = 1, durum = 'yeni', i = 0, sonuc = 0;
  // kalan iş günü artımlı: başlangıçta say, her geçen iş gününde azalt (O(gün²) → O(gün)).
  var kalan = 0; for (var d = Math.min(g, dl); d <= dl; d++) if (bnsGunIsMi(d)) kalan++;
  if (g > dl) kalan = 1;
  for (; g <= hedefGun; g++) {
    var gunSonuTs = (g + 1) * BNS_GUN_MS - BNS_TR_OFF - 1; // İstanbul gün sonu (ms)
    while (i < evs.length && evs[i].ts <= gunSonuTs) {
      if (durum === 'tamamlandi' && evs[i].durum !== 'tamamlandi') R = 1; // reopen: yeni döngü
      durum = evs[i].durum; i++;
    }
    var isGunu = bnsGunIsMi(g);
    if (g === hedefGun) {
      // Overdue + AÇIK iş → TAM DEĞER biner (birim=1; V ile ölçeklenir): iş bitmediyse
      // "tam iş bugün masada" — başlanmış/başlanmamış ayrımı yapılmaz (İrem bug'ı:
      // pencere içi tüketim R'yi sıfırlayıp 23 gün gecikmiş işi %0 gösteriyordu).
      if (isGunu && !BNS_V2_DURAN[durum] && durum !== 'tamamlandi') sonuc = g > dl ? 1 : R / Math.max(1, kalan);
      break;
    }
    // R tüketimi: yalnız deadline penceresi İÇİNDE ve SON GÜN HARİÇ (kalan>1) —
    // tüketim işi asla "bitmiş" sayamaz; bitişi yalnız tamamlandi olayı belirler.
    if (isGunu && g <= dl && kalan > 1 && !BNS_V2_DURAN[durum] && durum !== 'tamamlandi' && BNS_V2_CALISAN[durum]) {
      R = Math.max(0, R - R / kalan);
    }
    if (isGunu && g <= dl) kalan--; // geçen iş günü bölenden düşer (overdue'da tüketim zaten yok)
  }
  if (++_bnsV2CacheN > 20000) { _bnsV2Cache = {}; _bnsV2CacheN = 0; } // basit tavan
  _bnsV2Cache[ck] = sonuc;
  return sonuc;
}
// Simülatör: işin hedef gündeki payı. b: { created_at, deadline, durum_olaylari } · V: rol ağırlığı.
// Gün sınıfı = günün SON olayı (gün-sonu kuralı); olayların ötesinde son durum sabit sürer (projeksiyon).
function bnsYayilimGunlukPay(b, V, hedefGunKey) {
  if (!b || !V || b.created_at == null || b.deadline == null) return 0;
  var hedef = bnsGunFromKey(hedefGunKey);
  if (!bnsGunIsMi(hedef)) return 0;
  if (hedef < bnsEpochGun(b.created_at)) return 0;
  return Math.round(bnsYayilimBirimPay(b, hedef) * V * 100) / 100;
}
// Kişinin bir gündeki doluluk %'si (kırpılmaz — %100 aşılabilir, aşırı yük görünsün).
function bnsKisiGunDoluluk(briefs, u, gunKey) {
  var toplam = 0;
  (briefs || []).forEach(function (b) {
    var V = bnsBriefLoadWeight(b, u && u.id);
    if (V > 0) toplam += bnsYayilimGunlukPay(b, V, gunKey);
  });
  var lim = bnsPersonCapLimit(u);
  return lim > 0 ? Math.round((toplam / lim) * 100) : 0;
}
// Bugünden ileriye n İŞ GÜNLÜK doluluk serisi: [{gun, pct}].
function bnsKisiGunlukSeri(briefs, u, baslangicGunKey, n) {
  var out = [], g = baslangicGunKey;
  while (out.length < (n || 5)) {
    if (bnsIsGunuMu(g)) out.push({ gun: g, pct: bnsKisiGunDoluluk(briefs, u, g) });
    g = bnsSonrakiGun(g);
  }
  return out;
}

// Departman/firma gün doluluğu — üyelerin paylarının toplamı / limit toplamı (kırpılmaz).
function bnsDeptGunDoluluk(briefs, users, deptKey, gunKey) {
  var uyeler = (users || []).filter(function (u) {
    return u && /^U/.test(u.id || '') && u.active !== false && (u.dept || u.rol) === deptKey;
  });
  var pay = 0, lim = 0;
  uyeler.forEach(function (u) {
    lim += bnsPersonCapLimit(u);
    (briefs || []).forEach(function (b) {
      var V = bnsBriefLoadWeight(b, u.id);
      if (V > 0) pay += bnsYayilimGunlukPay(b, V, gunKey);
    });
  });
  return lim > 0 ? Math.round((pay / lim) * 100) : 0;
}
function bnsFirmaGunDoluluk(briefs, users, gunKey) {
  var kisiler = (users || []).filter(function (u) { return u && /^U/.test(u.id || '') && u.active !== false; });
  var pay = 0, lim = 0;
  kisiler.forEach(function (u) {
    lim += bnsPersonCapLimit(u);
    (briefs || []).forEach(function (b) {
      var V = bnsBriefLoadWeight(b, u.id);
      if (V > 0) pay += bnsYayilimGunlukPay(b, V, gunKey);
    });
  });
  return lim > 0 ? Math.round((pay / lim) * 100) : 0;
}

// node test ortamı için dışa aktar (tarayıcıda module tanımsız → atlanır)

// ── İş tipi süre motoru (spec: 2026-07-10-is-tipi-sure-motoru) ────────────────
// Net iş saati: basladi→tamamlandi çizgisinde ÇALIŞILAN durumlarda geçen sürenin
// mesai (Pzt-Cum 09:00-19:00, sabit UTC+3) ile kesişimi. beklemede/musteride/blokeli düşülür.
// basladi olayı olmayan iş → null (süre havuzuna girmez — eski işlerde 'plana alma' zamanı yanıltıcıydı).
var BNS_MESAI_BAS = 9, BNS_MESAI_BIT = 19;
function bnsMesaiSaatKes(t1, t2) {
  if (!(t2 > t1)) return 0;
  var ms = 0;
  for (var g = bnsEpochGun(t1); g <= bnsEpochGun(t2); g++) {
    if (!bnsGunIsMi(g)) continue;
    var gun0 = g * BNS_GUN_MS - BNS_TR_OFF;                       // TR gece yarısı (UTC ms)
    var a = Math.max(t1, gun0 + BNS_MESAI_BAS * BNS_H);
    var b = Math.min(t2, gun0 + BNS_MESAI_BIT * BNS_H);
    if (b > a) ms += b - a;
  }
  return ms / BNS_H;
}
function bnsNetIsSaati(olaylar) {
  var ol = (olaylar || []).filter(function (o) { return o && o.ts && o.durum; })
    .sort(function (a, b) { return a.ts - b.ts; });
  var basIdx = -1;
  for (var i = 0; i < ol.length; i++) if (ol[i].durum === 'basladi') { basIdx = i; break; }
  if (basIdx < 0) return null;
  var toplam = 0, calisiyor = true, t0 = ol[basIdx].ts;
  for (var j = basIdx + 1; j < ol.length; j++) {
    var d = ol[j].durum;
    var duran = BNS_V2_DURAN[d] === 1, bitti = d === 'tamamlandi';
    if (calisiyor && (duran || bitti)) { toplam += bnsMesaiSaatKes(t0, ol[j].ts); calisiyor = false; }
    else if (!calisiyor && !duran && !bitti) { t0 = ol[j].ts; calisiyor = true; }
    if (bitti) return toplam;
  }
  return null;   // tamamlandi olayı yok → henüz ölçülemez
}
// completed dizisinden tip → {medyan, min, max, n}. 15 dakikadan kısa örnekler gürültü sayılır.
function bnsTipSureIstatistik(completed, markaFiltre) {
  var havuz = {};
  (completed || []).forEach(function (c) {
    if (!c.is_tipi) return;
    if (markaFiltre && c.marka !== markaFiltre) return;
    var h = bnsNetIsSaati(c.durum_olaylari);
    if (h == null || h < 0.25) return;
    (havuz[c.is_tipi] = havuz[c.is_tipi] || []).push(h);
  });
  var out = {};
  Object.keys(havuz).forEach(function (tip) {
    var v = havuz[tip].sort(function (a, b) { return a - b; });
    var m = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
    out[tip] = { medyan: Math.round(m * 10) / 10, min: Math.round(v[0] * 10) / 10, max: Math.round(v[v.length - 1] * 10) / 10, n: v.length };
  });
  return out;
}
// Kademeli fallback: tip+marka (n>=3) → tip (n>=3) → genel medyan. {saat, n, kaynak}.
function bnsTipikSure(tip, marka, completed) {
  if (marka) {
    var im = bnsTipSureIstatistik(completed, marka)[tip];
    if (im && im.n >= 3) return { saat: im.medyan, n: im.n, kaynak: 'tip-marka' };
  }
  var it = bnsTipSureIstatistik(completed)[tip];
  if (it && it.n >= 3) return { saat: it.medyan, n: it.n, kaynak: 'tip' };
  var tum = [];
  (completed || []).forEach(function (c) {
    var h = bnsNetIsSaati(c.durum_olaylari);
    if (h != null && h >= 0.25) tum.push(h);
  });
  if (!tum.length) return { saat: null, n: 0, kaynak: 'genel' };
  tum.sort(function (a, b) { return a - b; });
  var g = tum.length % 2 ? tum[(tum.length - 1) / 2] : (tum[tum.length / 2 - 1] + tum[tum.length / 2]) / 2;
  return { saat: Math.round(g * 10) / 10, n: tum.length, kaynak: 'genel' };
}


// ── Fatura takip (spec: 2026-07-10-fatura-takip) ─────────────────────────────
// Eksik ek işler: tutarsiz (satış girilmemiş) + faturasiz (satış var, fatura kesilmemiş).
// completed dizisi üzerinde saf süzme — ekran rozeti, brifing ve hatırlatma script'i paylaşır.
function bnsFaturaEksikleri(completed) {
  var tutarsiz = [], faturasiz = [], faturasizToplam = 0;
  (completed || []).forEach(function (c) {
    if (c.ucret_tipi !== 'ek') return;
    if (typeof c.satis !== 'number') tutarsiz.push({ no: c.no, marka: c.marka, baslik: c.baslik });
    else if (!c.fatura) { faturasiz.push({ no: c.no, marka: c.marka, baslik: c.baslik, satis: c.satis }); faturasizToplam += c.satis; }
  });
  return { tutarsiz: tutarsiz, faturasiz: faturasiz, faturasizToplam: faturasizToplam };
}
// İçinde bulunulan ayın toplu-bildirim günü: 25'i; 25 Cmt/Paz ise önceki Cuma. YYYY-MM-DD döner.
function bnsFaturaTopluGunu(nowMs) {
  var key = bnsGunKey(nowMs);                        // İstanbul günü
  var g25 = bnsGunFromKey(key.slice(0, 7) + '-25');  // bu ayın 25'i (gün no)
  while (!bnsGunIsMi(g25)) g25--;                    // Cmt→Cum, Paz→Cum
  return bnsKeyFromGun(g25);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { bnsCapPct, bnsDeptActive, bnsDeptCapPct, bnsDeptLoad, bnsBriefsAsOf, bnsPersonLoad, bnsBriefLoadWeight, bnsPersonCapLimit, bnsPersonCapPct, bnsSureH, bnsCycleSure, bnsGecikmeH, bnsIsRisk, bnsThroughput, bnsUzatmaCeza, bnsUzatmaCezaFromTimes, bnsRatingWithPenalty, bnsDeliveryStatus, BNS_H, BNS_RISK_H, bnsBriefActionPerms, BNS_NEXT_STATUS, bnsKarMarj, bnsFinansOzet, bnsSinyalKapasite, bnsSinyalGeciken, bnsSinyalMarkaRisk, bnsSinyalKisiKalite, bnsBaselineCycle, bnsGecikmeOngoru, bnsKisiPerformans, bnsSinyalGecikme, bnsSinyalBurnout, bnsKisiTrend, bnsGunKey, bnsIsGunuMu, bnsKalanIsGunu, bnsYayilimGunlukPay, bnsKisiGunDoluluk, bnsKisiGunlukSeri, bnsDeptGunDoluluk, bnsFirmaGunDoluluk, bnsNetIsSaati, bnsTipSureIstatistik, bnsTipikSure, bnsMesaiSaatKes, bnsFaturaEksikleri, bnsFaturaTopluGunu };
}
