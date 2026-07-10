# Tatil Takvimi — resmî tatil bilinçli iş günü matematiği (Tasarım)

**Tarih:** 2026-07-10 · **Kararlar (Görkem):** yarım gün destekli (arefe + 31 Aralık) · 2026 seed yüklü gelir (Diyanet ±1 gün notuyla; admin düzeltir) · bu fazda yalnız HESAPLAR tatil-bilinçli (bildirim/termin davranışına karışılmaz).

## Veri
- **Migration 0022:** `tatiller (gun date PK, ad text NOT NULL, yarim boolean NOT NULL DEFAULT false)` + 2026 seed (13 kayıt: Yılbaşı; Ramazan arefe yarım + 3 gün; 23 Nisan; 1 Mayıs; 19 Mayıs; Kurban arefe yarım + 4 gün; 15 Temmuz; 30 Ağustos; 28 Ekim yarım; 29 Ekim; 31 Aralık yarım). ON CONFLICT DO NOTHING.
- Embedded + baked: `bns_tatiller [{gun:'YYYY-MM-DD', ad, yarim}]` (public güvenli).
- CRUD: `GET /api/tatiller` (readGuard) · `POST /api/tatiller` {gun, ad, yarim} · `DELETE /api/tatiller/:gun` — admin (authGuard + role admin; bot token'ına da açık writeGuard OR admin JWT: mevcut assertCanWriteFinancials kalıbı gibi adminGuard).

## calc.js (tek doğruluk kaynağı; ody-tools kopyası senkron)
- Modül durumu: `BNS_TATIL = {}` (gunKey → 1 tam | 0.5 yarım). `bnsTatilYukle(liste)` doldurur; data.js hydrate embedded geldiğinde çağırır (2+1 yol). Script'ler (firma-sinyal, kapasite-snapshot, fatura-hatirlatma) embedded'dan yükler.
- `bnsGunIsMi(day)`: hafta içi VE tam tatil değil (yarım gün İŞ GÜNÜ sayılır).
- `bnsGunKatsayi(day)`: 0 (hafta sonu/tam tatil) · 0.5 (yarım) · 1. Kapasite v2: bnsKalanIsGunu ve yayılım payları katsayı toplamıyla (yarım gün 0,5 pay); bnsKisiGunDoluluk yarım günde pay/0.5 etkisi — SADE KURAL: kalan iş günü = katsayı toplamı (>=0.5'e yuvarlanmaz, kesirli); günlük pay = R/kalan; yarım günde biriken pay×0.5 tüketilir. Testlerle kilitlenir.
- `bnsMesaiSaatKes`: tam tatil 0; yarım gün 09:00-13:00.
- `bnsFaturaTopluGunu`: bnsGunIsMi zaten tatil-bilinçli olduğundan otomatik düzelir.

## Admin ekranı
- Yönetim (admin) alanına "Takvim" sekmesi: yıl filtreli tablo (tarih · gün adı · ad · tam/yarım rozet · sil) + ekleme satırı (date input + ad + yarım checkbox). Yalnız admin görür.

## Kapsam dışı
Bildirim/dijest susturma · termin seçiciye tatil uyarısı · yıllık otomatik dinî bayram üretimi (her yıl admin girer/Claude yükler).

## Test
formula-test: tatil yüklü/yüksüz bnsGunIsMi; yarım gün katsayı; bnsKalanIsGunu tatil atlar; bnsMesaiSaatKes tam/yarım tatil; kapasite payı yarım günde yarım; bnsFaturaTopluGunu 25'i tatilse önceki iş günü. Canlı: takvim ekranından ekle/sil + embedded doğrulama.
