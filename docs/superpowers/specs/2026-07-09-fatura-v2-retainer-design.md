# Fatura Sistemi v2 — Retainer + Ek İş (Tasarım)

**Tarih:** 2026-07-09
**Bağlam:** Gelir modeli gerçeği: birçok iş **aylık sabit ücret (retainer)** kapsamında; ek işler ayrıca faturalanır. Mevcut sistem her işi tek tek faturalanır varsayıyor → 💰 dürtüsü kapsam-içi işlerde gereksiz, kâr/marj retainer gelirini görmüyor.
**Kararlar (Görkem):** Seviye **B** (tip + aylık retainer takibi) · retainer'lı markada varsayılan **kapsamda** · geçişte retainer'lı markaların mevcut işleri **toplu kapsamda**.

---

## Veri modeli (migration 0017)

```sql
ALTER TABLE brands ADD COLUMN IF NOT EXISTS aylik_ucret NUMERIC;          -- NULL = retainer yok
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ucret_tipi TEXT;              -- 'kapsamda' | 'ek'
CREATE TABLE IF NOT EXISTS marka_fatura (
  id BIGSERIAL PRIMARY KEY,
  marka_id INT NOT NULL REFERENCES brands(id),
  ay TEXT NOT NULL,                -- 'YYYY-MM'
  tutar NUMERIC,                   -- o ayın retainer tutarı (marka.aylik_ucret'ten kopyalanır; sonradan değişebilir)
  fatura BOOLEAN NOT NULL DEFAULT false,
  odeme  BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (marka_id, ay)
);
```

- **Varsayılan tip:** `createBrief` markanın `aylik_ucret`'ine bakar: dolu → `kapsamda`, boş → `ek`.
- **Geçiş (tek seferlik, retainer tutarı girildiğinde):** markaya `aylik_ucret` set edilirken o markanın `ucret_tipi IS NULL` işleri `kapsamda` yapılır (API tarafında, tutar girme aksiyonunun parçası). Retainer'sız markaların NULL işleri okuma tarafında `ek` kabul edilir (backfill zorunlu değil).

## API

- `POST /api/brands/:id/retainer` (yönetici, `assertCanWriteFinancials`): `{aylik_ucret}` — tutarı yazar + o markanın NULL-tipli işlerini `kapsamda` yapar. `aylik_ucret: null` → retainer kaldırılır (işlerin tipi dokunulmaz).
- `POST /api/brands/:id/retainer-ay` (yönetici): `{ay:'YYYY-MM', fatura?, odeme?}` — `marka_fatura` upsert (tutar yoksa markanın güncel `aylik_ucret`'i kopyalanır).
- `POST /api/briefs/:id/financials` genişler: body'ye `ucret_tipi` ('kapsamda'|'ek') eklenebilir (aynı yetki).
- `GET /api/embedded`: brands'e `aylik_ucret`, brief'lere `ucret_tipi` (sensitive blokta — finansla aynı gizlilik), + `bns_marka_fatura` (son 3 ay, sensitive).

## Davranış

1. **💰 Tamamlanma dürtüsü** (`writes.setStatus`): yalnız `ucret_tipi='ek'` (veya NULL + markası retainer'sız) işlerde; kapsam-içi işte susar.
2. **Drawer Finans bölümü:** üstte tip anahtarı (🔒 kapsamda / ➕ ek). `kapsamda` iken satış/fatura/ödeme alanları devre dışı + "retainer kapsamında — ayrıca faturalanmaz" notu; **maliyet her tipte girilebilir** (iç maliyet takibi).
3. **Marka detayı (yönetici) — "Retainer" kartı:** aylık tutar girişi; son 3 ayın satırı (ay · tutar · fatura ✓ · ödeme ✓ işaretleme). Tutar girilince geçiş kuralı çalışır.
4. **Kâr/marj:** calc'a `bnsMarkaAyGelir(aylikUcret, ekSatislar)` mantığı — marka aylık gelir = retainer + o ay tamamlanan `ek` işlerin satışı; maliyet tüm işlerden. `bnsFinansOzet` ek-işler üzerinden çalışır; Tamamlananlar kâr hücresi kapsam-içi işte "kapsamda" rozeti (satış beklenmez).
5. **Haftalık brifing + Ody finans_ozet:** "bu ay kesilmemiş retainer" listesi (marka_fatura'da `ay=bu ay` kaydı olmayan ya da `fatura=false` olan retainer'lı markalar).

## Erişim / güvenlik

- Tutar/ay işaretleri/tip değişimi: yönetici (`assertCanWriteFinancials`).
- `aylik_ucret`, `ucret_tipi`, `marka_fatura` = finans verisi → SEC-5: yalnız login-arkası API'de; public baked dosyalara sızmaz. Kâr yüzeyleri yönetici-only (P3.1 kuralı).

## Test

- calc: `bnsKarMarj`/`bnsFinansOzet` `ucret_tipi='kapsamda'` işleri satış tarafında atlar (yeni testler); kapsamda işin kâr null davranışı.
- Dürtü: kapsamda işte thread notu YOK, ek işte VAR (kod incelemesi + canlı gözlem).
- API: `node --check` + canlı curl (retainer set → işlerin tipi kapsamda; retainer-ay upsert; financials ucret_tipi).
- UI: CI JSX + preview.

## Başarı ölçütü

Retainer'lı markada tamamlanan kapsam-içi iş dürtü üretmez; ek iş üretir. Marka detayında retainer tutarı + ay işaretleri yönetilir. Brifing kesilmemiş retainer'ları söyler. Tamamlananlar/Marka kârı retainer'ı içerir.
