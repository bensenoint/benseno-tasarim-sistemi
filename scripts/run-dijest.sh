#!/bin/zsh
# Kişisel dijest — hft içi 08:30 (sabah).
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/rapor-dijest.js >> logs/dijest.log 2>&1
