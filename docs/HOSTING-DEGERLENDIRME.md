# Benseno Sistemi — Hosting / Taşıma Değerlendirmesi

> 1 Haziran 2026 · GitHub Actions `schedule` cron'unun güvenilmez olduğu (hiç fire etmedi) tespit edildikten sonra kalıcı çalışma ortamı analizi.

---

## 1. Kısıtlar — Sistem gerçekte neye ihtiyaç duyuyor?

Doğru host'u seçmek için sistemin **çalışma-zamanı gereksinimleri** belirleyicidir:

| # | Gereksinim | Detay |
|---|-----------|-------|
| **R1** | Zamanlanmış batch işleri | `claude -p "Skill: …"` — **Claude Code CLI** (tam Node binary, `child_process` spawn, dosya sistemi okuma/yazma, git push). Her :15/:45 (mesai içi) + sabah/haftalık/aylık. Run başına ~1-3 dk. |
| **R2** | Her zaman açık süreç | Slack Bot (`@slack/bolt` **Socket Mode**) — kalıcı Node process; içeriden `claude` spawn eder (reaction override, slash, form). |
| **R3** | Güvenilir cron | İş-kritik 07:50 raporu + 30 dk'lık döngü. **Best-effort olmamalı.** |
| **R4** | Çıkış HTTPS | Slack API, GitHub API, Anthropic API |
| **R5** | Secret saklama | `ANTHROPIC_API_KEY`, `BENSENO_GITHUB_PAT`, `SLACK_BOT/APP/USER_TOKEN`, `SLACK_TEAM_ID` |
| **R6** | Düşük maliyet + bakım + **kolay geliştirme/taşıma** | Tek kişilik ekip yönetebilmeli |

**Kolaylaştırıcı:** Headless modda **MCP sunucusu gerekmiyor** (curl fallback). Yani host'a sadece `node + git + curl + claude-code CLI` kurmak yeterli. Repo küçük (~31 MB), DB yok → taşıma düşük-friction.

**Belirleyici sonuç:** R1+R2 (keyfi binary + uzun-süreçli süreç + child_process) → **V8-isolate serverless platformları elenir.**

---

## 2. Seçeneklerin değerlendirmesi

### ❌ Cloudflare Workers — executor olarak UYGUN DEĞİL
- Workers = V8 isolate. **Node binary çalıştıramaz**, `child_process` yok, `claude -p` yok, CPU/süre limitleri var.
- **Ama güçlü olduğu yer:** Cloudflare **Cron Triggers** GitHub schedule'dan **çok daha güvenilir**; statik dashboard hosting (Pages) zaten yapılabilir.
- **Rolü:** Executor değil — istenirse "güvenilir tetikleyici" (Cron Trigger → gerçek executor'ı API ile uyandırır). Tek başına çözüm değil.

### 🟡 platform.claude — Zamanlanmış uzaktan agent'lar (`/schedule` routines)
- Anthropic bulutunda Claude agent'larını cron ile çalıştırır. Skill'leri **doğal** çalıştırır (zaten `claude -p`), **bakım yok**.
- **Artılar:** R1 için ideal — altyapı yok, Claude'un kendi ortamı.
- **Riskler:** (a) **R2 (always-on Socket Mode bot)** scheduled-agent modeline oturmaz — o olay-güdümlü kalıcı süreç, cron değil. (b) Headless ortamdan Slack token + git push + dosya kalıcılığı **doğrulanmalı** (interaktif-auth MCP'ler headless'ta yok). (c) Maliyet = Claude kullanımı. (d) Ortam/dosya-sistemi üzerinde **az kontrol**.
- **Rolü:** Batch işleri için güçlü aday; bot için zayıf. Olsa olsa hibrit.

### ✅✅ Küçük Linux sunucu — VPS (Hetzner/DigitalOcean/Vultr) **veya** PaaS (Railway/Fly.io/Render)
- Tam Linux: **gerçek cron daemon** (kaya gibi güvenilir), Node + claude CLI + git, bot için kalıcı **systemd/PM2 servisi**.
- **TÜM gereksinimleri** en az friction'la karşılar. Mac'le aynı Unix ortamı → `run-*.sh` + plist'ler **neredeyse olduğu gibi** cron/systemd'ye taşınır.
- Maliyet: **~$4-7/ay**. Geliştirme dostu (SSH, log, full kontrol). Taşıma trivial.
- **Railway/Fly vs ham VPS:**
  - **Railway/Fly.io:** git-push deploy, yönetilen secret, otomatik restart, dahili cron (Railway Cron / Fly Machines). Biraz daha pahalı (~$5) ama **en kolay kurulum + bakım**.
  - **Ham VPS:** en ucuz + tam kontrol, biraz daha kurulum (cron + systemd elle).

### 🟡 Ofis sunucusu (kendi donanım)
- Linux box + cron + always-on → teknik olarak çalışır.
- **Riskler:** Tek-nokta-arıza (elektrik/internet/bakım), **Mac ile aynı kırılganlık sınıfı**, yönetilen güvenilirlik yok, iç ağ güvenlik yüzeyi.
- **Verdict:** Yalnızca bakacak IT varsa; yoksa Mac riskini başka kutuya taşımış olursun.

---

## 3. Karar matrisi

| Kriter (ağırlık) | Cloudflare Workers | platform.claude | **Railway/Fly** | Ham VPS | Ofis sunucu | Mac (mevcut) | GitHub Actions |
|---|---|---|---|---|---|---|---|
| `claude -p` çalıştırır (R1) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Always-on bot (R2) | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Güvenilir cron (R3) | ✅✅ | ✅ | ✅✅ | ✅✅ | ✅ | 🟡 | ❌ |
| Maliyet | ~0 | kullanım | ~$5/ay | ~$4/ay | donanım | 0 | 0 |
| Bakım/kolaylık | — | ✅✅ | ✅ | 🟡 | 🔴 | 🟡 | ✅ |
| Geliştirme/taşıma | — | 🟡 | ✅✅ | ✅ | ✅ | ✅ | 🟡 |
| Mac-bağımsız | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |

---

## 4. Öneri

**Birincil: Railway (veya Fly.io) — tek container'da hem cron-batch hem always-on bot.**
- `claude -p` işleri Railway Cron ile (güvenilir), Slack bot kalıcı servis olarak.
- Dashboard: **GitHub Pages'te kalsın** (çalışıyor, ücretsiz) — container `live-data.json` üretip git push eder veya doğrudan Pages'e.
- GitHub Actions schedule: **ücretsiz best-effort yedek** olarak bırakılabilir (zararı yok).
- Maliyet ~$5/ay, kurulum ~yarım gün, taşıma düşük-risk (Unix script'ler birebir taşınır).

**Neden VPS değil de Railway?** Tek kişilik bakımda yönetilen restart + secret + deploy + log değerli; $1-2 fark önemsiz. Tam kontrol/ucuzluk önceliğse Hetzner VPS ($4) eşit derecede sağlam, biraz daha elle kurulum.

**platform.claude** ileride batch işleri için değerlendirilebilir (bot ayrı kalır) — ama önce headless Slack+git akışı PoC ile doğrulanmalı; bugünkü acil ihtiyaç için Railway daha kesin.

**Cloudflare:** executor değil; istenirse dashboard CDN + güvenilir cron-trigger katmanı olarak ikincil rol.

---

## 5. Taşıma taslağı (Railway, seçilirse)

1. Railway projesi + repo bağla (git-push deploy).
2. Secret'ları Railway env'e gir (ANTHROPIC_API_KEY, BENSENO_GITHUB_PAT, SLACK_*).
3. `Dockerfile` / Nixpacks: `node + git + curl + npm i -g @anthropic-ai/claude-code`.
4. **İki servis:**
   - `bot` — `node scripts/slack-bot.js` (kalıcı, auto-restart).
   - `orchestrator` — Railway Cron: `*/30 8-17 * * 1-5` → `claude -p "Skill: benseno-orchestrator — run"`; ayrıca sabah/haftalık/aylık cron'lar.
5. `run-*.sh` script'leri TR-saat kontrolünü zaten yapıyor → minimal uyarlama.
6. Dashboard push akışı (H17/H18 fix'leri) olduğu gibi çalışır (git push + Pages).
7. Doğrulama: 1 gün paralel (Railway + Actions fallback), sonra Actions cron'u kapat.

> **Not:** Bu doküman değerlendirmedir; kurulum yapılmadı. Karar verince adım adım uygularız.
