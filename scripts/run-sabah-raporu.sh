#!/bin/zsh
# Sabah Raporu — Hft içi 07:50
# launchd CalendarInterval ile tetiklenir, doğrudan çalışır.

cd ~/benseno-tasarim-sistemi
# Homebrew PATH (launchd ortamında gerekli)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
source ~/.zshrc 2>/dev/null

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] Sabah Raporu başlatıldı..." >> logs/sabah-raporu.log

/opt/homebrew/bin/claude -p "Skill: benseno-gunluk-performans — run now" --print --dangerously-skip-permissions >> logs/sabah-raporu.log 2>&1

echo "[$TIMESTAMP] Sabah Raporu tamamlandı." >> logs/sabah-raporu.log
