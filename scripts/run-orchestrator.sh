#!/bin/zsh
# run-orchestrator.sh — Benseno Ana Orkestratör
# launchd tarafından her dakika çağrılır; :15/:45 kontrolü burada yapılır.
# benseno-brief-sync'in yerini almıştır.

HOUR=$(date +%H)
DOW=$(date +%u)   # 1=Pazartesi 7=Pazar
MIN=$(date +%M)
PROJ="$HOME/benseno-tasarim-sistemi"
LOG="$PROJ/logs/orchestrator.log"
CLAUDE=/opt/homebrew/bin/claude

# Hafta sonu kontrolü
[ "$DOW" -gt "5" ] && exit 0
# Mesai dışı (08:00–17:59)
[ "$HOUR" -lt "8" ] || [ "$HOUR" -gt "17" ] && exit 0
# Sadece :15 ve :45
[ "$MIN" != "15" ] && [ "$MIN" != "45" ] && exit 0

echo "[$(date '+%d.%m.%Y %H:%M')] Orchestrator başlatılıyor..." >> "$LOG"

cd "$PROJ"
source ~/.zshrc 2>/dev/null

$CLAUDE -p "Skill: benseno-orchestrator — run" \
  --dangerously-skip-permissions \
  --print \
  >> "$LOG" 2>&1

CLAUDE_EXIT=$?

# Heartbeat: her durumda güncelle (başarılı da olsa başarısız da olsa)
date +%s > "$PROJ/logs/brief-sync-last.ts"

if [ $CLAUDE_EXIT -ne 0 ]; then
  echo "[$(date '+%d.%m.%Y %H:%M')] HATA: Claude çıkış kodu $CLAUDE_EXIT — orchestrator başarısız olmuş olabilir." >> "$LOG"
  # Watchdog'a sinyal: başarısız çalışma not et
  echo "claude_exit=$CLAUDE_EXIT ts=$(date +%s)" >> "$PROJ/logs/orchestrator-errors.log"
fi

echo "[$(date '+%d.%m.%Y %H:%M')] Orchestrator tamamlandı. (exit: $CLAUDE_EXIT)" >> "$LOG"
