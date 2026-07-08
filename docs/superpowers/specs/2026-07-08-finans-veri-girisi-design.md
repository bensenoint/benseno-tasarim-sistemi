# Finans Veri-Girişi Mini-Fazı (Tasarım)

**Tarih:** 2026-07-08
**Bağlam:** P3.1 kâr/marj katmanı canlıda ama `satis/maliyet/fatura/odeme` **%0 dolu** (124 tamamlanan iş) → tüm finans yüzeyleri boş. Yetenek eksik değil: Slack `/maliyet` modalı + `/financials` endpoint'i + yönetici-only yetki mevcut; sorun **benimseme/sürtünme** (dashboard'da giriş UI'ı yok, slash-komut kullanılmıyor).

---

## Amaç

Yöneticinin finans girmesini sürtünmesiz kılmak: (A) işe baktığı yerde (BriefDrawer) girsin, (B) iş tamamlanınca thread'de hatırlatılsın. P3.1 yüzeyleri (Marka detayı, Tamamlananlar KPI, Ody finans tool, haftalık brifing finansı) veriyle dolmaya başlar.

## Kapsam

**Dahil:**
- **A) BriefDrawer "Finans" bölümü** (yönetici-only UI).
- **B) Tamamlanma dürtüsü** — `setStatus` içinde thread notu (best-effort).

**Kapsam dışı:**
- `tahmini_sure_h` girişi (ayrı karar; P3.3b onsuz çalışıyor).
- Geçmiş 124 işin toplu doldurulması (istenirse `/maliyet` veya drawer ile elle; toplu içe-aktarım ayrı iş).
- Yeni endpoint/yetki/migration — YOK (mevcutlar kullanılır).

## A) BriefDrawer Finans bölümü

- **Görünürlük:** `_isMgr` (drawer'da mevcut). Hem aktif hem tamamlanan iş drawer'ında.
- **Alanlar:** maliyet (₺, number) · satış (₺, number) · fatura kesildi (checkbox) · ödeme alındı (checkbox) · Kaydet.
- **Ön-dolu:** `b.maliyet/b.satis/b.fatura/b.odeme` (giriş yapmış kullanıcıya geliyor; render yalnız yönetici).
- **Kaydet:** `POST ${apiBase}/api/briefs/${b.id}/financials` body `{maliyet, satis, fatura, odeme}` — drawer'daki mevcut `hdr` fetch deseni. Sunucu `assertCanWriteFinancials` ile yönetici-only 403 uygular (değişmez). Başarıda `onUpdate()` tazeleme + kısa "✓ kaydedildi"; hata mesajı satır-içi.
- Boş bırakılan sayı alanı `null` gönderilmez — yalnız dolu alanlar body'ye girer (setFinancials `undefined` alanı atlıyor; mevcut davranış).

## B) Tamamlanma dürtüsü

- **Yer:** `server/writes.js` `setStatus` — `tamamlandi`ya geçiş başarıyla işlendikten sonra.
- **Koşul:** işin `maliyet IS NULL AND satis IS NULL` VE `slack_channel+slack_ts` var VE `slack.hasToken()`.
- **Eylem:** thread'e best-effort not (remind deseni, try/yut):
  `💰 #${no} tamamlandı — maliyet/satış girilmedi. Dashboard → iş → Finans, ya da /maliyet ${no}`
- **Tekrar davranışı:** yeniden-açılıp tekrar tamamlanan iş tekrar dürtülebilir (nadir; kabul edilir, ek durum tutulmaz — YAGNI).
- writes.js `require('./slack')` eklenir (server-local; imaj güvenli).

## Güvenlik

- Yazma: mevcut `assertCanWriteFinancials` (yönetici-only) — dokunulmaz.
- Görünüm: Finans bölümü `_isMgr` gate (P3.1 politikası).
- SEC-5 korunur: finans public baked dosyalara sızmaz (bu faz yalnız login-arkası API kullanır).

## Test / doğrulama

- UI: CI JSX parse + preview (bölüm `_isMgr`'a bağlı render; fetch zinciri preview'da login olmadığından canlı kullanıcı onayıyla).
- Dürtü: `node --check server/writes.js` + kod incelemesi (endpoint test altyapısı yok — mevcut desen). Canlıda ilk tamamlanan işte thread notu gözlemi.
- Migration yok. Deploy: api (writes.js) + dashboard (drawer).

## Başarı ölçütü

Yönetici drawer'dan finans girip kaydedebilir (değerler tazelenir); finanssız iş tamamlanınca thread'e dürtü düşer; CI geçer; iki servis deploy; sonraki haftalarda doluluk >0'a çıkar.
