# Benseno — Yapılacaklar (Railway taşıması sonrası)

> Güncelleme: 1 Haziran 2026 — Railway taşıması (Faz 0–5) tamamlandıktan sonra yeniden önceliklendirildi.
> Tek aktif runner: **Railway** (proje `friendly-art`). Mac soğuk yedek. GitHub Actions silindi.

---

## 🔴 P1 — Yüksek öncelik (taşımadan doğan işlevsel/güvenilirlik boşlukları)

### P1.1 — Blokeli + escalation DM mantığını notification-agent'a taşı
- **Neden kritik:** Bu mantık silinen `benseno-brief-sync` skill'indeydi. Mac artık kalıcı kapalı olduğundan blokeli/escalation DM'leri **hiç gönderilmiyor** (eskiden "Mac kapalıyken kayıp"tı, şimdi tamamen kayıp).
- **Etki:** Blokeli brief'ler dashboard'da **Blokeli kolonunda görünmeye devam ediyor**; sadece proaktif DM gitmiyor.
- **Fix:** `data-agent`'a `blokeli` flag üretimi + `notification-agent`'a blokeli/escalation DM şablonu ekle. Dedup deposunu (`blokeli-notified.json`, `escalation-log.json`) `notifications-sent.json` gibi tracked + push kapsamına al.
- **Risk:** Orta — yeni flag + agent değişikliği, izole test.

### P1.2 — Watchdog'u Railway'e uyarla
- **Neden kritik:** Şu an **hiçbir hata izleme yok**. Railway orchestrator sessizce çökerse (claude hatası, push fail) kimse haberdar olmaz. Mac'teki watchdog kapandı.
- **Engel:** `watchdog.sh` heartbeat'i `logs/brief-sync-last.ts`'ten okuyor ama Railway dosya sistemi **ephemeral** (her deploy/restart sıfırlanır) → olduğu gibi taşınırsa sürekli yanlış alarm verir.
- **Fix seçenekleri:** (a) heartbeat'i git'e push edilen `agent-state.json → last_sync_ts`'ten oku (zaten persist), (b) scheduler.js'in `bitti (exit≠0)` log'unda doğrudan DM tetikle, (c) Railway healthcheck + harici uptime servisi.
- **Risk:** Orta.

### P1.3 — PAT süre takibini geri getir
- **Neden:** `check-pat-expiry.sh` Mac launchd'deydi (pat-check), şimdi kapalı. `data/.github-pat-sistem` ~78 gün sonra dolacak; dolduğunda **tüm push'lar sessizce 401 verir** (orchestrator çalışır ama dashboard güncellenmez).
- **Fix:** pat-check'i Railway scheduler'a ekle (haftalık cron) ya da takvime manuel hatırlatma. Süre dolmadan PAT yenile + `railway variable set BENSENO_GITHUB_PAT=...`.

---

## 🟡 P2 — Orta öncelik (güvenlik + maliyet + görünürlük)

### P2.1 — Classic PAT'lere expiration ekle (güvenlik hijyeni)
- `benseno-workflow` ve `benseno-sistem-full` classic token'larının **ikisinde de expiration yok** → sızarsa sonsuza dek geçerli.
- **Fix:** İkisine de süre ekle (yeni token üret + Railway env + `.github-pat-sistem` güncelle) veya net rotasyon takvimi. Süre eklenince P1.3 takibi anlamlı olur.

### P2.2 — ANTHROPIC API kullanım maliyeti izleme
- **Neden:** Yeni `ANTHROPIC_API_KEY` (console.anthropic.com) kullanım-başına faturalanıyor — Mac'teki abonelik OAuth'undan farklı. Şu an harcama görünürlüğü yok.
- **Fix:** console.anthropic.com → Usage limits / billing alert kur. Aylık beklenen: orchestrator ~günde 18 run × 22 gün + raporlar. İlk fatura sonrası kalibre et.

### P2.3 — Günlük-özet raporunu yeniden etkinleştir
- **Durum:** Eski 17:00 "Günlük Sistem Özeti" DM'i devre dışı (taşımada bırakıldı), Railway scheduler'a eklenmedi.
- **Fix:** `run-gunluk-ozet.sh` zaten var → scheduler.js'e cron ekle (`0 17 * * 1-5`) ya da gereksizse scripti/notu tümden kaldır (karar ver).

---

## 🟢 P3 — Düşük öncelik / opsiyonel

### P3.1 — Department + Profil ekranlarında iç layout taşması
- Main <1250px'e düşünce tablo kartı sağa taşıyor (13" MBA varsayılanda görünmez, sadece daraltınca).
- **Fix:** `Department.jsx` + `Profile.jsx` tablo kolonuna `minWidth:0` (Overview pattern'i).

### P3.2 — Geçmiş ekranı mock aktivite gösteriyor
- `History.jsx` → `data.activity` hep sahte; live-data.json'da doldurulmuyor.
- **Fix:** data-agent gerçek aktivite olayları üretsin + App.jsx bridge okusun.

### P3.3 — Canvas headless geri-yazma (kozmetik)
- Headless modda data-agent Canvas'a yazmıyor (format bozma riski). Slack Canvas öncelik renkleri güncellenmiyor; dashboard güncel.
- **Fix (opsiyonel):** `canvases.edit` API ile, izole test ortamında.

### P3.4 — autoresearch optimizasyon döngüleri (izole branch)
- bundle.js küçültme (248KB), sabah-raporu prompt kalitesi. Ayrı `autoresearch/*` branch'inde, Benseno Bot otomatik commit'leriyle karışmadan.

---

## 📌 Zamana bağlı izleme (bugün — 1 Haziran)

### marka_stats E3 aktivasyonu
- Bugün `silent_log_only → active` otomatik geçiş. İlk gün marka davranış uyarılarının (yetersiz/anormal süre) doğru DM gönderdiğini izle. Geçişin `marka_stats.json`/`agent-state.json`'a yazılıp commit edildiğini teyit et.

---

## ✅ Tamamlananlar (referans — Railway taşıması)
- Headless watermark + state + push robustluğu (H12/H17/H18/H23/H24/H25) — doğrulandı
- Slack Bot always-on host'a taşındı → **Railway** (eski "#3")
- ~~Workflow-scope PAT yenileme~~ → GitHub Actions silindi, gereksiz
- ~~Node.js 24 deprecation (Actions)~~ → Actions silindi, gereksiz
- Pazartesi ilk scheduled run izleme → cron 13:15 + 13:45'te ateşledi, doğrulandı
- Ölü kod temizliği (4 supersede skill + arşiv + graphify)
