// Panom kabuğu — gridstack ızgara + React-mount widget'lar + düzenle modu + layout kalıcılık.
var API_V2 = window.BNS_API_BASE || "https://benseno-api-production.up.railway.app";
function tokV2() { return (typeof localStorage !== "undefined" && localStorage.getItem("bns_token")) || ""; }

// EMBEDDED → BNS_DATA köprüsü. v2 bundle'ında (taze yol) tanımlı; paylaşılan data.js'in
// Fastly cache durumuna BAĞIMLI DEĞİL. Hidrasyon helper'ları bugünden eski → bayat data.js'te bile var.
function v2Apply(ed) {
  if (!ed || typeof ed !== "object") return;
  window.EMBEDDED_DATA = ed;
  var D = window.BNS_DATA = window.BNS_DATA || {};
  var sm = window.bnsSafeMap || function (a, f) { return (a || []).map(f); };
  try {
    if (Array.isArray(ed.bns_brands)) D.BRANDS = ed.bns_brands;
    if (Array.isArray(ed.bns_users)) D.USERS = window.bnsMergeUser ? ed.bns_users.map(window.bnsMergeUser) : ed.bns_users;
    if (Array.isArray(ed.bns_briefs)) D.briefs = window.bnsHydrateBrief ? sm(ed.bns_briefs, window.bnsHydrateBrief, "brief") : ed.bns_briefs;
    if (Array.isArray(ed.bns_completed)) D.completed = window.bnsHydrateCompleted ? sm(ed.bns_completed, window.bnsHydrateCompleted, "completed") : ed.bns_completed;
    if (ed.bns_dept_stats) D.deptStats = window.bnsNormDeptStats ? window.bnsNormDeptStats(ed.bns_dept_stats) : ed.bns_dept_stats;
    if (typeof window.bnsApplyExtras === "function") window.bnsApplyExtras(ed);
    D.__source = "live_briefs";
  } catch (e) { console.warn("[v2] apply hata:", e.message); }
}
var btnV2 = { padding: "6px 11px", border: "0.5px solid var(--line)", borderRadius: 6, background: "var(--surface)", color: "var(--ink)", font: "400 12px/1 var(--font-sans)", cursor: "pointer" };

function PanomApp() {
  var ref = React.useState(false), edit = ref[0], setEdit = ref[1];
  var pk = React.useState(false), picker = pk[0], setPicker = pk[1];
  var tk = React.useState(0), setTick = tk[1];
  var gridRef = React.useRef(null);
  var layoutRef = React.useRef([]);

  function mountWidget(node) {
    var el = node.querySelector(".grid-stack-item-content");
    var type = node.getAttribute("data-w");
    var def = window.BNS_V2_REGISTRY[type];
    if (!def || !el) return;
    ReactDOM.createRoot(el).render(React.createElement(def.Component));
  }
  function addWidget(grid, item) {
    var node = grid.addWidget({ x: item.x, y: item.y, w: item.w, h: item.h,
      content: '<div class="grid-stack-item-content" style="background:var(--surface);border:0.5px solid var(--line);border-radius:12px;padding:10px 12px"></div>' });
    node.setAttribute("data-w", item.type);
    mountWidget(node);
  }
  function save(grid) {
    var layout = window.bnsV2Serialize(grid.save(false));
    layoutRef.current = layout;
    setTick(function (t) { return t + 1; });
    fetch(API_V2 + "/api/layout", { method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer " + tokV2() },
      body: JSON.stringify({ layout: layout }) }).catch(function () {});
  }

  React.useEffect(function () {
    (async function () {
      // 1) canlı veri (JWT). 401 → login.
      try {
        var r = await fetch(API_V2 + "/api/embedded?t=" + Date.now(), {
          cache: "no-store", headers: { Authorization: "Bearer " + tokV2() } });
        if (r.status === 401) { localStorage.removeItem("bns_token"); localStorage.removeItem("bns_user"); location.href = "../dashboard/"; return; }
        if (r.ok) v2Apply(await r.json());
      } catch (e) {}
      // 2) layout
      var layout = window.bnsV2DefaultLayout();
      try {
        var lr = await fetch(API_V2 + "/api/layout", { headers: { Authorization: "Bearer " + tokV2() } });
        if (lr.ok) layout = window.bnsV2Validate((await lr.json()).layout);
      } catch (e) {}
      layoutRef.current = layout; setTick(function (t) { return t + 1; });
      // 3) gridstack
      var grid = window.GridStack.init({ column: 12, cellHeight: 70, margin: 8, disableDrag: true, disableResize: true,
        columnOpts: { breakpoints: [{ w: 700, c: 1 }] } }, "#bns-grid");
      gridRef.current = grid;
      layout.forEach(function (item) { addWidget(grid, item); });
      grid.on("change", function () { save(grid); });
      grid.on("removed", function () { save(grid); });
    })();
  }, []);

  React.useEffect(function () {
    var g = gridRef.current; if (!g) return;
    g.enableMove(edit); g.enableResize(edit);
  }, [edit]);

  var eklenebilir = window.BNS_V2_WIDGETS.filter(function (t) {
    return !layoutRef.current.some(function (w) { return w.type === t; });
  });
  return React.createElement(React.Fragment, null,
    window.OdyV2 ? React.createElement(window.OdyV2) : null,
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" } },
      React.createElement("h1", { style: { font: "500 20px/1 var(--font-sans)", margin: 0, flex: 1 } }, "Panom"),
      edit && React.createElement("button", { onClick: function () { setPicker(function (p) { return !p; }); }, style: btnV2 }, "+ alan ekle"),
      React.createElement("button", { onClick: function () { setEdit(function (e) { return !e; }); },
        style: Object.assign({}, btnV2, { background: edit ? "var(--ember)" : "var(--surface)", color: edit ? "#fff" : "var(--ink-3)" }) },
        edit ? "✓ bitti" : "düzenle")),
    picker && edit && React.createElement("div", { style: { padding: "0 16px 12px", display: "flex", gap: 8, flexWrap: "wrap" } },
      eklenebilir.length ? eklenebilir.map(function (t) {
        return React.createElement("button", { key: t, style: btnV2,
          onClick: function () { var g = gridRef.current; addWidget(g, { type: t, x: 0, y: 100, w: 4, h: 2 }); save(g); setPicker(false); } },
          (window.BNS_V2_REGISTRY[t] && window.BNS_V2_REGISTRY[t].title) || t);
      }) : React.createElement("span", { style: { fontSize: 12, color: "var(--ink-4)" } }, "tüm alanlar ekli")),
    React.createElement("div", { id: "bns-grid", className: "grid-stack", style: { padding: "0 8px" } }));
}
window.PanomApp = PanomApp;
