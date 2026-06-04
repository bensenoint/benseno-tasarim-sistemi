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

### Bug 1 — ✅ ÇÖZÜLDÜ (4 Haz) — Slack ✅ thread yanıtında dashboard'a yansımıyordu
Netleşti: kullanıcı ✅'i **thread yanıtına** koymuştu → `event.item.ts` yanıtın ts'i, brief'in `slack_ts`'i değil → `by-ts` araması başarısız.
Düzeltme (`scripts/slack-bot.js`): `resolveBriefTs(client, channel, ts)` — `conversations.replies` ile parent (brief) ts'e çözer.
Üç reaction handler'ı da (✅ tamamlama / 🎨✍️🤖👀 durum / 🔴🟠🟡🟢 öncelik) artık `briefTs` kullanıyor; ana mesaj VE thread yanıtı ikisinde de çalışır.
Bot 952609b ile temiz redeploy oldu (`node --check` geçti).

### Reviewer kalıcılığı — ✅ EKLENDİ (4 Haz)
Dashboard "reviewer" → DB `gozlemci` rolüne eşlendi (yeni şema yok). `queries.js` embedded'a `reviewerId` (=ilk gozlemci) ekler;
App.jsx helper reviewer değişimini `gozlemci_ids` PATCH'ine bağlar (boş dizi → temizler). API stamp-trick ile deploy edildi, round-trip prod'da doğrulandı.

## Kalan cutover
- **C2 — ✅ YAPILDI (4 Haz):** 4 rapor (sabah/günlük/haftalık/aylık) deterministik Node'a geçti, `/api/embedded`'den okuyor + claude (haiku) yorum katmanı. Dosyalar: `scripts/rapor-lib.js` + `scripts/rapor-{sabah,gunluk,haftalik,aylik}.js`. `run-*.sh` wrapper'ları artık `claude -p` yerine node çağırıyor (Railway'de claude CLI yoktu → raporlar sessizce ölüydü; artık çalışıyor). Scheduler crons değişmedi.
  - **Mod:** ✅ **CANLI** (4 Haz) — Railway'de `BNS_REPORT_LIVE=1` set → raporlar 5 yönetici + #benseno-grafik'e gidiyor. Görkem-only'ye dönmek: var'ı sil/0 yap.
  - **Orchestrator:** ✅ KAPATILDI (scheduler.js:66 yorumlandı, commit a908569).
  - ⚠️ **C3 yapılmadı** → DB hâlâ test verisiyle dolu; canlı raporlar şişkin sayılar gösterir (21 geçmiş vb.). Temiz raporlar için C3 (TRUNCATE) gerekir.
  - Manuel test: `node scripts/rapor-sabah.js` (Görkem'e DM) · `BNS_REPORT_LIVE=1 node ...` (canlı).
  - **Orchestrator-kill (C2 final):** raporlar artık `live-data.json` okumadığı için `scheduler.js:66` orchestrator cron'u kapatılabilir — **AMA önce ekip Canvas yerine `/yeni-brief` kullanmaya geçmeli** (yoksa Canvas'a eklenen brief'ler DB'ye düşmez). Org-readiness'e bağlı.
- **C3 — ✅ YAPILDI (4 Haz):** Sıfır-veri go-live. `TRUNCATE briefs, brief_assignees, brief_tags, brief_attachments, brief_approvals, events RESTART IDENTITY CASCADE` — brands(13)/users(18) KORUNDU. Yedek: `~/benseno-db-backups/brief-data-*.json` (repo dışı, geri yüklenebilir). API embedded: 0 brief / 13 marka / 18 kullanıcı.
- **Kullanıcı aksiyonu (BEKLİYOR):** eski Slack **Workflow**'u kapat (ekip `/yeni-brief` kullansın). Bot adı görünen: **Work Tracking** (handle `@demo_app`). Orchestrator kapalı olduğu için Workflow/Canvas'a eklenen briefler ARTIK DB'ye düşmez — ekip mutlaka `/yeni-brief` kullanmalı.
- **Smoke test (BEKLİYOR):** Slack'te `/yeni-brief` ile gerçek brief aç → marka kanalında post + dashboard'da görün → thread'e ✅ → dashboard'da tamamlandı'ya geçtiğini doğrula (uçtan uca: create + Slack post + reaction→DB).

## Güvenlik
data/.db-url, data/.slack*, data/.github-pat*, data/.dashboard-auth-hash ASLA commit edilmez. Token'ları chat'te maskele.
Gerçek marka kanallarına test mesajı atma (test için `BNS_FORCE_CHANNEL=#benseno-grafik` env ekle, sonra `railway variables delete BNS_FORCE_CHANNEL`).
