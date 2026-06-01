# Benseno — Yapılacaklar (Railway taşıması sonrası)

> Güncelleme: 1 Haziran 2026 — Railway taşıması (Faz 0–5) tamamlandıktan sonra yeniden önceliklendirildi.
> Tek aktif runner: **Railway** (proje `friendly-art`). Mac soğuk yedek. GitHub Actions silindi.

---

## 🔴 P1 — ✅ TÜMÜ TAMAMLANDI
P1.1 (blokeli/escalation DM), P1.2 (Railway watchdog — exit≠0'da Görkem'e DM), P1.3 (PAT takibi — Pazartesi cron). Bkz. "Tamamlananlar".

---

## 🟡 P2 — Orta öncelik (👤 = senin aksiyonun gerekiyor)

### P2.1 — Classic PAT'lere expiration ekle (güvenlik hijyeni) — 👤 SEN
- `benseno-workflow` ve `benseno-sistem-full` classic token'larının **ikisinde de expiration yok** → sızarsa sonsuza dek geçerli.
- **Fix (sen):** GitHub → Settings → Developer settings → Tokens → her ikisine süre ekle (yeni token üret) → `railway variable set BENSENO_GITHUB_PAT=<yeni>` + local `data/.github-pat-sistem` güncelle. (Token girişini ben yapamam.)

### P2.2 — ANTHROPIC API kullanım maliyeti izleme — 👤 SEN
- **Neden:** Yeni `ANTHROPIC_API_KEY` (console.anthropic.com) kullanım-başına faturalanıyor. Şu an harcama görünürlüğü yok.
- **Fix (sen):** console.anthropic.com → Billing → Usage limits / alert kur. Aylık beklenen: orchestrator ~günde 18 run × 22 gün + raporlar. İlk fatura sonrası kalibre et.

---

## 🟢 P3 — ✅ TÜMÜ TAMAMLANDI (P3.1 layout, P3.2 aktivite, P3.3 Canvas-bayrak, P3.4 bundle-minify)

> Kalan tek açık optimizasyon: sabah-raporu prompt kalitesi (autoresearch) — gerçek ihtiyaç doğarsa izole branch'te.

---

## 📌 Zamana bağlı izleme (bugün — 1 Haziran)

### marka_stats E3 aktivasyonu
- Bugün `silent_log_only → active` otomatik geçiş. İlk gün marka davranış uyarılarının (yetersiz/anormal süre) doğru DM gönderdiğini izle. Geçişin `marka_stats.json`/`agent-state.json`'a yazılıp commit edildiğini teyit et.

---

## ✅ Tamamlananlar (referans)
- **P1.1 — Blokeli + escalation DM** → notification-agent'a port edildi (Şablon 29-32, eski "#3a")
- **P1.2 — Railway watchdog** → run-orchestrator gerçek exit kodu döndürüyor + scheduler exit≠0'da Görkem'e DM
- **P1.3 — PAT takibi** → check-pat-expiry Pazartesi 09:00 cron + date portable (GNU/BSD)
- **P2.3 — Günlük-özet** → hft içi 17:00 cron yeniden etkin
- **P3.1 — Department/Profil layout** → tablo kolonuna minWidth:0
- **P3.2 — Geçmiş gerçek aktivite** → data-agent bns_activity[] + App.jsx bridge
- **P3.3 — Canvas geri-yazma** → bayrak-kontrollü (varsayılan kapalı), gözetimli-test prosedürlü
- **P3.4 — bundle küçültme** → esbuild full --minify, 254KB→231KB (%9), Playwright ile doğrulandı (0 hata)
- Headless watermark + state + push robustluğu (H12/H17/H18/H23/H24/H25)
- Slack Bot always-on host'a taşındı → **Railway** (eski "#3")
- ~~Workflow-scope PAT yenileme~~ / ~~Node.js 24 (Actions)~~ → Actions silindi, gereksiz
- Ölü kod temizliği (4 supersede skill + arşiv + graphify)
- **Railway taşıması uçtan uca doğrulandı** (15:15 run: yeni brief #26 tespit → işleme → push)

### 🐞 Taşımada bulunan + düzeltilen 3 altyapı bug'ı (davranışsal testle)
1. **logs/ dizini yok** (.dockerignore) → `claude >> logs/*.log` redirect fail → claude hiç çalışmıyordu. Fix: entrypoint `mkdir -p logs`.
2. **Headless Slack erişimi yok** — .mcp.json gitignored (container'da yok) + curl fallback `$GITHUB_ACTIONS` bekliyordu. Fix: kapı `$RAILWAY_ENVIRONMENT`'ı da tanıyor.
3. **root + --dangerously-skip-permissions reddi** — claude root'ta çalışmayı reddediyordu. Fix: Dockerfile `IS_SANDBOX=1`.
