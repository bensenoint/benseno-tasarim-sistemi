// Saf layout yardımcıları — DOM yok; node'da test edilir, tarayıcıda global.
// Widget örneği: { type, x, y, w, h }. gridstack 12-kolon ızgara varsayar.
var BNS_V2_WIDGETS = ["riskli-islerim", "kapasitem", "kart-akisi", "musteride", "bugun-yarin",
  "marka-yogunlugu", "cikti-hizi", "son-teslimler", "departman-ozeti"];

function bnsV2DefaultLayout() {
  return [
    { type: "riskli-islerim", x: 0, y: 0, w: 7, h: 3 },
    { type: "kapasitem",      x: 7, y: 0, w: 5, h: 3 },
    { type: "kart-akisi",     x: 0, y: 3, w: 7, h: 4 },
    { type: "musteride",      x: 7, y: 3, w: 5, h: 2 },
    { type: "bugun-yarin",    x: 7, y: 5, w: 5, h: 2 },
  ];
}

// gridstack save() çıktısı → kalıcı şekil (yalnız tip+konum). Bilinmeyen tip atılır.
function bnsV2Serialize(nodes) {
  return (nodes || [])
    .map(function (n) {
      var type = (n.el && n.el.getAttribute) ? n.el.getAttribute("data-w") : n.type;
      return { type: type, x: n.x | 0, y: n.y | 0, w: n.w | 0, h: n.h | 0 };
    })
    .filter(function (n) { return BNS_V2_WIDGETS.indexOf(n.type) !== -1; });
}

// API'den gelen layout'u doğrula; geçersizse varsayılana düş.
function bnsV2Validate(layout) {
  if (!Array.isArray(layout) || !layout.length) return bnsV2DefaultLayout();
  var ok = layout.filter(function (w) {
    return w && BNS_V2_WIDGETS.indexOf(w.type) !== -1 &&
      [w.x, w.y, w.w, w.h].every(function (v) { return typeof v === "number" && v >= 0; });
  });
  return ok.length ? ok : bnsV2DefaultLayout();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BNS_V2_WIDGETS: BNS_V2_WIDGETS, bnsV2DefaultLayout: bnsV2DefaultLayout, bnsV2Serialize: bnsV2Serialize, bnsV2Validate: bnsV2Validate };
}
