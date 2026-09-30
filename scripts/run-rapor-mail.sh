#!/bin/zsh
# Rapor e-postaları — mod parametresiyle çağrılır (scheduler.js):
#   run-rapor-mail.sh sabah|aksam|hafta-plan|hafta-ozet|ay-bas|ay-son
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
MOD="${1:-sabah}"
node scripts/rapor-mail.js --mod="$MOD" >> "logs/rapor-mail-$MOD.log" 2>&1
