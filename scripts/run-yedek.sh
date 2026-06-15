#!/bin/zsh
# Günlük DB yedeği — pg_dump → gzip → db_backups (rolling 2). scheduler.js tetikler.
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/backup-db.js >> logs/yedek.log 2>&1
