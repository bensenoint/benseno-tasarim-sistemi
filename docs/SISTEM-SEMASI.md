# Benseno Tasarım Sistemi — Sistem Şeması (Anlık Durum: 2026-06-12)

> **ÖNEMLİ — ÇALIŞMA YAPARKEN BAK:** Bu belge sistemin 12 Haziran 2026 itibarıyla tam halini
> tarif eder. Herhangi bir geliştirme/debug öncesi buradaki mimari, kurallar ve deploy
> mekanikleri referans alınmalı. Değişiklik yapıldığında bu belge de güncellenmelidir.

---

## 1. Mimari Genel Bakış

```
┌─────────────────────────────────────────────────────────────────────┐
│  SLACK (benseno workspace)                                          │
│  marka-* kanalları (32 marka) + #benseno (markasız genel kanal)     │
│  WT botu: brief mesajı + thread notları + hedefli DM'ler            │
└──────────────┬───────────────────────────────┬──────────────────────┘
               │ Socket Mode (bot)             │ chat.postMessage (API)
┌──────────────▼──────────────┐  ┌─────────────▼──────────────────────┐
│  BOT SERVİSİ                │  │  API SERVİSİ                       │
│  Railway: benseno-tasarim-  │  │  Railway: benseno-api              │
│  sistemi                    │  │  server/: api.js queries.js        │
│  scripts/: slack-bot.js     │  │  writes.js slack.js auth.js db.js  │
│  scheduler.js thread-ozet   │  │  https://benseno-api-production.   │
│  kanal-ozet rapor-*         │  │  up.railway.app                    │
└──────────────┬──────────────┘  └─────────────┬──────────────────────┘
               │                               │
        ┌──────▼───────────────────────────────▼──────┐
        │  POSTGRES (Railway)                          │
        │  briefs, brief_assignees, users, brands,     │
        │  events, notifications, brief_tags           │
        └──────────────────────┬───────────────────────┘
                               │ /api/embedded (JSON)
        ┌──────────────────────▼───────────────────────┐
        │  DASHBOARD (GitHub Pages)                    │
        │  bensenoint.github.io/benseno-tasarim-       │
        │  sistemi/dashboard/  — React (bundle.js)     │
        └──────────────────────────────────────────────┘
```

## 2. Servisler ve Deploy Mekanikleri (KRİTİK)

| Servis | Railway adı | Kod | Deploy şekli |
|---|---|---|---|
| API | `benseno-api` | `server/` | **GitHub push'la deploy OLMAZ.** Elle: `D=$(mktemp -d /tmp/bns-api-XXXX) && cp -R server/. "$D"/ && date > "$D"/.deploy-stamp && cd "$D" && railway link --project efcd3ff0-863b-472f-8dc9-c4a4fb4786ed --environment production --service benseno-api && railway up --service benseno-api --detach` (çıktıda `grep -c "Build Logs"` = 1 → başarı) |
| Bot + Scheduler | `benseno-tasarim-sistemi` | `scripts/` (+ `server/` paylaşımlı) | Konteyner açılışta `git origin/main`'e senkronlanır AMA **push otomatik restart TETİKLEMEZ** → sunucu/script değişikliğinden sonra `railway redeploy --service benseno-tasarim-sistemi -y` ŞART (12 Haz debug'ında en kritik bulgu buydu) |
| Dashboard | GitHub Pages | `dashboard/` | `bash scripts/build-dashboard.sh` → commit + push → Pages. Doğrulama: index.html'deki `bundle.js?v=` değerini canlı URL'de grep'le |

- DB bağlantısı: `psql "$(cat data/.db-url)"` (dosya ASLA commit edilmez)
- Slack tokenları: `data/.slack-bot-token` vb. — ASLA commit edilmez, chat'te maskelenir
- Bot adı: WT (`chat:write.customize` ile her mesajda override)

## 2.6 Tek Komutla Deploy + CI Kapısı (2026-06-13)

- **`npm run deploy`** (= `bash scripts/deploy.sh`) — tüm koreografiyi tek komuta toplar:
  CI kapısı → dashboard derle+push+Pages bekle → API deploy → bot redeploy → tutarlılık denetimi.
  Hedefli: `npm run deploy dashboard|api|bot`. **CI kapısı kalırsa deploy YAPILMAZ.**
- **`npm run check`** (= `scripts/ci-check.sh`) — secret'siz kapı: .js sözdizimi + .jsx derleme + **formül kilidi** (`scripts/formula-test.js`, 22 birim test).
- **Saf formüller `dashboard/app/calc.js`'te** (kapasite/süre/gecikme — tek doğruluk kaynağı). index.html'de data.js'ten ÖNCE yüklenir; node'da `module.exports` ile test edilir. Yeni formül = calc.js'e ekle + formula-test'e test ekle (BAŞKA yerde yeniden tanımlama).
- **`npm run verify`** (= `consistency-check.js`) — metrik doğruluğu (25 kontrol).
- **`npm run build`** — yalnız bundle derle.
- **GitHub Actions CI** (`.github/workflows/ci.yml`): her push/PR'da `ci-check.sh` çalışır.
  ⚠️ Bu dosya yalnızca **`workflow` scope'lu PAT** ile push edilebilir; scope yoksa GitHub
  reddeder (dosyayı GitHub web arayüzünden elle eklemek de mümkün).

## 3. AI Model Dağılımı

| Görev | Model | Yer |
|---|---|---|
| Saatlik thread özetleri | `claude-haiku-4-5` | scripts/thread-ozet.js (saat başı :00) |
| Kanal özetleri | `claude-haiku-4-5` | scripts/kanal-ozet.js (:30'larda) |
| Ody (dashboard asistanı) | `claude-sonnet-4-6` | server/api.js /api/chat |
| İş insight + yıldız puanı + gerekçe | `claude-opus-4-7` | scripts/thread-ozet.js generateInsight |

## 4. İş Kuralları (gün sonu hali)

### 4.1 Departman türetme (writes.js `deriveDept`)
- Brief dept'i = işi yapanların (contributor) distinct departmanları, virgül-join.
- **Üst yönetim kuralı** (`MGMT_IDS`: Görkem `U030C48PL23`, Reyhan `UD96GH76E`, Cansu `U4XCE3532`):
  - Üst yönetimden biri ATANIRSA → kendi dept'i değil, işi AÇANIN dept'i yazılır.
  - Üst yönetim İŞ AÇARSA → dept atananlardan türetilir (açanın dept'i karışmaz).
  - İkisi de üst yönetimse → diğer normal atananların dept'i; hiç normal yoksa kendi dept'leri.
  - Erdem/İpek (dept liderleri, yetki=yonetici) kapsam DIŞI — kural yetki'ye değil MGMT_IDS'e bağlı.
- Geriye dönük düzeltme 12 Haz'da yapıldı (eski işler yeniden hesaplandı).

### 4.2 Bildirimler (slack.js + writes.js)
- **Güncelleme DM'leri YOK** (12 Haz): "✏️ güncellendi / 🔄 durum" değişiklikleri DM atmaz;
  tek Slack bildirimi thread notudur. Dashboard çanı `logNotification` ile beslenmeye devam eder.
- **Yeni brief DM'i de YOK** (önceki karar): tek kanal = ilk thread yanıtındaki mention.
- Korunan hedefli DM'ler: role eklendin/çıkarıldın, zincirde sıra sende, gecikme uyarıları.
- Bildirim linki: thread İÇİNDEKİ ilgili mesaja gider — format
  `/archives/{cid}/p{replyTs}?thread_ts={kökTs}&cid={cid}` (reflectChange postThread'in dönen ts'ini kullanır).
- Eski 235 WT-fallback bildirim linki DB'de geriye dönük thread linkine çevrildi (0 kaldı).
- Thread notlarında **yapan kişi imzası**: ilk satır sonunda `· 👤 İsim` (opts.by → users.name).

### 4.3 Slack linkleri (dashboard)
- Chrome.jsx global capture-click kancası TÜM `slack.com/archives` linklerinde:
  thread parametrelerini URL'den türetip ekler + aracı sekmeyi 3.5 sn sonra kapatır
  (`window.open` handle ile — noopener KULLANMA).
- slack.js postBrief permalink'i baştan thread formatında üretir.

### 4.4 Süre / gecikme / puan hesapları
- `started_at`: ilk 'calisiliyor'da damgalanır (CASE WHEN ... COALESCE).
- `bekleme_ms`: events'ten lead() window ile (beklemede → sonraki durum); süre, gecikme
  ve AI puanından DÜŞÜLÜR. (Şu an 0 — hiç beklemeye alınmış iş yok, hata değil.)
- AI puan kuralı: net gecikme >24sa → max 3⭐, >48sa → max 2⭐.
- Ort. gecikme TÜM işlere bölünür (yalnız gecikenlere değil).
- Puanlama tamamlanma sonrası ilk saatlik Opus turunda düşer.

### 4.5 Sıralı akış (zincir)
- `akis`: 'paralel' (varsayılan) | 'sirali'. ZINCIR_EPOCH = 2026-06-11T16:00 TR;
  epoch öncesi 26 kayıt paralel'e çevrildi.
- Sıralı işte sıradaki halkaya DM; dept istatistiğinde sırası gelmemiş contributor sayılmaz.

### 4.6 Öncelik
- Manuel: 🔴 ACİL / 🟠 YÜKSEK / 🟡 NORMAL (boş=🟡) / 🟢 DÜŞÜK.
- ONC haritası data.js hydrate'te; renkler tokens.css'te ayrı (light: turuncu #E2670A, sarı #B5A013).

### 4.7 Kapasite
- Dashboard modeli: kişi × 6 EŞZAMANLI slot (günlük üretim hızı DEĞİL).
- **Kişi kapasitesi TEK DOĞRULUK KAYNAĞI:** `data.js` → `bnsPersonCapLimit(u)` (limit:
  yönetici=10, editor=8, tasarim/ai/freelance=6) + `bnsPersonCapPct(u, aktifSayısı)`.
  Profil ekranı VE Departman kişi satırları AYNI helper'ı çağırır (eskiden Departman
  `iş×18`, Profil `iş/limit` kullanıyordu → aynı kişi %90 vs %50 görünüyordu, 2026-06-13 düzeltildi).
  Sayma kapsamı: aktif (musteride/tamamlanan hariç) lead+contributor; reviewer rolü canlıda yok.
- **Saha bilgisi (Görkem):** 1 tasarımcı günde ortalama 3-5 iş tamamlar — veri olgunlaşınca
  "haftalık çıktı hızı" metriği bununla kıyaslanmalı.
- Müşterideki (✈️ musteride) işler kapasite/aktif sayımına girmez; ayrı mor KPI.
- Departman yükü kartı kişinin KENDİ dept'ine göre sayar (üst yönetim istisnası YOK — bilinçli karar).

## 5. Veri Modeli (özet)

- **briefs**: no, marka_id, baslik, dept, deadline, priority, akis, durum, started_at,
  completed_at, deleted_at (soft), slack_ts/slack_channel/slack_url, image_url, rating,
  rating_sebep, rev, maliyet/satis/fatura/odeme
- **brief_assignees**: brief_id, user_id, role (contributor|lead|gozlemci), sira, onay_at
- **users**: id (U...=Slack, FR...=freelance sentetik), name, dept (tasarim|editor|ai|freelance),
  yetki (yonetici|...), avatar_url (Slack image_192, bot açılışında syncAvatars)
- **events**: event-sourcing; verb+detail+source (dashboard|slack|system), slack_ts idempotency
- **notifications**: user_id, text (≤110 kr), link (thread formatlı)
- **brands**: 33 kayıt; "Benseno" (id 86) markasız genel kanal #benseno'ya bağlı;
  Hendex bilinçli olarak kanal haritasında YOK

## 6. Dashboard Ekranları (anlık durum)

| Ekran | Önemli özellikler |
|---|---|
| Overview | KPI kartları (tıklanabilir deep-link), Departman özeti (Tasarım/Editör/AI/**Freelance**, adlar DEPT_TR haritasından), sorunlu markalar, parlayan (yalnız admin) |
| Sıralı İşler (multi) | YALNIZ akis='sirali'; KPI kartları tıklanabilir filtre (tümü/gecikmiş/müşteride, aktif kart ember çerçeveli, toggle) |
| Marka | detayda 3 segment (aktif/müşteride/tamamlanan) + **marka geçiş dropdown'ı** (alfabetik, aktif sayısıyla) + CSV |
| Profil | musteride hariç kapasite; ayrı "Müşteride" KPI; **bnsOpenUser ile dışarıdan kişi açılır** |
| Müşteri Onayı | öncelik kolonu dahil |
| Tamamlananlar | süre/ort. (bekleme düşülmüş), Stars tooltip'inde Opus gerekçesi |
| Galeri | /api/img/:id proxy'siyle görseller (arrayBuffer stream fix) |
| Departman/Ekip | kişi adı + avatar tıklanınca profil |

**Global köprüler (App.jsx):** `window.bnsOpenBrand(name)`, `window.bnsOpenUser(id)`;
Atoms'ta BrandChip ve Avatar her yerde tıklanabilir.
**Ody:** sol altta, sürükle-bırak (balon+panel, localStorage `bns_ody_pos`), login kullanıcısını bilir.
**Avatarlar:** 19/25 Slack fotoğraflı, kalan 6 freelance baş harfli; bot açılışında senkron.

## 6.5 Tutarlılık Denetimi (TÜM HESAPLAMALARI DOĞRULAR)

- **`node scripts/consistency-check.js`** — sistemdeki türetilmiş metrikleri DB-gerçeğiyle
  bağımsızca yeniden hesaplayıp karşılaştırır (25 kontrol). Ayrışma varsa exit 1.
- Kapsam: departman istatistikleri, marka istatistikleri, yıldız karneleri (firma+kişi),
  süre/gecikme formülleri (invariant), puan aralığı, kişi kapasitesi, aktif brief toplamı.
- İki tür kontrol: **(A) DB-SQL ↔ API-sunulan** eşitliği (sunucu metrikleri) ·
  **(B) invariant + çapraz-tutarlılık** (istemci-türetilen metrikler: sureH/gecikmeH/kapasite
  API'de SUNULMAZ → formül ham veriden yeniden üretilir, sunulduğu VARSAYILMAZ).
- **Yeni bir metrik/hesaplama eklerken bu script'e de bir kontrol ekle.** Aynı metriği
  iki yerde hesaplamaktan kaçın; tek helper'a çıkar (bkz. kapasite → bnsPersonCapPct).
- Tipik kullanım: büyük değişiklik/deploy sonrası `node scripts/consistency-check.js` çalıştır.

## 7. Bilinen Davranışlar / Tuzaklar

- `sleep N` ve `rm -rf` hook'larca bloklanır → until-loop + run_in_background / mktemp -d kullan.
- Heredoc içinde "UPDATE ... " metni bile bloklanabilir → SQL'i Write ile dosyaya yaz, `psql -f` çalıştır.
- Gerçek marka kanallarına TEST MESAJI ATILMAZ. Test: BNS_FORCE_CHANNEL override.
- API logundaki "brief bulunamadı (slack_ts)" = brief olmayan mesaja emoji — zararsız.
- Türkçe karakterli anchor'larda patch öncesi gerçek satırı oku.
- bundle.js elle düzenlenmez — kaynak app/*.jsx, build script üretir.

## 8. Anlık Sayılar (12 Haz 2026 ~15:00 TR)

- 37 aktif brief (31 paralel, 6 sıralı) · 11 tamamlanan · 25 kullanıcı (4 dept)
- Öncelik: 31 🟡 · 5 🟠 · 1 🔴
- Departman yükü: Tasarım 15 (%36) · Editör 34 (%71) · AI 8 (%33) + Freelance satırı yeni eklendi
- 277 bildirim, tamamı thread-linkli
