# Kapasite v2 — Tamamlama (Aşama 3-4 + Deadline Kuralı) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Departman/firma doluluğunu v2 tabanına almak, firma-sinyal kapasite eşiğini v2'ye geçirmek, eski burnout sinyalini v2 gün-projeksiyonuyla değiştirmek, deadline'ı zorunlu kılmak (+ mevcut deadline'sızlara varsayılan) ve dokümanları eşlemek.

**Architecture:** calc'a `bnsDeptGunDoluluk`/`bnsFirmaGunDoluluk` (kişi paylarının toplamı / limit toplamı). firma-sinyal.js kapasiteyi v2 bugün-doluluğundan okur; burnout = kişi 5-gün serisinde ≥%120 gün. `writes.createBrief` deadline'sız kaydı reddeder; Slack modal termin alanı zorunlu. Tek seferlik backfill HTTP PATCH ile.

**Tech Stack:** calc.js, formula-test.js, scripts/firma-sinyal.js, server/writes.js, scripts/slack-bot.js, DeptCompare/Department JSX.

---

## Task 1: calc — departman/firma v2 + burnout metni (TDD)

**Files:** `dashboard/app/calc.js`, `scripts/formula-test.js`

- [ ] **Step 1: Testler (özetten ÖNCE)**

```js
// ── Kapasite v2: departman/firma + burnout v2 ──
const uT1 = { id: 'U11', dept: 'tasarim', active: true };
const uT2 = { id: 'U12', dept: 'tasarim', active: true };
const uE1 = { id: 'U13', dept: 'editor', active: true };
const bD1 = { created_at: D('2026-07-06'), deadline: D('2026-07-10'), durum: 'basladi',
  durum_olaylari: [{ ts: D('2026-07-06'), durum: 'basladi' }], workers: [{ id: 'U11' }], leads: [] };
// tasarim: U11 pay 1.0, U12 pay 0 → toplam 1 / (6+6) = %8
t('v2: dept doluluk %8', C.bnsDeptGunDoluluk([bD1], [uT1, uT2, uE1], 'tasarim', K('2026-07-07')), 8);
// firma: 1 / (6+6+8) = %5
t('v2: firma doluluk %5', C.bnsFirmaGunDoluluk([bD1], [uT1, uT2, uE1], K('2026-07-07')), 5);
t('v2: dept boş üye listesi %0', C.bnsDeptGunDoluluk([bD1], [], 'tasarim', K('2026-07-07')), 0);
// burnout v2 metni gün adıyla
t('v2: burnout sinyal gün adlı', C.bnsSinyalBurnout([{ ad: 'Eda', pct: 140, gun: 'Per' }])[0].text.includes('Per'), true);
```

- [ ] **Step 2: FAIL gör.**

- [ ] **Step 3: calc'a ekle (bnsKisiGunlukSeri'den sonra) + bnsSinyalBurnout metnini güncelle**

```js
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
```
`bnsSinyalBurnout` metni: `'🔥 ' + k.ad + (k.gun ? ' ' + k.gun + ' günü' : ' gelecek 5 günde') + ' %' + k.pct + ' yüklü — burnout riski, yük dengelemesi düşün.'`
Export: `bnsDeptGunDoluluk, bnsFirmaGunDoluluk`.

- [ ] **Step 4: PASS + eski burnout testleri hâlâ geçiyor (gun'suz çağrı geriye-uyumlu).**
- [ ] **Step 5: Commit** — `feat(kapasite-v2): dept/firma gün doluluğu + burnout gün-adlı metin`.

## Task 2: UI Aşama 3 — Departmanlar özet + Departman sayfası v2 satırı

**Files:** `dashboard/app/screens/DeptCompare.jsx`, `dashboard/app/screens/Department.jsx`

- [ ] **Step 1:** Her iki ekranda mevcut kapasite göstergesinin yakınına kompakt v2 satırı: `Kapasite v2 (bugün): %X` — `bnsDeptGunDoluluk(data.briefs, data.USERS, deptKey, bnsGunKey(Date.now()))`; DeptCompare'de 4 departman + firma satırı (`bnsFirmaGunDoluluk`). Renk: ≥120 kırmızı, ≥100 turuncu. Etiket: "(zamana yayılmış · deneme)". Veri kaynağı adları ekranda ne ise onu kullan (grep ile doğrula: `data.briefs`/`USERS` this shape).
- [ ] **Step 2:** CI JSX ✅. **Step 3: Commit.**

## Task 3: firma-sinyal Aşama 4 — kapasite v2 + burnout v2

**Files:** `scripts/firma-sinyal.js`

- [ ] **Step 1:** `firmaCapPct(d)` fonksiyonunu kaldır; kapasite sinyali:
```js
out.push(...C.bnsSinyalKapasite(C.bnsFirmaGunDoluluk(aktif, d.bns_users, C.bnsGunKey(now))));
```
- [ ] **Step 2:** Burnout bloğunu v2 ile değiştir (BES_GUN/upByKisi/bnsBurnout kullanımı gider):
```js
  // 6. Burnout v2: kişi 5-iş-günü serisinde ≥%120 gün (zamana yayılmış projeksiyon).
  const bugun = C.bnsGunKey(now);
  const GUN_AD = (k) => new Date(k + 'T12:00:00+03:00').toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'short' });
  const burnoutlar = [];
  (d.bns_users || []).forEach((u) => {
    if (!/^U/.test(u.id) || u.active === false) return;
    const seri = C.bnsKisiGunlukSeri(aktif, u, bugun, 5);
    const tepe = seri.reduce((a, x) => (x.pct > a.pct ? x : a), { pct: 0 });
    if (tepe.pct >= 120) burnoutlar.push({ ad: (u.name || '').split(' ')[0] || u.id, pct: tepe.pct, gun: GUN_AD(tepe.gun) });
  });
  out.push(...C.bnsSinyalBurnout(burnoutlar));
```
- [ ] **Step 3:** calc'tan `bnsBurnout` + testlerini kaldır (tek kullanıcı script'ti; artık öksüz). Yerinde tut: `bnsSinyalBurnout` (kullanılıyor).
- [ ] **Step 4:** `node --check` + sentetik `sinyalleriHesapla` koşusu (yüklü kişi → burnout gün-adlı; kapasite v2 %). **Step 5: Commit.**

## Task 4: Deadline zorunlu + backfill

**Files:** `server/writes.js` (createBrief), `scripts/slack-bot.js` (/yeni-brief modal termin alanı)

- [ ] **Step 1:** `writes.createBrief` başında (parse sonrası): `if (d.deadline == null) { const e = new Error('termin (deadline) zorunlu — terminsiz iş açılamaz'); e.status = 400; throw e; }` (alan adını createBrief'in gerçekten kullandığı adla doğrula — grep `deadline` createBrief içinde).
- [ ] **Step 2:** Slack `/yeni-brief` modalında termin input'unu zorunlu yap: modal blokta ilgili `optional: true` → kaldır/false (grep `termin` modal tanımında).
- [ ] **Step 3 (backfill, tek seferlik):** deadline'sız aktif işler: `açılış + 5 iş günü 18:00` ata + Görkem'e liste DM. PATCH yolu: önce `grep patchBrief` ile deadline kabul ettiğini doğrula; ediyorsa railway-run inline node: embedded'dan deadline'sız aktifleri bul → `PATCH /api/briefs/:id {deadline, by:'system'}` → sonuç listesi `post(tok, GORKEM, ...)`. patchBrief deadline almıyorsa `termin` kelime-yolu API'siyle aynı endpoint'i kullan (doğrula).
- [ ] **Step 4:** `node --check` her iki dosya. **Step 5: Commit.**

## Task 5: Dokümanlar + build + iki servis deploy + canlı doğrulama

- [ ] **Step 1:** Help.jsx "Kapasite & İş Yükü" bölümüne v2 açıklaması (zamana yayılmış model: pay=R/kalan gün; duran günler pay 0; overdue bugüne biner; %100 aşılabilir; Profil'de 5-gün şerit) + "deadline zorunlu" notu. kullanim-klavuzu md+html: kapasite bölümü + 8.5 burnout satırı v2 tanımına güncelle.
- [ ] **Step 2:** CI + build + commit.
- [ ] **Step 3:** `deploy.sh api` + `deploy.sh dashboard` + push (scheduler scripts/** ile otomatik).
- [ ] **Step 4:** Canlı: `railway run ... firma-sinyal.js --dry` → kapasite v2 % + burnout gün-adlı; deadline'sız POST 400 dönüyor (curl ile bilinçli deneme); health 200.

## Self-Review

- Spec Aşama 3 ✓ (T1+T2) · Aşama 4 ✓ (T3: kapasite v2 tabanı + burnout emekliliği) · Kural 1 deadline ✓ (T4: validasyon + modal + backfill+DM) · dokümanlar ✓ (T5).
- Tip tutarlılık: `bnsSinyalBurnout({ad,pct,gun})` T1↔T3; `bnsFirmaGunDoluluk(briefs,users,gunKey)` T1↔T3.
- Bilinçli: eski `bnsBurnout` kaldırılır (öksüz); eski düz kapasite fonksiyonları DURUR (ekranlar yan yana dönemde ikisini de gösteriyor — söküm ayrı iş).
