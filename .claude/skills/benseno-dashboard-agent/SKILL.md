---
name: benseno-dashboard-agent
description: v1.0 · Dashboard ve raporlama katmanı. live-data.json → EMBEDDED_DATA inject → GitHub push. Sabah raporu, haftalık retro, aylık strateji bu agent altında çalışır.
---

# Benseno Dashboard Agent v1.0

Kaynak: benseno-brief-sync SKILL.md v7.13 + benseno-gunluk-performans + benseno-haftalik-retrospektif + benseno-aylik-strateji'den bölündü.

## Görev
`live-data.json`'u oku → `dashboard/index.html`'e EMBEDDED_DATA inject et → GitHub'a push et.

## Sabitler
```
LIVE_DATA         = ~/benseno-tasarim-sistemi/dashboard/app/live-data.json
DASHBOARD_HTML    = ~/benseno-tasarim-sistemi/dashboard/index.html
ROOT_HTML         = ~/benseno-tasarim-sistemi/index.html
GITHUB_REPO       = bensenoint/benseno-tasarim-sistemi
GITHUB_PAT_FILE   = ~/benseno-tasarim-sistemi/data/.github-pat-sistem
DASHBOARD_URL     = https://bensenoint.github.io/benseno-tasarim-sistemi/
AUTH_HASH_FILE    = ~/benseno-tasarim-sistemi/data/.dashboard-auth-hash
GRAFIK_CHANNEL_ID = C02SZRJGY0M
```

---

## ADIM ADIM

### 1. live-data.json Oku
Dosya yoksa veya >10dk ise → uyarı log'a yaz, eski EMBEDDED_DATA'yı koru (push yapma).

### 2. EMBEDDED_DATA Inject

`dashboard/index.html` içindeki `window.EMBEDDED_DATA = {` bloğunu regex replace et:

```js
window.EMBEDDED_DATA = {
  canvas_markdown: `{canvas_md_escaped}`,
  bns_briefs: {bns_briefs_json},
  bns_completed: {bns_completed_json},
  bns_brands: {bns_brands_json},
  bns_users: {bns_users_json},
  bns_dept_stats: {bns_dept_stats_json},
  bns_brand_stats: {bns_brand_stats_json},
  generated_at: "{iso_timestamp}",
  sync_ts: {unix_ts},
  source: "dashboard-agent-run-{unix_ts}"
};
```

**Kritik kurallar:**
- `canvas_markdown` backtick içinde → `${}` ve backtick karakterlerini escape et
- `bns_dept_stats` boş `{}` GÖNDERMEsın — mock data devreye girer
- EMBEDDED_DATA pattern bulunamazsa → Görkem'e DM: "❌ EMBEDDED_DATA pattern bulunamadı"

### 3. Root index.html Güncelle
```bash
cp dashboard/index.html index.html
rsync -a --delete dashboard/app/ app/
```

### 4. GitHub Push
```bash
cd ~/benseno-tasarim-sistemi
git add dashboard/index.html dashboard/app/live-data.json index.html app/
git commit -m "Dashboard Agent sync {timestamp}"
git push origin main
```

PAT: `data/.github-pat-sistem` dosyasından oku.
- Push 401/403 → Görkem'e DM: "❌ GitHub PAT geçersiz, yenile"
- Push başarılı → log: `GitHub: pushed {sha[:7]}`

GitHub Pages ~1-2dk sonra güncellenir: {DASHBOARD_URL}

---

## SABAH RAPORU (Hafta içi 07:50)

Orkestratör tarafından ayrıca tetiklenir: `claude -p "Skill: benseno-dashboard-agent — sabah-raporu"`

⚠️ **ÖNEMLI:** Bu skill `--dangerously-skip-permissions` ile çalışır. Kullanıcıdan onay ALMA. Tüm DM ve kanal mesajlarını doğrudan gönder. "Devam edeyim mi?" veya "Göstereyim mi?" gibi sorular sorma — hepsini otomatik gönder.

### Veri Kaynağı
`live-data.json` + `canvas_cache.md` + `marka_stats.json`

### Rapor İçeriği (5 yöneticiye DM + #benseno-grafik kanalına)

```
📊 *Benseno Sabah Raporu — {tarih TR}*

🔴 Acil ({N}): {brief listesi}
⚠️ Geçmiş Tarih ({N}): {brief listesi}
🚨 Kapasite Aşımı: {tasarımcı adı} {N} aktif iş
📋 Bugün deadline ({N}): {brief listesi}

🎨 Tasarım: {aktif}/{kapasite}% · ✍️ Editör: {aktif}/{kapasite}% · 🤖 AI: {aktif}/{kapasite}%

🔗 {DASHBOARD_URL}
```

**Şüpheli Brief'ler** (gecikmiş, teyitsiz):
```
🚩 Tarihi Şüpheli Brief'ler ({N}):
  • {Marka} — {İş} ({delta} gün geride) [Teyit bekleniyor]
```

---

## HAFTALIK RETROSPEKTIF (Cuma 17:00)

Tetikleme: `claude -p "Skill: benseno-dashboard-agent — haftalik-retro"`

### İçerik
- Bu hafta tamamlanan brief'ler (marka_stats.json'dan)
- Ortalama tamamlanma süresi vs hedef
- En çok iş alan tasarımcı/editör
- E3 marka kıyas özeti (silent_log_only modda bile log verisi var)
- Gelecek hafta dikkat edilecek deadline'lar

Hedef: #benseno-grafik kanalı + 5 yöneticiye DM

---

## AYLIK STRATEJİ (Ay sonu)

Tetikleme: `claude -p "Skill: benseno-dashboard-agent — aylik-strateji"`

### İçerik
- Ay özeti: tamamlanan iş sayısı/marka/dept
- E3 marka hız trendleri (active mode aktifleştiyse)
- PAT yenileme hatırlatması
- Kapasite planlaması önerisi

---

## Çıktı (tek satır)
```
Dashboard Agent OK · EMBEDDED_DATA inject · GitHub: pushed {sha} · {DASHBOARD_URL}
```
