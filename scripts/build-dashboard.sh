#!/bin/zsh
# build-dashboard.sh — JSX'leri bundle.js'e derler ve her iki konuma kopyalar
# Kullanım: ~/benseno-tasarim-sistemi/scripts/build-dashboard.sh

set -e
PROJ="$HOME/benseno-tasarim-sistemi"
APP="$PROJ/dashboard/app"

echo "🔨 Bundle derleniyor..."

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
  "$APP/screens/Completed.jsx" \
  "$APP/screens/DeptCompare.jsx" \
  "$APP/screens/Department.jsx" \
  "$APP/screens/History.jsx" \
  "$APP/screens/Gallery.jsx" \
  "$APP/screens/Multi.jsx" \
  "$APP/screens/Brand.jsx" \
  "$APP/screens/Team.jsx" \
  "$APP/screens/Profile.jsx" \
  "$APP/Chrome.jsx" \
  "$APP/App.jsx" \
  | npx esbuild \
      --loader=jsx \
      --jsx=transform \
      --jsx-factory=React.createElement \
      --jsx-fragment=React.Fragment \
      --minify-whitespace \
  > "$APP/bundle.js"

# Root app/ ile senkronize et
rsync -a --delete "$APP/" "$PROJ/app/"

# Root index.html güncelle
cp "$PROJ/dashboard/index.html" "$PROJ/index.html"

SIZE=$(du -sh "$APP/bundle.js" | cut -f1)
echo "✅ bundle.js hazır ($SIZE) — dashboard/app/ ve app/ senkronize edildi"
