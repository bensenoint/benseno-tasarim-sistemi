#!/bin/zsh
# Brief Sync Watchdog — Her 30 dakikada bir çalışır
# Brief Sync'in son çalışma zamanını kontrol eder.
# Mesai saatinde 2 saatten uzun sessizlik varsa Slack uyarısı atar.

cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
source ~/.zshrc 2>/dev/null

LOG="logs/watchdog.log"
HEARTBEAT="logs/brief-sync-last.ts"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

HOUR=$(date +%H)
DOW=$(date +%u)

# Mesai dışı (hafta sonu veya 08:00-18:00 dışı) → sessizlik normal, çıkış
[[ "$DOW" -gt 5 ]] && exit 0
[[ "$HOUR" -lt 8 || "$HOUR" -gt 18 ]] && exit 0

NOW_EPOCH=$(date +%s)

# Heartbeat kaynakları:
# 1. agent-state.json last_run_ts (Orchestrator çalıştıysa güncellenir)
# 2. logs/brief-sync-last.ts (doğrudan Brief Sync launchd job'u)
# İkisinden hangisi daha yeniyse onu kullan — Orchestrator Brief Sync'i üstlenmiş olabilir.

LAST_SYNC=""

AGENT_STATE="data/agent-state.json"
if [[ -f "$AGENT_STATE" ]]; then
  AGENT_TS=$(python3 -c "import json,sys; d=json.load(open('$AGENT_STATE')); print(d.get('last_run_ts',''))" 2>/dev/null)
  if [[ -n "$AGENT_TS" && "$AGENT_TS" =~ ^[0-9]+$ ]]; then
    LAST_SYNC="$AGENT_TS"
  fi
fi

if [[ -f "$HEARTBEAT" ]]; then
  HEARTBEAT_TS=$(cat "$HEARTBEAT" | tr -d '[:space:]')
  # Daha yeniyse heartbeat'i kullan
  if [[ -z "$LAST_SYNC" || "$HEARTBEAT_TS" -gt "$LAST_SYNC" ]]; then
    LAST_SYNC="$HEARTBEAT_TS"
  fi
fi

# Hiçbir kaynak yoksa → uyar
if [[ -z "$LAST_SYNC" ]]; then
  echo "[$TIMESTAMP] UYARI: Heartbeat ve agent-state bulunamadı — sistem hiç çalışmamış olabilir." >> "$LOG"
  /opt/homebrew/bin/claude -p "Skill: benseno-notification-agent — şu mesajı benseno yöneticilerine (Görkem GM) Slack DM olarak gönder: ⚠️ *Brief Sync Watchdog:* Heartbeat ve agent-state bulunamadı. Brief Sync hiç çalışmamış veya log silinmiş olabilir. Kontrol et: launchctl list | grep benseno" --print --dangerously-skip-permissions >> "$LOG" 2>&1
  exit 1
fi

DIFF=$(( NOW_EPOCH - LAST_SYNC ))
DIFF_MIN=$(( DIFF / 60 ))
LAST_HUMAN=$(date -j -f "%s" "$LAST_SYNC" "+%H:%M" 2>/dev/null)

echo "[$TIMESTAMP] Son sync: ${LAST_HUMAN} (${DIFF_MIN} dk önce)" >> "$LOG"

# 2 saatten uzun sessizlik → uyar
if [[ $DIFF -gt 7200 ]]; then
  MSG="⚠️ *Brief Sync ${DIFF_MIN} dakikadır çalışmadı!* (Son çalışma: ${LAST_HUMAN})\nLaunchd kontrolü: \`launchctl list | grep benseno-brief\`\nManüel başlatma: \`bash ~/benseno-tasarim-sistemi/scripts/run-brief-sync.sh\`"
  echo "[$TIMESTAMP] UYARI gönderiliyor: ${DIFF_MIN} dk sessizlik" >> "$LOG"
  /opt/homebrew/bin/claude -p "Skill: benseno-notification-agent — şu mesajı benseno yöneticilerine (Görkem GM) Slack DM olarak gönder: $MSG" --print --dangerously-skip-permissions >> "$LOG" 2>&1
fi
