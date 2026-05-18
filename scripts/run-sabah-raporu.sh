#!/bin/zsh
# Sabah Raporu — Hft içi 07:50
# launchd CalendarInterval ile tetiklenir, doğrudan çalışır.

cd ~/benseno-tasarim-sistemi
source ~/.zshrc 2>/dev/null

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] Sabah Raporu başlatıldı..." >> logs/sabah-raporu.log

claude -p "Skill: benseno-gunluk-performans — run now" --print >> logs/sabah-raporu.log 2>&1

echo "[$TIMESTAMP] Sabah Raporu tamamlandı." >> logs/sabah-raporu.log
