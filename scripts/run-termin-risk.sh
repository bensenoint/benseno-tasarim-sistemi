#!/bin/zsh
# Termin Riski — hafta ici sabah 09:35. Teslime <=24sa kalan aktif briefleri
# thread'e uyarir (idempotent: 20sa icinde tekrar atmaz). calc.js bnsIsRisk kurali.
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/termin-risk.js >> logs/termin-risk.log 2>&1
