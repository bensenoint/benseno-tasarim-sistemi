#!/bin/zsh
# Marka kanal özeti — hafta içi 09-19 arası saatte bir (xx:30). Tüm kanal akışını özetler.
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/kanal-ozet.js >> logs/kanal-ozet.log 2>&1
