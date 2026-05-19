---
name: benseno-reaction-override
description: Yönetici reaction override'ını anlık işler. Slack Bot'un reaction_added event'inden çağrılır. Canvas'taki ilgili brief satırını bulur, önceliği günceller, Canvas'ı full replace ile yeniden yazar.
---

# Benseno — Reaction Override (Anlık İşlem)

Bu skill Slack Bot tarafından şu formatta çağrılır:
`Skill: benseno-reaction-override — brief_ts: {ts} kanal: {channel} emoji: {emoji} yonetici: {user_id} saat: {HH:MM}`

## Görev

1. Canvas'ı oku — **CACHE ÖNCELİKLİ (token tasarrufu):**
   - `~/benseno-tasarim-sistemi/data/canvas_cache.md` dosyasını kontrol et
   - Dosya varsa ve 30 dakikadan yeni ise → cache'i kullan, `slack_read_canvas` ÇAĞIRMA
   - Cache yoksa veya eskiyse → `slack_read_canvas` çağır, sonucu cache'e yaz
2. `brief_ts` ile eşleşen brief satırını bul:
   - Canvas'taki her brief satırında "Açılan Taraf" veya "Mesaj TS" sütununda timestamp tutuluyorsa direkt eşleştir.
   - Yoksa: yakın zamanda (son 30 dakika içinde) eklenen, öncelik sütunu değişmemiş brief'i tespit et.
3. İlgili brief satırının **Öncelik** sütununu güncelle → `{emoji}` (🔴/🟠/🟡/🟢)
4. **Override Geçmiş** sütununa ekle: `{emoji}Yön{saat}` (örn: `🔴Yön14:23`)
   - Mevcut geçmişin üzerine yaz (son override kazanır, ama eski de görünsün): `{yeni} / {eski}`
   - Max 2 geçmiş kayıt tut, daha eskisini sil.
5. Canvas'ı **full replace** ile yeniden yaz (section_id KULLANMA).

## Kurallar

- Canvas'a H1 başlık YAZMA.
- `slack_update_canvas`'ta `section_id` parametresi ASLA geçme.
- Aktif İşler tablosu 11 sütun, Tamamlanan İşler 12 sütun — KARIŞTIRMA.
- Override log satırı: `[{tarih} {saat}] OVERRIDE: brief={ts} emoji={emoji} yonetici={user_id}` → `~/benseno-tasarim-sistemi/logs/reaction-override.log`

## Eşleştirme Yapılamazsa

Canvas'ta eşleşen brief bulunamazsa:
- Log'a yaz: `[{tarih}] UYARI: brief_ts={ts} için eşleşme bulunamadı`
- İşlemi sonlandır, Canvas'a dokunma.

## Araçlar

```
mcp__claude_ai_Slack__slack_read_canvas   (canvas_id: F0B1B6XUD44)
mcp__claude_ai_Slack__slack_update_canvas (canvas_id: F0B1B6XUD44, content: <FULL MARKDOWN>)
```
