#!/usr/bin/env bash
# Railway entrypoint — gizli dosyaları env'den üretir, git'i hazırlar, scheduler'ı başlatır.
# Scriptler data/.* gizli dosyalarından okuduğu için (gitignored, image'de yok),
# bunları Railway environment variable'larından container açılışında yeniden yaratıyoruz.
set -u
PROJ="$HOME/benseno-tasarim-sistemi"
cd "$PROJ"

# logs/ .dockerignore ile hariç tutuluyor → image'de yok. run-*.sh hepsi
# `>> logs/*.log` yazıyor; dizin yoksa redirect açılamaz → claude hiç çalışmaz
# (exit 1, 0sn). Her boot'ta oluştur (ephemeral fs).
mkdir -p "$PROJ/logs"

# env var doluysa ilgili gizli dosyayı yaz
write_secret() { [ -n "${2:-}" ] && printf '%s' "$2" > "data/$1" && echo "  ✓ data/$1"; }

echo "[entrypoint] Gizli dosyalar env'den üretiliyor..."
write_secret ".github-pat-sistem"   "${BENSENO_GITHUB_PAT:-}"
write_secret ".slack-bot-token"     "${SLACK_BOT_TOKEN:-}"
write_secret ".slack-app-token"     "${SLACK_APP_TOKEN:-}"
write_secret ".slack-user-token"    "${SLACK_USER_TOKEN:-}"
write_secret ".slack-list-id"       "${SLACK_LIST_ID:-}"
write_secret ".dashboard-auth-hash" "${DASHBOARD_AUTH_HASH:-}"

# git kimliği
git config --global user.email "${GIT_AUTHOR_EMAIL:-bot@benseno.com.tr}"
git config --global user.name  "${GIT_AUTHOR_NAME:-Benseno Bot}"
git config --global --add safe.directory "$PROJ"

# git BOOTSTRAP — Railway build kaynağı .git İÇERMEYEBİLİR (özellikle workspace
# transfer / snapshot redeploy). O zaman tüm push'lar "not a git repository" (exit 128)
# verir → dashboard hiç güncellenmez. Bu yüzden her boot'ta git'i origin/main'den
# deterministik kuruyoruz. reset --hard tracked dosyaları origin/main'e eşitler;
# secret'lar + node_modules + logs gitignored=untracked olduğu için KORUNUR.
if [ -n "${BENSENO_GITHUB_PAT:-}" ]; then
  REMOTE="https://${BENSENO_GITHUB_PAT}@github.com/bensenoint/benseno-tasarim-sistemi.git"
  git init -q
  git remote remove origin 2>/dev/null || true
  git remote add origin "$REMOTE"
  if git fetch origin main -q; then
    git reset --hard origin/main && git branch -M main 2>/dev/null
    git branch --set-upstream-to=origin/main main 2>/dev/null || true
    echo "[entrypoint] ✓ git origin/main'e senkronlandı ($(git rev-parse --short HEAD 2>/dev/null))"
  else
    echo "[entrypoint] ⚠️ git fetch başarısız — push çalışmayabilir (ağ/PAT kontrol et)"
  fi
fi

echo "[entrypoint] Scheduler + Slack bot başlatılıyor (TZ=$TZ)..."
exec node scripts/scheduler.js
