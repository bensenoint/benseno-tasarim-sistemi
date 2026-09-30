#!/bin/zsh
# Akıllı bildirimler — hafta içi 09-19 saat başı (:15). termin-risk'in yerini aldı.
# Sinyaller: termin riski, fiilî gecikme+uzatma önerisi, hareketsiz iş, müşteride bekleyen.
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/akilli-bildirim.js >> logs/akilli-bildirim.log 2>&1
