# Ody Slack DM Diyaloğu (Tasarım)

**Tarih:** 2026-07-09 · **Karar (Görkem):** DM yanıtları okunsun, kaydedilsin VE aksiyon alınsın.

## Mimari
- **api.js:** /api/chat çekirdeği `odyChatRun({user, isAdmin, msgs, range, kanal})` fonksiyonuna çıkarılır (davranış birebir). Yeni `POST /api/ody-dm` (writeGuard, x-bns-token): {slack_id, text} → kullanıcı embedded bns_users'tan çözülür (rol=yonetici → isAdmin), sunucu-bellek DM geçmişi (kişi başına son 10 mesaj, 2 saat TTL) ile odyChatRun çağrılır, yanıt döner.
- **slack-bot.js:** message event'inde channel_type='im' + bot değil + subtype yok → /api/ody-dm'e ilet, dönen yanıtı DM'e yaz. "help" istisnası korunur.
- **Aksiyonlar:** Ody'nin MEVCUT araç seti aynen geçerli — durum sorgu/değişiklik, slack_gonder (önizleme+onay, reqSeq dashboard ile ORTAK sayaçta), yetki kapıları ctx.user üzerinden aynı.
- **Kayıt:** ody_chat_log'a kanal kolonu (migration 0018, default 'dashboard'; DM → 'slack-dm').

## Güvenlik
- Kimlik: Slack event.user = doğrulanmış Slack kimliği; embedded'da yoksa "seni tanıyamadım" yanıtı, LLM çağrısı yok.
- Yetki: dashboard ile aynı (yönetici-özel bilgiler yönetici olmayana verilmez).
- Bot kendi mesajına cevap vermez (bot_id/subtype filtresi) → döngü yok.

## Kapsam dışı
- Proaktif DM başlatma (ayrı faz). Kanal mesajlarında Ody diyaloğu (yalnız DM).
