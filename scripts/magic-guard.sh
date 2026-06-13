#!/usr/bin/env bash
# magic-guard.sh — İŞ METRİĞİ FORMÜLLERİNİN TEK YERDE (calc.js) tanımlı kaldığını doğrular.
# Kapasite bug'ı (aynı formül iki yerde → ayrışma) bu sınıftandı. Bir ekran/dosya formülü
# YENİDEN TANIMLARSA CI'yı kırar. Çağırmak (fn(...)) serbest; TANIMLAMAK (function fn / fn=) yasak.
# Secret/DB gerektirmez. ci-check.sh bunu çağırır → her push'ta GitHub CI'da çalışır.
set -u
cd "$(dirname "$0")/.."
FAIL=0
FNS="bnsCapPct bnsPersonCapLimit bnsPersonCapPct bnsSureH bnsGecikmeH bnsIsRisk bnsThroughput"

for fn in $FNS; do
  # calc.js ve üretilen bundle.js HARİÇ, başka yerde 'function fn' veya 'fn =' tanımı var mı?
  hits=$(grep -rnE "function[[:space:]]+$fn\b|[^.a-zA-Z0-9_]$fn[[:space:]]*=[^=]" \
           dashboard/app --include=*.jsx --include=*.js 2>/dev/null \
         | grep -v "dashboard/app/calc.js" | grep -v "dashboard/app/bundle.js" || true)
  if [ -n "$hits" ]; then
    echo "  ❌ $fn calc.js DIŞINDA tanımlanmış (çift-tanım = ayrışma riski):"
    echo "$hits"
    FAIL=1
  fi
done

[ "$FAIL" -eq 0 ] && echo "  ✅ tüm iş formülleri yalnız calc.js'te tanımlı"
exit "$FAIL"
