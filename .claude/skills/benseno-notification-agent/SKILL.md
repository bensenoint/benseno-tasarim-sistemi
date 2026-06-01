---
name: benseno-notification-agent
description: v1.0 · Slack bildirimleri katmanı. DM'ler, thread cevapları, kanal mesajları, calendar events. Data Agent'ın ürettiği notification-flags.json'u okur.
---

# Benseno Notification Agent v1.0

Kaynak: benseno-brief-sync SKILL.md v7.13'ten bölündü.

## Görev
`data/notification-flags.json`'u oku → DM'leri, thread cevaplarını ve calendar event'larını gönder. İdempotent çalış — aynı DM ikinci kez gönderilmez.

## Sabitler
```
NOTIFICATION_FLAGS = ~/benseno-tasarim-sistemi/data/notification-flags.json
SENT_LOG           = ~/benseno-tasarim-sistemi/data/notifications-sent.json
GRAFIK_CHANNEL_ID  = C02SZRJGY0M
CALENDAR_ID        = gorkem@benseno.com.tr
TIMEZONE           = Europe/Istanbul (UTC+3)
```

## İdempotent Kontrol
Her DM/thread gönderiminden önce `notifications-sent.json` kontrol et:
- Aynı `{brief_ts + şablon_no}` kombinasyonu varsa → ATLA
- Yoksa → gönder + kaydet

Format: `[{brief_ts, template, sent_at, user_id}]`

---

## ADIM ADIM

### 1. notification-flags.json Oku
Dosya yoksa veya boşsa → çık (yapacak şey yok).

### 2. Yeni Brief'ler — DM atananlara

`new_briefs` listesindeki her brief için:

**Şablon 1 — Tasarımcıya atama DM**
```
📋 *{İş özeti}* — {Marka}
⏰ Deadline: {deadline TR}
🏷️ Tip: {iş tipi}
🔄 Akış: {Paralel/Sıralı}
💬 Not: {not}
[Mesaja git]({permalink})
```

**Şablon 2 — Sıralı atamada sıradaki kişi (önceki tamamlayınca)**
Sıralı iş: ilk kişiye "başla", ikinciye "sıran gelecek — {deadline} önceki bitirilirse"

**Şablon 18 — 🔴 + @auto uyarısı**
```
⚠️ 🔴 Acil brief'te @auto kullanma. Atananları manuel belirt.
```

**Şablon 19 — 🤖 brief + Eren OOO**
Eren OOO kontrolü: Calender'da bugün OOO event var mı?
Varsa: Görkem ve erdem'e DM: "Eren OOO — AI brief beklemede: {brief}"

### 3. Geçmiş Tarih — Thread + DM

`past_deadline` listesindeki her brief için (idempotent):

**Şablon 24 — Thread cevabı**
```
⚠️ *Deadline geçmiş bir tarih:* {date} ({delta_days} gün geride)

Yanlışlık ise:
• Yeni brief aç (doğru tarihle), bu brief'i sahibin force-close etsin (🔒)

Bilerek geç tarihli kayıt ise:
• Bu thread'e `✅ ok` veya `teyit` yaz → uyarı kalkar
• Veya brief'e ✅ reaction ekle

Sabah Raporu'na bugün şüpheli olarak girer.
```

**Şablon 25 — Brief açana DM**
```
⚠️ Az önce açtığın brief'te deadline geçmiş bir tarih:

*{İş özeti}* — {Marka}
Deadline: {date} ({delta_days} gün geride)
Kanal: <#{channel_id}>
[Mesaja git]({permalink})

Thread'inde teyit isteniyor (`✅ ok` veya ✅ reaction).
```

### 4. Saat Eksik — DM

`saat_eksik` listesindeki her brief için:

**Şablon 26 — Aynı gün saat eksik DM (brief açana)**
```
⏰ Az önce açtığın brief aynı gün teslim ama saat girilmemiş:

*{İş özeti}* — {Marka}
Deadline: {date} (bugün — saat yok)
[Mesaja git]({permalink})

Brief thread'ine `HH:MM` formatında saat yaz, veya yeni brief aç.
```

### 5. Departman Belirsiz — Editör DM

`dept_belirsiz` listesindeki her brief için:

**Şablon 23 — Departman belirsiz**
Hedef: erdem (U02SZQDAFPF)
```
📋 Departman tespit edilemedi — kontrol et:
*{İş özeti}* — {Marka}
[Mesaja git]({permalink})
```

### 6. E3 Marka Kıyas — DM (sadece active mode)

`marka_yetersiz_sure` listesindeki her brief için:

**Şablon 27 — Yetersiz süre DM (brief açana)**
```
📈 *{Marka} için bu deadline alışılmadık agresif*

*{İş özeti}* — {Marka}
Senin verdiğin deadline: *{deadline_days} gün*
{Marka} medyan (son 90 gün, {n} brief): *{median_dl}g* {(düşük güven) if medium}

Bilgilendirme amaçlı — blokaj değil.
[Mesaja git]({permalink})
```

`marka_anormal_uzun` listesindeki her brief için:

**Şablon 28 — Anormal uzun süre DM (brief açana)**
```
📊 *{Marka} için bu deadline alışılmadık geniş*

*{İş özeti}* — {Marka}
Senin verdiğin deadline: *{deadline_days} gün*
{Marka} medyan (son 90 gün, {n} brief): *{median_dl}g* {(düşük güven) if medium}

Büyük iş ise normal — iş tipini kontrol et.
[Mesaja git]({permalink})
```

### 7. Calendar Events

`calendar_events` listesindeki her event için:
- Google Calendar'a ekle: `{öncelik_emoji} {İş özeti} — {Marka}`
- Zaman: deadline saati (TR)
- Açıklama: permalink + atananlar

### 8. İhlal / SLA / Bottleneck / Stale Uyarıları

SLA aşımı (4h/8h/24h eşikleri geçildiyse):
- Yöneticilere DM veya #benseno-grafik kanalına mesaj

Stale brief (🔴>1g, 🟠>3g, 🟡>7g, 🟢>14g güncelleme yoksa):
- Brief satırına `STALE 🔴` gibi etiket → Data Agent'a flag geçir

### 8.5 Gecikme Escalation + Blokeli DM (P1.1)

`mode` alanı `silent_log_only` ise → DM ATMA, sadece log'a yaz. `active` ise gönder.

**Sorumlu yönetici eşlemesi** (lead_role → manager id):
`tasarim → U055EDESLSE (İpek)` · `editor → U02SZQDAFPF (erdem)` · `ai → U030C48PL23 (Görkem)` · belirsiz → `UD96GH76E (Reyhan)`
**5 yönetici (48h kademesi):** U030C48PL23, UD96GH76E, U4XCE3532, U055EDESLSE, U02SZQDAFPF

**`escalation[]`** içindeki her brief için (idempotency: `notifications-sent.json` `{ts, template}` — her kademe 1 kez):
- `gecikme_h ≥ 1` VE şablon 30 gönderilmedi → lead_id'ye **Şablon 30**
- `gecikme_h ≥ 24` VE şablon 31 gönderilmedi → sorumlu yöneticiye **Şablon 31**
- `gecikme_h ≥ 48` VE şablon 32 gönderilmedi → 5 yöneticiye DM + #benseno-grafik'e **Şablon 32**
- `gecikme_h ≥ 72` VE şablon 29 gönderilmedi → lead_id'ye **Şablon 29** (otomatik blokeli)

**`blokeli[]`** içindeki her brief için: şablon 29 gönderilmedi → lead_id'ye **Şablon 29**.

> Headless modda Canvas'a "blokeli" yazılmaz; 72h escalation yalnızca DM tetikler (dashboard Blokeli kolonu `bns_briefs.durum`'dan beslenir).

**Şablon 30 — Gecikme hatırlatma (lead'e, ≥1 saat)**
```
⏰ *{marka} · {is}* gecikiyor. Deadline {deadline_str} geçti ({gecikme_h} saat önce).
Bugün bitirebilir misin? Zorlanıyorsan yöneticine haber ver.
[Brief'e git]({permalink})
```

**Şablon 31 — Yönetici uyarısı (≥24 saat)**
```
⚠️ *Müdahale gerekiyor — {marka}* · *{is}* {gecikme_h} saattir gecikiyor.
👤 Atanan: <@{lead_id}> · 📅 Deadline: {deadline_str}
Öneri: atananla iletişime geç veya brief'i yeniden ata. [Brief'e git]({permalink})
```

**Şablon 32 — Kritik duyuru (≥48 saat — 5 yönetici DM + kanal)**
DM (her yöneticiye):
```
🚨 *Kritik gecikme — {marka}* · *{is}* {gecikme_h} saattir teslim edilmedi.
👤 Atanan: <@{lead_id}> · 📅 Deadline: {deadline_str}
72 saat dolunca sistem otomatik "blokeli" işaretler.
```
Kanal (#benseno-grafik):
```
🚨 *{marka} · {is}* — *{gecikme_h} saat gecikme* · Atanan: <@{lead_id}> · Acil müdahale.
```

**Şablon 29 — Blokeli brief DM (lead'e)**
```
🔴 *{marka} · {is}* blokeli olarak işaretlendi.
*Ne engel var?* İlerletmek için neye/kime ihtiyacın var?
Çözüldüyse → brief'e ✅ koy. Devam ediyorsa → #benseno-grafik'te "@yönetici" ile müdahale iste.
[Brief'e git]({permalink})
```

### 9. notifications-sent.json Güncelle
Tüm gönderimler tamamlandıktan sonra dosyayı kaydet (escalation/blokeli `{ts, template}` kayıtları dahil).

## Çıktı (tek satır)
```
Notification Agent OK · DM:{N} · Thread:{N} · Calendar:{N} · Esc(30/31/32/29):{a}/{b}/{c}/{d} · Blokeli:{N} · Atlandı(idempotent):{N}
```

---

## HEADLESS BULUT ORTAMI — Slack curl fallback (v1.2)

**Tetikleyici:** `$GITHUB_ACTIONS` == `"true"` **VEYA** `$RAILWAY_ENVIRONMENT` set (Railway container — bugünkü canlı ortam). Slack MCP YOK — `mcp__slack__*` çağırma, curl kullan. Token: `$SLACK_BOT_TOKEN`. HALT ETME.

### DM gönder (slack_send_message / DM yerine)
`chat.postMessage`'da `channel` alanına doğrudan USER_ID ver — Slack otomatik IM açar:
```bash
curl -s -X POST "https://slack.com/api/chat.postMessage" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel":"{USER_ID}","text":"{MESAJ}"}'
```
Yanıtta `"ok":true` → gönderildi. `"ok":false` ise `error` alanını logla.

### Kanal mesajı (#benseno-grafik)
```bash
curl -s -X POST "https://slack.com/api/chat.postMessage" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel":"C4Y43AW2E","text":"{MESAJ}"}'
```
(Not: `#benseno-grafik` kanal ID'sini `conversations.list` ile doğrula; gerekirse güncelle.)

### Thread cevabı
```bash
curl -s -X POST "https://slack.com/api/chat.postMessage" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel":"{CHANNEL_ID}","thread_ts":"{TS}","text":"{MESAJ}"}'
```

### Calendar event (Google MCP yerine) — ATLA
Actions'ta Google MCP yok. Calendar event oluşturmayı atla, log'a yaz: `Calendar: skipped (headless)`. (Calendar entegrasyonu Mac'te kalır.)

### İdempotentlik
`notifications-sent.json` Actions'ta repo'dan gelir (commit'liyse) — aynı DM ikinci kez gönderme kontrolü çalışır. Gönderim sonrası dosyayı güncelle + push akışına dahil et.
