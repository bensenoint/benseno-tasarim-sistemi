---
name: benseno-brief-sync
description: "⚠️ DEPRECATED — Mayıs 2026den itibaren benseno-orchestrator kullanılıyor. Sadece referans/fallback."
---

> ⚠️ **DEPRECATED** — Bu skill artık doğrudan çağrılmaz.
> Yerine: `Skill: benseno-orchestrator — run`
> Alt skill'ler: benseno-data-agent, benseno-notification-agent, benseno-dashboard-agent



# Benseno — Brief Sync v7.13 (marka davranış öğrenmesi)

## ⚡ CHANGE LOG v7.13 — E3 MARKA DAVRANIŞ ÖĞRENMESİ

**v7.13 yeni:**
- **`marka_stats.json` okunur** (`~/benseno-tasarim-sistemi/data/marka_stats.json`). 39 marka için ortalama deadline + tamamlama süresi istatistikleri.
- **Adım 4f: Marka davranış kıyaslama** — yeni brief'in deadline süresi markanın **medyan ± 1× MAD** ve **ortalama ± 1× std** aralığı dışında kalırsa flag set.
  - `n < 3` ise marka için kıyas atlanır (yetersiz veri)
  - `3 ≤ n < 10` ise düşük güven (uyarı + "(düşük güven)" notu)
  - `n ≥ 10` ise tam güven
- **2 yeni uyarı kategorisi:**
  - **Yetersiz Süre:** `deadline < (median - 1×MAD)` → Şablon 27 (DM, sadece editör)
  - **Anormal Uzun:** `deadline > (median + 1×MAD)` → Şablon 28 (DM, sadece editör)
- **Silent mode (önemli):** `marka_stats.json.config.current_mode` değeri ile kontrol edilir:
  - `silent_log_only` (varsayılan, 1 Haziran'a kadar) → Brief Sync sadece log'a yazar, DM/dashboard etiketi YOK
  - `active` (1 Haziran'dan itibaren) → tam aktivasyon
- **Otomatik geçiş:** `now >= config.active_from` ise Brief Sync mode'u otomatik `active` olarak günceller (marka_stats.json'a yazar).
- **Dashboard flag (sadece active mode):** Marka kıyaslama uyarısı varsa Aktif İşler tablosunda Süre sütununa `📊 sapma` veya `📈 agresif` mini etiket eklenir.

**v7.12 yeni:**
- **🔔 Öncelik alanı workflow form'undan kaldırıldı.** Brief Sync deadline'dan otomatik hesaplar:
  - `deadline - now ≤ 8 saat` → 🔴 Acil
  - `8h < ≤ 24 saat` → 🟠 Yüksek
  - `24h < ≤ 72 saat (3 gün)` → 🟡 Normal
  - `> 3 gün` → 🟢 Düşük
- **Yönetici reaction override:** brief mesajına `🔴`/`🟠`/`🟡`/`🟢` reaction ekleyen yönetici (Görkem/Reyhan/Cansu/İpek/erdem) sistemde öncelik manuel set eder. Override Geçmiş'e kaydedilir (`🔴Yön15:30`). Yönetici dışı reaction yoksayılır.

- **Geçmiş tarih uyarı sistemi** (`deadline < now` ise):
  - Dashboard'da Süre sütununa `⚠️ GEÇMİŞ` prefix
  - Brief satırı kırmızı yarı-saydam zemin (CSS `.deadline-past`)
  - Brief mesajının thread'inde bot cevabı (Şablon 24)
  - Brief açana (🐷 Kimden) DM (Şablon 25)
  - Sabah Raporu'nda "🚩 Tarihi Şüpheli Brief'ler" bölümünde listelenir
  - Teyit yolu: thread'e `✅ ok` yazılır veya brief'e ✅ reaction → uyarı `✓ Teyit edilmiş geç brief`'e döner
- **Aynı gün brief'te saat zorunlu uyarısı** (`deadline.date == today` AND `saat girilmemiş` ise):
  - Dashboard etiket: `⏰ Saat eksik`
  - Brief açana DM (Şablon 26)
- **Mesai dışı deadline yumuşak uyarı** (`saat < 08:00` veya `> 17:30` ise):
  - Dashboard etiket: `🌙 Mesai dışı`
  - Bilgilendirici, blokaj değil

**v7.11 → v7.12 backward compat:** Eski mesajlarda 🔔 Öncelik satırı varsa Brief Sync onu da kabul eder (geçiş döneminde, gelirse manuel override ile aynı sayılır). Yeni mesajlarda 🔔 satırı gelmez (form'dan silindi).

**Workflow output format (v7.12):**
```
🎀 İş: {özet}
⏰ Süre: {tarih + saat, UTC veya TR}
👷 Kim: {atananlar}

🏷️ Tip: {iş tipi}
🔄 Akış: {Paralel/Sıralı}
🔗 Ref: {URL}
💬 Not: {metin}

🐷 Kimden: {form'u açan}
```
- **Marka kanal'dan türetilir** (v7.10'dan değişmedi)
- **Departman** önce ilk satırdan (📋/✍️/🤖 varsa), sonra atanan heuristic
- **UTC → TR çevirme:** "May 21st, 2026 at 4:05 PM UTC" → "21 Mayıs 2026 19:05 TR"
- **2 katmanlı parser:** v7.12 workflow (emoji-label, `🎀 İş:` imzalı) → Manuel brief fallback (📋/✍️/🤖 prefix)

## SABİTLER
```
CANVAS_ID = F0B1B6XUD44
ARCHIVE_CANVAS_ID = (Canvas footer'dan)
BRAND_BOOK_CANVAS_ID = F0B2ANKBBFV
LESSONS_LEARNED_CANVAS_ID = F0B2H49SXPC
TEMPLATES_CANVAS_ID = F0B2F2REETG
GRAFIK_CHANNEL_ID = C02SZRJGY0M
TIMEZONE = Europe/Istanbul (UTC+3)
PRIMARY_CALENDAR = gorkem@benseno.com.tr
DASHBOARD_URL = https://bensenoint.github.io/benseno-tasarim-sistemi/
GITHUB_REPO = bensenoint/dashboard
GITHUB_PAT_FILE = ~/benseno-tasarim-sistemi/data/.github-pat
DASHBOARD_AUTH_HASH_FILE = ~/benseno-tasarim-sistemi/data/.dashboard-auth-hash
PAT_CREATED_DATE_FILE = ~/benseno-tasarim-sistemi/data/.github-pat-created
WORKFLOW_BOT_NAME = "Yeni Brief Aç"
MARKA_STATS_FILE = ~/benseno-tasarim-sistemi/data/marka_stats.json
```

## CHANNEL → MARKA MAPPING (33 marka)
```
marka-bauhaus → Bauhaus
marka-beta → Beta
marka-cimporglobal → Cimporglobal
marka-cureffect → Cureffect
marka-egosport → Egosport
marka-gursoy → Gürsoy
marka-hasvet → Hasvet
marka-hendex → Hendex
marka-jnj → JNJ
marka-jnj-acuvue-me → JNJ Acuvue ME
marka-jnj-vision-tr → JNJ Vision TR
marka-jungleous → Jungleous
marka-kmr-amos → KMR Amos
marka-kmr-copic → KMR Copic
marka-kmr-lamy → KMR Lamy
marka-kmr-marshmallow → KMR Marshmallow
marka-kmr-max → KMR Max
marka-kmr-panfix → KMR Panfix
marka-kmr-serve → KMR Serve
marka-kuzeypet → Kuzeypet
marka-kzy-bark → KZY Bark
marka-kzy-everclean → KZY Everclean
marka-kzy-ferplast → KZY Ferplast
marka-kzy-flamingo → KZY Flamingo
marka-kzy-simplesolution → KZY Simple Solution
marka-kzy-supreme → KZY Supreme
marka-kzy-vetsbest → KZY Vet's Best
marka-marmaraholding → Marmara Holding
marka-muffik → Muffik
marka-polisan → Polisan
marka-splenda → Splenda
marka-tour2america → Tour2America
marka-vdm-petdent → VDM Petdent
```

**Editor/FAQ kanalları hariç:** `*-editors`, `*-faq` suffix'li kanallar Brief Sync için aktif değil.

## 3 DEPARTMAN
**🎨 Tasarım (7, 📋):** Aylin (U0AN6DD79M0), Aykut (U06J26R1XCJ), Hasan Serdar (U09BFPBKQG7), **Pelin Özdemir (U0B3K2WE7SB)**, İpek 🎯 Tasarım Yön. (U055EDESLSE), İrem (U0AK8U7L57F), Serhat (U08HLMHTGEL)
**✍️ Editör (8, ✍️):** Cansu 👑 Direktör (U4XCE3532), erdem 🏅 Editör Yön. (U02SZQDAFPF), Eda T (U09BZHR25NG), Eda A (U07PV0RA9L2), Melis (U08NQJ27G5S), Aylin C (U05PP70GQTX), Buse (U063T8M5HL4), Simge (U0AAC3YK20G)
**🤖 AI (1, 🤖):** Eren (U0AP31SAA1W)

## 👑 YÖNETİCİLER (5)
1. Görkem (U030C48PL23) — Genel Müdür
2. Reyhan (UD96GH76E) — Genel Müdür Yardımcısı
3. Cansu (U4XCE3532) — Direktör (3 dept)
4. İpek (U055EDESLSE) — Tasarım Yöneticisi
5. erdem (U02SZQDAFPF) — Editör Yöneticisi

# WORKFLOW BRIEF TESPİTİ (v7.11 yeni)

## Brief mesajı olup olmadığını anla
Bir Slack mesajı brief olarak sayılır eğer:
1. **Workflow tarafından gönderilmiş** → `bot_id` veya `app_id` `Yeni Brief Aç` workflow'unun ID'si ile eşleşir
   - VEYA mesaj `🎀 İş:` ile satır içeriyor (workflow imzası)
2. **VEYA manuel brief** → ilk satır `📋/✍️/🤖` ile başlıyor (eski format'lar — manuel yazılmış)

Bu iki kategori farklı parser kullanır.

## Mesaj parser — Workflow brief'i için

### Adım 1: Marka türet (kanal'dan)
`channel_id` → kanal adı → mapping tablosu (yukarıda) → kanonik marka.
Editor/FAQ kanalında ise atla.

### Adım 2: Field-by-field parse (emoji-label format)
Her satırı regex ile yakala:

| Field | Regex | Çıkarılan |
|---|---|---|
| Departman | `^(📋|✍️|🤖)` (ilk satırın başında) | departman emoji |
| İş özeti | `^🎀\s*İş:\s*(.+)$` | string |
| ~~Öncelik~~ | ~~`^🔔\s*Öncelik:\s*(🔴|🟠|🟡|🟢)`~~ | **v7.12: artık yok — Süre'den otomatik hesaplanır. Eski mesajlarda varsa fallback olarak kabul edilir.** |
| Süre | `^⏰\s*Süre:\s*(.+)$` | tarih+saat (UTC→TR çevir) |
| Atananlar | `^👷\s*Kim:\s*(.+)$` | atama bloğu |
| İş tipi | `^🏷️\s*Tip:\s*(.+)$` | string |
| Akış | `^🔄\s*Akış:\s*(.+)$` | Paralel/Sıralı |
| Ref | `^🔗\s*Ref:\s*(.+)$` | URL |
| Not | `^💬\s*Not:\s*(.+)$` | string |
| Submitter | `^🐷\s*Kimden:\s*<@(U\w+)>` | User ID |

### Adım 3: Departman tespiti (öncelik sırası)
1. **İlk satırda 📋/✍️/🤖 varsa** → onu kullan
2. **Yoksa atanan heuristic:**
   - Atananların hepsi AI ekibi (Eren) ise → 🤖 AI
   - Atananların hepsi editör ekibinde ise → ✍️ Editör
   - Aksi takdirde → 📋 Tasarım (varsayılan)
3. **Belirsizse** editöre Şablon 23 (yeni) DM: "Departman belirsiz, kontrol et"

### Adım 4: Süre çevirisi (UTC → TR)
Slack default formatı: `May 21st, 2026 at 4:05 PM UTC`
Parse:
- Ay: May → Mayıs (TR ay tablosu)
- Gün: 21st → 21
- Yıl: 2026
- Saat: 4:05 PM UTC → 16:05 UTC + 3 saat = 19:05 TR
TR string: `21 Mayıs 2026 19:05 TR`

Eğer Süre saatsiz gelirse (sadece tarih) → "21 Mayıs 2026 (tüm gün)"

### Adım 4b: Otomatik öncelik hesapla (v7.12)
`deadline_unix = parse(Süre)` ve `now_unix = current_time`
`delta_hours = (deadline_unix - now_unix) / 3600`

| `delta_hours` | Öncelik |
|---|---|
| `≤ 0` | 🔴 Acil + GEÇMİŞ flag (Adım 4d'ye git) |
| `0 < delta ≤ 8` | 🔴 Acil |
| `8 < delta ≤ 24` | 🟠 Yüksek |
| `24 < delta ≤ 72` | 🟡 Normal |
| `> 72` | 🟢 Düşük |

Saatsiz brief'ler için (sadece tarih, "tüm gün") delta hesabı `deadline.date 23:59 TR` üzerinden yapılır.

### Adım 4c: Aynı gün brief'te saat kontrolü (v7.12)
Eğer `deadline.date == today.date` AND `saat girilmemiş` (yani "tüm gün") ise:
- `flag_saat_eksik = true`
- Dashboard'a `⏰ Saat eksik` etiket eklenir
- Brief açana (🐷 Kimden) DM gönderilir (Şablon 26)
- Bot thread cevabı eklenir (kısa): "⏰ Aynı gün teslim için saat lütfen — `HH:MM` formatında thread'e yaz veya yeni brief aç."

### Adım 4d: Geçmiş tarih kontrolü (v7.12)
Eğer `deadline_unix < now_unix` (deadline geçmişte) ise:
- `flag_past_deadline = true`
- Dashboard'a `⚠️ GEÇMİŞ` prefix + CSS class `.deadline-past`
- Brief satırı kırmızı yarı-saydam zemin
- Bot thread cevabı (Şablon 24) — sadece 1 kez (idempotent)
- Brief açana DM (Şablon 25) — sadece 1 kez
- Sabah Raporu'nda "🚩 Tarihi Şüpheli Brief'ler" bölümünde listelenir
- **Teyit yolu:** brief thread'inde `✅ ok` veya `teyit` yazılırsa VEYA brief'e ✅ reaction eklenirse `flag_past_deadline_confirmed = true` → dashboard etiketi `✓ Teyit edilmiş geç brief`'e döner

### Adım 4e: Mesai dışı saat kontrolü (v7.12)
Eğer `saat girilmiş` AND (`saat < 08:00` OR `saat > 17:30`) ise:
- `flag_after_hours = true`
- Dashboard etiket: `🌙 Mesai dışı`
- Hafta sonu (Cumartesi/Pazar) deadline da bu flag'i alır
- Bilgilendirici, blokaj değil, DM/thread cevabı yok

### Adım 4f: Marka davranış kıyaslama (v7.13 — E3)
1. `marka_stats.json` dosyasını oku (`MARKA_STATS_FILE`)
2. **Mode kontrolü:**
   - `config.current_mode == "silent_log_only"` AND `now >= config.active_from` ise → `current_mode = "active"` olarak güncelle ve dosyaya kaydet (otomatik geçiş)
   - `current_mode == "silent_log_only"` ise sonraki adımlar sadece log'a yazılır (DM/dashboard etiketi YOK)
   - `current_mode == "active"` ise normal davranış
3. Brief'in markası için `brands[markaAdı]` aranır:
   - **Yoksa veya n < `config.min_n_for_uyari_active` (varsayılan 3):** kıyas atlanır, log'a `marka_kiyasla: skip · yetersiz_veri` yaz, sonraki adıma geç
   - **Var ve n >= 3:** devam et
4. **Kıyaslama (iki metrik):**
   - `deadline_days = (deadline_unix - now_unix) / 86400`
   - **Medyan tabanlı sapma:** `|deadline_days - median_deadline_days|` > `mad_deadline_days × deviation_threshold_mult (varsayılan 1.0)`
   - **Ortalama tabanlı sapma:** `|deadline_days - mean_deadline_days|` > `std_deadline_days × deviation_threshold_mult`
   - **Her iki kontrol de yapılır.** Birinde uyarı çıkarsa flag set edilir (OR mantığı).
5. **Yön belirleme:**
   - `deadline_days < median_deadline_days - 1×MAD` → **Yetersiz Süre** (`flag_marka_yetersiz_sure = true`)
   - `deadline_days > median_deadline_days + 1×MAD` → **Anormal Uzun** (`flag_marka_anormal_uzun = true`)
6. **Güven seviyesi:**
   - `n >= config.min_n_for_high_confidence (varsayılan 10)` → `confidence = high`
   - `3 <= n < 10` → `confidence = medium` (DM'lerde "(düşük güven)" notu)
7. **Aksiyon (mode'a göre):**
   - **silent_log_only:** Sadece log'a yaz: `marka_kiyasla: {marka} n={n} median={X} brief_dl={Y} flag={yetersiz/uzun/normal} confidence={high/medium} mode=silent`
   - **active:** 
     - Brief açana (🐷 Kimden) DM (Şablon 27 veya 28)
     - Dashboard'da Süre sütununa mini etiket: `📈 agresif` (yetersiz) veya `📊 sapma` (anormal uzun)
     - Sabah Raporu'na "📊 Marka Hız Trendi" listesinde görünür (v7.9 Sabah Raporu özelliği)

**Önemli:** Marka kıyaslama uyarısı **deadline kontrolü değildir** — sadece "bu marka için alışılmadık" demek. Editör bilerek farklı bir deadline veriyorsa görmezden gelir.

### Adım 5: Atananlar parse
`@Pelin Özdemir, @erdem` veya `@Pelin Özdemir > @erdem`:
- Virgül VE/VEYA `>` ayır
- Slack user mention'ları çıkar
- Akış alanı "Sıralı" ise sıra korunur (form'da seçim sırası)
- Akış "Paralel" ise sıra önemsiz

### Adım 6: Brief Canvas'a yaz
- Marka: kanal'dan
- Proje Adı: 🎀 İş satırından
- Departman: yukarıdaki sırayla
- **Öncelik: Adım 4b otomatik hesabından** (v7.11 fallback'te 🔔 varsa onu da kabul et — aynı sayılır)
- Deadline: ⏰ satırından (TR formatlı)
- **Flag'ler:** `past_deadline`, `past_deadline_confirmed`, `saat_eksik`, `after_hours` (Adım 4c/4d/4e)
- Atananlar: 👷 satırından
- Editör (👷 satırından çıkmaz, ayrı çek): 🐷 Kimden'den
- Diğer alanlar: 🏷️ 🔄 🔗 💬

### Adım 7: Yönetici reaction override (v7.12)
Her sync run'da brief mesajlarının reaction'larını oku.

**Yönetici listesi:**
- U030C48PL23 Görkem (GM)
- UD96GH76E Reyhan (GMY)
- U4XCE3532 Cansu (Direktör)
- U055EDESLSE İpek (Tasarım Yön.)
- U02SZQDAFPF erdem (Editör Yön.)

Yönetici user'lardan herhangi biri brief'e şu reaction'lardan birini ekleyince:
- `🔴` (red_circle) → Öncelik manuel override = 🔴 Acil
- `🟠` (large_orange_circle) → 🟠 Yüksek
- `🟡` (large_yellow_circle) → 🟡 Normal
- `🟢` (large_green_circle) → 🟢 Düşük

**Override mantığı:**
- Override yalnız 1 kez geçerli olur (idempotent). En son eklenen yönetici reaction'ı dikkate alınır.
- Yönetici dışı kullanıcılardan gelen 🔴/🟠/🟡/🟢 reaction'ları yoksayılır.
- Override Geçmiş sütununa kaydedilir: `🔴Yön15:30` (override-zaman damgası — reaction zamanı).
- Dashboard'da öncelik hücresinin yanına ✋ ikonu (override işareti) — hover'da "Görkem 15:30'da manuel set etti".
- Override sonrası deadline değişirse otomatik hesap **bir daha çalışmaz** (override kalıcı, deadline değişimi yoksayılır). Yeniden otomatik hale döndürmek için yönetici aynı emoji'yi remove + yeniden add yapar (toggle).

## PARSING — Format önceliği

Brief Sync sırayla dener; ilk eşleşeni kullanır:

1. **v7.11+ (öncelikli):** workflow brief — emoji-label format (`🎀 İş:` imzalı)
2. **Manuel brief fallback:** ilk satır `📋/✍️/🤖` ile başlıyor (nadiren kullanılır)

## CANVAS YAPISI (14 sütun) — değişmedi.

# ADIM ADIM

### 1. Canvas oku — CACHE ÖNCELİKLİ (v7.14)

**⚡ Önce `~/benseno-tasarim-sistemi/data/canvas_cache.md` dosyasını kontrol et:**
- Dosya varsa ve son değişiklik zamanı 30 dakikadan eskiyse → `slack_read_canvas` çağır, cache'i güncelle
- Dosya varsa ve 30 dakikadan yeni ise → cache'i kullan, `slack_read_canvas` ÇAĞIRMA (token tasarrufu)
- `LAST_SYNC_TS`'yi cache'den oku

**Canvas'a yazmadan önce değişiklik kontrolü:**
- Yeni brief eklenmiyorsa VE override değişikliği yoksa → `slack_update_canvas` ÇAĞIRMA
- Sadece gerçek değişiklik varsa Canvas'ı güncelle ve cache'i yenile

**1a-1g — değişmedi.**

### 2. Yeni brief'leri ara — QUEUE ÖNCELİKLİ (v7.14)

**⚡ Önce `~/benseno-tasarim-sistemi/data/brief-queue.json` dosyasını oku (lokal dosya, bedava):**
- Dosya yoksa veya boşsa → fallback: `slack_search_public` ile normal tarama yap (aşağıdaki eski yöntem)
- Dosya doluysa → sadece queue'daki brief'leri işle, Slack kanallarını TARAMA (token tasarrufu)
- Queue'yu işledikten sonra dosyayı temizle: `[]` yaz

Queue entry formatı: `{ts, channel, text, user, is, queued_at}`
- `channel` → kanal ID'si (C…), CHANNEL→MARKA mapping'den marka adını türet
- `text` → ham Slack mesajı, normal brief parse akışına sok (aşağıdaki adımlar)
- Zaten Canvas'ta olan ts'ler atlanır (duplicate önleme)

**Fallback — Queue boşsa eski yöntem:**
`slack_search_public` query: `in:#marka-*` after:LAST_SYNC_TS limit:30
**Workflow bot mesajlarını da dahil et** (filter ekleme — eskiden manuel-only varsayılıyordu).

Her brief için (queue veya search fark etmez):
1. **Marka türet** (kanal'dan)
2. **Brief mı?** (workflow bot veya 🎀 İş imzası veya 📋/✍️/🤖 prefix)
3. **Format dedektör (5 katman)** — sırayla dene
4. **Departman tespiti** (ilk satır → atanan heuristic)
5. **UTC → TR saat çevirisi**
6. **Multi-assignee parsing** (virgül + `>` ayır)
7. 🔴 + @auto kontrolü → Şablon 18
8. 🤖 brief + Eren OOO → Şablon 19
9. P7-C1 Smart Assign
10. P7-C3 Revizyon tahmin
11. Yeni alan parsing
12. Canvas'a yaz
13. DM atananlara

### 2a-9. (Thread özet, reaction, hayalet, tamamlanmış, SLA, bottleneck, stale, OOO, tablo, GitHub push) — değişmedi (detay aşağıda).

### 9b. GitHub push — EMBEDDED_DATA inject (v7.x kritik adım, açıklamalı)

**Brief Sync her run'da yapması gereken:**

1. `~/benseno-tasarim-sistemi/dashboard/index.html` oku
2. `window.EMBEDDED_DATA = {…}` bloğunu regex replace et:
   - `canvas_markdown`: bu run'daki yeni Canvas markdown (backtick + `${}` escape)
   - `bns_briefs`: aktif brief'ler (JSON array)
   - `bns_completed`: son 90 günde tamamlananlar (JSON array) — her obje şu alanları içermeli:
     `no, marka, baslik, leadId, contribIds[], deadline, baslangic, bitis, revision, rating, slack_url, notes`
     **YENİ:** `image_url` — brief thread'indeki ilk Slack dosya eki URL'si (varsa). Şu adımlarla çıkar:
     1. `slack_read_thread` ile brief thread'ini oku
     2. Thread mesajlarındaki `files[]` dizisini tara — ilk `image/*` mime type'lı dosyanın `thumb_720` veya `url_private_download` değerini al
     3. Bulamazsan `image_url: null` gönder (dashboard SVG pattern gösterir)
     Not: `url_private` Slack auth gerektirdiğinden dashboard'da görüntülenemez — `thumb_720` tercih edilir (public CDN URL olabilir)
   - `bns_brands`: 39 marka listesi (JSON array)
   - `bns_users`: 16+ kullanıcı listesi (JSON array)
   - `bns_dept_stats`: departman istatistikleri (JSON object — tasarim/editor/ai key'leri zorunlu, her biri: name/people/active/overdue/capacity/completed30/avgComplete/revRate)
   - `bns_brand_stats`: marka istatistikleri (JSON array)
   - `generated_at`: şimdiki ISO 8601
   - `sync_ts`: şimdiki unix timestamp
   - `source`: `"brief-sync-run-{unix_ts}"`
3. Aynı JSON'u `~/benseno-tasarim-sistemi/dashboard/app/live-data.json` dosyasına da yaz (App.jsx her 30sn polling yapar)
4. `cp dashboard/index.html index.html` ile root kopyasını güncelle
5. Git push: `git add dashboard/index.html dashboard/app/live-data.json index.html marka_stats.json && git commit -m "Brief Sync v7.13 run" && git push origin main`
6. GitHub Pages 1-2 dk içinde deploy eder (bensenoint.github.io/benseno-tasarim-sistemi/)

**bns_dept_stats örnek format:**
```json
{
  "tasarim": { "name": "Tasarım", "people": 6, "active": 8, "overdue": 2, "capacity": 78, "completed30": 24, "avgComplete": 26.4, "revRate": 18 },
  "editor":  { "name": "Editör",  "people": 6, "active": 6, "overdue": 1, "capacity": 65, "completed30": 18, "avgComplete": 34.1, "revRate": 22 },
  "ai":      { "name": "AI",      "people": 1, "active": 4, "overdue": 0, "capacity": 90, "completed30": 12, "avgComplete": 18.7, "revRate": 11 }
}
```

**Hata kontrolü:**
- `EMBEDDED_DATA` pattern bulunamazsa → Görkem'e DM
- GitHub push 401/403 → PAT yenileme gerekli, Görkem'e DM
- `bns_dept_stats` boş `{}` gönderilmez — mock data devreye girer ama eksik veri olur

### 10. CANVAS FULL REPLACE template
```
> 💡 v7.11 · workflow ile tam senkron · 16 kişi.

## 📊 Canlı Dashboard
🔒 [Birleşik Dashboard](https://bensenoint.github.io/benseno-tasarim-sistemi/) ← şifre korumalı
🏷️ [Marka Kitabı](...) · 🎓 [Lessons](...) · 📐 [Templates](...)

## 🎨 Tasarımcı (7) | ✍️ Editör (8) | 🤖 AI (1)
## 📋 Aktif İşler · STALE: 🔴=1g 🟠=3g 🟡=7g 🟢=14g
## ✅ Tamamlanan (90 gün)
## 💬 Thread Özetleri

## 📖 Kullanım
- Workflow'la brief aç: marka kanalı bookmark `📋 Yeni Brief Aç`
- Manuel brief: `📋 İş özeti` ile başlat (marka kanal'dan)
- Reaction PARENT mesaja (thread'e değil)
- 🔴 acilde @auto kullanma

---
> 🔄 Son sync: {şimdi} · `LAST_SYNC_TS={unix}`
🔒 Dashboard: https://bensenoint.github.io/benseno-tasarim-sistemi/
```

### 11. Calendar — yeni format
Event title: `{öncelik_emoji} {İş özeti} — {Marka}`

### 12. İhlal · 13. Saatlik özet — değişmedi.

## ŞABLONLAR (28 toplam)
1-21 + **22. Marka çelişki** + **23. v7.11 — Departman belirsiz** uyarısı + **24. v7.12 — Geçmiş tarih thread cevabı** + **25. v7.12 — Geçmiş tarih DM (brief açana)** + **26. v7.12 — Aynı gün saat eksik DM** + **27. v7.13 — Marka için yetersiz süre DM** + **28. v7.13 — Marka için anormal uzun süre DM**.

### Şablon 24 — Geçmiş tarih bot thread cevabı
Hedef: brief mesajının thread'i
```
⚠️ *Deadline geçmiş bir tarih:* {{date}} ({{delta_days}} gün geride)

Yanlışlık ise:
• Yeni brief aç (doğru tarihle), bu brief'i sahibin force-close etsin (🔒)

Bilerek geç tarihli kayıt ise (yedek/arşiv/teslim alınmış iş):
• Bu thread'e `✅ ok` veya `teyit` yaz → uyarı kalkar, "✓ Teyit edilmiş geç brief" notu kalır
• Veya brief'e ✅ reaction ekle (aynı işlevi görür)

Sabah Raporu'na bugün şüpheli olarak girer (teyit verilirse temizlenir).
```

### Şablon 25 — Geçmiş tarih DM (brief açana)
Hedef: 🐷 Kimden user_id (DM)
```
⚠️ Az önce açtığın brief'te deadline geçmiş bir tarih:

*{{İş özeti}}* — {{Marka}}
Deadline: {{date}} ({{delta_days}} gün geride)
Kanal: <#{{channel_id}}>
[Mesaja git]({{permalink}})

Slack thread'inde teyit isteniyor (`✅ ok` veya ✅ reaction). Bilerek geç tarih ise teyit ver, değilse yeni brief aç.
```

### Şablon 26 — Aynı gün saat eksik DM
Hedef: 🐷 Kimden user_id (DM)
```
⏰ Az önce açtığın brief aynı gün teslim ama saat girilmemiş:

*{{İş özeti}}* — {{Marka}}
Deadline: {{date}} (bugün — saat yok)
Kanal: <#{{channel_id}}>
[Mesaja git]({{permalink}})

Brief thread'ine `HH:MM` formatında saat yaz (örn: `15:00`), veya brief'i kapatıp yeni brief aç. Atanan tasarımcı doğru SLA hesabını yapamıyor.
```

### Şablon 27 — Marka için yetersiz süre DM (v7.13)
Hedef: 🐷 Kimden user_id (DM)
**Sadece `current_mode == "active"` ise gönderilir. silent_log_only modda log'a yazar.**
```
📈 *{{Marka}} için bu deadline alışılmadık agresif*

*{{İş özeti}}* — {{Marka}}
Senin verdiğin deadline: *{{deadline_days}} gün*
{{Marka}} ortalama (son 90 gün, {{n}} brief): *medyan {{median_dl}}g · ortalama {{mean_dl}}g* {{ "(düşük güven)" if confidence=="medium" }}

Bu kontrol bilgilendirme amaçlı — *blokaj değil*. Stratejik öncelik veya gerçekten hızlı teslim gerekliyse görmezden gel. Hata ise yeni brief aç (daha gerçekçi deadline).

[Mesaja git]({{permalink}})
```

### Şablon 28 — Marka için anormal uzun süre DM (v7.13)
Hedef: 🐷 Kimden user_id (DM)
**Sadece `current_mode == "active"` ise gönderilir. silent_log_only modda log'a yazar.**
```
📊 *{{Marka}} için bu deadline alışılmadık geniş*

*{{İş özeti}}* — {{Marka}}
Senin verdiğin deadline: *{{deadline_days}} gün*
{{Marka}} ortalama (son 90 gün, {{n}} brief): *medyan {{median_dl}}g · ortalama {{mean_dl}}g* {{ "(düşük güven)" if confidence=="medium" }}

Büyük bir iş (dergi kapağı, kampanya seti vb) ise normal. İş tipini ve kapsamı kontrol et — yanlışlıkla geniş süre girilmediğinden emin ol.

[Mesaja git]({{permalink}})
```

## P7-C1 / P7-C2 / P7-C3 / P7-fix4 / P7-fix5 — değişmedi.

## P1.x / P2 entegrasyonlar — değişmedi.

---

### 9c. Blokeli Brief DM — v7.14 (YENİ)

**Amaç:** Bir brief'in durumu "blokeli" olarak tespit edildiğinde lead'e otomatik Slack DM gönder.

**Tetikleyici:** Canvas'taki brief satırında durum = "🔴 Blokeli" veya "blokeli" ise VE:
- `~/benseno-tasarim-sistemi/data/blokeli-notified.json` dosyasında bu brief'in `ts` değeri YOK ise (idempotent)

**Akış:**
1. Canvas'taki brief listesini parse et
2. `durum == "blokeli"` olan brief'leri filtrele
3. Her biri için `blokeli-notified.json`'a bak — daha önce DM gönderildiyse atla
4. DM gönderilmemişse → brief'in `lead` kullanıcısına Şablon 29 DM at
5. `blokeli-notified.json`'a `{ts, marka, baslik, notified_at}` kaydet

**Dosya formatı (`data/blokeli-notified.json`):**
```json
[
  {"ts": "1234567890.123456", "marka": "Bauhaus", "baslik": "Sosyal medya paketi", "notified_at": "2026-05-25T08:15:00"}
]
```

**İdempotent:** Aynı brief için bir kez DM gönderilir. Durum "blokeli" → başka bir şeye geçince bir sonraki blokeli dönemde tekrar DM gönderilir (ts bazlı değil, ts+durum_degisim_tarihi bazlı tutmak mümkün ama basit versiyon: 24 saat sonra tekrar blokeli olursa yeni DM).

**Basit versiyon:** Notified listesini `notified_at`'e göre 24 saat sonra otomatik temizle — böylece uzun süre blokeli kalan brief'ler her gün 1 kez DM atar.

**Mod kontrolü:** `current_mode == "silent_log_only"` ise DM atma, sadece log'a yaz.

---

### Şablon 29 — Blokeli Brief DM (v7.14)

**Alıcı:** Brief'in lead kullanıcısı  
**Koşul:** Brief durumu "blokeli" olarak tespit edildi, daha önce DM gönderilmedi

```
🔴 *{{Marka}} · {{İş başlığı}}* blokeli olarak işaretlendi.

*Ne engel var?*
Bu brief'i ilerletmek için kime ihtiyacın var veya ne eksik?

Eğer çözüldüyse → brief'e ✅ reaksiyonu koy veya durumu güncelle.
Eğer devam ediyorsa → #benseno-grafik kanalında "@yönetici" ile müdahale iste.

[Brief'e git]({{permalink}})
```

---

## ÇIKTI
```
Brief Sync v7.13 OK · :15/:45
Format parser: v7.12_workflow={N} manuel_fallback={F}
Marka türetme: kanal={N} çelişki={C}
Departman: ilk_satır={A} heuristic={B} belirsiz={C}
UTC→TR çeviri: {N} brief
🎨 {N}/{N}/{N} · ✍️ {N}/{N}/{N} · 🤖 {N}/{N}/{N}
v7.12 Otomatik öncelik: 🔴={A} 🟠={B} 🟡={C} 🟢={D}
v7.12 Yön. override: 🔴={A} 🟠={B} 🟡={C} 🟢={D}
v7.12 Geçmiş tarih: yeni={N} teyitli={C} bekleyen={B}
v7.12 Saat eksik (aynı gün): {N} · Mesai dışı: {N}
v7.13 Marka kıyas: mode={silent_log_only|active} yetersiz_süre={A} anormal_uzun={B} yeterli_veri_yok={C} high_conf={H} medium_conf={M}
v7.14 Blokeli DM: gönderilen={N} atlanan={S} (daha önce notified)
SLA: 4h={N} 8h={N} 24h={N} · GitHub: pushed {sha[:7]}
PAT: {days}/90
🔗 Ref:{N} · 📎 Dosya:{N} · 💬 Not:{N}
🚫 Blocker:{N} · ⏰ Sessiz:{N} · 🔄 Sıralı:{N}
P7-C1/C2/C3 · 🔒 Force:{N} · 👻 Ghost:{N}
Thread→Parent:{N} · 🔴+@auto:{N} · Eren OOO:{N}
Pelin atama:{N}
Dashboard: https://bensenoint.github.io/benseno-tasarim-sistemi/
```

## HATA KURTARMA
- 5 parser fail → editöre Şablon 8
- Departman tespit edilemedi → Şablon 23 (varsayılan: Tasarım)
- UTC parse fail → orijinal string kaydet, dashboard'da "?" gösterilir
- Marka türetme fail → fallback Title Case
- Editor/FAQ kanalında brief → atla (sessiz)
- Canvas/Calendar/DM fail → log, devam
- GitHub push fail → 401/403'te Görkem'e DM

## MALİYET v7.13
20 run/gün · ~58-150 saniye (v7.12 + marka_stats okuma + 39 marka kıyaslama + Şablon 27/28 üretimi) · ~$1.8-4.0/gün

**E3 ek maliyet:** marka_stats.json okuma çok hızlı (lokal file ~10ms), 39 marka kıyaslama negligeable. Asıl maliyet Şablon 27/28 DM gönderiminde — silent mode'da bu DM'ler atılmadığı için maliyet artmaz. 1 Haziran'dan sonra DM sayısına bağlı olarak ~5-15sn ek.