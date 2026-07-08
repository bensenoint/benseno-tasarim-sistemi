# Kapasite v2 — Çekirdek + Profil Kartı (Aşama 1-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zamana yayılmış kapasite çekirdeğini (günlük pay simülatörü) calc.js'e TDD ile kurmak ve Profil'de yeni doluluk % + 5-günlük projeksiyon şeridini eski %'nin yanında göstermek.

**Architecture:** Saf simülatör `bnsYayilimSim(b, V, hedefGunKey)` işin `created_at/deadline/durum_olaylari`sını İstanbul iş-günü takviminde gün gün yürütür (R tüketimi, duran günler, overdue, reopen). Üstüne `bnsKisiGunDoluluk` ve 5-günlük seri. UI yalnız Profil (Aşama 2); Departman/firma/sinyaller sonraki plan.

**Tech Stack:** calc.js (var-style, saf), formula-test.js, React UMD/JSX (Profil).

---

## Kapsam notu

Bu plan spec'in **Aşama 1+2**'si. Aşama 3 (departman/firma) ve 4 (firma-sinyal/burnout geçişi) canlı kalibrasyon sonrası ayrı plandır. Deadline-zorunlu validasyonu da (spec Kural 1) ayrı küçük iş — bu planda yok.

## Model sabitleri (spec'ten)

- Sınıflar: `BASLANMAMIS={yeni,calisiliyor}` · `CALISAN={basladi,revizyon,incelemede}` · `DURAN={beklemede,musteride,blokeli}` · `BITTI={tamamlandi}`.
- Gün sınıfı = o günün **son olayına** göre (gün sonundaki durum). `tamamlandi` günü pay 0 (teslimde yük düşer).
- pay = R / kalanİşGünü (deadline günü dahil; overdue → 1). BASLANMAMIS+CALISAN pay biner; yalnız CALISAN'da `R -= pay`.
- Reopen (BITTI→aktif olay): `R = V` (yeni döngü).
- İş günü: Pzt-Cum, Europe/Istanbul. Hafta sonu: pay yok, tüketim yok, bölene girmez.
- **Projeksiyon varsayımı (gelecek günler):** bugünden sonrası için işin bugünkü sınıfı sabit sürer varsayılır (olay bilinemez).

## Task 1: calc.js çekirdek (TDD)

**Files:**
- Modify: `dashboard/app/calc.js`
- Modify: `scripts/formula-test.js`

- [ ] **Step 1: Başarısız testleri yaz (özet console.log'dan ÖNCE)**

```js
// ── Kapasite v2: zamana yayılmış yük ──
const D = (s) => Date.parse(s + 'T12:00:00+03:00');           // İstanbul öğlen ts
const K = (s) => s;                                             // gün anahtarı 'YYYY-MM-DD'
// (1) Başlanmamış: R sabit, pay büyür. Pzt açıldı, deadline Cum (5 iş günü).
const bYeni = { created_at: D('2026-07-06'), deadline: D('2026-07-10'),
  durum: 'yeni', durum_olaylari: [] };
t('v2: başlanmamış gün1 pay 1.0', C.bnsYayilimGunlukPay(bYeni, 5, K('2026-07-06')), 1);
t('v2: başlanmamış gün2 pay 1.25', C.bnsYayilimGunlukPay(bYeni, 5, K('2026-07-07')), 1.25);
t('v2: başlanmamış son gün pay 5', C.bnsYayilimGunlukPay(bYeni, 5, K('2026-07-10')), 5);
// (2) Gün1 başlandı, aralıksız: pay sabit 1.0.
const bCalisan = { created_at: D('2026-07-06'), deadline: D('2026-07-10'), durum: 'basladi',
  durum_olaylari: [{ ts: D('2026-07-06'), durum: 'basladi' }] };
t('v2: çalışan gün1 pay 1.0', C.bnsYayilimGunlukPay(bCalisan, 5, K('2026-07-06')), 1);
t('v2: çalışan gün3 pay 1.0', C.bnsYayilimGunlukPay(bCalisan, 5, K('2026-07-08')), 1);
t('v2: çalışan gün5 pay 1.0', C.bnsYayilimGunlukPay(bCalisan, 5, K('2026-07-10')), 1);
// (3) Gün2-3 müşteride: o günler pay 0; dönüş günü pay = korunan R / kalan gün.
const bBekle = { created_at: D('2026-07-06'), deadline: D('2026-07-10'), durum: 'revizyon',
  durum_olaylari: [
    { ts: D('2026-07-06'), durum: 'basladi' },
    { ts: Date.parse('2026-07-06T18:00:00+03:00'), durum: 'musteride' },
    { ts: D('2026-07-09'), durum: 'revizyon' } ] };
// gün1: son olay musteride → DURAN → pay 0 (gün-sonu kuralı: aynı gün ✈️ olduysa o gün pay binmez)
t('v2: ✈️ günü pay 0', C.bnsYayilimGunlukPay(bBekle, 5, K('2026-07-06')), 0);
t('v2: müşteride gün pay 0', C.bnsYayilimGunlukPay(bBekle, 5, K('2026-07-07')), 0);
t('v2: dönüş günü pay 2.5 (R=5, 2 gün)', C.bnsYayilimGunlukPay(bBekle, 5, K('2026-07-09')), 2.5);
// (4) incelemede = çalışılan (tüketir).
const bInc = { created_at: D('2026-07-06'), deadline: D('2026-07-10'), durum: 'incelemede',
  durum_olaylari: [{ ts: D('2026-07-06'), durum: 'incelemede' }] };
t('v2: incelemede tüketir (gün2 pay 1.0)', C.bnsYayilimGunlukPay(bInc, 5, K('2026-07-07')), 1);
// (5) Overdue: kalan gün 1 → tüm R bugüne.
const bGec = { created_at: D('2026-07-01'), deadline: D('2026-07-03'), durum: 'yeni', durum_olaylari: [] };
t('v2: overdue tüm R bugüne', C.bnsYayilimGunlukPay(bGec, 5, K('2026-07-08')), 5);
// (6) Hafta sonu: pay 0 ve bölene girmez (Cum→Pzt).
t('v2: hafta sonu pay 0', C.bnsYayilimGunlukPay(bYeni, 5, K('2026-07-11')), 0);
// Cum açıldı, deadline Pzt → 2 iş günü (Cum+Pzt): gün1 pay 2.5.
const bCuma = { created_at: D('2026-07-10'), deadline: D('2026-07-13'), durum: 'yeni', durum_olaylari: [] };
t('v2: Cum→Pzt 2 iş günü (pay 2.5)', C.bnsYayilimGunlukPay(bCuma, 5, K('2026-07-10')), 2.5);
// (7) Teslim: tamamlandi günü ve sonrası pay 0.
const bBitti = { created_at: D('2026-07-06'), deadline: D('2026-07-10'), durum: 'tamamlandi',
  durum_olaylari: [{ ts: D('2026-07-06'), durum: 'basladi' }, { ts: D('2026-07-08'), durum: 'tamamlandi' }] };
t('v2: tamamlandi günü pay 0', C.bnsYayilimGunlukPay(bBitti, 5, K('2026-07-08')), 0);
// (8) Reopen: yeni döngü R=V; deadline geçmiş → hepsi bugüne.
const bReopen = { created_at: D('2026-07-01'), deadline: D('2026-07-03'), durum: 'basladi',
  durum_olaylari: [
    { ts: D('2026-07-01'), durum: 'basladi' }, { ts: D('2026-07-02'), durum: 'tamamlandi' },
    { ts: D('2026-07-08'), durum: 'basladi' } ] };
t('v2: reopen tam V + overdue', C.bnsYayilimGunlukPay(bReopen, 5, K('2026-07-08')), 5);
// (9) Kişi gün doluluğu: 2 iş (worker 5/5gün + lead 1/5gün) / limit 6 → %20.
const u2 = { id: 'U9', dept: 'tasarim' };
const bA = { ...bCalisan, workers: [{ id: 'U9' }], leads: [] };
const bB = { ...bCalisan, workers: [], leads: [{ id: 'U9' }] };
t('v2: kişi gün doluluk %20', C.bnsKisiGunDoluluk([bA, bB], u2, K('2026-07-07')), 20);
// (10) 5 günlük seri: uzunluk 5, ilk eleman bugünün anahtarı.
const seri = C.bnsKisiGunlukSeri([bA], u2, K('2026-07-06'), 5);
t('v2: seri 5 eleman', seri.length, 5);
t('v2: seri hafta sonunu atlar (Cum→Pzt)', seri[4].gun, '2026-07-10');
```

- [ ] **Step 2: FAIL gör** — `node scripts/formula-test.js`.

- [ ] **Step 3: calc.js'e çekirdeği ekle (bnsKisiTrend'den sonra, module.exports ÖNCESİ)**

```js
// ── Kapasite v2 — zamana yayılmış yük (spec: 2026-07-08-zamana-yayilmis-kapasite) ──
// Sınıflar: BASLANMAMIS pay biner R sabit · CALISAN pay biner R-=pay · DURAN/BITTI pay 0 R sabit.
// Reopen (BITTI→aktif) R=V. Overdue kalan gün=1. İş günü: Pzt-Cum Europe/Istanbul.
var BNS_V2_CALISAN = { basladi: 1, revizyon: 1, incelemede: 1 };
var BNS_V2_DURAN = { beklemede: 1, musteride: 1, blokeli: 1 };
function bnsGunKey(ms) {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }); // YYYY-MM-DD
}
function bnsIsGunuMu(gunKey) {
  var wd = new Date(gunKey + 'T12:00:00+03:00').toLocaleDateString('en-US', { timeZone: 'Europe/Istanbul', weekday: 'short' });
  return wd !== 'Sat' && wd !== 'Sun';
}
function bnsSonrakiGun(gunKey) {
  var t = Date.parse(gunKey + 'T12:00:00+03:00') + 24 * BNS_H;
  return bnsGunKey(t);
}
// gunKey'den deadline gününe (dahil) kalan iş günü; overdue → 1.
function bnsKalanIsGunu(gunKey, deadlineMs) {
  var dlKey = bnsGunKey(deadlineMs);
  if (gunKey > dlKey) return 1;
  var n = 0, g = gunKey;
  while (g <= dlKey) { if (bnsIsGunuMu(g)) n++; g = bnsSonrakiGun(g); }
  return Math.max(1, n);
}
// Simülatör: işin yaşamını hedef güne kadar gün gün yürüt → hedef günün payı.
// b: { created_at, deadline, durum, durum_olaylari[{ts,durum}] } · V: rol ağırlığı.
// Gün sınıfı = o günün SON olayındaki durum (gün-sonu kuralı). Gelecek günlerde
// (olayların ötesi) son bilinen durum sabit sürer (projeksiyon varsayımı).
function bnsYayilimGunlukPay(b, V, hedefGunKey) {
  if (!b || !V || b.created_at == null || b.deadline == null) return 0;
  if (!bnsIsGunuMu(hedefGunKey)) return 0;
  var ev = (b.durum_olaylari || []).filter(function (e) { return e && e.ts != null && e.durum; })
    .slice().sort(function (a, c) { return a.ts - c.ts; });
  var g = bnsGunKey(b.created_at);
  if (hedefGunKey < g) return 0;
  var R = V, durum = 'yeni', i = 0;
  while (true) {
    // Bu günün sonuna kadarki olayları uygula (reopen: BITTI→aktif → R=V).
    var gunSonu = Date.parse(g + 'T23:59:59+03:00');
    while (i < ev.length && ev[i].ts <= gunSonu) {
      if (durum === 'tamamlandi' && ev[i].durum !== 'tamamlandi') R = V; // yeni döngü
      durum = ev[i].durum; i++;
    }
    var pay = 0;
    if (bnsIsGunuMu(g) && !BNS_V2_DURAN[durum] && durum !== 'tamamlandi') {
      pay = R / bnsKalanIsGunu(g, b.deadline);
      if (BNS_V2_CALISAN[durum]) R = Math.max(0, R - pay);
    }
    if (g === hedefGunKey) return Math.round(pay * 100) / 100;
    g = bnsSonrakiGun(g);
  }
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
```
Export listesine ekle: `bnsGunKey, bnsIsGunuMu, bnsKalanIsGunu, bnsYayilimGunlukPay, bnsKisiGunDoluluk, bnsKisiGunlukSeri`.

- [ ] **Step 4: PASS gör** — tüm v2 testleri ✅, FAIL=0. (Not: test (3) dönüş günü 2.5 — R=5 korunmuş, Per+Cum 2 iş günü.)

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/calc.js scripts/formula-test.js
git commit -m "feat(kapasite-v2): zamana yayılmış yük çekirdeği (simülatör + gün/seri) + testler

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

## Task 2: Profil — v2 doluluk + 5 günlük şerit (eski % yanında)

**Files:**
- Modify: `dashboard/app/screens/Profile.jsx`

- [ ] **Step 1: KPI şeridindeki "Kapasite" hücresinin yanına v2 hücresi ekle**

Profile.jsx'te `<Kpi label="Kapasite" value={capPct+"%"}` satırını bul; hemen ardına:
```jsx
        <Kpi label="Kapasite v2" value={(() => {
          const s = (typeof bnsKisiGunlukSeri === "function")
            ? bnsKisiGunlukSeri(myAll, u, (typeof bnsGunKey === "function" ? bnsGunKey(Date.now()) : ""), 5) : [];
          return s.length ? s[0].pct + "%" : "—";
        })()} sub="zamana yayılmış · bugün" color={(() => {
          const s = (typeof bnsKisiGunlukSeri === "function")
            ? bnsKisiGunlukSeri(myAll, u, (typeof bnsGunKey === "function" ? bnsGunKey(Date.now()) : ""), 1) : [];
          const p = s.length ? s[0].pct : 0;
          return p >= 120 ? "var(--prio-red)" : p >= 100 ? "var(--prio-orange)" : undefined;
        })()}/>
```
`myAll` = kişinin aktif brief listesi (Profil'de mevcut değişken; yoksa aynı kaynaktan kişinin işleri). Not: seri fonksiyonu `durum_olaylari` bekler — aktif briefs embedded'da taşıyor.

- [ ] **Step 2: KendiPerformansKarti üstüne / KPI altına 5-günlük şerit**

KPI şeridinden sonra (yalnız `_isSelf`):
```jsx
      {_isSelf && (() => {
        const seri = (typeof bnsKisiGunlukSeri === "function")
          ? bnsKisiGunlukSeri(myAll, u, bnsGunKey(Date.now()), 5) : [];
        if (!seri.length) return null;
        const gunAd = (k) => new Date(k + "T12:00:00+03:00").toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", weekday: "short" });
        return (
          <Card style={{padding:12, marginBottom:"var(--grid-gap)"}}>
            <div style={{font:"600 12px/1 var(--font-sans)", marginBottom:8}}>📅 Önümüzdeki 5 iş günü — doluluk projeksiyonu <span style={{font:"400 10px var(--font-sans)", color:"var(--ink-4)"}}>(zamana yayılmış model — deneme)</span></div>
            <div style={{display:"flex", gap:8}}>
              {seri.map((x, i) => (
                <div key={x.gun} style={{flex:1, textAlign:"center"}}>
                  <div style={{height:44, display:"flex", alignItems:"flex-end", justifyContent:"center"}}>
                    <div style={{width:"70%", borderRadius:3,
                      height: Math.max(3, Math.min(44, Math.round(x.pct / 150 * 44))),
                      background: x.pct >= 120 ? "var(--prio-red)" : x.pct >= 100 ? "var(--prio-orange)" : "var(--prio-green)"}}/>
                  </div>
                  <div style={{font:"600 11px/1.4 var(--font-sans)"}}>%{x.pct}</div>
                  <div style={{font:"400 10px/1.2 var(--font-sans)", color:"var(--ink-3)"}}>{i === 0 ? "bugün" : gunAd(x.gun)}</div>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}
```

- [ ] **Step 3: CI** — `bash scripts/ci-check.sh` → JSX ✅ + formüller ✅.

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/screens/Profile.jsx
git commit -m "feat(kapasite-v2): Profil'de v2 doluluk KPI + 5 iş günü projeksiyon şeridi (eski % yanında)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

## Task 3: Build + preview + deploy

- [ ] **Step 1: Build** — `bash scripts/build-dashboard.sh`.
- [ ] **Step 2: Preview** — gerçek veride: `bnsKisiGunlukSeri` bir kullanıcı için 5 eleman + makul %'ler; konsol temiz; overdue işleri olan kişide bugün yüksek % beklenir.
- [ ] **Step 3: Commit build + deploy dashboard + push.**

## Self-Review

- Spec Aşama 1 formül kuralları: başlanmamış-artan ✓(test1) · çalışan-sabit ✓(2) · duran-koruma+dönüş sıkışması ✓(3) · incelemede=çalışan ✓(4) · overdue ✓(5) · hafta sonu ✓(6) · teslim ✓(7) · reopen tam-V ✓(8) · kırpma yok (doluluk >%100 serbest) ✓ (bnsKisiGunDoluluk min/max'sız).
- Aşama 2: Profil KPI + 5-gün şerit + eski % korunur ✓. Departman/firma/sinyal + deadline-zorunlu → sonraki plan (bilinçli).
- Tip tutarlılığı: `bnsYayilimGunlukPay(b,V,gunKey)` ↔ testler ↔ UI çağrıları eşleşir; `myAll`/`_isSelf`/`Kpi` Profil'de mevcut.
