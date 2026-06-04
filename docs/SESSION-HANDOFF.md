# Benseno — Oturum Handoff (2026-06-04)

Yeni oturuma "bu dosyayı oku, Bug 2'den devam et" de.

## Mimari (canlı)
- **benseno-api** (Railway servis id `d1f3b13e-b8f5-4847-af1c-c30d0693c7a7`) — Postgres + Express.
  - `GET /api/state`, `GET /api/embedded` (dashboard ham shape), `POST /api/briefs`,
    `PATCH /api/briefs/:id`, `POST .../:id/status`, `.../:id/financials`,
    `by-no/:no/...` ve `by-ts/:ts/...` varyantları. Zod + event-sourcing (`source`: dashboard|slack|system).
  - URL: https://benseno-api-production.up.railway.app
- **benseno-tasarim-sistemi** (bot servisi, id `6c993a49-...`) — Slack bot + scheduler. GitHub'dan auto-deploy eder.
- Postgres servis id `2d810996-...`. Project id `efcd3ff0-863b-472f-8dc9-c4a4fb4786ed`, env `production` (`8a714267-...`).

## Bitti + canlı
- Faz 2: dashboard varsayılan veri kaynağı **API/DB** (escape: `?api=0`).
- Faz 3 b1: dashboard formu + Slack `/yeni-brief` modalı → DB → marka kanalı postu + thread (slack_ts kaydı).
- Faz 3 b2: dashboard durum/finans/düzenleme API çağrıları brief thread'ine yansır + atananlara DM (`reflectChange`).
- Faz 3 b3-update: Slack reaction/thread → DB (shadow, by-ts, source=slack).
- Cutover C1: dashboard varsayılanı API.

## DEPLOY YÖNTEMİ (önemli)
- **API servisi GitHub'dan auto-deploy ETMEZ.** Deploy = git-dışı `server/` kopyasından:
  ```
  D=/tmp/bns-api-$(date +%H%M%S); mkdir -p "$D"
  rsync -a --exclude=node_modules --exclude=.git ~/benseno-tasarim-sistemi/server/ "$D"/
  echo "deploy $(date -u +%H%M%S)" > "$D"/.deploy-stamp   # ← dedup kırmak için ŞART
  cd "$D"; export RAILWAY_CALLER=skill:use-railway@1.2.2
  railway link --project efcd3ff0-863b-472f-8dc9-c4a4fb4786ed --environment production --service benseno-api
  railway up --service benseno-api --detach
  ```
  watch_patterns=`["**"]`. `.deploy-stamp` benzersiz olmazsa "no changes → SKIP".
- **Bot servisi**: `scripts/slack-bot.js`'i git'e push → otomatik redeploy. Push öncesi `node --check` ŞART (canlı bot, crash-loop riski).
- DB temizlik: `node /tmp/bns_cleanup_test.js` benzeri; `server/db.js` `data/.db-url`'den bağlanır.

## AÇIK BUG'LAR (sırayla)
### Bug 2 — ✅ ÇÖZÜLDÜ (4 Haz) — Dashboard düzenlemesi DB'ye yazmıyordu
Kök neden mimariydi: `BriefDrawer` zaten düzenlenmiş brief'i `onUpdate(next)` ile veriyordu;
`App.jsx`'teki `onUpdateBrief`/`onStatusChange` sadece local state'e yazıp DB'ye hiç dokunmuyordu.
Düzeltme (`dashboard/app/App.jsx`): module-scope `bnsPersistBriefChange(prev,next,by)` helper'ı —
prev↔next diff'ler, değişen alana göre endpoint ateşler:
durum→`POST /:id/status`; baslik→`PATCH baslik`; not→`PATCH musteri_notu`; lead+contributors→`PATCH atanan_ids`.
Numeric id varsa `/:id`, yoksa `by-no/:no` fallback. Optimistic UI + hata toast'ı. Başarıda `bnsRefresh()`.
b2 sayesinde yazma Slack thread'ine de yansır. **Reviewer sync DIŞI** — embedded payload reviewerId döndürmüyor
(round-trip yok) + API'de temiz rol param'ı yok. Doğrulandı: PATCH+status prod'a yazıldı/okundu/geri alındı.
Not: id korunuyor (`data.js` hydrate `raw.id`; embedded `bns_briefs[].id` numeric verir).

### Bug 1 (netleştirme bekliyor) — Slack ✅ dashboard'a yansımadı
Bot ✅'i `event.item.ts` ile `by-ts` DB'de arıyor. Kullanıcı ✅'i thread yanıtına mı / ana brief mesajına mı koydu + emoji tam ✅ mı (white_check_mark) — netleşince: ya kullanım notu, ya handler sağlamlaştırma.

## Kalan cutover
- C2: raporları DB'den okuyacak şekilde yaz (sırayla sabah→günlük→haftalık→aylık; mevcut: `claude -p "Skill: benseno-dashboard-agent — sabah-raporu"`). **Test: önce sadece Görkem'e DM.** Sonra `scheduler.js` satır ~66 orchestrator cron'unu kapat.
- C3: DB'yi sıfırla (TRUNCATE) — veri önemsiz, sıfır-veri go-live.
- Kullanıcı aksiyonu: eski Slack **Workflow**'u kapat (ekip `/yeni-brief` kullansın). Bot adı görünen: **Work Tracking** (handle `@demo_app`).

## Güvenlik
data/.db-url, data/.slack*, data/.github-pat*, data/.dashboard-auth-hash ASLA commit edilmez. Token'ları chat'te maskele.
Gerçek marka kanallarına test mesajı atma (test için `BNS_FORCE_CHANNEL=#benseno-grafik` env ekle, sonra `railway variables delete BNS_FORCE_CHANNEL`).
