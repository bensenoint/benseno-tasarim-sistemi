# "İşe başlandı" Statüsü Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** İş akışına, "kabul" (`çalışılıyor`) ile "gerçek çalışma" arasını ayıran eklemeli `basladi` ("İşe başlandı") statüsü eklemek; çalışma süresini damga varsa işe-başlandıdan, yoksa mevcut `started_at`'ten ölçmek (hibrit).

**Architecture:** Tamamen eklemeli. Yeni `basladi` durum key'i; `briefs.basladi_at` kolonu status endpoint'te 🚀 ile damgalanır; `queries.js` `baslangic = COALESCE(basladi_at, started_at)` ile besler → calc.js + 35 test değişmez. Dashboard (StatusPill/Kanban/BriefTable/Jobs), Slack bot (🚀), Ody durum bilgisi güncellenir.

**Tech Stack:** Node+Express+pg, React UMD + esbuild bundle, Slack Bolt bot, `node --test`, scripts/ci-check.sh, scripts/deploy.sh.

---

## Genel kurallar
- `main` branch'te çalış (repo main'den deploy eder). Push gerektiğinde önce `git pull --rebase origin main` (data-agent eş-zamanlı push edebilir).
- Dashboard kaynağı `dashboard/app/`; build `scripts/build-dashboard.sh` (→ root `app/`), v2 ayna `scripts/build-v2.sh`. CI: `scripts/ci-check.sh`.
- **dashboard/app/ ve v2/app/ senkron tutulur** (değişen ekran dosyasını v2'ye kopyala; ama önce `git show HEAD:dashboard/app/<f>` ile v2'nin pre-edit'e eşit olduğunu doğrula).
- Yeni durum key: **`basladi`**, etiket **"İşe başlandı"** (kısa "Başladı"). Renk: `var(--ok, #2E8F66)` (yeşil).

---

## Task 1: Migration — `briefs.basladi_at`

**Files:**
- Create: `server/migrations/0004_brief_basladi_at.sql`

- [ ] **Step 1: Migration dosyasını yaz**

```sql
-- "İşe başlandı" statüsü: gerçek çalışma başlangıç damgası.
-- Durum 'basladi' olunca status endpoint'te (COALESCE ile bir kez) set edilir.
-- Süre hesabı: queries.js baslangic = COALESCE(basladi_at, started_at) — damga yoksa eski davranış.
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS basladi_at timestamptz;
CREATE INDEX IF NOT EXISTS briefs_basladi_idx ON briefs(basladi_at);
```

- [ ] **Step 2: Prod'a uygula**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node server/scripts/migrate.js`
Expected: `✓ uygulandı: 0004_brief_basladi_at.sql`

- [ ] **Step 3: Doğrula**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node server/scripts/migrate.js status`
Expected: `[✓] 0004_brief_basladi_at.sql`

- [ ] **Step 4: Commit**

```bash
git add server/migrations/0004_brief_basladi_at.sql
git commit -m "feat(db): briefs.basladi_at kolonu — işe-başlandı damgası (migration 0004)"
```

---

## Task 2: Backend durum enum + `basladi_at` damgası (writes.js)

**Files:**
- Modify: `server/writes.js` (DURUMLAR enum satır 16; status UPDATE bloğu ~471)
- Test: `server/writes-durum.test.js` (yeni)

- [ ] **Step 1: Failing test yaz**

```js
// server/writes-durum.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { DURUMLAR } = require('./writes');

test("DURUMLAR 'basladi' içerir ve çalışılıyor ile incelemede arasındadır", () => {
  assert.ok(DURUMLAR.includes('basladi'), "basladi eklenmeli");
  const i = DURUMLAR.indexOf('basladi'), c = DURUMLAR.indexOf('calisiliyor'), r = DURUMLAR.indexOf('incelemede');
  assert.ok(c < i && i < r, "sıra: calisiliyor < basladi < incelemede");
});
```

- [ ] **Step 2: Testi çalıştır, başarısız gör**

Run: `node --test server/writes-durum.test.js`
Expected: FAIL (basladi yok)

- [ ] **Step 3: DURUMLAR enum'a `basladi` ekle**

`server/writes.js` satır 16'yı değiştir:

```js
const DURUMLAR = ['yeni', 'calisiliyor', 'basladi', 'incelemede', 'beklemede', 'revizyon', 'blokeli', 'musteride', 'tamamlandi'];
```

- [ ] **Step 4: Status UPDATE'e `basladi_at` damgası ekle**

`server/writes.js` status UPDATE'inde `started_at` satırından SONRA bir satır ekle (durum 'basladi' olunca bir kez damgala):

```js
         started_at   = CASE WHEN $1='calisiliyor' THEN COALESCE(started_at, now()) ELSE started_at END,
         basladi_at   = CASE WHEN $1='basladi' THEN COALESCE(basladi_at, now()) ELSE basladi_at END,
```

- [ ] **Step 5: Testi + syntax doğrula**

Run: `node --test server/writes-durum.test.js && node --check server/writes.js && echo OK`
Expected: test PASS, `OK`

- [ ] **Step 6: Commit**

```bash
git add server/writes.js server/writes-durum.test.js
git commit -m "feat(api): 'basladi' durumu DURUMLAR enum'a + status endpoint basladi_at damgası"
```

---

## Task 3: Süre kaynağı — `queries.js` COALESCE

**Files:**
- Modify: `server/queries.js` (satır 173 — `baslangic: ms(b.started_at)`)

- [ ] **Step 1: `baslangic`'i COALESCE'e çevir**

`server/queries.js` satır 173'te `baslangic: ms(b.started_at)` → COALESCE. `b.basladi_at` SELECT'te yoksa ekle. Önce SELECT'e `b.basladi_at` ekli mi kontrol et:

Run: `grep -n "b.started_at\|b.basladi_at\|baslangic: ms" server/queries.js`

SELECT listesinde `b.started_at` geçen satıra `b.basladi_at` ekle (yanına), ve map satırını değiştir:

```js
    deadline: ms(b.deadline), baslangic: ms(b.basladi_at || b.started_at), bitis: ms(b.completed_at),
```

(`ms()` null-güvenli; `b.basladi_at || b.started_at` damga varsa onu, yoksa started_at'i kullanır = hibrit fallback.)

> **Not (uygulayıcıya):** `b.basladi_at` SELECT'lerde (getEmbedded'in ana brief sorgusunda) yoksa, `b.started_at`'in geçtiği SELECT sütun listesine `b.basladi_at` ekle — yoksa `b.basladi_at` undefined olur ve hep started_at'e düşer. İki SELECT olabilir (getEmbedded + getState); ikisinde de started_at'in yanına basladi_at ekle.

- [ ] **Step 2: Fallback'i doğrula (damga yokken started_at ile aynı)**

Run:
```
[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"
node -e '
const {getEmbedded}=require("./server/queries");
(async()=>{ const ed=await getEmbedded();
  const c=(ed.bns_completed||[]).filter(x=>x.baslangic!=null).slice(0,5);
  console.log("örnek baslangic değerleri:", c.map(x=>"#"+x.no+":"+x.baslangic).join(", "));
  console.log("tamamlanan:", (ed.bns_completed||[]).length, "— hata yoksa OK");
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});'
```
Expected: hata yok, baslangic değerleri dolu (damga olmadığından started_at'ten gelir).

- [ ] **Step 3: Commit**

```bash
git add server/queries.js
git commit -m "feat(api): süre baslangici COALESCE(basladi_at, started_at) — işe-başlandı varsa ondan ölç (hibrit)"
```

---

## Task 4: StatusPill (Atoms.jsx)

**Files:**
- Modify: `dashboard/app/Atoms.jsx` (StatusPill map ~120)

- [ ] **Step 1: `basladi` satırını map'e ekle**

`dashboard/app/Atoms.jsx`'te `calisiliyor:` satırından SONRA ekle:

```js
    calisiliyor: { color: "var(--info)",     label: "Çalışıyor", full: "Çalışılıyor" },
    basladi:     { color: "var(--ok, #2E8F66)", label: "Başladı", full: "İşe başlandı · şu an çalışılıyor" },
```

- [ ] **Step 2: Doğrula (syntax/CI)**

Run: `bash scripts/ci-check.sh 2>&1 | tail -1`
Expected: `🟢 CI KAPISI GEÇTİ`

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/Atoms.jsx
git commit -m "feat(dashboard): StatusPill 'basladi' (İşe başlandı) rozeti"
```

---

## Task 5: Kanban kolonu (Kanban.jsx)

**Files:**
- Modify: `dashboard/app/screens/Kanban.jsx` (cols dizisi ~14-21)

- [ ] **Step 1: `basladi` kolonunu çalışılıyor ile incelemede arasına ekle**

`dashboard/app/screens/Kanban.jsx` `cols` dizisinde `calisiliyor` satırından SONRA ekle:

```js
    { id: "calisiliyor", label: "Çalışılıyor", Ic: I.Pencil, accent: "var(--info)" },
    { id: "basladi",     label: "İşe başlandı", Ic: I.Play,  accent: "var(--ok, #2E8F66)" },
```

> **Not:** `I.Play` ikonu yoksa mevcut bir ikon kullan (`I.Pencil`/`I.Bolt`/`I.Clock`). `dashboard/app` içinde `I.` ikon setini `grep -n "Play\|Bolt" dashboard/app/*.jsx` ile doğrula; yoksa `I.Pencil` ile aynı bırakma — ayrışsın diye `I.Clock` kullan.

- [ ] **Step 2: CI**

Run: `bash scripts/ci-check.sh 2>&1 | tail -1`
Expected: `🟢 CI KAPISI GEÇTİ`

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/screens/Kanban.jsx
git commit -m "feat(dashboard): Kanban 'İşe başlandı' kolonu (Çalışılıyor↔İncelemede arası)"
```

---

## Task 6: BriefTable durum menüsü

**Files:**
- Modify: `dashboard/app/BriefTable.jsx` (StatusMenu opts ~210-215)

- [ ] **Step 1: Menüye `basladi` seçeneği ekle**

`dashboard/app/BriefTable.jsx` `StatusMenu` `opts` dizisinde `calisiliyor` satırından SONRA ekle:

```js
    ["yeni",        "Yeni"],
    ["calisiliyor", "Çalışılıyor"],
    ["basladi",     "İşe başlandı"],
    ["incelemede",  "İncelemede"],
    ["blokeli",     "Blokeli"],
    ["tamamlandi",  "Tamamlandı"]
```

- [ ] **Step 2: CI**

Run: `bash scripts/ci-check.sh 2>&1 | tail -1`
Expected: `🟢 CI KAPISI GEÇTİ`

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/BriefTable.jsx
git commit -m "feat(dashboard): BriefTable durum menüsüne 'İşe başlandı'"
```

---

## Task 7: Jobs "Açık" scope + sayaç

**Files:**
- Modify: `dashboard/app/screens/Jobs.jsx` (rows filter ~18; segment options ~78)

- [ ] **Step 1: "open" scope filtresine `basladi` ekle**

`dashboard/app/screens/Jobs.jsx`'te:

```js
  if (scope === "open")    rows = rows.filter(b => b.durum === "yeni" || b.durum === "calisiliyor" || b.durum === "basladi");
```

- [ ] **Step 2: "Açık" segment sayacını güncelle**

Aynı dosyada Segment options'taki "open" sayımını değiştir:

```js
          ["open",    `Açık · ${data.briefs.filter(b => b.durum==="yeni"||b.durum==="calisiliyor"||b.durum==="basladi").length}`],
```

- [ ] **Step 3: CI**

Run: `bash scripts/ci-check.sh 2>&1 | tail -1`
Expected: `🟢 CI KAPISI GEÇTİ`

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/screens/Jobs.jsx
git commit -m "feat(dashboard): Jobs 'Açık' scope + sayacına 'basladi' dahil"
```

---

## Task 8: Slack bot — 🚀 → basladi

**Files:**
- Modify: `scripts/slack-bot.js` (DURUM_MAP ~918; EMOJI_DURUM ~1185; /yardım ~638)

- [ ] **Step 1: DURUM_MAP'e rocket ekle**

`scripts/slack-bot.js` `DURUM_MAP` nesnesine ekle (calisiliyor satırlarının yanına):

```js
    rocket: 'basladi',
```

- [ ] **Step 2: thread-metni EMOJI_DURUM'a 🚀 ekle**

`EMOJI_DURUM` dizisine (calisiliyor girdilerinden sonra) ekle:

```js
      { emoji: '🚀', durum: 'basladi' }, { emoji: ':rocket:', durum: 'basladi' },
```

- [ ] **Step 3: /yardım metnine ekle**

`/yardım` durum listesi metninde (`:bso-calisiliyor: → Çalışılıyor` içeren satır) `Çalışılıyor`dan sonra `🚀 → İşe başlandı` ekle. Örn:

```js
          '*Durum:*\n:bso-calisiliyor: → Çalışılıyor\n🚀 → İşe başlandı\n:bso-devam: → Devam ediyor\n:bso-incelemede: → İncelemede\n:bso-beklemede: → Beklemede\n:bso-revizyon: → Revizyon\n:bso-musteriye: → Müşteriye\n:bso-tamamlandi: → Tamamlandı\n:bso-yeniden-acildi: → Yeniden aç\n:bso-galeri-muhru: → Final teslim (galeri)' },
```

- [ ] **Step 4: Syntax doğrula**

Run: `node --check scripts/slack-bot.js && echo OK`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add scripts/slack-bot.js
git commit -m "feat(slack): 🚀 (:rocket:) → 'İşe başlandı' durumu; DURUM_MAP + thread emoji + /yardım"
```

---

## Task 9: Ody durum bilgisi

**Files:**
- Modify: `server/ody-tools.js` (brief_sorgula description ~75)
- Modify: `server/chat-bilgi.md` (durum listesi)

- [ ] **Step 1: brief_sorgula durum açıklamasına `basladi` ekle**

`server/ody-tools.js` satır 75 description'da `durum (yeni/calisiliyor/incelemede/...)` listesine `basladi` ekle:

```js
  description: 'Brief ara/filtrele. Filtreler: marka (kısmi), durum (yeni/calisiliyor/basladi/incelemede/musteride/blokeli), kisi (isim, atanan), gecikmis (true), tamamlandi (true→tamamlananlarda arar; aralık uygulanır). Eşleşen işlerin listesi + toplam sayı.',
```

- [ ] **Step 2: chat-bilgi.md durum listesine ekle**

`server/chat-bilgi.md` içinde durum/statü açıklamasının geçtiği yere (calisiliyor'dan sonra) ekle:

Run önce yeri bul: `grep -n "calisiliyor\|Çalışılıyor\|durum" server/chat-bilgi.md`
Sonra calisiliyor açıklamasının ardına bir satır ekle (markdown):

```markdown
- **basladi** (İşe başlandı): kişi işi kabul edip (çalışılıyor) gerçekten o iş üzerinde çalışmaya başladı. Çalışma süresi bu andan ölçülür.
```

- [ ] **Step 3: Syntax**

Run: `node --check server/ody-tools.js && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add server/ody-tools.js server/chat-bilgi.md
git commit -m "feat(ody): 'basladi' durumu brief_sorgula + chat-bilgi'ye eklendi"
```

---

## Task 10: v2 senkron + build + deploy + doğrulama

**Files:** yok (senkron + çalıştırma)

- [ ] **Step 1: v2 ekran dosyalarını senkronla**

Değişen dashboard ekran dosyalarını v2'ye kopyala (Atoms, Kanban, BriefTable, Jobs):

```bash
cd /Users/gorkemkaya/benseno-tasarim-sistemi
for f in Atoms.jsx BriefTable.jsx screens/Kanban.jsx screens/Jobs.jsx; do cp dashboard/app/$f v2/app/$f; done
```

- [ ] **Step 2: CI + build**

Run: `bash scripts/ci-check.sh 2>&1 | tail -1 && bash scripts/build-dashboard.sh 2>&1 | tail -1 && bash scripts/build-v2.sh 2>&1 | tail -1`
Expected: `🟢 CI KAPISI GEÇTİ` + iki build "hazır".

- [ ] **Step 3: Commit + push (Pages) **

```bash
git add -A && git commit -m "chore: 'İşe başlandı' — v2 senkron + bundle build" && git pull --rebase origin main && git push
```

- [ ] **Step 4: API deploy (Railway) + bot deploy**

Run: `bash scripts/deploy.sh api 2>&1 | grep -iE "tetiklendi|GEÇTİ|geçti, |kaldı|tamam"`
Expected: `✅ API deploy tetiklendi`; tutarlılık denetimi temiz; Ody eval geçti.
(Bot `benseno-tasarim-sistemi` servisi git push ile otomatik deploy olur; gerekirse `bash scripts/deploy.sh bot`.)

- [ ] **Step 5: SUCCESS bekle**

Run: `until railway deployment list --service benseno-api 2>/dev/null | sed -n '2p' | grep -q SUCCESS; do sleep 10; done; echo CANLI`
Expected: `CANLI`

- [ ] **Step 6: Canlı round-trip doğrulama (basladi_at damgası + süre)**

Bir test brief'ini status endpoint ile `basladi` yapıp `basladi_at` damgalandığını ve `baslangic`'in ondan geldiğini doğrula (DİKKAT: gerçek brief'in durumunu geçici değiştirir — sonra eski durumuna geri al). Tercihen yeni/test bir brief seç. Adımlar:
1. `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"` ve bir test brief id seç (`node -e` ile durum='yeni' bir brief bul).
2. Status endpoint'e (JWT'li) `{durum:'basladi'}` POST et.
3. DB'de `SELECT basladi_at FROM briefs WHERE id=...` → dolu olmalı.
4. Brief'i eski durumuna geri al.

Bu adım risklidir; alternatif: yalnız `basladi_at` kolonu + enum kabulünü doğrula (status endpoint 'basladi'yı 400 vermeden kabul eder) ve gerçek damgalamayı ekibin ilk 🚀'ında gözle.

- [ ] **Step 7: Kapanış commit (varsa)**

```bash
git add -A && git commit -m "chore: 'İşe başlandı' statüsü — canlı doğrulandı" || echo temiz
```

---

## Self-Review notları

- **Spec kapsama:** akış modeli (T2,T4,T5,T6,T7), basladi_at + süre hibrit (T1,T2,T3), Slack 🚀 (T8), dashboard (T4-T7), Ody (T9), deploy/doğrulama (T10) — hepsi karşılanıyor.
- **Otomatik doğru:** aktif/gecikme/kapasite/consistency-check `durum<>'musteride'` mantığıyla `basladi`'yı kendiliğinden kapsar → ek görev yok; T10 consistency-check ile doğrulanır.
- **calc.js dokunulmadı** → 35 test değişmeden geçer (CI). Süre değişimi yalnız `baslangic` kaynağında (queries COALESCE).
- **Tip/isim tutarlılığı:** durum key her yerde `basladi`; etiket "İşe başlandı"/"Başladı"; renk `var(--ok, #2E8F66)`; emoji 🚀/`:rocket:`.
- **Doğrulanacak (uygulama anında):** `b.basladi_at`'in getEmbedded + getState SELECT sütun listelerine eklendiği (T3 notu); `I.Play` ikonunun varlığı (T5 notu).
