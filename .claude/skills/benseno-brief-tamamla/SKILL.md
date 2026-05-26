---
name: benseno-brief-tamamla
description: Slack Bot'un "Tamamlandı" butonundan çağrılır. Canvas'taki ilgili brief satırını Tamamlanan İşler tablosuna taşır, atanan tasarımcıya ephemeral DM gönderir.
---

# Benseno — Brief Tamamla

Bu skill Slack Bot tarafından şu formatta çağrılır:
`Skill: benseno-brief-tamamla — no: {brief_no} tasarimci: {user_id}`

## Görev

1. **Canvas'ı oku** — CACHE ÖNCELİKLİ:
   - `~/benseno-tasarim-sistemi/data/canvas_cache.md` dosyasını kontrol et
   - Dosya varsa ve 30 dakikadan yeni ise → cache'i kullan
   - Cache yoksa veya eskiyse → `slack_read_canvas` çağır (canvas_id: F0B1B6XUD44), sonucu cache'e yaz

2. **Brief'i bul** — Aktif İşler tablosunda `no` alanı `{brief_no}` olan satırı bul
   - Satır yoksa: log'a yaz, işlemi sonlandır

3. **Canvas'ı güncelle** — Full replace ile:
   - Bulunan satırı Aktif İşler tablosundan **kaldır**
   - Aynı satırı Tamamlanan İşler tablosuna **ekle** (Tamamlanma sütununa şimdiki tarihi yaz: `GG Ay · SS:DD`)
   - Aktif İşler tablosu 11 sütun, Tamamlanan İşler 12 sütun olduğuna dikkat et

4. **Tasarımcıya bildirim** — `slack_send_message` ile {user_id}'ye DM:
   ```
   ✅ Brief #{brief_no} tamamlandı olarak işaretlendi. Canvas güncellendi.
   ```

5. **Log** — `~/benseno-tasarim-sistemi/logs/brief-tamamla.log`:
   ```
   [{tarih} {saat}] TAMAMLANDI: no={brief_no} tasarimci={user_id}
   ```

## Kurallar

- Canvas'a H1 başlık YAZMA
- `slack_update_canvas`'ta `section_id` parametresi ASLA geçme
- Aktif İşler tablosu 11 sütun, Tamamlanan İşler 12 sütun — KARIŞTIRMA
- Bu skill sadece Canvas günceller; `notifications-sent.json` ve `live-data.json` bir sonraki orchestrator çalışmasında güncellenir

## Brief Bulunamazsa

- Log'a yaz: `[{tarih}] UYARI: no={brief_no} için Aktif İşler'de eşleşme bulunamadı`
- Tasarımcıya DM: `⚠️ Brief #{brief_no} aktif işler arasında bulunamadı. Zaten tamamlanmış olabilir.`
- Canvas'a dokunma

## Araçlar

```
slack_read_canvas    (canvas_id: F0B1B6XUD44)
slack_update_canvas  (canvas_id: F0B1B6XUD44, content: <FULL MARKDOWN>)
slack_send_message   (channel: {user_id}, text: ...)
```
