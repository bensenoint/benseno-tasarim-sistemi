---
name: benseno-data-agent
description: v1.0 · Veri katmanı. Canvas okuma/yazma, brief parse, queue işleme, canvas_cache.md ve live-data.json üretimi. Notification ve Dashboard agent'larının girdi kaynağı.
---

# Benseno Data Agent v1.0

Kaynak: benseno-brief-sync SKILL.md v7.13'ten bölündü.

## Görev
Canvas'ı oku → yeni brief'leri bul ve parse et → Canvas'ı güncelle → live-data.json üret.

## Sabitler
```
CANVAS_ID          = F0B1B6XUD44
CANVAS_CACHE       = ~/benseno-tasarim-sistemi/data/canvas_cache.md
CANVAS_CACHE_TTL   = 30dk
BRIEF_QUEUE        = ~/benseno-tasarim-sistemi/data/brief-queue.json
LIVE_DATA          = ~/benseno-tasarim-sistemi/dashboard/app/live-data.json
MARKA_STATS        = ~/benseno-tasarim-sistemi/data/marka_stats.json
TIMEZONE           = Europe/Istanbul (UTC+3)
WORKFLOW_BOT_NAME  = "Yeni Brief Aç"
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
Editor/FAQ kanalları (`*-editors`, `*-faq` suffix) → atla.

## 3 DEPARTMAN
**🎨 Tasarım (7, 📋):** Aylin (U0AN6DD79M0), Aykut (U06J26R1XCJ), Hasan Serdar (U09BFPBKQG7), Pelin (U0B3K2WE7SB), İpek (U055EDESLSE), İrem (U0AK8U7L57F), Serhat (U08HLMHTGEL)
**✍️ Editör (8, ✍️):** Cansu (U4XCE3532), erdem (U02SZQDAFPF), Eda T (U09BZHR25NG), Eda A (U07PV0RA9L2), Melis (U08NQJ27G5S), Aylin C (U05PP70GQTX), Buse (U063T8M5HL4), Simge (U0AAC3YK20G)
**🤖 AI (1, 🤖):** Eren (U0AP31SAA1W)

## YÖNETİCİLER (5)
U030C48PL23 Görkem · UD96GH76E Reyhan · U4XCE3532 Cansu · U055EDESLSE İpek · U02SZQDAFPF erdem

---

## ADIM ADIM

### 1. Canvas Oku — Cache Öncelikli

`canvas_cache.md` dosyasını kontrol et:
- Varsa ve <30dk ise → cache'den oku, `slack_read_canvas` ÇAĞIRMA
- Yoksa veya >30dk ise → `slack_read_canvas(F0B1B6XUD44)` çağır, cache'i güncelle
- `LAST_SYNC_TS`'yi oku — **kaynak önceliği:**
  1. **Headless bulut modda** (`$GITHUB_ACTIONS==true` VEYA `$RAILWAY_ENVIRONMENT` set): `data/agent-state.json` → `last_sync_ts` alanı varsa ONU kullan (bulutta ilerleyen tracked watermark; Canvas write-back atlandığı için Canvas footer'ı bulutta donar). Yoksa Canvas footer'a düş.
  2. **Mac modda:** Canvas footer'dan oku (mevcut davranış).

### 2. Yeni Brief'leri Ara — Queue Öncelikli

**Önce** `brief-queue.json` oku:
- Doluysa → sadece queue'daki brief'leri işle (Slack taraması YAPMA)
- Boşsa → fallback: `slack_search_public` query: `in:#marka-*` after:LAST_SYNC_TS limit:30

Queue entry formatı: `{ts, channel, text, user, is, queued_at}`
İşlendikten sonra queue'yu temizle: `[]` yaz.

### 3. Her Brief İçin Parse

#### 3a. Marka türet
`channel_id` → kanal adı → mapping tablosu → kanonik marka adı.

#### 3b. Brief mi?
- Workflow: `bot_id` veya `🎀 İş:` imzası
- Manuel fallback: ilk satır `📋/✍️/🤖` ile başlıyor

#### 3c. Field-by-field parse (Workflow format v7.12)
| Field | Regex |
|---|---|
| İş özeti | `^🎀\s*İş:\s*(.+)$` |
| Süre | `^⏰\s*Süre:\s*(.+)$` |
| Atananlar | `^👷\s*Kim:\s*(.+)$` |
| İş tipi | `^🏷️\s*Tip:\s*(.+)$` |
| Akış | `^🔄\s*Akış:\s*(.+)$` |
| Ref | `^🔗\s*Ref:\s*(.+)$` |
| Not | `^💬\s*Not:\s*(.+)$` |
| Submitter | `^🐷\s*Kimden:\s*<@(U\w+)>` |

#### 3d. Departman tespiti
1. İlk satırda 📋/✍️/🤖 → kullan
2. Yoksa atanan heuristic (Eren=🤖, editör listesi=✍️, diğer=📋)
3. Belirsizse → Notification Agent'a flag: `dept_belirsiz=true` (Şablon 23 DM)

#### 3e. UTC → TR çeviri
`May 21st, 2026 at 4:05 PM UTC` → `21 Mayıs 2026 19:05 TR`

#### 3f. Otomatik öncelik (v7.12)
`delta_hours = (deadline_unix - now_unix) / 3600`
- `≤ 0` → 🔴 + GEÇMİŞ flag
- `0 < delta ≤ 8` → 🔴 Acil
- `8 < delta ≤ 24` → 🟠 Yüksek
- `24 < delta ≤ 72` → 🟡 Normal
- `> 72` → 🟢 Düşük
Saatsiz brief: deadline.date 23:59 TR üzerinden.

#### 3g. Yönetici reaction override (v7.12)
Brief mesajının reaction'larını oku. Yönetici listesinden biri `🔴/🟠/🟡/🟢` eklemişse önceliği override et. Geçmiş sütununa `🔴Yön15:30` kaydet. Yönetici dışı reaction yoksay.

#### 3h. Validation flag'leri
- `saat_eksik`: deadline bugün AND saat yok → flag
- `gecmis_tarih`: deadline < now → flag
- `gecmis_teyit`: thread'de `✅ ok` / `teyit` veya ✅ reaction → confirmed flag
- `mesai_disi`: saat < 08:00 veya > 17:30 → flag

#### 3i. Marka davranış kıyaslaması (v7.13 — E3)
`marka_stats.json` oku:
- `config.current_mode` kontrol et (`silent_log_only` | `active`)
- `now >= config.active_from` ise mode'u `active` yap, dosyayı güncelle
- `brands[marka]` → `n < 3` ise atla
- `deadline_days` → medyan ± 1×MAD kontrolü
- Flag: `yetersiz_sure` veya `anormal_uzun`
- Güven: `n >= 10` high, `3 ≤ n < 10` medium
- `silent_log_only` modda sadece log, DM yok

### 4. Canvas'a Yaz — Full Replace

Değişiklik yoksa `slack_update_canvas` ÇAĞIRMA (idempotent kontrol).

Canvas yapısı (14 sütun): No | Dept | Marka | İş | Atanan | Editör | Öncelik | Deadline | Saat | Durum | Rev | Geçmiş | Link | Notlar

Footer: `> 🔄 Son sync: {şimdi TR} · LAST_SYNC_TS={unix}`

### 4b. Tamamlananlar — Galeri Görselleri

Canvas'ın **"Tamamlananlar"** tablosunu parse et (aktif brief tablosunun altında ayrı tablo):

**Adımlar:**
1. Canvas cache'den "Tamamlananlar" bölümünü bul
2. Her satırdan şunları çıkar:
   - No, Marka, İş adı, Atanan, Deadline, Tamamlanma tarihi, Rev sayısı
   - **Link sütunu** → `slack_url` (Slack thread URL, `[link](https://...)` formatı)
3. `bns_completed` array'ini oluştur — max 20 kayıt, en yeni önce

**Slack thread'den görsel çekme (kritik):**
```
Her completed brief için (max son 12 brief):
  slack_url boşsa → image_url = null, atla
  slack_url doluysa:
    ts = URL'den çıkar (son /p{ts} kısmı → ts formatına çevir: "1234567890.123456")
    channel_id = URL'deki /archives/{channel_id}/ kısmı
    slack_read_thread(channel_id, ts) çağır
    Thread mesajlarında dosya eki ara:
      Tüm mesajlardaki files[] listesini topla
      mimetype "image/*" (png, jpg, gif, webp) olanları filtrele — video atla
      → En SON yüklenen görseli al (kronolojik sıraya göre)
      
      Görsel public URL üretimi:
      1. Slack API'den file metadata'sını al (file.url_private_download)
      2. curl veya wget ile görseli indir:
         curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" "{url_private_download}" -o \
           ~/benseno-tasarim-sistemi/dashboard/app/gallery/{no}.jpg
      3. ~/benseno-tasarim-sistemi/app/gallery/{no}.jpg konumuna da kopyala (rsync zaten yapar değil)
      4. image_url = "app/gallery/{no}.jpg" (GitHub Pages'te public)

  Görsel yoksa (sadece video veya dosya yok) → image_url = null
    Bulunmazsa → image_url = null
```

**Hız notu:** Thread çağrıları sıralı yapılır (rate limit). 12'den fazla tamamlanan varsa sadece en yeni 12'si için görsel çek, geri kalanlar image_url=null.

**bns_completed kayıt formatı:**
```json
{
  "no": 10,
  "marka": "Bauhaus",
  "baslik": "Bahçe Düzen / 22 Mayıs",
  "leadId": "U0AN6DD79M0",
  "contribIds": [],
  "deadline": 1747872000000,
  "baslangic": 1747785600000,
  "bitis": 1747958400000,
  "revision": 0,
  "rating": null,
  "slack_url": "https://benseno.slack.com/archives/C.../p...",
  "image_url": "https://files.slack.com/files-pri/...",
  "notes": ""
}
```

### 5. live-data.json Üret

`~/benseno-tasarim-sistemi/dashboard/app/live-data.json` dosyasına yaz:
```json
{
  "bns_briefs": [...],
  "bns_completed": [...],
  "bns_brands": [...],
  "bns_users": [
    { "id": "U030C48PL23", "name": "Görkem Kaya",      "rol": "yonetici", "initials": "GK", "color": "#7C3AED" },
    { "id": "U4XCE3532",   "name": "Cansu Kazgan 👑",  "rol": "editor",   "initials": "CK", "color": "#10B981" },
    { "id": "U09BFPBKQG7", "name": "Hasan Serdar Arda","rol": "tasarim",  "initials": "HA", "color": "#6366F1" },
    ...tüm aktif ekip üyeleri (YÖNETİCİLER dahil — U030C48PL23 Görkem HER ZAMAN dahil edilmeli)
  ],
  // bns_users formatı: her user { id, name, rol (tasarim|editor|ai|yonetici), initials, color, avatar? }
  // YÖNETİCİLER (her zaman dahil et): U030C48PL23 Görkem, UD96GH76E Reyhan
  "bns_dept_stats": {
    "tasarim": { "name": "Tasarım", "people": N, "active": N, "overdue": N, "capacity": N, "completed30": N, "avgComplete": N, "revRate": N },
    "editor":  { "name": "Editör",  "people": N, "active": N, "overdue": N, "capacity": N, "completed30": N, "avgComplete": N, "revRate": N },
    "ai":      { "name": "AI",      "people": N, "active": N, "overdue": N, "capacity": N, "completed30": N, "avgComplete": N, "revRate": N }
  },
  "bns_brand_stats": [...],
  "bns_history": [
    // data/agent-state.json dosyasını oku → history[] (1 kayıt/gün, eski→yeni)
    // Son 14 kaydı al (zaten günlük, ~3 hafta), yoksa [] gönder
    // Her eleman: { "ts": <unix>, "date": "YYYY-MM-DD", "active": N, "overdue": N, "dm_sent": N, "errors": N, "ok": true|false }
  ],
  "bns_activity": [
    // GERÇEK aktivite akışı (P3.2) — Geçmiş ekranı bunu gösterir (yoksa mock).
    // Bu run'da gözlemlenen olaylardan en yeni ~20 olay (yeni→eski). Şekil:
    //   { "t": <unix_ms>, "who": "<user_id>", "verb": "<fiil>", "target": "<marka · iş>", "meta": "<ops>" }
    // Kaynaklar (mevcut verilerden, ek Slack çağrısı GEREKMEZ):
    //   • Tamamlananlar (bns_completed): t=bitis(ms), who=leadId, verb="tamamladı", target="{marka} · {baslik}"
    //   • Bu run yeni brief'ler (new_briefs): t=now_ms, who=atanan[0]||opener, verb="yeni brief açtı", target="{marka} · {is}"
    //   • Threshold geçişleri: t=now_ms, who="U030C48PL23", verb="öncelik değişti", target, meta="{prev}→{yeni}"
    // who bilinmiyorsa atla. En fazla 20 olay, t'ye göre azalan sırada.
  ],
  "last_sync": "<ISO timestamp>",
  "sync_ts": <unix>,
  "source": "data-agent-run-{unix}"
}
```
**UYARI:** `bns_dept_stats` boş `{}` gönderme — mock data devreye girer.

### 6. Notification Agent için flag dosyası yaz

`data/notification-flags.json` dosyasına yaz (Notification Agent bunu okur):
```json
{
  "mode": "active",             // config.current_mode (active | silent_log_only)
  "new_briefs": [...],          // yeni eklenen brief'ler
  "past_deadline": [...],       // GEÇMİŞ flag'li brief'ler
  "past_confirmed": [...],      // teyit edilmiş geç brief'ler
  "saat_eksik": [...],          // saat eksik brief'ler
  "dept_belirsiz": [...],       // departman belirsiz brief'ler
  "marka_yetersiz_sure": [...], // E3 yetersiz süre flag'li
  "marka_anormal_uzun": [...],  // E3 anormal uzun flag'li
  "calendar_events": [...],     // eklenecek calendar event'ları
  "escalation": [...],          // geciken brief'ler (gecikme tırmanması — aşağıda)
  "blokeli": [...]              // durumu blokeli olan brief'ler
}
```

**`escalation[]` üretimi** — `delta_hours ≤ 0` VE `durum ≠ tamamlandı` olan her brief için:
```json
{ "ts": "<brief slack ts>", "no": 20, "marka": "Bauhaus", "is": "Sosyal medya",
  "lead_id": "U0AN6DD79M0", "lead_role": "tasarim",   // bns_users'tan rol lookup
  "deadline_str": "21 Mayıs 17:00 TR", "permalink": "<slack_url>",
  "gecikme_h": 26 }                                     // = (now_unix - deadline_unix)/3600, tam saat
```
- `lead_role`: lead_id'nin `bns_users` rol'ü (tasarim|editor|ai). Belirsizse "tasarim".
- Notification Agent eşik + idempotency'yi yönetir; Data Agent yalnızca veriyi sağlar.

**`blokeli[]` üretimi** — durumu "blokeli" (🔴 Blokeli) tespit edilen brief'ler aynı şekil (`gecikme_h` opsiyonel). Headless modda Canvas'a yazılmadığı için blokeli durumu yalnızca DM tetikler (dashboard Blokeli kolonu `bns_briefs.durum`'dan beslenir).

## Çıktı (tek satır)
```
Data Agent OK · {N} aktif brief · {N} yeni · cache:{hit|miss} · canvas:{updated|skip}
Format: workflow={N} manuel={F} · Dept: ilk_satır={A} heuristic={B} belirsiz={C}
UTC→TR: {N} · Öncelik: 🔴={A} 🟠={B} 🟡={C} 🟢={D} · Override: {N}
Geçmiş: yeni={N} teyitli={C} · Saat_eksik={N} · E3: mode={X} sapma={N}
```

---

## HEADLESS BULUT ORTAMI — Slack curl fallback (v1.2)

**Tetikleyici:** `$GITHUB_ACTIONS` == `"true"` **VEYA** `$RAILWAY_ENVIRONMENT` set (Railway container — bugünkü canlı ortam). Bu modda Slack MCP sunucusu YOK — `mcp__slack__*` tool'ları çağırma, aşağıdaki curl eşdeğerlerini kullan. Token: `$SLACK_BOT_TOKEN` (env). HALT ETME — curl ile devam et.

### Canvas OKU (slack_read_canvas yerine)
```bash
URL=$(curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/files.info?file=F0B1B6XUD44" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['file']['url_private'])")
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" "$URL" > /tmp/canvas.html
```
Dönen içerik **quip HTML** (markdown değil). İçinde 2 `<table>` var:
- 1. tablo = Aktif brief'ler, sütunlar: `Marka | İş | Öncelik | Saat (TR) | Atanan | Durum`
- 2. tablo = Tamamlananlar
`<tr>`/`<td>` satırlarını parse et. Footer'daki `LAST_SYNC_TS` değerini de HTML'den çıkar. (HTML entity'leri decode et: `&amp;`→`&` vb.)

### Yeni brief tespiti (slack_search_public yerine)
Önce `brief-queue.json` oku (Mac slack-bot doluysa). Queue boşsa veya Mac kapalıysa, her `#marka-*` kanalında:
```bash
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/conversations.history?channel={CHANNEL_ID}&oldest={LAST_SYNC_TS}&limit=100"
```
**Pagination ZORUNLU:** Yanıtta `response_metadata.next_cursor` doluysa, boşalana dek `&cursor={next_cursor}` ile devam çek. `limit=100` tek sayfada yetmezse (donmuş watermark + Mac uzun kapalıyken kanal birikir) brief kaybını önler.
Kanal ID → marka mapping için channel listesini al: `conversations.list?types=public_channel,private_channel&limit=200`

### Thread oku (slack_read_thread yerine)
```bash
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/conversations.replies?channel={CHANNEL_ID}&ts={TS}&limit=50"
```

### Canvas GÜNCELLE (slack_update_canvas yerine) — BAYRAK KONTROLLÜ (P3.3)

**Varsayılan: ATLA.** Geri-yazma yalnızca `data/agent-state.json → canvas_writeback === true` ise yapılır. Bayrak yok/false ise (varsayılan) headless'ta Canvas'a YAZMA — format dönüşümü (HTML↔markdown) + 16 kişinin kullandığı production Canvas bozma riski.

> ⚠️ **Açmadan önce gözetimli test ZORUNLU.** İlk açıkken bir run'ı canlı izle (Canvas snapshot'ını önce yedekle). Kurallar: H1 ekleme, `section_id` kullanma, footer `LAST_SYNC_TS`'i koru, EMBEDDED_DATA bloğunu AYNEN bırak, full-replace yerine yalnızca tablo satırlarını güncelle. Bozulma görürsen bayrağı kapat.

**Bayrak true ise** — `canvases.edit` curl ile (yalnızca öncelik etiketi/durum sütunlarını güncelle):
```bash
curl -s -X POST "https://slack.com/api/canvases.edit" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" -H "Content-Type: application/json" \
  -d '{"canvas_id":"F0B1B6XUD44","changes":[{"operation":"replace","document_content":{"type":"markdown","markdown":"<TAM güncel markdown — footer+EMBEDDED_DATA korunmuş>"}}]}'
```
Yanıt `"ok":false` ise log'la, **HALT etme**, live-data.json akışına devam et.

**Her durumda (bayrak ne olursa olsun):**
- live-data.json'u güncelle + push et (asıl dashboard kaynağı budur)
- **WATERMARK PERSIST (ZORUNLU):** Canvas'a yazmadığın için, bu run'da gördüğün **en yeni brief mesajının `ts`'ini** (yoksa şu anki unix zamanı) `data/agent-state.json` → `last_sync_ts` alanına yaz + commit et. Sonraki headless run bunu okuyup ilerletir. **Bu adım atlanırsa watermark bulutta donar → kanal >100 mesaj birikince brief sessizce kaybolur.** agent-state.json'un diğer alanlarını koru (oku→merge→yaz).
- Log'a yaz: `Canvas write-back: skipped (headless mode) · last_sync_ts→{unix} (agent-state.json)`
- Auto-öncelik recalc + reaction override'lar live-data.json'a YANSIR (dashboard doğru), sadece Slack Canvas etiketleri güncellenmez (kozmetik, Mac açılınca senkronlanır)

### Git push — orchestrator akışında PUSH ETME
**Orchestrator tarafından çağrıldığında (normal durum) burada `git push` YAPMA.** Sonda Dashboard Agent tüm değişiklikleri (live-data.json + index.html + data/ state dosyaları) tek seferde konsolide edip rebase+retry ile push eder. Burada ayrıca push etmek tek run'da çift push = gereksiz yarış yüzeyi yaratır. Değişiklikleri working tree'de bırak, devam et.

Sadece data-agent **tek başına** (orchestrator olmadan) çalıştırıldıysa push gerekir:
```bash
for i in 1 2 3; do
  if git pull --rebase -X theirs origin main && git push origin main; then break; fi
  git rebase --abort 2>/dev/null || true; sleep 3
done
```
(remote zaten BENSENO_GITHUB_PAT ile yapılandırılmış — workflow git config step. PAT dosyası `data/.github-pat-sistem` Actions'ta YOK, okumaya çalışma.)
