#!/bin/zsh
# Günlük Özet — Hft içi 17:05. C2: deterministik (DB→Slack) + claude yorum.
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/rapor-gunluk.js >> logs/gunluk-ozet.log 2>&1
