#!/bin/zsh
# Firma-seviyesi proaktif sinyaller (P3.3a) — hft içi 09:00 + 15:00. Yöneticilere push.
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/firma-sinyal.js >> logs/firma-sinyal.log 2>&1
