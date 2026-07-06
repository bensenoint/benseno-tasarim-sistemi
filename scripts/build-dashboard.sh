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
  "$APP/screens/Bugun.jsx" \
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

# Root app/ ile senkronize et (data.js dahil)
rsync -a --delete --exclude='.gitkeep' "$APP/" "$PROJ/app/"
# Not: gallery/*.jpg dosyaları rsync ile app/gallery/'ye kopyalanır (--delete hariç tutulmadı)

# Cache-bust: bundle.js ve data.js'e timestamp ekle
TS=$(date +%s)
sed -i '' \
  -e "s|app/bundle\.js?v=[0-9]*|app/bundle.js?v=${TS}|g" \
  -e "s|app/data\.js?v=[0-9]*|app/data.js?v=${TS}|g" \
  -e "s|app/calc\.js?v=[0-9]*|app/calc.js?v=${TS}|g" \
  -e "s|app/tokens-2\.css?v=[0-9]*|app/tokens-2.css?v=${TS}|g" \
  "$PROJ/dashboard/index.html"

# Root index.html güncelle
cp "$PROJ/dashboard/index.html" "$PROJ/index.html"

SIZE=$(du -sh "$APP/bundle.js" | cut -f1)
echo "✅ bundle.js hazır ($SIZE) — dashboard/app/ ve app/ senkronize edildi"

# Root index.html'i otomatik stage et (her build'de versiyon değişiyor)
cd "$PROJ" && git add index.html 2>/dev/null || true
