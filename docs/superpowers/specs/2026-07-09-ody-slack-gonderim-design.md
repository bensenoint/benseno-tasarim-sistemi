# Ody → Slack Mesaj Gönderimi (Tasarım)

**Tarih:** 2026-07-09
**Bağlam:** Ody bugüne dek yalnız OKUYAN asistandı (slack_sorgu). Bu faz ilk YAZMA yeteneği: kullanıcı adına Slack'e mesaj. Kararlar (Görkem): 3 mod (thread + DM + kanal) · kademeli yetki · önizleme+onay.

---

## Araçlar (server/ody-tools.js)

### `slack_gonder` — önizleme üretir, GÖNDERMEZ
- Girdi: `{ mod: 'thread'|'dm'|'kanal', hedef, mesaj }` — hedef: iş no / kişi adı-ID / marka adı. mesaj ≤ 600 karakter.
- Yetki (sunucuda, ctx.ed + ctx.user ile):
  - **thread**: işin atananı (worker/lead) VEYA açanı VEYA yönetici
  - **dm / kanal**: yalnız yönetici
- Dönüş: `{ onay_gerekli: true, onay_kodu, onizleme }` — bekleyen gönderi kullanıcıya bağlı saklanır (10 dk TTL).

### `slack_gonder_onayla` — gerçek gönderim
- Girdi: `{ onay_kodu }`.
- **Sunucu-tarafı onay garantisi:** bekleyen kayıt, oluşturulduğu /api/chat isteğinin sıra numarasını (reqSeq) taşır; onay çağrısı ancak **daha sonraki bir kullanıcı isteğinde** (reqSeq büyükse) geçerlidir → LLM aynı turda önizleme+onayı zincirleyip onayı bypass EDEMEZ.
- Gönderim: mevcut `server/slack.js` (postThread / dm / postBrief-kanal). server-local — dashboard bağımlılığı yok (502 kuralı).

## Güvenlik çerçevesi

- **İmza zorunlu:** her mesaj `🤖 Ody — {Kullanıcı Adı} adına:\n` önekiyle gider (anonim/sahte konuşma imkânsız).
- **Hız limiti:** kullanıcı başına 10 gönderim/saat (bellek-içi; aşımda araç hata döner).
- **Denetim logu:** her gönderim console'a `[ody-gonder] uid → mod:hedef` (kim/nereye/ne).
- **Sistem yönergesi:** "slack_gonder'ı YALNIZ kullanıcı açıkça mesaj göndermeni istediğinde çağır; önizlemeyi göster ve açık onay ('evet/gönder') almadan slack_gonder_onayla'yı çağırma."
- TTL dolan/kullanılan kod geçersiz; kullanıcı başına tek bekleyen gönderi (yenisi eskisini ezer).

## Kapsam dışı / Gelecek

- **Proaktif iş-bazlı DM yorumları (Görkem'in gelecek isteği):** Ody'nin kendi inisiyatifiyle kişilere iş hakkında yorum DM'lemesi — ody-icgoru'nun genelleşmesi. AYRI faz: tetik kuralları, frekans tavanı, kişi bazlı opt-out gerektirir. Bu fazın imza + limit + log çerçevesi ona zemindir.
- UI değişikliği yok (mevcut sohbet akışı yeter — önizleme/onay diyaloğu doğal sohbet).
- Migration yok.

## Test

- Yetki matrisi: düz kullanıcı kendi işi thread ✓ / başkasının işi ✗ / dm ✗; yönetici üçü ✓ (node ile tool run() birim çağrıları — ctx sahte).
- Onay garantisi: aynı reqSeq'te onay → red; sonraki reqSeq → gönderir (sahte ctx ile).
- TTL + tek-bekleyen + limit davranışı.
- Canlı: Görkem'in sohbetten bir test işi thread'ine gönderimi (uçtan uca).

## Başarı ölçütü

"Ody, #85 thread'ine yaz: …" → önizleme → "evet" → thread'de imzalı mesaj. Onaysız/aynı-tur denemeler sunucuda reddedilir. Yetkisiz mod istekleri açıklayıcı hatayla döner.
