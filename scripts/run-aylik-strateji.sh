#!/bin/zsh
# Aylık Strateji — Ay sonu (cron 25-31, script son güne kilitler). C2: deterministik + claude.
TODAY=$(date +%d); MONTH=$(date +%m); YEAR=$(date +%Y)
LAST_DAY=$(python3 -c "import calendar; print(calendar.monthrange($YEAR, $MONTH)[1])")
[[ "$TODAY" != "$LAST_DAY" ]] && exit 0
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/rapor-aylik.js >> logs/aylik-strateji.log 2>&1
