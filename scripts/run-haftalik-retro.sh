#!/bin/zsh
# Haftalık Retrospektif — Cuma 17:00
# launchd CalendarInterval ile tetiklenir.

cd ~/benseno-tasarim-sistemi
source ~/.zshrc 2>/dev/null

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] Haftalık Retro başlatıldı..." >> logs/haftalik-retro.log

claude -p "Skill: benseno-haftalik-retrospektif — run now" --print >> logs/haftalik-retro.log 2>&1

echo "[$TIMESTAMP] Haftalık Retro tamamlandı." >> logs/haftalik-retro.log
