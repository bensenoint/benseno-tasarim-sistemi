#!/bin/zsh
# Kişisel iş özeti — Hft içi 07:55. Aktif işi olan her çalışana DM.
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/rapor-kisisel.js >> logs/kisisel-rapor.log 2>&1
