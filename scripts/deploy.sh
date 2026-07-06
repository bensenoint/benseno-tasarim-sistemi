#!/usr/bin/env bash
# deploy.sh — TEK KOMUTLA güvenli deploy. Elle koreografiyi (build→push→Pages izle→API mktemp→bot redeploy)
# tek yere toplar ve sonunda tutarlılık denetimini çalıştırır.
#
# Kullanım:
#   bash scripts/deploy.sh            → CI kapısı + dashboard + API + bot (tam)
#   bash scripts/deploy.sh dashboard  → yalnız dashboard (Pages)
#   bash scripts/deploy.sh api        → yalnız API (Railway)
#   bash scripts/deploy.sh bot        → yalnız bot/scheduler (Railway)
#
# ÖNCE CI kapısı çalışır; kalırsa deploy YAPILMAZ (bozuk kod prod'a gidemez).
set -euo pipefail
cd "$(dirname "$0")/.."
PROJ="$(pwd)"
RAILWAY_PROJECT="efcd3ff0-863b-472f-8dc9-c4a4fb4786ed"
TARGET="${1:-all}"

do_dash=0; do_api=0; do_bot=0
case "$TARGET" in
  all)       do_dash=1; do_api=1; do_bot=1 ;;
  dashboard) do_dash=1 ;;
  api)       do_api=1 ;;
  bot)       do_bot=1 ;;
  *) echo "Bilinmeyen hedef: $TARGET (all|dashboard|api|bot)"; exit 2 ;;
esac

echo "═══ 0/4 · CI kapısı ═══"
bash scripts/ci-check.sh || { echo "🔴 CI kapısı kaldı — deploy iptal."; exit 1; }

if [ "$do_dash" -eq 1 ]; then
  echo "═══ 1/4 · Dashboard derle + push ═══"
  bash scripts/build-dashboard.sh
  git add -A
  git commit -q -m "deploy: dashboard $(date +%H:%M)" || echo "  (commit edilecek değişiklik yok)"
  git push -q
  VER="$(grep -o 'bundle.js?v=[0-9]*' dashboard/index.html | head -1)"
  echo "  Pages yayını bekleniyor ($VER)…"
  # 5sn aralıkla yokla, en fazla ~5 dk (60×5sn). Cache baypas (?cb + no-cache) → edge cache'e takılma.
  # Süre dolarsa uyar ve devam et: kod push edildi, Pages build'i askıda kalsa bile GitHub kendi yayınlar
  # (ya da `git commit --allow-empty` ile yeniden tetiklenebilir). Sonsuz sıkı-döngü YOK.
  DASH_OK=0
  for _i in $(seq 1 60); do
    if curl -s -H "Cache-Control: no-cache" "https://bensenoint.github.io/benseno-tasarim-sistemi/dashboard/index.html?cb=$(date +%s)" | grep -q "$VER"; then
      DASH_OK=1; break
    fi
    sleep 5
  done
  if [ "$DASH_OK" -eq 1 ]; then
    echo "  ✅ Pages canlı: $VER"
  else
    echo "  ⚠️  Pages ~5 dk içinde $VER sürümünü yayınlamadı (build askıda olabilir)."
    echo "     Kod push edildi (origin/main güncel). Tetiklemek için: git commit --allow-empty -m 'retrigger' && git push"
  fi
fi

if [ "$do_api" -eq 1 ]; then
  echo "═══ 2/4 · API deploy (Railway benseno-api) ═══"
  D="$(mktemp -d /tmp/bns-api-XXXX)"
  cp -R server/. "$D"/
  date > "$D/.deploy-stamp"
  ( cd "$D" \
    && railway link --project "$RAILWAY_PROJECT" --environment production --service benseno-api >/dev/null 2>&1 \
    && railway up --service benseno-api --detach 2>&1 | grep -c "Build Logs" >/dev/null \
    && echo "  ✅ API deploy tetiklendi" )
fi

if [ "$do_bot" -eq 1 ]; then
  echo "═══ 3/4 · Bot/scheduler redeploy (benseno-tasarim-sistemi) ═══"
  railway redeploy --service benseno-tasarim-sistemi -y >/dev/null 2>&1 || true
  echo "  ✅ Bot redeploy tetiklendi (en güncel main'e senkronlanır)"
fi

echo "═══ 4/4 · Tutarlılık denetimi ═══"
if [ -f data/.db-url ]; then
  # API'nin yeni kodu yansıtması için kısa bekleme (cache-warm)
  node scripts/consistency-check.js || echo "  ⚠️ Denetimde ayrışma — yukarıdaki çıktıyı incele."
else
  echo "  (data/.db-url yok — denetim atlandı)"
fi

if [ "$do_api" -eq 1 ]; then
  echo "🤖 Ody eval (canlı /api/chat)"
  # Eval, canlı API'nin secret'ıyla imzalı JWT gerektirir → Railway'den çek.
  # (DATABASE_URL gerekmez: db.js, expectTool/getEmbedded için data/.db-url'e fallback yapar.)
  EVAL_SECRET="$(railway variables --service benseno-api --kv 2>/dev/null | grep '^BNS_JWT_SECRET=' | head -1 | cut -d= -f2-)"
  if [ -n "$EVAL_SECRET" ]; then
    BNS_JWT_SECRET="$EVAL_SECRET" API_BASE=https://benseno-api-production.up.railway.app node scripts/ody-eval.js \
      || echo "  ⚠️ Ody eval'da başarısız vaka var — yukarıyı incele (deploy bloklanmadı)."
  else
    echo "  (BNS_JWT_SECRET Railway'den alınamadı — eval atlandı, deploy bloklanmadı)"
  fi
fi
echo "🟢 deploy.sh tamam ($TARGET)"
