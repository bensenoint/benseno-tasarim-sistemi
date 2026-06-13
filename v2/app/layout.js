// Saf layout yardımcıları — DOM yok; node'da test edilir, tarayıcıda global.
// Panom yerleşimi: { id, type, x, y, w, h }. 12-kolon ızgara.
var BNS_V2_WIDGETS = ["risk", "capacity", "working", "client", "today",
  "brandload", "output", "gallery", "dept", "aktif", "kanban", "onay",
  "tamam", "gecmis", "marka", "ekip", "plan", "karsi"];

function bnsV2DefaultLayout() {
  return [
    { id: "risk", type: "risk", x: 0, y: 0, w: 4, h: 3 },
    { id: "capacity", type: "capacity", x: 4, y: 0, w: 4, h: 3 },
    { id: "client", type: "client", x: 8, y: 0, w: 4, h: 3 },
    { id: "working", type: "working", x: 0, y: 3, w: 6, h: 4 },
    { id: "today", type: "today", x: 6, y: 3, w: 6, h: 4 },
  ];
}

// API'ye yazılacak şekil — yalnız tip+konum, bilinmeyen tip atılır.
function bnsV2Serialize(items) {
  return (items || [])
    .map(function (w) { return { id: w.id || w.type, type: w.type, x: w.x | 0, y: w.y | 0, w: w.w | 0, h: w.h | 0 }; })
    .filter(function (w) { return BNS_V2_WIDGETS.indexOf(w.type) !== -1; });
}

// API/localStorage'dan gelen layout'u doğrula; geçersizse varsayılana düş.
function bnsV2Validate(layout) {
  if (!Array.isArray(layout) || !layout.length) return bnsV2DefaultLayout();
  var ok = layout.filter(function (w) {
    return w && BNS_V2_WIDGETS.indexOf(w.type) !== -1 &&
      [w.x, w.y, w.w, w.h].every(function (v) { return typeof v === "number" && v >= 0; });
  }).map(function (w) { return { id: w.id || w.type, type: w.type, x: w.x, y: w.y, w: w.w, h: w.h }; });
  return ok.length ? ok : bnsV2DefaultLayout();
}

if (typeof window !== "undefined") {
  window.BNS_V2_WIDGETS = BNS_V2_WIDGETS; window.bnsV2DefaultLayout = bnsV2DefaultLayout;
  window.bnsV2Serialize = bnsV2Serialize; window.bnsV2Validate = bnsV2Validate;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { BNS_V2_WIDGETS: BNS_V2_WIDGETS, bnsV2DefaultLayout: bnsV2DefaultLayout, bnsV2Serialize: bnsV2Serialize, bnsV2Validate: bnsV2Validate };
}
