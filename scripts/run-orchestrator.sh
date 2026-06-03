#!/bin/zsh
# run-orchestrator.sh — Benseno Ana Orkestratör
# launchd tarafından her dakika çağrılır; :15/:45 kontrolü burada yapılır.
# benseno-brief-sync'in yerini almıştır.

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

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

LOCKFILE="/tmp/benseno-orchestrator.lock"

# Önceki run hâlâ çalışıyorsa atla
if [ -f "$LOCKFILE" ]; then
  LOCK_PID=$(cat "$LOCKFILE" 2>/dev/null)
  if kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "[$(date '+%d.%m.%Y %H:%M')] SKIP: Orchestrator zaten çalışıyor (PID $LOCK_PID)" >> "$LOG"
    exit 0
  else
    # Ölü PID — eski lock temizle
    rm -f "$LOCKFILE"
  fi
fi

echo $$ > "$LOCKFILE"
trap "rm -f '$LOCKFILE'" EXIT INT TERM

echo "[$(date '+%d.%m.%Y %H:%M')] Orchestrator başlatılıyor..." >> "$LOG"

cd "$PROJ"
source ~/.zshrc 2>/dev/null

# ── Boş-run guard ─────────────────────────────────────────────────────────────
# Yeni brief yoksa (brief-queue boş) VE son tam-run <2sa önceyse → claude'u ATLA,
# deterministik recalc çalıştır (auto-priority güncel kalır). Aksi halde tam run.
# Bot her yeni brief'i queue'ya yazar → kuyruk dolu = işlenecek yeni iş var (≤30dk gecikme korunur).
QUEUE="$PROJ/data/brief-queue.json"
LASTFULL="$PROJ/logs/last-full-run.ts"
NOW_TS=$(date +%s)
LF_TS=$(cat "$LASTFULL" 2>/dev/null || echo 0)
QN=$(node -e "try{console.log((JSON.parse(require('fs').readFileSync('$QUEUE','utf8'))||[]).length)}catch(e){console.log(0)}" 2>/dev/null || echo 0)
NEED_FULL=0
[ "${QN:-0}" -gt 0 ] && NEED_FULL=1                  # kuyrukta yeni brief var
[ $(( NOW_TS - LF_TS )) -ge 7200 ] && NEED_FULL=1    # 2 saattir tam run yok (güvenlik ağı — bot kaçırmışsa yakalar)

if [ $NEED_FULL -eq 1 ]; then
  echo "[$(date '+%d.%m.%Y %H:%M')] TAM run (queue=$QN, son tam run $(( (NOW_TS - LF_TS) / 60 ))dk önce)..." >> "$LOG"
  timeout 900 $CLAUDE -p "Skill: benseno-orchestrator — run" \
    --model sonnet \
    --dangerously-skip-permissions \
    --print \
    >> "$LOG" 2>&1
  CLAUDE_EXIT=$?
  [ $CLAUDE_EXIT -eq 0 ] && date +%s > "$LASTFULL"
else
  echo "[$(date '+%d.%m.%Y %H:%M')] BOŞ döngü — claude atlandı (yeni brief yok). Deterministik recalc." >> "$LOG"
  node "$PROJ/scripts/recalc.js" >> "$PROJ/logs/recalc.log" 2>&1 || echo "[$(date '+%d.%m.%Y %H:%M')] recalc hata" >> "$LOG"
  CLAUDE_EXIT=0
fi

# timeout komutu 124 döndürür — özel mesaj yaz
if [ $CLAUDE_EXIT -eq 124 ]; then
  echo "[$(date '+%d.%m.%Y %H:%M')] TIMEOUT: Claude 15 dakikada tamamlanamadı — zorla sonlandırıldı." >> "$LOG"
  echo "timeout ts=$(date +%s)" >> "$PROJ/logs/orchestrator-errors.log"
fi

# Heartbeat: her durumda güncelle (başarılı da olsa başarısız da olsa)
date +%s > "$PROJ/logs/brief-sync-last.ts"

if [ $CLAUDE_EXIT -ne 0 ]; then
  echo "[$(date '+%d.%m.%Y %H:%M')] HATA: Claude çıkış kodu $CLAUDE_EXIT — orchestrator başarısız olmuş olabilir." >> "$LOG"
  # Watchdog'a sinyal: başarısız çalışma not et
  echo "claude_exit=$CLAUDE_EXIT ts=$(date +%s)" >> "$PROJ/logs/orchestrator-errors.log"
fi

echo "[$(date '+%d.%m.%Y %H:%M')] Orchestrator tamamlandı. (exit: $CLAUDE_EXIT)" >> "$LOG"

# Yönetici reaction override'larını taze live-data'ya yeniden uygula (deterministik) —
# data-agent headless'ta reaction okuyamadığı için auto-priority override'ı geri almasın.
if [ $CLAUDE_EXIT -eq 0 ]; then
  node "$PROJ/scripts/reaction-override.js" --reapply >> "$PROJ/logs/reaction-override.log" 2>&1 || \
    echo "[$(date '+%d.%m.%Y %H:%M')] reaction-override --reapply hata" >> "$LOG"
  # 🎨/👀 durum geçişlerini taze veriye geri uygula (data-agent reaction okuyamıyor)
  node "$PROJ/scripts/brief-status.js" --reapply >> "$PROJ/logs/brief-status.log" 2>&1 || \
    echo "[$(date '+%d.%m.%Y %H:%M')] brief-status --reapply hata" >> "$LOG"
  # ✅ tamamlanmış brief'leri completed'de tut (data-agent Canvas'tan aktif geri getirdiyse taşı)
  node "$PROJ/scripts/complete-brief.js" --reapply >> "$PROJ/logs/complete-brief.log" 2>&1 || \
    echo "[$(date '+%d.%m.%Y %H:%M')] complete-brief --reapply hata" >> "$LOG"
  # 💰 maliyet/satış'ı taze live-data'ya geri uygula (data-agent finansalları okuyamaz)
  node "$PROJ/scripts/set-financials.js" --reapply >> "$PROJ/logs/set-financials.log" 2>&1 || \
    echo "[$(date '+%d.%m.%Y %H:%M')] set-financials --reapply hata" >> "$LOG"
fi

# Gecikme escalation (deterministik script — LLM değil) — sadece başarılı run'da,
# taze live-data.json üzerinde. Kendi state'ini (escalation-state.json) push eder.
if [ $CLAUDE_EXIT -eq 0 ]; then
  node "$PROJ/scripts/escalation.js" --send >> "$PROJ/logs/escalation.log" 2>&1 || \
    echo "[$(date '+%d.%m.%Y %H:%M')] escalation.js hata (logs/escalation.log)" >> "$LOG"
fi

# Gerçek claude exit kodunu döndür (scheduler izlesin — eskiden son echo 0 döndürüp
# claude hatalarını maskeliyordu). Lock trap'i yine çalışır.
exit $CLAUDE_EXIT
