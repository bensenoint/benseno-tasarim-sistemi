# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.


This file also provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# Benseno Tasarım Sistemi — Claude Code Workspace

**Sistem:** v7.13 · 16 kişilik dijital ajans brief takip sistemi · 39 marka · 3 departman
**Dashboard:** https://bensenoint.github.io/benseno-tasarim-sistemi/
**Slack Workspace:** `T4Y3R6RAN`

---

## Mimari Genel Bakış

Sistem 4 katmanlı agent mimarisine bölünmüştür (Mayıs 2026):

```
Railway (tek container, TZ=Europe/Istanbul)
  ├─ scripts/scheduler.js (node-cron)
  │    ├─ :15/:45 hft içi → run-orchestrator.sh
  │    │    └─ Skill: benseno-orchestrator
  │    │         ├─ Skill: benseno-data-agent      → canvas_cache.md, live-data.json, notification-flags.json
  │    │         ├─ Skill: benseno-notification-agent → DM'ler, thread cevapları, calendar events
  │    │         └─ Skill: benseno-dashboard-agent → EMBEDDED_DATA inject, GitHub push
  │    ├─ 07:50 hft içi → run-sabah-raporu.sh   (dashboard-agent — sabah-raporu)
  │    ├─ Cuma 17:00   → run-haftalik-retro.sh  (dashboard-agent — haftalik-retro)
  │    └─ ay sonu 17:00 → run-aylik-strateji.sh (dashboard-agent — aylik-strateji)
  └─ scripts/slack-bot.js (always-on, Socket Mode) — aynı süreçte require ile başlar

Hosting: Railway (proje: friendly-art). GitHub'a `git push origin main` → otomatik build+deploy.
Dashboard: GitHub Pages (bensenoint.github.io), git push ile güncellenir.
Mac: SOĞUK YEDEK — scriptler değiştirilmedi, gerekirse `claude -p "Skill: benseno-orchestrator — run"` ile manuel.
```

**Haberleşme dosyaları (agent'lar arası):**
- `data/canvas_cache.md` — Canvas içeriği (30dk TTL cache)
- `dashboard/app/live-data.json` — React dashboard + Slack Bot ortak veri kaynağı
- `data/notification-flags.json` — Data Agent → Notification Agent flag'leri
- `data/brief-queue.json` — Slack Bot → Data Agent yeni brief queue'su
- `data/agent-state.json` — Son run durumu

**Slack Bot** (`scripts/slack-bot.js`) ayrı bir process olarak Socket Mode'da çalışır:
- `live-data.json` değişince Slack List'i otomatik günceller
- Slash commands: `/brief-durum`, `/kapasite`, `/slack-list-guncelle`
- Reaction override'ları anında işler
- Brief validation ephemeral mesajları gönderir

**Dashboard** React + esbuild bundle (`dashboard/app/bundle.js`):
- Kaynak JSX dosyaları: `dashboard/app/*.jsx` ve `dashboard/app/screens/*.jsx`
- Bundle rebuild: `bash scripts/build-dashboard.sh`
- `window.EMBEDDED_DATA` → `data.js` bridge → `window.BNS_DATA` → React
- Her 30sn `app/live-data.json` polling yapar

---

## Komutlar

```bash
# Dashboard bundle'ı yeniden derle (JSX değişikliği sonrası)
bash scripts/build-dashboard.sh

# Manuel sync (test)
claude -p "Skill: benseno-orchestrator — run" --dangerously-skip-permissions

# Sadece data agent
claude -p "Skill: benseno-data-agent — run" --dangerously-skip-permissions

# Sabah raporu manuel
claude -p "Skill: benseno-dashboard-agent — sabah-raporu" --dangerously-skip-permissions

# Slack List manuel güncelle
node scripts/create-slack-list.js --update

# ── Railway (canlı sistem) ──
railway status                       # servis durumu (Online/Crashed)
railway logs                         # scheduler + bot stdout
railway redeploy --yes               # yeniden başlat (bot + scheduler)
railway ssh "tail -30 logs/orchestrator.log"   # container içi run logları
railway variables --json             # env var'lar (değerler dahil — dikkat)

# ── Mac soğuk yedek (gerekirse) ──
# launchctl load ~/Library/LaunchAgents/com.benseno.slack-bot.plist   # bot'u Mac'te aç
# claude -p "Skill: benseno-orchestrator — run" --dangerously-skip-permissions  # manuel run
```

---

## Sistem Sabitleri

```
CANVAS_ID          = F0B1B6XUD44          (Ana iş takip canvas)
BRAND_BOOK         = F0B2ANKBBFV
LESSONS_LEARNED    = F0B2H49SXPC
TEMPLATES          = F0B2F2REETG
GRAFIK_CHANNEL     = C02SZRJGY0M          (#benseno-grafik · private · bot ÜYE olmalı)
GITHUB_REPO        = bensenoint/benseno-tasarim-sistemi
DASHBOARD_URL      = https://bensenoint.github.io/benseno-tasarim-sistemi/
TIMEZONE           = Europe/Istanbul (UTC+3)
SLACK_APP          = "Work Tracking" (display) · bot handle: @demo_app · user_id: U0B5AGDEZRN
```

**Token dosyaları** (`data/` — git'e commit edilmez):
- `.slack-bot-token` — xoxb-... (bot token)
- `.slack-user-token` — xoxp-... (user token, lists:write için)
- `.slack-app-token` — xapp-... (Socket Mode)
- `.github-pat-sistem` — GitHub PAT (90 gün)
- `.slack-list-id` — Aktif Slack List ID

---

## Ekip

**Yöneticiler:** Görkem (U030C48PL23) · Reyhan (UD96GH76E) · Cansu (U4XCE3532) · İpek (U055EDESLSE) · erdem (U02SZQDAFPF)

**Tasarım (7):** Aylin T (U0AN6DD79M0) · Aykut (U06J26R1XCJ) · Hasan Serdar (U09BFPBKQG7) · Pelin (U0B3K2WE7SB) · İpek (U055EDESLSE) · İrem (U0AK8U7L57F) · Serhat (U08HLMHTGEL)

**Editör (8):** Cansu (U4XCE3532) · erdem (U02SZQDAFPF) · Eda T (U09BZHR25NG) · Eda A (U07PV0RA9L2) · Melis (U08NQJ27G5S) · Aylin C (U05PP70GQTX) · Buse (U063T8M5HL4) · Simge (U0AAC3YK20G)

**AI (1):** Eren (U0AP31SAA1W)

---

## KRİTİK Çalışma Kuralları — ASLA İHLAL ETME

### Canvas
1. `slack_update_canvas`'ta **`section_id` parametresini KULLANMA** — Slack API bug'ı, blockquote/footer çoğalır
2. Canvas'a **H1 başlık YAZMA** — title API tarafından ayrıca set edilir
3. Canvas update her zaman **full replace** — kısmi güncelleme yok
4. Değişiklik yoksa `slack_update_canvas` **ÇAĞIRMA** (idempotent kontrol)
5. Aktif İşler (14 sütun) ile Tamamlanan İşler (12 sütun) tablolarını **KARIŞTRIMA**

### Dashboard
6. `dashboard/index.html`'deki `window.EMBEDDED_DATA = {` bloğunu **ASLA SILME**
7. `bns_dept_stats` boş `{}` **GÖNDERMEsın** — mock data devreye girer, hatalı görünür
8. `dashboard/app/` değişikliği sonrası mutlaka `build-dashboard.sh` çalıştır

### GitHub
9. PAT dosyası: `data/.github-pat-sistem` — 90 günlük expiry
10. Push'tan önce remote URL'yi PAT ile set et: `https://{PAT}@github.com/bensenoint/benseno-tasarim-sistemi.git`

### Brief Sync
11. Brief önceliği **deadline'dan otomatik hesaplanır** (v7.12) — forma bakma
12. Yönetici reaction override: en son eklenen yönetici kazanır
13. UTC → TR çevirimi zorunlu (+3 saat) — Slack form datetime UTC verir
14. Canvas cache TTL: 30dk — `canvas_cache.md` <30dk ise `slack_read_canvas` ÇAĞIRMA
15. `marka_stats.json` mode `silent_log_only` ise E3 DM gönderme, sadece log yaz

### Öncelik Hesabı
- `delta ≤ 0h` → 🔴 + GEÇMİŞ | `≤ 8h` → 🔴 | `≤ 24h` → 🟠 | `≤ 72h` → 🟡 | `> 72h` → 🟢

---

## MCP Tool İsimleri

Bu session'daki aktif Slack MCP ID: `8d40c455-2f52-4946-b26f-009e54bc2168`

```
mcp__8d40c455-...__slack_read_canvas
mcp__8d40c455-...__slack_update_canvas   ← section_id KULLANMA!
mcp__8d40c455-...__slack_read_channel
mcp__8d40c455-...__slack_read_thread
mcp__8d40c455-...__slack_search_public_and_private
mcp__8d40c455-...__slack_send_message
mcp__8d40c455-...__slack_schedule_message
mcp__8d40c455-...__slack_search_users
mcp__8d40c455-...__slack_read_user_profile
```

> MCP ID değişirse `claude mcp list` çıktısına bak.

---

## Scheduled Task'lar

Zamanlama **Railway + node-cron** (`scripts/scheduler.js`, TZ=Europe/Istanbul) ile yapılır. Her cron run-*.sh'i detached spawn eder; cron tanımları scheduler.js'tedir.

| Task | Zamanlama | Script | Skill |
|---|---|---|---|
| Orchestrator (Brief Sync) | Hft içi :15/:45 (08-17) | `run-orchestrator.sh` | `benseno-orchestrator` |
| Sabah Raporu | Hft içi 07:50 | `run-sabah-raporu.sh` | `benseno-dashboard-agent — sabah-raporu` |
| Haftalık Retro | Cuma 17:00 | `run-haftalik-retro.sh` | `benseno-dashboard-agent — haftalik-retro` |
| Aylık Strateji | Ay sonu 17:00 | `run-aylik-strateji.sh` | `benseno-dashboard-agent — aylik-strateji` |
| Log temizle | Her gece 03:30 | `run-log-temizle.sh` | — |
| Slack Bot | Her zaman (always-on) | `scheduler.js` içinde require | — |
| Onboarding | Manuel | — | `benseno-onboarding — başlat: {ID} {İsim} {Tarih}` |

---

## Sıkça Karşılaşılan Sorunlar

**Dashboard yüklenmiyor / loading screen'de kalıyor:**
→ `build-dashboard.sh` çalıştır, `rsync -av --delete dashboard/app/ app/` yap, GitHub'a push et.

**"DeptRow: cannot read properties of undefined":**
→ `bns_dept_stats: {}` boş gönderilmiş. `data.js`'deki guard'ı kontrol et.

**Canvas cache stale:**
→ `data/canvas_cache.md`'yi sil, bir sonraki sync'te yenilenir.

**Slack Bot ölmüş / cron ateşlemiyor:**
→ `railway status` (Crashed mı?), `railway logs` ile bak. Gerekirse `railway redeploy --yes`.
→ Env eksikse bot `appToken` hatasıyla çöker — `railway variables --json` ile SLACK_*/ANTHROPIC kontrol et.

**GitHub push 401:**
→ `data/.github-pat-sistem` yenile, 90 günlük expiry dolmuş.
