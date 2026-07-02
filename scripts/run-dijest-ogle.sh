#!/bin/zsh
# Kişisel dijest — hft içi 13:30 (öğle).
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/rapor-dijest.js --slot=ogle >> logs/dijest.log 2>&1
