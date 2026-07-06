#!/bin/zsh
# Ody proaktif günlük içgörü — hft içi 08:15 (dijest'ten önce).
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/ody-icgoru.js >> logs/ody-icgoru.log 2>&1
