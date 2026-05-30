# Benseno — Yayın Sonrası Yapılacaklar

> Pazartesi 2 Haziran 2026 yayını sonrası ele alınacak işler.
> Kaynak: 30 May 2026 sistematik denetim (`autoresearch/debug-260530-0915/`)

---

## ✅ DÜZELTİLDİ (2. debug — 31 May, yayın öncesi) — pazartesi doğrula

### 0. Headless watermark + state commit + push robustluğu (H12 + H17 + H18 + H23 + H24 + H25)
- **Bulgu H12:** `data-agent` watermark'ı (LAST_SYNC_TS) yalnızca Canvas footer'ından okuyordu. Headless modda Canvas write-back atlandığı için watermark bulutta **donuyordu** → kanal >mesaj-eşiği birikince eski brief'ler sessizce düşer.
- **Bulgu H17 (kademeli):** Tek bulut push'u (dashboard-agent) dar `git add` kullanıyordu → `data/agent-state.json` ve `data/notifications-sent.json` **commit edilmiyordu** → hem watermark hem DM-dedup state'i her run kayboluyordu (çift DM riski).
- **Yapılan düzeltmeler:**
  1. `data-agent` SKILL: headless modda watermark'ı `agent-state.json → last_sync_ts`'ten oku (Canvas fallback), her run en yeni brief ts'iyle ilerlet + persist (ZORUNLU adım olarak işaretlendi).
  2. `conversations.history` `limit=30 → limit=100` + `next_cursor` pagination ZORUNLU.
  3. `dashboard-agent` push kapsamı genişletildi: `data/agent-state.json data/notifications-sent.json data/marka_stats.json data/brief-queue.json data/notification-flags.json` eklendi.
  4. `agent-state.json` bootstrap `last_sync_ts=1780053300` ile seed edildi.
  5. **H18 — push yarışı:** dashboard-agent push'a `git pull --rebase` + 3x retry eklendi. Rebase yoktu → run sırasında main'e düşen commit push'u reddediyordu → run kaybı + çift DM. (4 skill main'e push ediyor, çakışma kaçınılmazdı.)
  6. **H23 — çift push:** data-agent orchestrator akışında artık push ETMEZ (dashboard-agent sonda konsolide eder); tek run'da iki push = gereksiz yarış yüzeyi kaldırıldı. data-agent standalone push'una rebase+retry eklendi.
  7. **H24 — ölü repo push:** haftalik-retro `github-prep/dashboard` (terk edilmiş `bensenoint/dashboard` reposu, bulutta gitignored=yok) yerine ana repo `data/marka_stats.json` yolundan push ediyor. (Ek: o repoya yazma yetkili açıktaki PAT iptal + temizlendi — bkz. güvenlik.)
  8. **H25 — rebase conflict sağlamlaştırma:** 3 push noktası da `git pull --rebase -X theirs` (generated dosyalarda bizim taze üretimimiz kazanır) + `git rebase --abort` temizliği + 3x döngü. Salt `--rebase`, `live-data.json`/`index.html` satır çakışmasında abort edip asılı kalıyordu → push hiç olmazdı.
- **Pazartesi doğrulama:** İlk orchestrator run'ından sonra `agent-state.json`'daki `last_sync_ts`'in **ilerlediğini** ve commit'lendiğini kontrol et (Benseno Bot commit diff'inde `data/agent-state.json` görünmeli). 5 yöneticiye/16 kişiye **çift DM gitmediğini** doğrula. Push commit'inin tek seferde (data-agent ayrı push yok) geldiğini teyit et.

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

#### 3a. Blokeli + escalation DM'leri Mac kapalıyken gitmiyor (2. debug bulgusu H9)
- **Bulgu:** "Blokeli" brief uyarıları ve kademeli escalation DM'leri yalnızca `benseno-brief-sync` (Mac/Socket-Mode) skill'inde tanımlı. Bulut orchestrator'ın `notification-agent`'ı `data/notification-flags.json` şemasında `blokeli` flag'i taşımıyor — dolayısıyla Mac kapalıyken bu DM'ler hiç gönderilmez.
- **Etki:** Sınırlı — blokeli brief'ler dashboard'da **Blokeli kolonunda görünmeye devam ediyor**; sadece proaktif DM kayboluyor (yalnızca Mac kapalıyken).
- **Dedup dosyaları:** `data/blokeli-notified.json` + `data/escalation-log.json` gitignore'da → bu zaten brief-sync'in Mac-lokal idempotency deposu, bulutta gelmiyor (bulutta brief-sync çalışmadığı için sorun değil).
- **Fix (Railway taşımasıyla birlikte):** ya brief-sync'i de always-on host'ta çalıştır, ya da data-agent'a `blokeli` flag üretimi + notification-agent'a blokeli DM şablonu ekle (+ dedup deposunu `notifications-sent.json` gibi tracked yap).
- **Risk:** Orta — yeni flag + agent değişikliği; izole test gerekir.

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

### 6b. Classic PAT'lerde expiration yok (güvenlik hijyeni)
- **Bulgu:** `benseno-workflow` (repo+workflow) ve `benseno-sistem-full` (repo) classic token'larının **ikisinde de expiration date yok** → sızarsa sonsuza dek geçerli.
- **Etki:** `check-pat-expiry.sh` `-sistem`'i izliyor ama token süresizse o izleme anlamsız (hiç uyarı tetiklenmez).
- **Fix:** İkisine de expiration ekle (yeni token üret + secret/`-sistem` dosyasını güncelle), veya net bir rotasyon takvimi koy. Süre eklenince `.github-pat-created` + check-pat-expiry yeniden anlamlı olur.
- **Doğrulandı (31 May):** Her iki token aktif, Actions secret `BENSENO_GITHUB_PAT` push için çalışıyor (Benseno Bot commit'leri kanıt). Silme YOK — sadece expiration ekle.

### 7. Node.js 24 deprecation (16 Haziran 2026)
- `actions/checkout@v4` + `setup-node@v4` Node 20 uyarısı veriyor. 16 Haziran'dan sonra otomatik Node 24. Sorun çıkarsa action versiyonlarını güncelle.

### 8. marka_stats E3 aktivasyonu (1 Haziran 2026)
- `silent_log_only` → `active` otomatik geçiş. İlk gün marka davranış uyarılarının (yetersiz/anormal süre) doğru DM gönderdiğini izle.
- **Bulut persist doğrulandı (H19):** Geçiş `data/marka_stats.json` + `agent-state.json` mode alanına yazılıyor; bu dosyalar H17 fix'iyle push kapsamına alındı → mode değişikliği bulutta **kalıcı olur** (fix öncesi her run yeniden flip eder, "active" hiç persist olmazdı). İlk aktivasyon sonrası commit'te mode değişikliğinin push edildiğini teyit et.

### 9. Pazartesi ilk gerçek scheduled run izleme
- **07:50** sabah raporu → 5 yönetici DM geldi mi?
- **08:15** ilk orchestrator → dashboard güncellendi mi, Benseno Bot commit'i + Pages rebuild oldu mu?
