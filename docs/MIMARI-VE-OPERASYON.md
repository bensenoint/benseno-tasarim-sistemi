# Benseno Tasarım Sistemi — Mimari & Operasyon Rehberi

> **Sürüm:** v7.13 · Bulut göçü tamamlandı 30 May 2026
> **Hedef kitle:** Sistemi devralan geliştirici / gelecekteki Claude oturumu
> **Kaynak:** 30 May 2026 sistematik denetim (`autoresearch/debug-260530-0915/`)

Bu doküman sistemin **göç sonrası gerçek** halini anlatır. Eski "her şey Mac'te launchd" mimarisi artık geçerli değil — kritik işler **GitHub Actions (bulut)** üzerinde, Mac kapalıyken çalışır.

---

## 1. Sistem Nedir?

Benseno'nun 3 departmanlı (Tasarım 7 · Editör 8 · AI 1 = 16 kişi) tasarım iş takip sistemi. 39 marka için brief'leri Slack Canvas'tan okur, öncelik hesaplar, yöneticilere bildirim gönderir, web dashboard'unu günceller.

**Üç ana yüzey:**
1. **Slack Canvas** (`F0B1B6XUD44`) — brief'lerin ana veri kaynağı (insan + bot yazar)
2. **Web Dashboard** — `https://bensenoint.github.io/benseno-tasarim-sistemi/` (GitHub Pages)
3. **Slack DM/kanal** — yöneticilere otomatik bildirimler

---

## 2. Mimari — Hibrit Bulut/Mac

```
┌─────────────────────────────────────────────────────────────┐
│  BULUT (GitHub Actions — Mac kapalıyken çalışır)            │
│                                                              │
│  Cron tetikleyiciler:                                        │
│   • orchestrator.yml    :15/:45 hafta içi 08-17 TR          │
│   • sabah-raporu.yml     07:50 hafta içi TR                  │
│   • haftalik-retro.yml   Cuma 17:00 TR                       │
│   • aylik-strateji.yml   Ayın 28'i 17:00 TR                  │
│        │                                                     │
│        ▼  (her workflow: PAT remote + git identity ayarlar) │
│   claude -p "Skill: ..." --dangerously-skip-permissions      │
│        │                                                     │
│        ▼  Slack curl fallback (MCP yok!)                     │
│   Canvas oku (files.info+url_private) → parse → live-data    │
│        │                                                     │
│        ▼  git push (Benseno Bot, PAT remote)                 │
│   GitHub repo main → Pages otomatik rebuild → dashboard      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  MAC (her zaman açık olması gereken tek parça)              │
│   • com.benseno.slack-bot — Socket Mode (slash/reaction/form)│
│   • com.benseno.pat-check — PAT süre kontrolü (zararsız)     │
│   • com.benseno.log-temizle — log temizliği (zararsız)       │
└─────────────────────────────────────────────────────────────┘
```

### Ne nerede çalışır?

| İş | Nerede | Neden |
|---|---|---|
| Brief sync (orchestrator) :15/:45 | ☁️ Bulut | Cron'a uygun batch iş |
| Sabah raporu 07:50 | ☁️ Bulut | Cron'a uygun |
| Haftalık/aylık raporlar | ☁️ Bulut | Cron'a uygun |
| Slack Bot (slash command, reaction, brief formu) | 💻 Mac | Always-on Socket Mode dinleyici — cron değil, GitHub Actions barındıramaz |

> **Önemli:** Mac kapalıyken brief'ler yine işlenir (orchestrator curl ile `#marka-*` kanallarını okur), ama gerçek-zamanlı slash command / reaction override / brief formu çalışmaz. Bunları her zaman çalıştırmak için Slack Bot'u Railway/Fly'a taşımak gerekir (bkz. yayin-sonrasi-yapilacaklar.md #3).

---

## 3. Bileşenler

### 3.1 Skills (`.claude/skills/`)

**Orchestrator zinciri** (orchestrator → data → notification → dashboard):
| Skill | Görev |
|---|---|
| `benseno-orchestrator` | Ana orkestratör — alt skill'leri sırayla aynı session'da çalıştırır |
| `benseno-data-agent` | Canvas oku → brief parse → öncelik hesapla → live-data.json üret |
| `benseno-notification-agent` | notification-flags.json oku → DM/thread/kanal mesajı gönder |
| `benseno-dashboard-agent` | EMBEDDED_DATA inject + git push (Benseno Bot) |

**Bağımsız raporlar:**
| Skill | Tetikleyici |
|---|---|
| `benseno-gunluk-performans` | Sabah raporu (07:50) — 5 yönetici DM + kanal |
| `benseno-haftalik-retrospektif` | Cuma 17:00 |
| `benseno-aylik-strateji` | Ay sonu |

**Yardımcı:**
| Skill | Görev |
|---|---|
| `benseno-brief-tamamla` | Brief'i tamamlandı işaretle |
| `benseno-reaction-override` | Yönetici reaction ile öncelik override |
| `benseno-onboarding` | Yeni ekip üyesi 5 günlük onboarding |
| `benseno-brief-sync` | ⚠️ DEPRECATED — orchestrator'a bölündü, referans/fallback |

### 3.2 GitHub Actions Workflows (`.github/workflows/`)

Her workflow'un ortak yapısı (göç sonrası eklendi):
```yaml
permissions:
  contents: write          # ← push için (repo default 'read', bu olmadan 403)
steps:
  - uses: actions/checkout@v4
  - name: Git push yapilandirmasi    # ← KRİTİK
    run: |
      git config user.name "Benseno Bot"
      git config user.email "bot@benseno.com.tr"
      git remote set-url origin https://x-access-token:${{ secrets.BENSENO_GITHUB_PAT }}@github.com/...
  - uses: actions/setup-node@v4 (node 24)
  - run: npm install -g @anthropic-ai/claude-code
  - run: claude -p "Skill: ..." --dangerously-skip-permissions --print
```

**GitHub Secrets** (Settings → Secrets → Actions):
`ANTHROPIC_API_KEY`, `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_USER_TOKEN`, `SLACK_TEAM_ID`, `BENSENO_GITHUB_PAT`

### 3.3 launchd (`~/Library/LaunchAgents/`)

**Aktif (Mac'te kalanlar):**
- `com.benseno.slack-bot` — Socket Mode bot (PID canlı)
- `com.benseno.pat-check` — PAT süre uyarısı
- `com.benseno.log-temizle` — log temizliği

**Disabled (`benseno-disabled/` klasöründe — reboot-safe):**
orchestrator, sabah-raporu, haftalik-retro, aylik-strateji, startup-recovery, watchdog, gunluk-ozet
> Bunlar bulut'a taşındığı için kapatıldı. **Geri açma:** `mv benseno-disabled/X.plist . && launchctl load X.plist` (ama o zaman bulut ile ÇİFT çalışır — açma!)

### 3.4 Veri Dosyaları (`data/` — git'te)

| Dosya | İçerik |
|---|---|
| `marka_stats.json` | 39 marka deadline/tamamlama istatistikleri (E3) |
| `agent-state.json` | last_run_ts + 14 günlük history (KPI sparklines) |
| `brief-queue.json` | Slack bot'un yazdığı işlenmemiş brief kuyruğu |
| `notification-flags.json` | data-agent → notification-agent flag'leri |
| `notifications-sent.json` | İdempotentlik — gönderilmiş DM kaydı (çift DM önler) |

**Gizli dosyalar (gitignore — ASLA commit etme):**
`data/.slack-bot-token`, `.slack-app-token`, `.slack-user-token`, `.github-pat-sistem`, `.dashboard-auth-hash`

### 3.5 Dashboard (`dashboard/app/`)

- **JSX ekranları** (`screens/*.jsx`) — 15 ekran (Overview, Jobs, Plan/Gantt, Kanban, Completed, vb.)
- **data.js** — mock veri + `bnsHydrateBrief` (live-data.json → uygulama formatı bridge)
- **live-data.json** — orchestrator'ın ürettiği canlı veri (dashboard bunu poll eder)
- **build-dashboard.sh** — `cat` ile tüm JSX'leri birleştirip `esbuild --loader=jsx` → `bundle.js`
- **İki kopya:** `dashboard/app/` (kaynak) + `app/` (GitHub Pages serve eder) — build script rsync ile senkronlar

---

## 4. Veri Akışı (doğrulanmış uçtan uca zincir)

```
1. Cron tetikler (örn. 08:15 TR = 05:15 UTC, orchestrator.yml)
2. Workflow: PAT remote + git identity ayarlar
3. claude -p "Skill: benseno-orchestrator — run"
4. data-agent: GITHUB_ACTIONS=true → curl ile Canvas oku
     URL=files.info(F0B1B6XUD44).url_private
     curl $URL → quip HTML → 2 tablo parse (Aktif + Tamamlananlar)
5. data-agent: brief'leri parse, öncelik hesapla (deadline math + reaction)
     → live-data.json üret
     → Canvas geri-yazma ATLA (headless güvenlik kararı)
6. notification-agent: notification-flags.json → curl chat.postMessage ile DM
     (notifications-sent.json ile idempotent)
7. dashboard-agent: git add + commit + push (Benseno Bot, PAT remote)
8. GitHub: main güncellendi → Pages otomatik rebuild (PAT push = user push)
9. Dashboard ~1-2dk sonra canlı
```

---

## 5. KRİTİK Bilgiler (göç öğrenimleri)

### 5.1 Headless Slack — MCP yok, curl şart
GitHub Actions'ta Slack MCP sunucusu **yoktur**. Skill'ler `$GITHUB_ACTIONS=="true"` kontrolüyle curl fallback kullanır:
- **Canvas OKU:** `files.info?file=F0B1B6XUD44` → `url_private` çek (quip HTML döner, markdown değil)
- **DM gönder:** `chat.postMessage` (channel=USER_ID → otomatik IM açar)
- **Thread oku:** `conversations.replies`
- **Kanal oku:** `conversations.history`
- **Canvas YAZ:** headless'ta atlanır (format riski)
Bot scope'ları: `canvases:read/write`, `chat:write`, `channels:history`, `files:read` (hepsi mevcut).

### 5.2 Push auth (3 parça birden gerekir)
1. `permissions: contents: write` (repo default 'read' → olmadan 403)
2. `git remote set-url` ile **PAT** (BENSENO_GITHUB_PAT) — workflow scope'lu olmalı
3. `git config user.name/email` (yoksa "author unknown" hatası)
> PAT'lı push ayrıca Pages'i otomatik rebuild eder (automatic GITHUB_TOKEN push ETMEZ).

### 5.3 Saat dilimi
Actions runner **UTC**. Cron UTC yazılır (07:50 TR = `50 4 UTC`). Skill içinde saat kontrolü için `TZ=Europe/Istanbul date` kullan.

### 5.4 launchctl unload reboot-safe değil
`launchctl unload` sadece o oturumu etkiler; reboot'ta `~/Library/LaunchAgents` tekrar yüklenir. Kalıcı kapatma için plist'i **başka klasöre taşı** (`benseno-disabled/`).

---

## 6. Operasyon

### Manuel tetikleme (test)
```python
# Orchestrator'ı elle çalıştır
PAT="<workflow-scope PAT>"
# GitHub API workflow_dispatch (örnek autoresearch/debug-260530-0915 scriptlerinde)
```
Veya GitHub web → Actions → workflow seç → "Run workflow".

### Dashboard build + deploy (manuel)
```bash
cd ~/benseno-tasarim-sistemi
bash scripts/build-dashboard.sh    # bundle.js üret + app/ senkronla + index.html cache-bust
git add dashboard/ app/ index.html
git push                           # PAT remote → Pages otomatik rebuild
```
> ⚠️ Build, `index.html`'i de değiştirir (cache-bust timestamp). Hem `dashboard/index.html` hem root `index.html` commit edilmeli (script root'u otomatik stage eder).

### İzleme
- **Workflow çalışmaları:** GitHub → Actions
- **Push kanıtı:** `git log origin/main` → "Benseno Bot" commit'leri
- **Dashboard güncel mi:** `app/live-data.json` içindeki `sync_ts`

### Sorun giderme
| Belirti | Olası neden | Kontrol |
|---|---|---|
| Dashboard güncellenmiyor | Actions push fail | Actions log + `permissions: write` + PAT scope |
| Workflow push 403 | repo token read-only | workflow'da `permissions: contents: write` |
| Workflow push "author unknown" | git identity yok | workflow git config step |
| Canvas okunamıyor (Actions) | curl fallback eksik/scope | bot `canvases:read` + files.info testi |
| Çift DM / çift commit | launchd + Actions ikisi de çalışıyor | `launchctl list \| grep benseno` |
| Pages rebuild olmuyor | automatic token ile push | PAT remote kullanıldığından emin ol |

---

## 7. Bakım Takvimi

| Ne | Ne zaman | Aksiyon |
|---|---|---|
| Workflow PAT | 28 Haziran 2026 | Yenile (workflow scope'lu classic PAT) |
| data PAT (`.github-pat-sistem`) | ~78 gün | Yenile (90 günlük) |
| Node.js 24 deprecation | 16 Haziran 2026 | actions versiyonlarını izle |
| marka_stats E3 | 1 Haziran 2026 | `silent_log_only`→`active` otomatik, ilk gün izle |

---

## 8. İlgili Dokümanlar

- `docs/yayin-sonrasi-yapilacaklar.md` — açık işler + bakım
- `docs/kullanim-klavuzu.md` — son kullanıcı kılavuzu
- `CLAUDE.md` — Claude oturumları için proje kuralları
- `autoresearch/debug-260530-0915/` — göç denetimi raporu (bu mimarinin nasıl doğrulandığı)
