# Benseno — Yayın Sonrası Yapılacaklar

> Pazartesi 2 Haziran 2026 yayını sonrası ele alınacak işler.
> Kaynak: 30 May 2026 sistematik denetim (`autoresearch/debug-260530-0915/`)

---

## 🟡 Minör Düzeltmeler (yayın engellemez)

### 1. Department + Profil ekranlarında iç layout taşması
- **Bulgu:** Tasarım/Editör/AI (Department.jsx) + Profil (Profile.jsx) ekranlarında, main genişliği ~1250px altına düşünce iç içerik (brief tablosu kartı) sağa taşıyor.
- **Etki:** 13" MacBook Air varsayılan çözünürlükte (1440 logical → main ~1218px) **görünmüyor**. Sadece pencere daraltılınca / ağır ölçeklendirmede çıkar.
- **Kök neden:** Çift kolonlu yerleşimde (kişi paneli + tablo) tablo kolonunda `minWidth:0` eksik → tablo kendi `overflow-x:auto` scroll'unu açamıyor, kartı genişletiyor.
- **Fix:** Department.jsx ve Profile.jsx'te tablo kolonuna/kartına `minWidth:0` ekle (Overview'da yaptığımız aynı pattern).
- **Risk:** Düşük ama sıfır değil — dikkatli test gerekir.

### 2. Geçmiş ekranı mock aktivite gösteriyor
- **Bulgu:** `History.jsx:32` → `data.activity` hep mock (data.js:215), live-data.json'da hiç doldurulmuyor.
- **Etki:** Çökme yok; "Geçmiş" ekranındaki aktivite akışı gerçek değil, sahte örnek olaylar.
- **Fix:** data-agent'ın `bns_history` / agent-state'ten gerçek aktivite olayları üretip live-data.json'a `activity` alanı eklemesi; App.jsx live bridge'in bunu okuması.
- **Risk:** Orta — yeni veri alanı + agent değişikliği.

---

## 🔵 Mimari / Altyapı (orta vade)

### 3. Slack Bot'u always-on host'a taşı (Railway/Fly)
- **Durum:** Socket Mode bot (slash command, reaction override, brief formu) Mac'te `com.benseno.slack-bot` olarak çalışıyor. Mac kapalıyken bu özellikler çalışmaz.
- **Etki:** Mac kapalıyken: orchestrator (curl ile kanal okur) brief'leri yine yakalar, ama gerçek-zamanlı slash/reaction/form çalışmaz.
- **Fix:** `scripts/slack-bot.js`'i Railway/Fly.io container'ına deploy et (~$5-7/ay). Token'lar host secret'larına.

### 4. Canvas geri-yazma (headless)
- **Durum:** Headless modda data-agent Canvas'a geri yazmıyor (güvenli karar — format dönüşümü + bozma riski). Dashboard live-data.json'dan güncel; Slack Canvas otomatik öncelik etiketlerini güncellemiyor.
- **Etki:** Kozmetik — Slack Canvas'taki öncelik renkleri Mac açılınca senkronlanıyor.
- **Fix (isteğe bağlı):** `canvases.edit` API ile markdown geri-yazma; izole test ortamında doğrulanmalı (production Canvas riski).

### 5. autoresearch optimizasyon döngüleri (izole branch)
- **Durum:** `/ar` deney döngüsü kuruldu ama yayın-dondurma nedeniyle çalıştırılmadı. Gerçek değerini "optimizasyon manzarası" olan hedeflerde gösterir.
- **Adaylar:**
  - **bundle.js küçültme** (248KB) — JSX kaynağında code-golf/esbuild flag'leri, metrik=bytes. Risk: UI bozabilir → izole `autoresearch/engineering/bundle-size` branch'inde, her iterasyonda Playwright ile 15-ekran render testi.
  - **sabah-raporu prompt kalitesi** — `llm_judge_prompt` ile DM içerik kalitesi, metrik=quality_score. Risk: prod skill → branch'te test.
- **Fix:** `python scripts/setup_experiment.py --scope project --domain engineering --name bundle-size --target dashboard/app/... --eval "..." --metric size_bytes --direction lower`
- **Not:** Otonom döngü main'i bozmaz (deney branch'i) ama her iterasyon commit/eval yapar — Benseno Bot otomatik commit'leriyle karışmaması için ayrı branch şart.

---

## 🟢 Bakım / Takip

### 6. Workflow PAT yenileme
- Workflow-scope PAT 28 Haziran 2026'da dolar. Takvime hatırlatma.
- data PAT (`data/.github-pat-sistem`) 78 gün kaldı.

### 7. Node.js 24 deprecation (16 Haziran 2026)
- `actions/checkout@v4` + `setup-node@v4` Node 20 uyarısı veriyor. 16 Haziran'dan sonra otomatik Node 24. Sorun çıkarsa action versiyonlarını güncelle.

### 8. marka_stats E3 aktivasyonu (1 Haziran 2026)
- `silent_log_only` → `active` otomatik geçiş. İlk gün marka davranış uyarılarının (yetersiz/anormal süre) doğru DM gönderdiğini izle.

### 9. Pazartesi ilk gerçek scheduled run izleme
- **07:50** sabah raporu → 5 yönetici DM geldi mi?
- **08:15** ilk orchestrator → dashboard güncellendi mi, Benseno Bot commit'i + Pages rebuild oldu mu?
