#!/usr/bin/env bash
set -e
PROJ="$HOME/benseno-tasarim-sistemi"; APP="$PROJ/v2/app"
echo "🔨 v2 bundle derleniyor..."
cat "$APP/layout.js" "$APP/widgets.jsx" "$APP/ody.jsx" "$APP/panom.jsx" "$APP/render.jsx" \
  | npx esbuild --loader=jsx --jsx=transform --jsx-factory=React.createElement --jsx-fragment=React.Fragment --minify \
  > "$APP/bundle.js"
TS=$(date +%s)
sed -i '' -e "s|app/bundle\.js?v=[0-9]*|app/bundle.js?v=${TS}|g" "$PROJ/v2/index.html"
sed -i '' -e "s|app/calc\.js?v=[0-9]*|app/calc.js?v=${TS}|g" -e "s|app/data\.js?v=[0-9]*|app/data.js?v=${TS}|g" "$PROJ/v2/index.html"
echo "✅ v2/app/bundle.js hazır"
