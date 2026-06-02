#!/bin/zsh
# Sabah Raporu — Hft içi 07:50
# launchd CalendarInterval ile tetiklenir, doğrudan çalışır.

cd ~/benseno-tasarim-sistemi
# Homebrew PATH (launchd ortamında gerekli)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
source ~/.zshrc 2>/dev/null

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] Sabah Raporu başlatıldı..." >> logs/sabah-raporu.log

OUTPUT=$(timeout 900 /opt/homebrew/bin/claude -p "Skill: benseno-dashboard-agent — sabah-raporu" --model sonnet --print --dangerously-skip-permissions 2>&1)
EXIT_CODE=$?

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "$OUTPUT" >> logs/sabah-raporu.log

if [[ $EXIT_CODE -eq 124 ]]; then
  echo "[$TIMESTAMP] TIMEOUT: Sabah Raporu 15 dakikada tamamlanamadı." >> logs/sabah-raporu.log
  exit 1
fi

if [[ $EXIT_CODE -ne 0 ]]; then
  echo "[$TIMESTAMP] HATA: Sabah Raporu başarısız (exit $EXIT_CODE) — tamamlandı sayılmadı." >> logs/sabah-raporu.log
  exit $EXIT_CODE
fi

# Çıktı boş mu kontrol et (Claude sessizce çıktıysa)
OUTPUT_LEN=$(echo "$OUTPUT" | tr -d '[:space:]' | wc -c | tr -d ' ')
if [[ "$OUTPUT_LEN" -lt 50 ]]; then
  echo "[$TIMESTAMP] UYARI: Sabah Raporu çıktısı çok kısa (${OUTPUT_LEN}k) — başarılı olmayabilir." >> logs/sabah-raporu.log
  exit 1
fi

echo "[$TIMESTAMP] Sabah Raporu tamamlandı. (${OUTPUT_LEN} karakter)" >> logs/sabah-raporu.log

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
