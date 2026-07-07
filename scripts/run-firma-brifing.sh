#!/bin/zsh
# Haftalık GM brifingi (P3.3c) — Pazartesi 08:00. Opus sentezi, yönetici+GM DM.
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/firma-brifing.js >> logs/firma-brifing.log 2>&1
