#!/bin/zsh
# run-gunluk-ozet.sh — Her hft içi 17:00'de günlük sistem özeti Slack'e gönderir.
# launchd CalendarInterval ile tetiklenir.

cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
source ~/.zshrc 2>/dev/null

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
LOG="logs/gunluk-ozet.log"

echo "[$TIMESTAMP] Günlük özet başlatılıyor..." >> "$LOG"

# Bugünkü orchestrator run sayısı
TODAY=$(date '+%d.%m.%Y')
RUN_COUNT=$(grep -c "$TODAY.*Orchestrator tamamlandı" logs/orchestrator.log 2>/dev/null || echo 0)
TIMEOUT_COUNT=$(grep -c "$TODAY.*TIMEOUT" logs/orchestrator.log 2>/dev/null || echo 0)
ERROR_COUNT=$(grep -c "$TODAY.*HATA" logs/orchestrator.log 2>/dev/null || echo 0)

# agent-state.json'dan özet bilgi
AGENT_STATE="data/agent-state.json"
DM_SENT=$(python3 -c "import json; d=json.load(open('$AGENT_STATE')); print(d.get('dm_sent',0))" 2>/dev/null || echo "?")
ACTIVE=$(python3 -c "import json; d=json.load(open('$AGENT_STATE')); print(d.get('active_briefs',0))" 2>/dev/null || echo "?")
OVERDUE=$(python3 -c "import json; d=json.load(open('$AGENT_STATE')); print(d.get('overdue_count',0))" 2>/dev/null || echo "?")
ERRORS=$(python3 -c "import json; d=json.load(open('$AGENT_STATE')); errs=d.get('errors',[]); print(len(errs))" 2>/dev/null || echo "?")

# Slack botu çalışıyor mu?
# Slack Bot durumu: önce PID dosyasını dene, olmazsa launchd PID'ini al
BOT_PID=""
[[ -f logs/slack-bot.pid ]] && BOT_PID=$(cat logs/slack-bot.pid 2>/dev/null | tr -d '[:space:]')
if [[ -z "$BOT_PID" ]]; then
  BOT_PID=$(launchctl list com.benseno.slack-bot 2>/dev/null | grep '"PID"' | grep -o '[0-9]*')
fi
if [[ -n "$BOT_PID" ]] && kill -0 "$BOT_PID" 2>/dev/null; then
  BOT_STATUS="✅ çalışıyor (PID $BOT_PID)"
else
  BOT_STATUS="⚠️ çalışmıyor"
fi

# Özet mesaj oluştur
MSG="📊 *Günlük Sistem Özeti — $(date '+%d %B %Y')*

*Orchestrator:*
• Bugün ${RUN_COUNT} başarılı run
• ${TIMEOUT_COUNT} timeout · ${ERROR_COUNT} hata

*Brief Durumu:*
• ${ACTIVE} aktif · ${OVERDUE} gecikmiş
• ${DM_SENT} DM gönderildi · ${ERRORS} agent hatası

*Slack Bot:* ${BOT_STATUS}

_Son sync: $(python3 -c "import json; d=json.load(open('$AGENT_STATE')); print(d.get('last_run','?')[:16].replace('T',' '))" 2>/dev/null)_"

OUTPUT=$(timeout 120 /opt/homebrew/bin/claude -p "Skill: benseno-notification-agent — şu mesajı SADECE Görkem'e (GM) Slack DM olarak gönder, başka işlem yapma: $MSG" --print --dangerously-skip-permissions 2>&1)
EXIT_CODE=$?

echo "$OUTPUT" >> "$LOG"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

if [[ $EXIT_CODE -ne 0 ]]; then
  echo "[$TIMESTAMP] HATA: Günlük özet gönderilemedi (exit $EXIT_CODE)" >> "$LOG"
else
  echo "[$TIMESTAMP] Günlük özet tamamlandı." >> "$LOG"
fi
