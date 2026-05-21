#!/bin/zsh
# Aylık Strateji — Ay sonu (25-31 arası) 17:00
# launchd 25-31 günleri için her gün 17:00'da tetikler;
# script "bugün ayın son günü mü?" kontrol eder.

TODAY=$(date +%d)
MONTH=$(date +%m)
YEAR=$(date +%Y)

# Ayın son günü hesapla (GNU date veya BSD date uyumlu)
LAST_DAY=$(python3 -c "import calendar; print(calendar.monthrange($YEAR, $MONTH)[1])")

[[ "$TODAY" != "$LAST_DAY" ]] && exit 0

cd ~/benseno-tasarim-sistemi
# Homebrew PATH (launchd ortamında gerekli)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
source ~/.zshrc 2>/dev/null

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] Aylık Strateji başlatıldı (Ay sonu: $TODAY/$MONTH/$YEAR)..." >> logs/aylik-strateji.log

/opt/homebrew/bin/claude -p "Skill: benseno-dashboard-agent — aylik-strateji — run now" --print --dangerously-skip-permissions >> logs/aylik-strateji.log 2>&1

echo "[$TIMESTAMP] Aylık Strateji tamamlandı." >> logs/aylik-strateji.log

# GitHub'a push (değişiklik varsa)
GITHUB_PAT=$(cat ~/benseno-tasarim-sistemi/data/.github-pat-sistem 2>/dev/null)
if [[ -n "$GITHUB_PAT" ]]; then
  cd ~/benseno-tasarim-sistemi
  git add -A -- ':!data/.github-pat*' ':!data/.slack*' ':!data/.dashboard*' ':!data/canvas_cache.md' ':!logs/' 2>/dev/null
  if ! git diff --cached --quiet; then
    git commit -m "Auto: $(basename $0 .sh) $(date '+%Y-%m-%d %H:%M')" 2>/dev/null
    git remote set-url origin "https://$GITHUB_PAT@github.com/bensenoint/benseno-tasarim-sistemi.git"
    git push origin main >> logs/$(basename $0 .sh).log 2>&1
  fi
fi
