#!/bin/zsh
# Startup Recovery — Bilgisayar açıldığında otomatik çalışır.
# Sistemin kapalı kaldığı süreyi hesaplar ve gerekirse birikmiş işleri toplar.

PROJ="$HOME/benseno-tasarim-sistemi"
LOG="$PROJ/logs/startup-recovery.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

cd "$PROJ"
source ~/.zshrc 2>/dev/null

echo "" >> "$LOG"
echo "[$TIMESTAMP] ═══════════════════════════════" >> "$LOG"
echo "[$TIMESTAMP] Startup Recovery başlatıldı." >> "$LOG"

# ── Kaç saat kapalıydı? ──────────────────────────────────────────────────────
NOW_EPOCH=$(date +%s)
HEARTBEAT_FILE="$PROJ/logs/brief-sync-last.ts"

if [[ -f "$HEARTBEAT_FILE" ]]; then
  LAST_TS=$(cat "$HEARTBEAT_FILE" | tr -d '[:space:]')
  OFFLINE_SEC=$(( NOW_EPOCH - LAST_TS ))
  OFFLINE_H=$(( OFFLINE_SEC / 3600 ))
  OFFLINE_MIN=$(( (OFFLINE_SEC % 3600) / 60 ))
  LAST_HUMAN=$(date -j -f "%s" "$LAST_TS" "+%d %b %H:%M" 2>/dev/null)
  echo "[$TIMESTAMP] Son çalışma: $LAST_HUMAN · Kapalı kalınan süre: ${OFFLINE_H}sa ${OFFLINE_MIN}dk" >> "$LOG"
else
  OFFLINE_SEC=999999
  OFFLINE_H=999
  echo "[$TIMESTAMP] Heartbeat bulunamadı — ilk başlatma kabul edildi." >> "$LOG"
fi

# ── Queue kontrolü ───────────────────────────────────────────────────────────
QUEUE_SIZE=$(python3 -c "import json; print(len(json.load(open('data/brief-queue.json'))))" 2>/dev/null || echo "0")
echo "[$TIMESTAMP] Brief queue: $QUEUE_SIZE bekleyen giriş" >> "$LOG"

# ── 2 saatten az kapalıysa + queue boşsa → hiçbir şey yapma ────────────────
if [[ $OFFLINE_SEC -lt 7200 && "$QUEUE_SIZE" == "0" ]]; then
  echo "[$TIMESTAMP] Kısa kapanış (<2sa) ve boş queue → recovery gerekmez. Çıkış." >> "$LOG"
  date +%s > "$HEARTBEAT_FILE"
  exit 0
fi

# ── Slack'e bildirim gönder ──────────────────────────────────────────────────
if [[ $OFFLINE_H -ge 2 ]]; then
  MSG="🖥️ *Benseno sistemi yeniden başlatıldı* · ${OFFLINE_H}sa ${OFFLINE_MIN}dk kapalıydı."
  if [[ "$QUEUE_SIZE" -gt 0 ]]; then
    MSG="$MSG · *${QUEUE_SIZE} bekleyen brief* işleniyor..."
  fi
  MSG="$MSG · Startup Recovery çalışıyor, birkaç dakika içinde hazır."
  echo "[$TIMESTAMP] Slack bildirimi gönderiliyor..." >> "$LOG"
  /opt/homebrew/bin/claude -p "Skill: benseno-notification-agent — şu mesajı benseno yöneticilerine (Görkem GM) Slack DM olarak gönder: $MSG" \
    --model haiku --print --dangerously-skip-permissions >> "$LOG" 2>&1
fi

# ── Recovery run ─────────────────────────────────────────────────────────────
echo "[$TIMESTAMP] Orchestrator FORCE_REBUILD başlatılıyor..." >> "$LOG"

RUN_TYPE="startup_recovery"
if [[ $OFFLINE_H -ge 24 ]]; then
  RUN_TYPE="startup_recovery_long_${OFFLINE_H}h"
fi

/opt/homebrew/bin/claude -p "Skill: benseno-orchestrator — ${RUN_TYPE}: sistem ${OFFLINE_H}sa ${OFFLINE_MIN}dk kapalıydı. Queue: ${QUEUE_SIZE} brief. Canvas'ı sıfırdan oku, tüm birikmiş brief'leri işle, deadline'ları yeniden hesapla, gerekli DM'leri gönder. FORCE_REBUILD." \
  --model sonnet --print --dangerously-skip-permissions >> "$LOG" 2>&1

# ── Heartbeat güncelle ───────────────────────────────────────────────────────
date +%s > "$HEARTBEAT_FILE"

echo "[$TIMESTAMP] Startup Recovery tamamlandı. Heartbeat güncellendi." >> "$LOG"
