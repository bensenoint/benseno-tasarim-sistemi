#!/usr/bin/env bash
# ci-check.sh — SECRET GEREKTİRMEYEN güvenlik kapısı (CI + yerel).
# Bozuk JS/JSX'in prod'a gitmesini engeller. DB/API erişimi YOK → her ortamda çalışır.
#   1) server/ ve scripts/ altındaki .js dosyalarında sözdizimi (node --check)
#   2) dashboard/app/ data.js + live-data.js sözdizimi
#   3) tüm .jsx dosyalarının esbuild ile derlenebildiği (JSX parse hatası yakalar)
# Çıkış: hata varsa 1.
set -u
cd "$(dirname "$0")/.."
FAIL=0

echo "① JS sözdizimi (server/ + scripts/ + dashboard data)"
for f in server/*.js scripts/*.js dashboard/app/data.js dashboard/app/live-data.js; do
  [ -f "$f" ] || continue
  if node --check "$f" 2>/tmp/ci-err; then
    echo "  ✅ $f"
  else
    echo "  ❌ $f"; cat /tmp/ci-err; FAIL=1
  fi
done

echo "② JSX derlenebilirlik (esbuild parse)"
for f in dashboard/app/*.jsx dashboard/app/screens/*.jsx; do
  [ -f "$f" ] || continue
  if npx --yes esbuild --loader=jsx --jsx=transform --jsx-factory=React.createElement --jsx-fragment=React.Fragment >/dev/null 2>/tmp/ci-err < "$f"; then
    :
  else
    echo "  ❌ $f"; cat /tmp/ci-err; FAIL=1
  fi
done
[ "$FAIL" -eq 0 ] && echo "  ✅ tüm .jsx derlendi"

if [ "$FAIL" -eq 0 ]; then echo "🟢 CI KAPISI GEÇTİ"; else echo "🔴 CI KAPISI KALDI"; fi
exit "$FAIL"
