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

## CHANNEL → MARKA MAPPING (35 marka)
```
marka-bauhaus → Bauhaus
marka-beta → Beta
marka-cimporglobal → Cimporglobal
marka-cureffect → Cureffect
marka-efor-ofçay → Efor (Ofçay)
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
marka-preby → Preby
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
- `LAST_SYNC_TS`'yi canvas footer'dan oku

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

### 5. live-data.json Üret

`~/benseno-tasarim-sistemi/dashboard/app/live-data.json` dosyasına yaz:
```json
{
  "bns_briefs": [...],
  "bns_completed": [...],
  "bns_brands": [...],
  "bns_users": [...],
  "bns_dept_stats": {
    "tasarim": { "name": "Tasarım", "people": N, "active": N, "overdue": N, "capacity": N, "completed30": N, "avgComplete": N, "revRate": N },
    "editor":  { "name": "Editör",  "people": N, "active": N, "overdue": N, "capacity": N, "completed30": N, "avgComplete": N, "revRate": N },
    "ai":      { "name": "AI",      "people": N, "active": N, "overdue": N, "capacity": N, "completed30": N, "avgComplete": N, "revRate": N }
  },
  "bns_brand_stats": [...],
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
  "new_briefs": [...],          // yeni eklenen brief'ler
  "past_deadline": [...],       // GEÇMİŞ flag'li brief'ler
  "past_confirmed": [...],      // teyit edilmiş geç brief'ler
  "saat_eksik": [...],          // saat eksik brief'ler
  "dept_belirsiz": [...],       // departman belirsiz brief'ler
  "marka_yetersiz_sure": [...], // E3 yetersiz süre flag'li
  "marka_anormal_uzun": [...],  // E3 anormal uzun flag'li
  "calendar_events": [...]      // eklenecek calendar event'ları
}
```

## Çıktı (tek satır)
```
Data Agent OK · {N} aktif brief · {N} yeni · cache:{hit|miss} · canvas:{updated|skip}
Format: workflow={N} manuel={F} · Dept: ilk_satır={A} heuristic={B} belirsiz={C}
UTC→TR: {N} · Öncelik: 🔴={A} 🟠={B} 🟡={C} 🟢={D} · Override: {N}
Geçmiş: yeni={N} teyitli={C} · Saat_eksik={N} · E3: mode={X} sapma={N}
```
