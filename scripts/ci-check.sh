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

echo "③ Formül kilidi (calc.js birim testleri)"
if node scripts/formula-test.js >/tmp/ci-ft 2>&1; then
  echo "  ✅ $(grep -o '[0-9]* geçti' /tmp/ci-ft | tail -1)"
else
  cat /tmp/ci-ft; FAIL=1
fi

echo "④ Formül tek-tanım güvencesi (iş metrikleri yalnız calc.js'te)"
if ! bash scripts/magic-guard.sh; then FAIL=1; fi

if [ "$FAIL" -eq 0 ]; then echo "🟢 CI KAPISI GEÇTİ"; else echo "🔴 CI KAPISI KALDI"; fi
exit "$FAIL"
