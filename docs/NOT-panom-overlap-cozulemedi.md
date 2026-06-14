# NOT: Panom widget panosu — overlap sorunu çözülemedi (2026-06-14)

**Durum:** Panom sekmesi prod menüsünden geçici olarak kaldırıldı. Kod duruyor
(`dashboard/app/Panom.jsx`, `PanomScreen`, `build-dashboard.sh` içinde hâlâ listeli),
sadece nav item (`Chrome.jsx` NAV_SECTIONS "main") ve route (`App.jsx` `tab==="panom"`) çıkarıldı.

## Kullanıcının şikâyeti
Düzenleme modunda + normal modda widget kartları **birbirinin üzerine giriyor** (overlap).
Hem Safari hem Chrome'da görülüyor. Büyütme/küçültme ve "alan ekle" listesi de sorunluydu
(bunlar ref-based drag + ek widget tipleriyle düzeltilmişti ama overlap devam etti).

## Çözmek için denenenler (sonuç vermedi)
1. Ref-based drag (`wRef.current`) — stale-closure giderildi.
2. `panomPack` ile yüklemede otomatik onarım (useState initializer'da).
3. localStorage `bns_panom_prod` + POST `/api/layout` reset.
4. browser-harness ile programatik ölçüm: **overlaps:[] (sıfır çakışma)**, grid matematiksel doğru.
5. Canlı bundle == local doğrulandı; ekran görüntüsü (benim oturumum) **temiz** çıktı.

## Çelişki / kök neden bulunamadı
- Benim Chrome'umda (güncel bundle) pano **temiz** render oluyor.
- Kullanıcının cihazında çakışık görünüyor → "stale cache" hipotezi kuruldu (Cmd+Shift+R önerildi).
- Ama kullanıcı sert yenileme sonrası da çakışma bildirdi → **stale cache açıklaması yetersiz kaldı**.
- Gerçek kök neden TESPİT EDİLEMEDİ. Olası açık uçlar:
  - Kullanıcının ekranında farklı viewport/zoom → `panomPack` satır hesabı farklı oturuyor olabilir.
  - `PANOM_ROW=84` / `PANOM_GAP=14` sabitleri + kart iç içeriğinin (uzun listeler) gerçek
    yüksekliği grid hücresini aşıyor olabilir (içerik overflow → görsel overlap, DOM rect değil).
  - Kayıtlı layout farklı bir cihaz/çözünürlükte üretilmiş olabilir.

## İleride çözmek için öneri
- Kullanıcıyla **aynı cihazda** (ekran paylaşımı / onun Chrome'unda browser-harness) tekrarla.
- DOM rect değil, **görünen kart yüksekliği vs hücre yüksekliği** ölçülsün (içerik overflow testi).
- Sabit yükseklikli hücre yerine içeriğe göre min-height + clip dene.
- Gerekirse hazır bir grid kütüphanesi (gridstack — v2'de zaten kullanılıyor) prod'a alınsın.
