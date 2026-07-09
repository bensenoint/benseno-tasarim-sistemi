# Fatura v2 — Retainer + Ek İş Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** İşlere ücret tipi (kapsamda/ek), markalara aylık retainer + ay×marka fatura takibi; dürtü/kâr yalnız ek işlerde satış bekler; brifing kesilmemiş retainer'ları söyler.

**Architecture:** Migration 0017 (brands.aylik_ucret, briefs.ucret_tipi, marka_fatura). API: by-name retainer set (geçiş tetiği: NULL tipleri kapsamda yapar) + retainer-ay upsert + financials'a ucret_tipi. Embedded sensitive bloklarına yeni alanlar + bns_marka_fatura. Dürtü koşulu daralır; bnsFinansOzet ek-satış/tüm-maliyet olur; Drawer tip anahtarı; Brand.jsx Retainer kartı; brifing listesi.

**Tech Stack:** Postgres/Express (server), calc.js+formula-test, React UMD (Drawer/Brand/Completed), firma-brifing.js.

---

## Kritik notlar

- Embedded `bns_brands`'te **id yok** → marka API'leri **by-name** çalışır (`brandIdByName` mevcut).
- Okuma kuralı: `ucret_tipi IS NULL` → markası retainer'lıysa `kapsamda`, değilse `ek` sayılır (geçiş tetiği NULL'ları zaten doldurur; bu kural emniyet).
- Finans alanları sensitive blokta kalır (SEC-5).

## Task 1: Migration + server (API + embedded + createBrief default)

**Files:** `server/migrations/0017_fatura_v2.sql` (yeni), `server/writes.js`, `server/api.js`, `server/queries.js`

- [ ] **Step 1: Migration** — spec'teki SQL aynen (brands.aylik_ucret NUMERIC · briefs.ucret_tipi TEXT · marka_fatura tablosu UNIQUE(marka_id, ay)).
- [ ] **Step 2: writes.js**
  - `financialsBody` zod'a: `ucret_tipi: z.enum(['kapsamda','ek']).optional()`; `setFinancials`'ta `if (d.ucret_tipi !== undefined) put('ucret_tipi', d.ucret_tipi);`
  - `createBrief` tx içinde markaId'den sonra: `const mu = await client.query('SELECT aylik_ucret FROM brands WHERE id=$1',[markaId]);` INSERT kolonlarına `ucret_tipi` ekle, değer: `mu.rows[0]?.aylik_ucret != null ? 'kapsamda' : 'ek'`.
  - Yeni: `async function setBrandRetainer(name, aylikUcret)` — `UPDATE brands SET aylik_ucret=$ WHERE id` + tutar NULL değilse `UPDATE briefs SET ucret_tipi='kapsamda' WHERE marka_id=$ AND ucret_tipi IS NULL` (dönüş: güncellenen iş sayısı). `async function upsertMarkaFaturaAy(name, ay, patch)` — tutar verilmemişse brands.aylik_ucret kopyala; `INSERT ... ON CONFLICT (marka_id, ay) DO UPDATE`. Export ikisini.
- [ ] **Step 3: api.js** (assertCanWriteFinancials + writeGuard ile):
```js
app.post('/api/brands/by-name/:name/retainer', writeGuard, handleWrite(async req => { await assertCanWriteFinancials(req); return writes.setBrandRetainer(req.params.name, req.body?.aylik_ucret ?? null); }));
app.post('/api/brands/by-name/:name/retainer-ay', writeGuard, handleWrite(async req => { await assertCanWriteFinancials(req); return writes.upsertMarkaFaturaAy(req.params.name, req.body?.ay, req.body || {}); }));
```
- [ ] **Step 4: queries.js embedded**
  - brands SELECT'lerine (57 ve 115) `aylik_ucret` ekle; `bns_brands` map'ine `...(sensitive ? { aylik_ucret: b.aylik_ucret != null ? +b.aylik_ucret : null } : {})`.
  - Aktif + tamamlanan brief sensitive spread'lerine `ucret_tipi: b.ucret_tipi || null` ekle (allBriefsWithAssignees SELECT'ine `b.ucret_tipi` kolonu).
  - `bns_marka_fatura` (sensitive iken): son 3 ayın kayıtları `SELECT br.name AS marka, mf.ay, mf.tutar, mf.fatura, mf.odeme FROM marka_fatura mf JOIN brands br ON br.id=mf.marka_id WHERE mf.ay >= to_char(now() - interval '2 months','YYYY-MM')`.
- [ ] **Step 5:** `node --check` üçü; commit `feat(fatura-v2): migration 0017 + retainer API + embedded alanları`.

## Task 2: Dürtü koşulu (yalnız ek işler)

**Files:** `server/writes.js` (setStatus finans dürtüsü)

- [ ] **Step 1:** Dürtü SELECT'ini genişlet: `SELECT b.no, b.maliyet, b.satis, b.ucret_tipi, br.aylik_ucret, b.slack_channel, b.slack_ts FROM briefs b LEFT JOIN brands br ON br.id=b.marka_id WHERE b.id=$1`. Koşula ekle: `const ek = fb.ucret_tipi === 'ek' || (fb.ucret_tipi == null && fb.aylik_ucret == null); if (ek && fb.maliyet == null && fb.satis == null) { ...postThread... }`.
- [ ] **Step 2:** `node --check`; commit.

## Task 3: calc — bnsFinansOzet retainer farkındalığı (TDD)

**Files:** `dashboard/app/calc.js`, `scripts/formula-test.js`

- [ ] **Step 1: Testler**
```js
// ── Fatura v2: kapsamda işler satış tarafında sayılmaz; maliyet her işte ──
const fEk = { maliyet: 100, satis: 400, fatura: true, odeme: false, ucret_tipi: 'ek' };
const fKap = { maliyet: 200, satis: 999, fatura: false, odeme: false, ucret_tipi: 'kapsamda' }; // satis girilmişse bile sayılmaz
const fo2 = C.bnsFinansOzet([fEk, fKap]);
t('fatura-v2: satis yalnız ek', fo2.satis, 400);
t('fatura-v2: maliyet hepsi', fo2.maliyet, 300);
t('fatura-v2: kar = ek satış − tüm maliyet', fo2.kar, 100);
t('fatura-v2: tahsil yalnız ek', fo2.tahsilEdilmemis, 400);
t('fatura-v2: tipsiz eski davranış', C.bnsFinansOzet([{ maliyet: 50, satis: 150 }]).kar, 100);
```
- [ ] **Step 2: FAIL → bnsFinansOzet güncelle:** döngüde `var ek = b.ucret_tipi !== 'kapsamda';` — satis/faturalanmamis/tahsil ve kâr'ın satış ayağı yalnız `ek` iken; maliyet her zaman. (kar hesabı: `kar = satisToplam(ek) − maliyetToplam(hepsi)` olarak yeniden kur — bnsKarMarj per-iş çağrısı yerine toplamlardan.)
- [ ] **Step 3: PASS** (eski finans testleri de geçmeli); commit.

## Task 4: Drawer — ücret tipi anahtarı

**Files:** `dashboard/app/BriefDrawer.jsx` (FinansBolumu)

- [ ] **Step 1:** FinansBolumu state'ine `ucret_tipi` (`b.ucret_tipi || 'ek'` başlangıç); en üste iki-seçenekli anahtar (🔒 kapsamda / ➕ ek). `kapsamda` iken satış+fatura+ödeme input'ları `disabled` + altta not: "retainer kapsamında — ayrıca faturalanmaz". Kaydet body'sine `ucret_tipi` her zaman eklenir; `kapsamda` iken body'ye satis/fatura/odeme koyma.
- [ ] **Step 2:** CI JSX; commit.

## Task 5: Brand.jsx Retainer kartı + Completed rozeti

**Files:** `dashboard/app/screens/Brand.jsx`, `dashboard/app/screens/Completed.jsx`

- [ ] **Step 1 (Brand):** Kâr özet satırının (fin, ~343) yakınına yönetici-only "Retainer" kartı: markanın `aylik_ucret`'i (bns_brands'ten) + tutar input + Kaydet → `POST /api/brands/by-name/{marka}/retainer` (bnsApiPost). Altında son 3 ay satırı (bu ay + 2 önceki; `bns_marka_fatura`'dan eşleşen kayıt): `ay · ₺tutar · [fatura ✓] [ödeme ✓]` checkbox'ları → `retainer-ay` POST. Kayıt yoksa "işaretle" ile oluşur. Kâr satırına retainer dahil edilir: `Kâr: fmtTRY(fin.kar + (aylıkÜcret için seçili aralıktaki ay sayısı × aylik_ucret))` — v1 SADELEŞTİRME: yalnız "Bu ay geliri: retainer + ek satış" ayrı satır olarak göster (mevcut fin.kar satırına dokunma — aralık/ay eşleşmesi karmaşası YAGNI).
- [ ] **Step 2 (Completed):** kâr hücresinde `c.ucret_tipi === 'kapsamda'` ise tutar yerine küçük "kapsamda" rozeti.
- [ ] **Step 3:** CI JSX; commit.

## Task 6: Brifing — kesilmemiş retainer listesi

**Files:** `scripts/firma-brifing.js`

- [ ] **Step 1:** `brifingOlgulari`'na: `const buAy = new Date().toISOString().slice(0,7);` `kesilmemisRetainer` = bns_brands'te `aylik_ucret != null` olup `bns_marka_fatura`'da `(marka, buAy)` kaydı `fatura=true` OLMAYAN marka adları. Olgulara ekle; `fallbackMetin`'e satır: `📄 Kesilmemiş retainer (bu ay): X, Y` (boşsa satır yok). SYS'e ekleme gerekmez (olgu JSON'da).
- [ ] **Step 2:** `node --check` + sentetik test (retainer'lı marka + kayıtsız → listede); commit.

## Task 7: Deploy + canlı doğrulama

- [ ] CI + build; deploy api (migration 0017 boot) + dashboard + push (scheduler script'i alır).
- [ ] Canlı: migration `✓ 0017`; curl ile `retainer` POST (bir test markasında?) — GERÇEK markaya dokunma: doğrulama Görkem'in ilk gerçek girişiyle; teknik doğrulama: `financials` body'de `ucret_tipi:'ek'` kabulü + embedded'da alanların gelmesi (`railway run` fetch).
- [ ] Kullanıcıya bildirim: Marka detayından retainer tutarlarını girmesi (geçiş tetiği oradan çalışır).

## Self-Review

- Spec kapsama: 0017 ✓T1 · by-name API + geçiş tetiği ✓T1 · default tip createBrief ✓T1 · embedded sensitive ✓T1 · dürtü ✓T2 · FinansOzet ✓T3 · Drawer ✓T4 · Brand kartı + ay işaretleri ✓T5 · Completed rozeti ✓T5 · brifing ✓T6.
- Sadeleştirme (bilinçli): Brand kâr satırı yerine ayrı "bu ay geliri" satırı (aralık×retainer eşleme YAGNI); Ody finans_ozet tool'una retainer eklemek → brifing olgusuyla aynı kaynaktan sonra.
- Tutarlılık: `ucret_tipi` NULL okuma kuralı T2/T3/T5'te aynı (`!== 'kapsamda'` = ek-varsayılan; retainer'lı markada NULL'lar geçiş tetiğiyle dolduğundan güvenli).
