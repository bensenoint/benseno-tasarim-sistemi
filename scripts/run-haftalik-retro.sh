#!/bin/zsh
# Haftalık Retro — Cuma 17:10 (cron gated). C2: deterministik (DB→Slack) + claude yorum.
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/rapor-haftalik.js >> logs/haftalik-retro.log 2>&1
