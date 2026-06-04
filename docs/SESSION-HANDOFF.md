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
- **Eski Slack Workflow — ✅ KALDIRILDI (4 Haz).** Ekip artık `/yeni-brief` kullanmalı. Bot görünen adı: **Work Tracking** (handle `@demo_app`).
- **Smoke test — ✅ GEÇTİ (4 Haz):** `/yeni-brief` → dashboard → ✅ reaction → DB tamamlandi → dashboard completed. Uçtan uca doğrulandı, sonra DB tekrar sıfırlandı (gerçek sıfır-veri: 0 brief, 14 marka, 18 kullanıcı).
- **Bug 1 GERÇEK kök neden (gelecekte lazım olur):** Slack app'te **`reaction_added` event'i "Subscribe to bot events"e ekli değildi** → event bot'a hiç ulaşmıyordu (Socket Mode'da bile event subscription şart; `reactions:read` scope'u tek başına YETMEZ). Kullanıcı ekledi → çalıştı. Kod fix'i (`resolveBriefTs` thread→parent ts) ayrıca yerinde, thread-yanıtı senaryosu için gerekli. **Reaction çalışmıyorsa önce Event Subscriptions'ı kontrol et.**
- **DEFER → toplu yapılacak (tüm değişiklikler bitince):** dokümantasyon güncellemesi — `kullanim-klavuzu.html` "2.2 Workflow Yöntemi (Önerilen)" → `/yeni-brief` komutu olacak. Ayrıca ölü kod temizliği (benseno-dashboard-agent skill, live-data.json, EMBEDDED_DATA injection).

## Güvenlik
data/.db-url, data/.slack*, data/.github-pat*, data/.dashboard-auth-hash ASLA commit edilmez. Token'ları chat'te maskele.
Gerçek marka kanallarına test mesajı atma (test için `BNS_FORCE_CHANNEL=#benseno-grafik` env ekle, sonra `railway variables delete BNS_FORCE_CHANNEL`).

## Ölü kod temizliği — ✅ YAPILDI (4 Haz)
Silindi: skill'ler (benseno-orchestrator/data-agent/dashboard-agent/notification-agent/brief-tamamla/reaction-override),
script'ler (run-orchestrator, run-startup-recovery, watchdog, run-slack-bot), stale state (agent-state.json, canvas_cache.md), server/scripts/seed-from-livedata.js.
`check-pat-expiry.sh` → claude/notification-agent yerine doğrudan Slack API (`notify()`, Railway-uyumlu).
**KORUNDU:** benseno-onboarding skill (manuel onboarding aracı), escape hatch (live-data.json + EMBEDDED_DATA + ?api=0), marka_stats.json + brief-queue.json (slack-bot.js hâlâ okuyor — App Home E3 satırı + queueeEkle).
**DEFER:** App Home'daki E3-mod satırı + queueeEkle ölü kodu (canlı-bot cerrahisi gerektirir, ayrı adım). Bot 8aa9d9a ile temiz redeploy oldu.

## Brief oluşturma yeniden tasarımı — ✅ CANLI (4 Haz)
Spec/plan: docs/superpowers/{specs,plans}/2026-06-04-brief-creation-redesign*. 3-rol modeli:
- `contributor`=**işi yapan(lar)** (dept buradan türetilir, virgül-join), `lead`=**lead(ler)** (çoklu, boşsa oluşturan), `gozlemci`=**gözlemciler**. `editor` rolü + `reviewer` kavramı kaldırıldı.
- API body: `worker_ids`(zorunlu)/`lead_ids`/`gozlemci_ids` (atanan_ids/editor_ids/dept kalktı). `getEmbedded` shape: `workers[]/leads[]/observers[]/attachments[]`.
- Dosya: `POST /api/briefs/:id/attachments` (base64 JSON → Slack thread external-upload → brief_attachments). express.json limit 25mb. Slack modal: `file_input` → `attachments-meta`.
- Dashboard NewBrief: dept-gruplu 3 kişi seçici + dosya. data.js hydrate yeni shape + escape-hatch fallback + geriye uyum (lead=leads[0], contributors=workers). BriefDrawer: 3 RoleGroup.
- **BEKLEYEN smoke:** Slack `/yeni-brief` ile gerçek brief (işi yapan + lead + gözlemci + dosya) → DB'de roller + dept türemiş + thread'de dosya → dashboard'da görün/düzenle.
- **DEFER:** kullanim-klavuzu.html güncellemesi (toplu doküman turu); Cards/BriefTable salt-okunur gösterim geriye-uyumla çalışıyor (işi yapanlar=atananlar), istenirse ayrıştırılır.
