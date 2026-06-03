# Benseno — Canvas'tan Postgres'e Geçiş Planı

> **Karar (3 Haziran 2026):** Canvas EMEKLİ · Railway Postgres = tek doğruluk kaynağı ·
> Railway API + dinamik dashboard · Brief girişi HEM yapılandırılmış form HEM serbest-metin LLM parse.
> Amaç: LLM data-agent drift'ini (bu oturumda 4 bug'ın kökü) kökten yok etmek.

---

## 1. Hedef Mimari

```
Slack (reaction / komut / brief formu / serbest mesaj)
        │  (deterministik; serbest-metin için izole LLM parse)
        ▼
   BOT + API  (Railway Node servisi — Socket Mode + Express/Fastify)
        │
        ▼
   POSTGRES  (Railway managed — TEK DOĞRULUK KAYNAĞI)
        │  GET /api/* (auth'lu)
        ▼
   DİNAMİK DASHBOARD  (React, Railway'de servis edilir — canlı API sorgusu)
```

- **Canvas YOK.** data-agent LLM skill EMEKLİ. live-data.json/EMBEDDED EMEKLİ.
- **Override patch dosyaları YOK** (priority/status/financials/completion → DB sütunları).
- **Notification/escalation/raporlar** DB sorgular (live-data.json değil).

---

## 2. Veritabanı Şeması (taslak)

```sql
-- Kanonik kullanıcılar (sabit; isim halüsinasyonu imkânsız)
users(id PK, name, rol, initials, color, title, active)

brands(id PK, name UNIQUE, color, wheel_idx)

briefs(
  id PK, no UNIQUE, slack_ts, slack_channel, slack_url,
  marka_id FK→brands, baslik, dept,
  deadline TIMESTAMPTZ, saat,
  durum,                       -- yeni|calisiliyor|incelemede|blokeli|tamamlandi
  priority, priority_label,    -- DOĞRUDAN sütun (override dosyası yok)
  rev INT DEFAULT 0,
  maliyet NUMERIC, satis NUMERIC, fatura BOOL, odeme BOOL,
  musteri_notu TEXT,           -- (eklendi) müşteri notu
  tahmini_sure_h NUMERIC,      -- (eklendi) tahmini süre (saat)
  akis,                        -- (eklendi) sirali | paralel (açılışta belirlenir; onay/iş sırasını yönetir)
  stale BOOL, gecmis TEXT,
  created_at, completed_at, updated_at   -- bitis/30g/History DOĞAL
)

brief_assignees(brief_id FK, user_id FK, role, sira INT)
  -- role: lead | contributor | editor | gozlemci(observer). lead DEĞİŞTİRİLEBİLİR, gozlemci EKLENEBİLİR,
  -- atanan(doer) DEĞİŞTİRİLEBİLİR. sira: sıralı akışta iş/onay sırası.
brief_tags(brief_id FK, tag)                     -- (eklendi) etiketler — seçilebilir VEYA serbest; boşsa Claude önerir
brief_attachments(id PK, brief_id FK, url, filename, mime, uploaded_by FK, source, ts)
  -- (eklendi) dosya/ek. source: dashboard_upload | slack_thread (Slack thread'indeki dosyalar OTOMATİK yakalanır)
brief_approvals(id PK, brief_id FK, approver_id FK, sira INT, durum, ts)
  -- (eklendi) onay zinciri. akis=sirali → sira'ya göre tek tek; akis=paralel → hepsi eşzamanlı.

events(                         -- aktivite/audit logu → History + denetim
  id PK, brief_id FK, user_id FK, verb, detail, source, ts
)  -- retention: brief completed_at + 18 ay sonra temizlenir (cron)
```
- Tamamlanan iş = `briefs.completed_at IS NOT NULL` (ayrı tablo gerekmez).
- dept/marka/30g/medyan/revize/puan = **SQL view/sorgu** (LLM toplama YOK).
- `brands(... slack_channel)` — markaya göre brief mesaj kanalı.
- `users(... dept, yetki)` — rol + departman bazlı yetki.

---

## 3. API (Railway Node — auth'lu)

**Okuma (dashboard):**
`GET /api/state` → {briefs, completed, users, brands, deptStats, brandStats, events} (tek çağrı, dashboard'ın ihtiyacı)
veya granüler: `/api/briefs`, `/api/brand-stats`, `/api/dept-stats`, `/api/events`.

**Yazma:**
`POST /api/brief` (form girişi — yapılandırılmış) · `PATCH /api/brief/:no` (finans/durum vb. — opsiyonel UI girişi)
Slack mutasyonları bot içinden doğrudan DB (HTTP gerekmez).

**Auth:** mevcut `.dashboard-auth-hash` → dashboard login token; API `Authorization: Bearer <token>` kontrol eder. Slack tarafı Slack signing ile.

---

## 4. Brief Girişi (HEM form HEM serbest-metin)

- **Yapılandırılmış:** Slack workflow/modal → {marka, deadline, atananlar, açıklama} → bot **deterministik INSERT** (LLM yok).
- **Serbest metin:** kanala yazılan brief mesajı → bot **küçük izole LLM parse** (sadece alan çıkarımı: marka/deadline/atanan) → DB INSERT. Bu tek nokta LLM kalır ama izole + doğrulanabilir (Canvas'ı yeniden üretmez).

---

## 5. Fazlı Geçiş (her faz bağımsız shippable, eski sistem cutover'a dek çalışır)

| Faz | İş | Doğrulama | Risk |
|---|---|---|---|
| **1. Temel** | Railway Postgres provision · şema+migration · read API (GET) · mevcut temiz live-data.json'dan DB seed | API doğru veri dönüyor (eski dashboard'a dokunulmaz) | Sıfır (paralel) |
| **2. Dashboard→API** | Dinamik dashboard API'den besleniyor · Railway'de servis · auth/login | Dashboard DB'den render | Düşük (eski Pages yedek) |
| **3. Yazma** | Reaction/komut/finans/tamamlama → DB doğrudan · brief intake (form+serbest) → DB | Her mutasyon yolu canlı test | Orta |
| **4. Cutover** | LLM data-agent run KAPAT · escalation/raporlar DB sorgular · Canvas read/write KALDIR | Tam döngü DB üzerinden | Orta (geri dönüş planı) |
| **5. Temizlik** | Override dosyaları, reapply adımları, EMBEDDED injection, gecmis-guard kaldır (safeMap defansif kalır) · eski scriptleri emekli et | Regresyon yok | Düşük |

---

## 6. Avantaj / Dezavantaj (özet)

**Avantaj:** LLM drift sıfır · deterministik · gerçek SQL metrikler · gerçek tarihler · API maliyeti ↓ (orchestrator claude run kalkar) · headless sorun yok · tek doğruluk kaynağı.

**Dezavantaj:** Geçiş emeği (4-6 odaklı oturum) · ekip Canvas alışkanlığını bırakır (dashboard/Home Tab'a geçiş) · Postgres ~$5/ay · DB yedek/migration ops · dashboard yeniden yazımı (dinamik).

---

## 7. Açık Konular (Faz ilerledikçe netleşir)
- Dashboard hosting: Railway statik servis mi, ayrı servis mi (CORS'tan kaçınmak için aynı origin önerilir).
- Ekip için "yeni brief" UX: Slack workflow formu mu, dashboard formu mu, ikisi de mi.
- Yedekleme: Railway otomatik + haftalık dump.
- Geri dönüş (rollback): cutover'a dek eski Canvas+Pages sistemi dokunulmadan durur.

---

## 8. İKİ YÖNLÜ SENKRON (eklendi 3 Haz) — Slack ⇄ Dashboard

**İlke:** DB = hub. Slack VE dashboard ikisi de DB'ye yazar/okur → veri katmanında zaten iki yönlü.
Üstüne: bir tarafta yapılan değişiklik **diğer tarafın yüzeyine de yansır**.

### Brief'in Slack'teki yeni "evi": tek mesaj (Canvas satırı yerine)
Canvas emekli olunca her brief = brief kanalında **tek kanonik Slack mesajı**. `briefs.slack_ts` +
`slack_channel` sütunları o mesajı işaret eder. Thread'i reaction + finans + tartışma taşır.
Ekibin "tüm işler" görünümü = **Slack Home Tab** (zaten kurulu) + dashboard.

### Akışlar
| Kaynak | Olay | DB | Slack yüzeyi |
|---|---|---|---|
| **Dashboard** | Yeni brief (tüm alanlar formu) | INSERT | bot kanonik mesajı **postlar** + atananları DM'ler + ts'yi satıra yazar |
| **Dashboard** | Düzenleme (öncelik/durum/deadline/atanan/finans) | UPDATE | bot orijinal mesajı **`chat.update`** ile günceller; önemli değişimde (deadline/atanan) thread'e not + DM |
| **Slack** | reaction / thread / komut | UPDATE | (dashboard bir sonraki sorgu/poll'da yansıtır) |
| **Slack** | yeni brief mesajı (form/serbest) | INSERT | mesaj zaten Slack'te; dashboard yansıtır |

### Kritik tasarım
- **Echo/loop koruması:** dashboard→bot→Slack mesajı, bot'un kendi event'i olarak geri dönüp DB'yi
  yeniden tetiklemesin (`bot_id` guard + `source` damgası).
- **Çakışma:** aynı brief Slack+dashboard'dan yakın anda düzenlenirse `updated_at` ile last-write-wins
  (bu ekip boyutunda yeterli) + opsiyonel "X saniye önce başkası düzenledi" uyarısı.
- **Dashboard yazma yetkisi:** POST/PATCH auth'lu (yetkiye göre: yönetici tümünü, atanan kendi briefini).
- **Brief mesajı hangi kanala:** marka→kanal eşlemesi (ör. #benseno-grafik) ya da merkezi #briefs.

### Faz etkisi
- Faz 1-2 (read API + dashboard) değişmez.
- Faz 3'e eklenir: **dashboard yazma yolları** (yeni brief formu + edit) ve **bot'un Slack-yansıtma**
  katmanı (post/chat.update/DM). Faz 3 biraz büyür.

### KESİNLEŞEN KARARLAR (3 Haz)
- **Edit yansıması:** Her değişimde brief mesajı `chat.update` + **thread'e not** + ilgili kişilere **DM**
  (tam izlenebilirlik). Her edit Slack thread'inde iz bırakır.
- **Yeni brief kanalı:** **Markaya göre** (marka→kanal eşlemesi; ör. #benseno-grafik / marka kanalı).
  → `brands` tablosuna `slack_channel` sütunu eklenir.
- **Ekip görünümü:** **Slack Home Tab + dashboard.** Home Tab kişisel/genel özet, detay+filtre dashboard.
- **Dashboard yazma yetkisi:** yönetici → tüm briefler; atanan → kendi briefi (rol bazlı API auth).

---

## 9. Ek Gereksinimler & Aksiyon Modeli Değişikliği (3 Haz, 2. tur)

### 9.1 AKSİYON MODELİ — HİBRİT: reaction (hızlı) + thread-yazı (zengin)
**Reaction KALIR** (kaldırma kararı iptal). Sebep: her-zaman-açık bot `reaction_added` event'ini
anında alıyor (Socket Mode push) — bu oturumda 🎨/👀/✅/🔴 canlı kanıtlandı. "reactions.get okunamıyor"
sorunu yalnızca eski POLL yöntemindeydi; event push her zaman çalışıyor. İş thread'de devam ettiği için
reaction (thread'deki herhangi mesaja, tek tık, parent'a dönmeden) ekibin akışına en uygun.
Buton fikri ELENDİ (brief mesajını kalabalıklaştırıyor + thread'den parent'a dönüş gerektiriyor).

| Aksiyon | Yöntem | DB etkisi |
|---|---|---|
| Durum: Tasarımda | **reaction** `🎨` | durum=calisiliyor, dept=tasarim |
| Durum: Editörde | **reaction** `✍️` | durum=calisiliyor, dept=editor |
| Durum: AI'da | **reaction** `🤖` | durum=calisiliyor, dept=ai |
| Revize | **reaction** `👀` | durum=incelemede, rev++ |
| Tamamlandı | **reaction** `✅` | completed_at=now (çoklu-atanan kuralı korunur) |
| Öncelik | **reaction** `🔴/🟠/🟡/🟢` | priority (atanan+yönetici yetkisi) |
| Maliyet/Satış | **thread'e yazı** `maliyet 1500 satış 4000` | maliyet/satis |
| Fatura/Ödeme | **thread'e yazı** `fatura ok` / `ödeme ok` (+`iptal`) | fatura/odeme |
| Onay | **thread'e yazı** `onay ok` | onay zinciri ilerler |
| Müşteri notu / etiket vb. | **thread'e yazı** veya dashboard | ilgili alan |

- **Hızlı aksiyonlar = reaction** (tek tık, thread'de, kalabalık yok). **Zengin/rakamlı = thread-yazı.**
- Bot her ikisini de event olarak alır → **DB'ye deterministik yazar** → Slack mesajını `chat.update`
  + (gerekirse) DM + `events` defterine satır.

### 9.2 Maliyet/Satış girişi: HEM dashboard HEM Slack thread (ikisi de açık).

### 9.3 Bildirim kuralları: şimdilik **her edit → DM** (gürültü olursa kritik-only'ye düşürülür).

### 9.4 Audit/Geçmiş: `events` tablosu kim-ne-zaman-ne-değiştirdi tutar; brief **tamamlandıktan 18 ay**
sonra ilgili kayıtlar temizlenir (cron).

### 9.5 Yetki: **rol + departman bazlı.** (ör. yönetici tümü; departman lideri kendi dept'i; atanan kendi briefi.)

### 9.6 Mobil: dashboard **tam mobil** (görüntüleme + form girişi dahil).

### 9.7 Hosting: dashboard **Railway'de** (özel neden yoksa) — tek origin, CORS yok.

### 9.8 Raporlama/Analiz: 
- **Otomatik dışa aktarma** (zamanlı DB dump → dosya/e-posta; yedek + arşiv).
- Dashboard'da **genel rapor & analiz alanı** (SQL üstünde). Öncelikli raporlar:
  **departman yükü** · **marka bazlı harcanan süre** · **iş adetleri** (dönemsel) ·
  **iş tipi yoğunluğu** (Sosyal Medya/Print/Video/Araştırma... dağılımı) · ciro/maliyet/tahsilat ·
  marka kârlılığı · teslim/gecikme trendleri.

### 9.11 Onay & Atama modeli (detay)
- **Akış:** brief açılışında `akis` = **sıralı** (sıra ile onay/iş) veya **paralel** (eşzamanlı) belirlenir.
- **Lead (işi lead eden):** değiştirilebilir (brief_assignees lead rolü güncellenir → thread notu + DM).
- **Gözlemci (işi gözlemleyen):** sonradan eklenebilir (bildirim alır, düzenleyemez).
- **Atanan (işi yapan):** değiştirilebilir.
- **Onay ilerleme:** thread'e `onay ok` (veya dashboard) → sıralı ise bir sonraki onaylayıcıya geçer,
  paralel ise herkesinki bağımsız; hepsi tamam → brief onaylı/ilerleyebilir.

### 9.12 Etiketler: mevcut etiketlerden **seçilebilir** + kullanıcı **serbest** yazabilir; brief açılışında
etiket boşsa **Claude önerir** (başlık/marka/dept'e göre, küçük izole çağrı).

### 9.13 Dosya/ek: dashboard'dan **yükleme** + Slack thread'indeki dosyalar **otomatik yakalanır** (ikisi de).

### 9.9 Veri stratejisi:
- **Test aşamasında:** mevcut tüm veri (temiz hali) akışı anlamak için kullanılır.
- **Canlıya geçmeden ÖNCE:** tüm veri SİLİNİR → **sıfır veri** ile başlanır. (Migration seed yalnızca test için.)

### 9.10 Şema eklemeleri (yukarıda işlendi): müşteri_notu, tahmini_süre, etiketler, dosya/ek, onay zinciri.

---
*Sonraki adım: Faz 1 (Postgres provision + şema + read API + seed) — sıfır riskli, paralel. Onayla başlanır.*
