#!/bin/zsh
# build-v2.sh — v2 SANDBOX bundle'ı. Yalnız v2/ klasörünü derler/günceller.
# Canlı dashboard/ ve root app/ DOKUNULMAZ. Tasarım denemeleri için.
# Kullanım: bash scripts/build-v2.sh

set -e
PROJ="$HOME/benseno-tasarim-sistemi"
APP="$PROJ/v2/app"

echo "🔨 v2 bundle derleniyor..."

cat \
  "$APP/Icons.jsx" \
  "$APP/Atoms.jsx" \
  "$APP/Cards.jsx" \
  "$APP/BriefTable.jsx" \
  "$APP/BriefDrawer.jsx" \
  "$APP/CommandPalette.jsx" \
  "$APP/NewBrief.jsx" \
  "$APP/tweaks-panel.jsx" \
  "$APP/screens/Overview.jsx" \
  "$APP/screens/Manager.jsx" \
  "$APP/screens/Jobs.jsx" \
  "$APP/screens/Plan.jsx" \
  "$APP/screens/Kanban.jsx" \
  "$APP/screens/Musteride.jsx" \
  "$APP/screens/Completed.jsx" \
  "$APP/screens/DeptCompare.jsx" \
  "$APP/screens/Department.jsx" \
  "$APP/screens/History.jsx" \
  "$APP/screens/Gallery.jsx" \
  "$APP/screens/Multi.jsx" \
  "$APP/screens/Brand.jsx" \
  "$APP/screens/Team.jsx" \
  "$APP/screens/Profile.jsx" \
  "$APP/screens/Login.jsx" \
  "$APP/screens/Users.jsx" \
  "$APP/screens/Silinenler.jsx" \
  "$APP/screens/Help.jsx" \
  "$APP/screens/Lab.jsx" \
  "$APP/Panom.jsx" \
  "$APP/Chrome.jsx" \
  "$APP/App.jsx" \
  | npx esbuild \
      --loader=jsx \
      --jsx=transform \
      --jsx-factory=React.createElement \
      --jsx-fragment=React.Fragment \
      --minify \
  > "$APP/bundle.js"

# Cache-bust: yalnız v2/index.html
TS=$(date +%s)
sed -i '' \
  -e "s|app/bundle\.js?v=[0-9]*|app/bundle.js?v=${TS}|g" \
  -e "s|app/data\.js?v=[0-9]*|app/data.js?v=${TS}|g" \
  -e "s|app/calc\.js?v=[0-9]*|app/calc.js?v=${TS}|g" \
  -e "s|app/tokens-2\.css?v=[0-9]*|app/tokens-2.css?v=${TS}|g" \
  "$PROJ/v2/index.html"

SIZE=$(du -sh "$APP/bundle.js" | cut -f1)
echo "✅ v2/app/bundle.js hazır ($SIZE) — yalnız v2/ güncellendi (canlı dokunulmadı)"
