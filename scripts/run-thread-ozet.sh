#!/bin/zsh
# Thread özeti — hafta içi 09-19 arası 2 saatte bir. Aktif brief thread'lerini özetler.
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/thread-ozet.js >> logs/thread-ozet.log 2>&1
# Kapasite v2 saatlik arşivi (hibrit) — aynı saatlik ritim; dedup server'da.
node scripts/kapasite-snapshot.js >> logs/kapasite-snapshot.log 2>&1
