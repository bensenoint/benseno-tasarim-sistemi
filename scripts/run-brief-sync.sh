#!/bin/zsh
# Brief Sync — Hft içi 08:00-17:30, :15 ve :45'te çalışır
# launchd bu script'i her dakika çağırır; script dakikayı kontrol eder.

HOUR=$(date +%H)
DOW=$(date +%u)   # 1=Pzt … 5=Cum, 6=Cmt, 7=Pzr
MIN=$(date +%M)

# Hafta sonu veya mesai dışı → çıkış
[[ "$DOW" -gt 5 ]] && exit 0
[[ "$HOUR" -lt 8 || "$HOUR" -gt 17 ]] && exit 0
[[ "$HOUR" -eq 17 && "$MIN" -gt 30 ]] && exit 0

# :15 veya :45 değilse → çıkış
[[ "$MIN" != "15" && "$MIN" != "45" ]] && exit 0

cd ~/benseno-tasarim-sistemi
# Homebrew PATH (launchd ortamında gerekli)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
source ~/.zshrc 2>/dev/null

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] Brief Sync başlatıldı..." >> logs/brief-sync.log

/opt/homebrew/bin/claude -p "Skill: benseno-brief-sync — run now" --print --dangerously-skip-permissions >> logs/brief-sync.log 2>&1

echo "[$TIMESTAMP] Brief Sync tamamlandı." >> logs/brief-sync.log

# Watchdog heartbeat — son başarılı çalışma zamanını kaydet
date +%s > logs/brief-sync-last.ts

# Root index.html'yi dashboard/index.html ile senkronize et (GitHub Pages için)
cp ~/benseno-tasarim-sistemi/dashboard/index.html ~/benseno-tasarim-sistemi/index.html 2>/dev/null

# GitHub'a push (değişiklik varsa)
GITHUB_PAT=$(cat ~/benseno-tasarim-sistemi/data/.github-pat-sistem 2>/dev/null)
if [[ -n "$GITHUB_PAT" ]]; then
  cd ~/benseno-tasarim-sistemi
  git add -A -- ':!data/.github-pat*' ':!data/.slack*' ':!data/.dashboard*' ':!data/canvas_cache.md' ':!logs/' 2>/dev/null
  if ! git diff --cached --quiet; then
    git commit -m "Auto: Brief Sync $(date '+%Y-%m-%d %H:%M')" 2>/dev/null
    git remote set-url origin "https://$GITHUB_PAT@github.com/bensenoint/benseno-tasarim-sistemi.git"
    git push origin main >> logs/brief-sync.log 2>&1
    echo "[$TIMESTAMP] GitHub push OK" >> logs/brief-sync.log
  fi
fi
