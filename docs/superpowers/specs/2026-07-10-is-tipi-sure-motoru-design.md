# İş Tipi Alanı + Tip Bazlı Süre Motoru (Tasarım)

**Tarih:** 2026-07-10 · **Kararlar (Görkem):** 19 tipli geniş taksonomi · net iş saati · backfill'i Claude atar/belirsizler onaya gelir · yeni işte zorunlu tip + otomatik öneri · kapasite bu fazda yalnız hazırlık+gözlem.

## Amaç
Her işe bir "iş tipi" atanır; tamamlanan işlerin gerçek çalışma sürelerinden tip başına tipik süre öğrenilir (her teslimle güncellenir); tip bazlı zengin raporlama açılır; ileride kapasite değeri ve termin önerisi bu veriye bağlanır.

## Veri modeli
- **`is_tipleri` tablosu** (migration 0019): `kod text PK, ad text, grup text, sira int, aktif bool default true`. 19 tip seed:
  - Tasarım: sm-gorsel (Sosyal medya görseli), baski-pop (Baskı & POP materyal), ambalaj, katalog-dokuman, giydirme, mailing-tasarim, web-gorsel, dergi-ilan
  - Video & İçerik: video-produksiyon, video-revizyon, sm-plan (Aylık SM içerik planı), ceviri
  - Analiz & Dijital: raporlama, web-site, uygulama-yazilim, strateji
  - Operasyon: idari-operasyon, fiyat-guncelleme, diger
- **`briefs.is_tipi text`** (NULL serbest — eski işler backfill'e kadar boş; FK zorlanmaz, kod referansı).
- Embedded (queries.js) + baked data yollarına `is_tipi` ve `bns_is_tipleri` eklenir. SEC: finans içermez, public güvenli.

## Süre motoru (calc.js — tek doğruluk kaynağı, testli)
- `bnsNetIsSaati(durum_olaylari, bitis)`: basladi→tamamlandi zaman çizgisi yürünür; `beklemede|musteride|blokeli` durumundayken geçen süre düşülür; kalan aralıklar iş takvimi (Pzt-Cum 09:00-19:00, UTC+3 sabit) ile kesilir → saat döner. basladi olayı yoksa `null` (havuza girmez).
- `bnsTipSureIstatistik(completed)`: tip → {medyan, min, max, n} (yalnız net saat ≥ 0.25 olan güvenilir örnekler).
- `bnsTipikSure(tip, marka, completed)`: kademeli fallback — tip+marka (n≥3) → tip (n≥3) → genel medyan; dönüş {saat, n, kaynak:'tip-marka'|'tip'|'genel'}.
- Canlı hesap (embedded zaten elde); ayrı cron/arşiv YOK bu fazda.

## Giriş noktaları
- **Slack /yeni-brief:** zorunlu "İş Tipi" static_select (is_tipleri'nden); modal açılışında başlıktan kural-bazlı tahmin önceden seçili. Kural sözlüğü `server/is-tipi-tahmin.js` (anahtar kelime → tip; LLM yok). Submit'te tip yoksa 400 benzeri hata mesajı. Modal'da tip seçilince değil, sabit metin: form açıklamasında tipik süre GÖSTERİLMEZ (modal update karmaşası — V2).
- **Dashboard BriefDrawer:** tip rozeti + değiştirme (dropdown; yetki: atanan/açan/yönetici — statusYetki ile aynı ruh). PATCH `/api/briefs/:id` body'ye `is_tipi` (zod enum değil — is_tipleri'nden doğrulanır).
- **Ody:** `is_detay` çıktısına `is_tipi` + tipik süre; yeni araç `is_tipi_ozet` (aşağıda); "tipini değiştir" sohbet aksiyonu mevcut yazma araçları üzerinden DEĞİL — V2 (bu fazda Ody tip değiştirmez).

## Backfill
- Script `scripts/is-tipi-backfill.js`: 239 işe kural sözlüğü + elle hazırlanmış no→tip eşleme tablosuyla atama; çıktı iki liste (kesin / belirsiz). Belirsizler Görkem onayına sunulur (sohbette), onay sonrası tek POST ile yazılır. Yazma: `/api/is-tipi-backfill` (writeGuard, {atamalar:[{no,tip}]}).

## Raporlama — yeni "İş Tipleri" ekranı (dashboard)
- Kartlar: tip × adet (dönem filtresi uyumlu) · tip × marka matrisi · tip × kişi (adet + toplam net saat) · tip süre kartları (medyan/aralık/n; n<3 → "veri birikiyor") · tip × gecikme oranı · aylık tip trendi · tahmini-vs-gerçek tablosu (kapasite geçişi için gözlem) · tip × ek-iş satışı (fatura v2 verisi, yalnız yönetici).
- Ody `is_tipi_ozet` aracı: aynı metrikler sohbetten (yetki: finans kısmı yönetici).
- Haftalık GM brifingi olgularına tip dağılımı satırı.

## Kapasite (bu fazda)
- Formüle DOKUNULMAZ. "Tahmini vs gerçek" tablosu gözlem verisi biriktirir. Geçiş ayrı mini-faz: sabit V yerine tip bazlı değer (ör. V = medyan_saat/8) — ayrı karar, geri dönülebilir anahtar.

## Kapsam dışı (V2 notları)
- Kişi bazlı süre profili; paralel-iş düzeltmesi (eşzamanlı iş sayısına bölme); Ody otomatik termin önerisi; modal içi canlı tipik-süre ipucu; Ody sohbetten tip değiştirme; kapasite entegrasyonu.

## Test
- calc: bnsNetIsSaati (bekleme düşme, mesai kesme, hafta sonu, basladi yok→null, çoklu basladi) + bnsTipSureIstatistik + bnsTipikSure fallback zinciri — formula-test.js'e eklenir.
- is-tipi-tahmin: başlık→tip sözlük testleri (SM planı, rollup, video, mailing…).
- Canlı smoke: backfill sonrası ekran + Ody aracı gerçek veriyle.

## Başarı ölçütü
Yeni iş tipsiz açılamaz; geçmiş işler tiplenmiş; İş Tipleri ekranı gerçek metrikleri gösterir; tip süre kartları 23 örneklik havuzla başlar ve her teslimle güncellenir; kapasite davranışı değişmemiştir (139+ test yeşil).
