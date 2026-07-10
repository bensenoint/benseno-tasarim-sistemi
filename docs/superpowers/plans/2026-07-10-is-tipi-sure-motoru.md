# İş Tipi + Süre Motoru Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline — bu projede yerleşik karar).

**Goal:** Her işe zorunlu iş tipi; tamamlanan işlerin net iş saatinden tip başına öğrenilen tipik süre; tip bazlı raporlama ekranı + Ody aracı; kapasiteye dokunmadan gözlem verisi.

**Architecture:** DB'de is_tipleri tablosu + briefs.is_tipi; süre matematiği calc.js'te (bnsNetIsSaati/bnsTipSureIstatistik/bnsTipikSure, saf aritmetik iş takvimi); tahmin sözlüğü server/is-tipi-tahmin.js (Slack modal + backfill paylaşır); yeni dashboard ekranı İş Tipleri; Ody is_tipi_ozet.

**Tech Stack:** mevcut yığın (node, pg, esbuild bundle, Slack Bolt).

---

## Task 1: Migration 0019 + seed + embedded
- [ ] `server/migrations/0019_is_tipi.sql`: is_tipleri tablosu + 19 seed (spec'teki kod/ad/grup/sıra) + `ALTER TABLE briefs ADD COLUMN IF NOT EXISTS is_tipi text`.
- [ ] `server/queries.js`: embedded'a briefs/completed satırlarına `is_tipi`, üst seviyeye `bns_is_tipleri` (SELECT * FROM is_tipleri WHERE aktif ORDER BY sira).
- [ ] `dashboard/app/data.js`: `bns_is_tipleri` → `window.BNS_DATA.IS_TIPLERI` passthrough (2 hydrate yolu).
- [ ] node --check + commit `feat(is-tipi): şema + seed + embedded`.

## Task 2: calc.js süre motoru (TDD)
- [ ] `scripts/formula-test.js`'e testler: bnsNetIsSaati — (a) basladi yok → null; (b) basit basladi→tamamlandi mesai içi; (c) beklemede aralığı düşülür; (d) hafta sonu/mesai dışı sayılmaz; (e) çoklu basladi (ilk basladi baz); bnsTipSureIstatistik medyan/n; bnsTipikSure fallback tip-marka→tip→genel.
- [ ] Testleri koş → FAIL doğrula.
- [ ] `dashboard/app/calc.js`: `bnsMesaiSaatKes(t1,t2)` (Pzt-Cum 09-19 UTC+3, saf aritmetik — bnsEpochGun ailesini kullan), `bnsNetIsSaati(olaylar,bitis)`, `bnsTipSureIstatistik(completed)`, `bnsTipikSure(tip,marka,completed)` (n≥3 eşikleri, net saat ≥0.25 filtre).
- [ ] Testler PASS + CI → commit `feat(is-tipi): net iş saati + tip süre istatistiği (calc)`.

## Task 3: Tahmin sözlüğü + Slack formu
- [ ] `server/is-tipi-tahmin.js`: `tahminEt(baslik) → kod|null` — anahtar kelime sözlüğü (sm planı/içerik planı→sm-plan; rollup|stant|föy|kartonet|yaka kartı|nfc|sticker|poster|önlük→baski-pop; video|reels|kurgu→video-produksiyon; revision+video→video-revizyon; ambalaj|kutu→ambalaj; katalog|broşür|specsheet|doküman→katalog-dokuman; giydirme→giydirme; mail|mailing→mailing-tasarim; banner|packshot|web görsel→web-gorsel; dergi ilan→dergi-ilan; çeviri|lokalizasyon|translation→ceviri; rapor→raporlama; web site|website→web-site; uygulama|cms|app→uygulama-yazilim; strateji|iletişim plan→strateji; fatura|ödeme|organizasyon|arşiv|notion|dosya kontrol→idari-operasyon; fiyat listesi|imza→fiyat-guncelleme; story|post|kampanya|görsel→sm-gorsel [en sona, genel]). Inline birim test (node -e) ~12 başlık.
- [ ] `scripts/slack-bot.js` /yeni-brief modalı: zorunlu static_select "İş Tipi" (seçenekler is_tipleri'nden — bot embedded'ı zaten çekiyor mu kontrol; değilse /api/embedded'dan); initial_option = tahminEt(başlık boşken tahmin submit'te de yapılır — modal açılışında başlık yok, bu yüzden: seçenek zorunlu ama initial YOK; submit'te boşsa hata). NOT: modal açılışında başlık henüz yazılmadığı için ön-seçim yapılamaz — spec'in 'önceden seçili' niyeti submit-öncesi mümkün değilse zorunlu seçim yeter; Ody tahmini backfill ve drawer tarafında değerli.
- [ ] `server/writes.js` createBrief: `is_tipi` kabul + zorunlu (yoksa 400 'İş tipi seçilmeli'); geçerlilik is_tipleri sorgusuyla.
- [ ] Commit `feat(is-tipi): tahmin sözlüğü + Slack formunda zorunlu tip`.

## Task 4: Backfill
- [ ] `scripts/is-tipi-backfill.js`: embedded'ı çek, tipi boş işlere tahminEt uygula + `EL_ATAMALARI` (script içi no→tip tablo — Claude'un 239'luk analizi gömülür); çıktı: kesin listesi + belirsiz listesi (tahmin null). `--yaz` bayrağıyla POST `/api/is-tipi-backfill`.
- [ ] `server/api.js`: POST `/api/is-tipi-backfill` (writeGuard) — {atamalar:[{no,tip}]} → UPDATE briefs SET is_tipi=... WHERE no=... (tip is_tipleri'nde doğrulanır; is_tipi NULL olanlar yalnız — mevcut atamayı ezmez).
- [ ] Kuru koşu → belirsizleri Görkem'e sun → onay → --yaz.
- [ ] Commit `feat(is-tipi): backfill script + endpoint`.

## Task 5: Dashboard — BriefDrawer + İş Tipleri ekranı
- [ ] `dashboard/app/BriefDrawer.jsx`: tip rozeti + dropdown (IS_TIPLERI), PATCH ile kaydet (yetki: atanan/açan/yönetici — mevcut durum değiştirme kalıbı). `server/api.js` PATCH briefs yoluna is_tipi kabulü (doğrulamalı) — writes.js updateBrief.
- [ ] `dashboard/app/screens/IsTipleri.jsx` (yeni): dönem filtresi uyumlu — tip×adet çubukları; tip×marka matris tablosu; tip×kişi tablosu (adet+toplam net saat); süre kartları (medyan/min-max/n, n<3 'veri birikiyor'); tip×gecikme oranı; aylık trend; tahmini-vs-gerçek tablo; tip×ek-iş satışı (yalnız yönetici). Hesaplar calc.js fonksiyonlarıyla, ekranda döngü hesabı useMemo.
- [ ] `Chrome.jsx` menüye "İş Tipleri" sekmesi (yönetici + herkes? — herkes görür, finans satırı yönetici).
- [ ] CI + build + commit `feat(is-tipi): İş Tipleri ekranı + drawer tip alanı`.

## Task 6: Ody + brifing
- [ ] `server/ody-tools.js`: `is_detay` çıktısına is_tipi + bnsTipikSure (server-local calc kopyası kuralı: ody-tools kendi mini kopyasını tutar — MODULE_NOT_FOUND kuralı!) → NOT: süre matematiğini `server/` içinde de kullanılabilir yapmak için calc'taki 4 fonksiyonun server-local eşleniği ody-tools'taki mevcut `calc` nesnesine eklenir (senkron tutulur, yorum satırıyla işaretli). Yeni araç `is_tipi_ozet` {tip?, aralik?}: adet/marka/kişi/süre/gecikme özetleri; finans kısmı isAdmin.
- [ ] `scripts/firma-brifing.js` olgularına tip dağılımı satırı (ilk 5 tip + adet).
- [ ] Birim test (sahte ed ile is_tipi_ozet) + commit `feat(is-tipi): Ody is_tipi_ozet + brifing satırı`.

## Task 7: Doküman + deploy + canlı doğrulama
- [ ] Help.jsx + kullanim-klavuzu (md+html) + /yardim: iş tipi bölümü.
- [ ] CI + build; deploy api (migration otomatik) + `railway up` bot + dashboard push; Pages poll.
- [ ] Canlı smoke: yeni-brief modalında tip zorunlu; backfill sonrası İş Tipleri ekranı gerçek veri; Ody'ye "en çok hangi iş tipini yapıyoruz?" sorusu.
- [ ] Commit `docs(is-tipi): kılavuz + yardım`.

## Self-Review
Spec kapsama: şema✓ süre motoru✓ zorunlu giriş✓ tahmin✓ backfill✓ ekran✓ Ody✓ brifing✓ kapasite-dokunma✓ V2 kapsam dışı✓. Modal ön-seçim sınırı Task 3'te açıkça ele alındı (teknik kısıt notu). Tip adları Task 1 seed ↔ Task 3 sözlük tutarlı.
