#!/usr/bin/env bash
# build-portal.sh — Müşteri Portalı shell'ini v2 shell'inden türetir (görüntü birebir).
# Önce build-v2.sh çalışmış olmalı (v2/index.html damgalı bundle sürümünü taşır).
# Değişenler: başlık, BNS_PORTAL bayrağı, script yolları ../v2/app/, V2 şeridi yok, SW yok.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 - <<'PY'
import re
s = open('v2/index.html').read()
s = s.replace('<title>[V2] Benseno Dashboard · Pano + Raporlar</title>',
              '<title>Benseno · Müşteri Portalı</title>')
# V2 geliştirme şeridini kaldır
s = re.sub(r'<div[^>]*>V2 · GELİŞTİRME</div>\n?', '', s)
# Service worker kaydını portalda kapat
s = s.replace("if ('serviceWorker' in navigator) {", "if (false && 'serviceWorker' in navigator) {")
# Uygulama script/stil yolları → v2/app (portal ayrı dizinden servis edilir)
s = s.replace('href="app/', 'href="../v2/app/').replace('src="app/', 'src="../v2/app/')
# Portal bayrağı + OTURUM YALITIMI — app scriptlerinden ÖNCE.
# Aynı origin'de (github.io) portal ve dashboard aynı bns_token anahtarını paylaşıyordu:
# müşteri girişi personel oturumunu eziyordu. Prototype-patch, portal sayfasındaki TÜM
# localStorage bns_token/bns_user erişimlerini şeffafça portal_* anahtarlarına yönlendirir.
s = s.replace('<script src="../v2/app/calc.js',
              '''<script>
window.BNS_PORTAL = true;
(function(){
  var MAP = { bns_token: "portal_bns_token", bns_user: "portal_bns_user" };
  var g = Storage.prototype.getItem, st = Storage.prototype.setItem, rm = Storage.prototype.removeItem;
  Storage.prototype.getItem    = function(k){ return g.call(this, MAP[k] || k); };
  Storage.prototype.setItem    = function(k, v){ return st.call(this, MAP[k] || k, v); };
  Storage.prototype.removeItem = function(k){ return rm.call(this, MAP[k] || k); };
})();
</script>
<script src="../v2/app/calc.js''', 1)
open('portal/index.html', 'w').write(s)
print('✅ portal/index.html üretildi (v2 shell + BNS_PORTAL)')
PY
