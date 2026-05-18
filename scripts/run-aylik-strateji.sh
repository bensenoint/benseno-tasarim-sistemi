#!/bin/zsh
# Aylık Strateji — Ay sonu (25-31 arası) 17:00
# launchd 25-31 günleri için her gün 17:00'da tetikler;
# script "bugün ayın son günü mü?" kontrol eder.

TODAY=$(date +%d)
MONTH=$(date +%m)
YEAR=$(date +%Y)

# Ayın son günü hesapla (GNU date veya BSD date uyumlu)
LAST_DAY=$(python3 -c "import calendar; print(calendar.monthrange($YEAR, $MONTH)[1])")

[[ "$TODAY" != "$LAST_DAY" ]] && exit 0

cd ~/benseno-tasarim-sistemi
source ~/.zshrc 2>/dev/null

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] Aylık Strateji başlatıldı (Ay sonu: $TODAY/$MONTH/$YEAR)..." >> logs/aylik-strateji.log

claude -p "Skill: benseno-aylik-strateji — run now" --print >> logs/aylik-strateji.log 2>&1

echo "[$TIMESTAMP] Aylık Strateji tamamlandı." >> logs/aylik-strateji.log
