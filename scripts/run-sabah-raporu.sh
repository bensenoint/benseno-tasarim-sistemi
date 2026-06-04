#!/bin/zsh
# Sabah Raporu — Hft içi 07:50. C2: deterministik (DB→Slack) + claude yorum.
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/rapor-sabah.js >> logs/sabah-raporu.log 2>&1
