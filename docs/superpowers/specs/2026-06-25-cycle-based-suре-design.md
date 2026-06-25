# Döngü-bazlı iş süresi hesabı — Tasarım

**Hedef:** Bir işe harcanan süreyi statü geçmişinden (events) sağlıklı hesaplamak; tekrar açılan işleri ayrı döngü olarak izlemek.

## Kurallar (onaylı)

**Çalışma (sayılan) statüleri:** `basladi`, `incelemede`, `revizyon`
**Ölü (sayılmayan) statüler:** `yeni`, `calisiliyor` (iş planında), `beklemede`, `musteride`, `blokeli`

**Döngü başı:**
1. Döngüde `basladi` event'i varsa → ilk `basladi` anı (bu durumda öncesindeki `calisiliyor` planlama dışarıda kalır).
2. Yoksa (başladı atlanmış) → `yeni`'den çıkan ilk statü anı; bu döngüde `calisiliyor` da çalışma sayılır (de-facto başlangıç = "ilk anlamlı statü değişikliği").

Uygulama: döngüde `basladi` varsa aktif-küme = {basladi, incelemede, revizyon}; yoksa aktif-küme = {calisiliyor, basladi, incelemede, revizyon}. Süre = aktif-kümedeki statü spanlarının toplamı.

**Döngü sonu:** `tamamlandi` anı. Açık döngüde → now().

**Tekrar açılma = yeni döngü:** YALNIZ `tamamlandi`'dan tekrar aktif statüye dönüş yeni döngü başlatır. `musteride`→`revizyon` aynı döngüdür (müşteride ölü span olarak düşülür).

**Çıktı (her brief için):**
- `sure_cycles: [{ n, basladi(ms), bitis(ms|null), sureH }]` — her döngü ayrı
- `sureH_son` — son (aktif/en yeni) döngü süresi
- `sureH_toplam` — tüm döngülerin toplamı

**Gösterim:** Her döngü ayrı ayrı + toplam döngü gösterilir (drawer/profil). KPI "toplam saat" = toplam.

**Gecikme:** ölü span (beklemede+musteride+blokeli) düşülerek hesaplanır (mevcut mantık genişler).

**Geriye uyum:** events yoksa eski `started_at`/`created_at` + `completed_at` fallback.

## Uygulama
- Saf fonksiyon `bnsCycleSure(events, nowMs, fallback)` → calc.js (TDD: scripts/formula-test.js).
- `queries.js`: events'i brief başına çekip `bnsCycleSure` ile hesapla; `sure_cycles/sureH_son/sureH_toplam/bekleme_ms/baslangic` üret.
- `data.js`: yeni alanları taşı.
- UI: drawer + profil tamamlanan tabloda döngü kırılımı + toplam.
