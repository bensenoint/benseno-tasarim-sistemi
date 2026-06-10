#!/bin/zsh
# Marka gün-sonu insight — hafta içi 18:45. Kanal özetini tazeler + günlük insight'ı arşivler.
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
BNS_GUNSONU=1 node scripts/kanal-ozet.js >> logs/kanal-ozet.log 2>&1
