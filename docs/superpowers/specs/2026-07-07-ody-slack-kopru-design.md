# Ody × Slack Canlı Bilgi Köprüsü — Tasarım Spec'i

> Tarih: 2026-07-07 · EFOR: M · Risk: orta (gizlilik/erişim-kontrolü + Slack rate-limit) · Altyapı: benseno-api + Slack Web API + yeni DB tablosu

## Problem

Ody (dashboard asistanı) yalnız DB'den okuyor (`ody-tools`). Slack'te olup DB'ye yansımamış canlı bilgiye (taze kanal konuşması, arama, kişi durumu, ham thread) erişemiyor. İstenen: Ody **gerektiğinde** Slack'e sorup dönen bilgiyi **yorumlayarak** kullansın ve sonradan yeniden kullanmak üzere **kalıcılaştırsın**.

## Kullanıcı kararları (onaylı)

1. **Talep-üzerine**, sürekli değil: 4 mod — kanal mesajları, genel arama, kişi durumu, brief thread'i.
2. **Mimari:** doğrudan Slack Web API (benseno-api'den); Slack bot servisine bağlanma yok.
3. **Kalıcılık:** yeni `ody_slack_cache` tablosu + TTL 6 saat.
4. **Erişim kontrolü:** Ody bot'un tüm kanallarına erişebilir AMA bir kullanıcıya yalnız o kullanıcının ÜYE OLDUĞU kanalların bilgisini verir. **Görkem (`U030C48PL23`) tek istisna** — üye olmasa da bot'un tüm kanallarına erişir. DM'ler her zaman hariç.

## Ön koşul / ortam (DOĞRULANDI 2026-07-07)

- benseno-api: `SLACK_BOT_TOKEN` **var** → kanal/thread/kişi-durumu modları çalışır.
- benseno-api: `SLACK_USER_TOKEN` **YOK** → `search.messages` user-token gerektirir. **Arama modu, `SLACK_USER_TOKEN` benseno-api Railway servisine eklenene kadar KAPALI kalır** (kod zarifçe atlar; Ody "Slack araması şu an kapalı" der). Etkinleştirmek: token scheduler servisinde mevcut (`.slack-user-token`); aynı değeri benseno-api env'ine eklemek kullanıcının ops adımıdır.
- `BNS_SLACK_WORKSPACE` yok → thread linkleri için `benseno` varsayılanı kullanılır (mevcut kod deseni).

## Bileşenler

### 1. `server/ody-slack.js` (yeni)
Slack Web API sarmalayıcısı. Dışa verilenler:
- `kanalMesajlari(channel, limit=50)` → `conversations.history`
- `threadDokumu(channel, ts, limit=50)` → `conversations.replies`
- `slackArama(query, limit=20)` → `search.messages` (yalnız `SLACK_USER_TOKEN` varsa; yoksa `{disabled:true}`)
- `kisiDurumu(slackUserId)` → `users.getPresence` + `users.profile.get` (status_text/emoji, presence)
- `userKanallari(slackUserId)` → `users.conversations(types=public_channel,private_channel)` — kullanıcının üye olduğu kanal id kümesi (erişim filtresi için)
- Saf yardımcılar (test edilir): `erisebilirMi(userChannels, channelId, askerSlackId)` (Görkem bypass dahil), `cacheTaze(row, ttlMs)`.
Tüm çağrılar try/catch; Slack hata/429 → `null`/`{error}` (çökme yok). Sabit: `GORKEM='U030C48PL23'`, `TTL_MS=6*3600*1000`.

### 2. `ody-tools.js` — yeni tool `slack_sorgu`
```
description: "Slack'ten CANLI bilgi çek (DB'de olmayan taze veri). mod: kanal_mesaj (marka/iş kanalı son mesajları) | thread (#no brief thread ham dökümü) | arama (anahtar kelimeyle tüm kanallar; kapalıysa belirtir) | kisi_durum (tatil/izin/çevrimiçi). Dönen ham veriyi yorumla. Yalnız kullanıcının erişebildiği kanallar döner."
input_schema: { mod (enum, required), marka?, no?, kelime?, kisi? }
```
`runTool('slack_sorgu', input, ctx)` → `ody-slack.js`. `ctx.slackId` (soran kullanıcı) erişim filtresi için ZORUNLU. Akış:
1. Cache'e bak (`ody_slack_cache`: tip+anahtar+user_scope, TTL 6sa). Taze → dön.
2. Değilse Slack'e sor. **Erişim filtresi:** hedef kanal(lar) kullanıcının `userKanallari` kümesinde mi (veya asker=Görkem)? Değilse o kanal içeriği elenir. arama sonuçları da kanal bazında filtrelenir.
3. Sonucu (ham özet) `ody_slack_cache`'e yaz (`user_scope` = Görkem ise `'gorkem'`, değilse `askerSlackId` — böylece farklı erişimli kullanıcılar birbirinin önbelleğinden okumaz).
4. Ody'ye döndür; Ody yorumlar.
`kisi_durum` erişim-filtresizdir (durum bilgisi kişiye özel gizli değil).

### 3. Kalıcılık — migration `0013_ody_slack_cache.sql`
```sql
CREATE TABLE IF NOT EXISTS ody_slack_cache (
  id BIGSERIAL PRIMARY KEY,
  sorgu_tipi TEXT NOT NULL,          -- kanal_mesaj|thread|arama|kisi_durum
  anahtar TEXT NOT NULL,             -- channel id / #no / arama kelimesi / kisi id
  user_scope TEXT NOT NULL,          -- 'gorkem' | askerin slack_id'si
  ham_ozet TEXT,                     -- Slack'ten dönen özet/ham
  yorum TEXT,                        -- (ops.) Ody'nin yorumu — ileride
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ody_slack_cache_lookup ON ody_slack_cache (sorgu_tipi, anahtar, user_scope, created_at DESC);
```
TTL kod tarafında (created_at > now()-6sa). Eski satırlar birikebilir; ileride basit temizlik cron'u (kapsam dışı).

### 4. Chat entegrasyonu (`/api/chat`, api.js)
Mevcut tool döngüsüne `slack_sorgu` eklenir; `ctx`'e `slackId = req.user.slack_id` geçirilir (zaten authGuard var). Mevcut `/api/chat` rate-limiter'ı (SEC-10) `slack_sorgu`'yu da kapsar. Ody sistem promptuna kısa yönerge: "Slack'te olan taze bilgi gerektiğinde `slack_sorgu` çağır; dönen veriyi yorumla; yalnız kullanıcının eriştiği kanallar döner."

## Erişim kontrolü (kritik özet)
- Asker = Görkem (`U030C48PL23`) → tüm bot kanalları, filtresiz.
- Diğer herkes → yalnız `userKanallari(askerSlackId)` kümesindeki kanallar; dışı elenir.
- DM'ler (`D`/`im` tipi) her zaman hariç.
- Mevcut S2 (kişi puanı yalnız yöneticiye) ve diğer Ody gizlilik kuralları korunur.

## Kapsam dışı (sonraya)
- Slack bot servisi aracılığıyla köprü (doğrudan API seçildi).
- Önbellek temizlik cron'u.
- Arama modu, `SLACK_USER_TOKEN` benseno-api'ye eklenene dek kapalı.
- Ody'nin yorumu (`yorum` kolonu) doldurma otomasyonu — kolon hazır, ilk sürümde ham_ozet yeterli.

## Test
- **Birim (Slack API mock'lu):** `erisebilirMi` (üye kanal geçer, üye-olmayan elenir, Görkem her şeyi geçer, DM elenir), `cacheTaze` (6sa içi/dışı), arama `SLACK_USER_TOKEN` yokken `{disabled:true}`.
- **Migration 0013** idempotent (`node server/scripts/migrate.js status`).
- **CI** (`ci-check.sh`) + `node --check`.
- **Prod dry:** Ody chat'ten "Splenda kanalında bugün ne konuşuldu?" → erişimi olan kullanıcıda döner, olmayanda "erişimin yok/bilgi yok"; Görkem'de her kanal.
