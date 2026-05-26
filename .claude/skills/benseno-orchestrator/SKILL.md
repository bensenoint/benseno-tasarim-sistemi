---
name: benseno-orchestrator
description: v1.1 · Ana orkestratör. Sub-agent skill'leri sırayla aynı session içinde çalıştırır. launchd tarafından çağrılır.
---

# Benseno Orkestratör v1.1

## Görev
Aşağıdaki 3 sub-agent SKILL.md'yi sırayla oku ve talimatlarını uygula. Hepsi aynı claude session'ı içinde çalışır — child process başlatma.

## Sabitler
```
PROJECT_DIR  = ~/benseno-tasarim-sistemi
AGENT_STATE  = ~/benseno-tasarim-sistemi/data/agent-state.json
```

---

## ÇALIŞMA SIRASI

### Adım 1 — Data Agent (zorunlu, önce tamamla)

`~/benseno-tasarim-sistemi/.claude/skills/benseno-data-agent/SKILL.md` dosyasını oku ve talimatlarını uygula.

- Canvas okur, brief'leri parse eder
- `canvas_cache.md` ve `dashboard/app/live-data.json` üretir
- `data/notification-flags.json` yazar

**Başarı kontrolü:** `dashboard/app/live-data.json` güncellendi mi?
- Hayır → Görkem'e DM: "❌ Data Agent başarısız, sync atlandı" ve ÇIK
- Evet → Adım 2'ye geç

### Adım 2 — Notification Agent

`~/benseno-tasarim-sistemi/.claude/skills/benseno-notification-agent/SKILL.md` dosyasını oku ve talimatlarını uygula.

- `data/notification-flags.json` okur
- DM'leri, thread cevaplarını ve calendar event'larını gönderir
- Hata olursa sadece log'a yaz, devam et

### Adım 3 — Dashboard Agent

`~/benseno-tasarim-sistemi/.claude/skills/benseno-dashboard-agent/SKILL.md` dosyasını oku ve talimatlarını uygula.

- `dashboard/app/live-data.json` okur
- `dashboard/index.html`'e EMBEDDED_DATA inject eder
- GitHub'a push eder
- Hata olursa sadece log'a yaz

### Adım 4 — State Güncelle

`data/agent-state.json` dosyasına yaz.

**ÖNEMLİ:** Mevcut dosyayı oku → tüm alanları koru → sadece güncellenen alanları üzerine yaz → history'ye yeni satır ekle. Dosyadaki `dm_sent`, `overdue_count`, `run_type`, `priority_summary` gibi alanları silme.

```json
{
  "last_run": "<ISO timestamp>",
  "last_run_ts": <unix>,
  "data_agent": "ok|error",
  "notification_agent": "ok|error",
  "dashboard_agent": "ok|error",
  "active_briefs": <N>,
  "errors": [],
  "history": [
    {
      "ts": <unix>,
      "date": "<YYYY-MM-DD>",
      "active": <N>,
      "overdue": <N>,
      "dm_sent": <N>,
      "errors": <N>,
      "ok": true|false
    }
    // ... önceki kayıtlar (her gün için 1 kayıt, max 14 günlük)
  ]
}
```

`history` güncellemesi — **GÜNLÜK özet** (per-run değil):
1. Mevcut `agent-state.json`'u oku → `history` dizisini al (yoksa `[]`)
2. Bugünün tarihi (`YYYY-MM-DD`) history'de var mı?
   - **Varsa:** Bugünkü satırı bu run'ın verileriyle GÜNCELLE (replace)
   - **Yoksa:** Bu run'ın özetini dizinin SONUNA ekle (push)
3. 14'ten fazla kayıt varsa en eski kaydı sil
4. Güncellenmiş `agent-state.json`'u yaz

> Amaç: 1 kayıt/gün → 14 kayıt = 14 iş günü = ~3 haftalık trend verisi

### Adım 5 — PAT Süresi Kontrolü

`data/.github-pat-created` dosyasını oku → kaç gün önce oluşturuldu?
- 80+ gün → Görkem'e DM: "⚠️ GitHub PAT {N} günde doluyor"
- 90+ gün → DM + sabah raporuna ekle

---

## Çıktı (tek satır)
```
Orchestrator OK · {timestamp} · Data:ok · Notify:ok · Dashboard:ok · {N} aktif brief
```
