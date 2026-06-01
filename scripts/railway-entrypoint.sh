#!/usr/bin/env bash
# Railway entrypoint — gizli dosyaları env'den üretir, git'i hazırlar, scheduler'ı başlatır.
# Scriptler data/.* gizli dosyalarından okuduğu için (gitignored, image'de yok),
# bunları Railway environment variable'larından container açılışında yeniden yaratıyoruz.
set -u
PROJ="$HOME/benseno-tasarim-sistemi"
cd "$PROJ"

# env var doluysa ilgili gizli dosyayı yaz
write_secret() { [ -n "${2:-}" ] && printf '%s' "$2" > "data/$1" && echo "  ✓ data/$1"; }

echo "[entrypoint] Gizli dosyalar env'den üretiliyor..."
write_secret ".github-pat-sistem"   "${BENSENO_GITHUB_PAT:-}"
write_secret ".slack-bot-token"     "${SLACK_BOT_TOKEN:-}"
write_secret ".slack-app-token"     "${SLACK_APP_TOKEN:-}"
write_secret ".slack-user-token"    "${SLACK_USER_TOKEN:-}"
write_secret ".slack-list-id"       "${SLACK_LIST_ID:-}"
write_secret ".dashboard-auth-hash" "${DASHBOARD_AUTH_HASH:-}"

# git kimliği + PAT'li remote (otomatik commit/push için)
git config --global user.email "${GIT_AUTHOR_EMAIL:-bot@benseno.com.tr}"
git config --global user.name  "${GIT_AUTHOR_NAME:-Benseno Bot}"
git config --global --add safe.directory "$PROJ"
if [ -n "${BENSENO_GITHUB_PAT:-}" ]; then
  git remote set-url origin "https://${BENSENO_GITHUB_PAT}@github.com/bensenoint/benseno-tasarim-sistemi.git" 2>/dev/null || true
fi

echo "[entrypoint] Scheduler + Slack bot başlatılıyor (TZ=$TZ)..."
exec node scripts/scheduler.js
