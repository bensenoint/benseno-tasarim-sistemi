#!/bin/zsh
# Haftalık Retrospektif — Cuma 17:00
# launchd CalendarInterval ile tetiklenir.

cd ~/benseno-tasarim-sistemi
# Homebrew PATH (launchd ortamında gerekli)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
source ~/.zshrc 2>/dev/null

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] Haftalık Retro başlatıldı..." >> logs/haftalik-retro.log

/opt/homebrew/bin/claude -p "Skill: benseno-dashboard-agent — haftalik-retro — run now" --print --dangerously-skip-permissions >> logs/haftalik-retro.log 2>&1

echo "[$TIMESTAMP] Haftalık Retro tamamlandı." >> logs/haftalik-retro.log

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
