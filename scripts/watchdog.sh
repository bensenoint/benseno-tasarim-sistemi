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

# Heartbeat dosyası yoksa → hiç çalışmamış
if [[ ! -f "$HEARTBEAT" ]]; then
  echo "[$TIMESTAMP] UYARI: Heartbeat dosyası yok — Brief Sync hiç çalışmamış olabilir." >> "$LOG"
  /opt/homebrew/bin/claude -p "Skill: benseno-notification-agent — şu mesajı benseno yöneticilerine (Görkem GM) Slack DM olarak gönder: ⚠️ *Brief Sync Watchdog:* Heartbeat dosyası bulunamadı. Brief Sync hiç çalışmamış veya log silinmiş olabilir. Kontrol et: launchctl list | grep benseno" --print --dangerously-skip-permissions >> "$LOG" 2>&1
  exit 1
fi

LAST_SYNC=$(cat "$HEARTBEAT" | tr -d '[:space:]')
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
