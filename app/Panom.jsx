// PanomScreen — kişiye özel widget panosu. GridStack motoru (çakışmasız drag/resize, kütüphane garantili).
// SIFIRDAN yazıldı; eski el-yapımı pack/absolute-positioning motoru KULLANILMIYOR.
// Prod token'ları + prod verisi (data.briefs/completed/USERS/deptStats/BR + calc.js). Kalıcılık: localStorage + /api/layout.

// ── Tablo kataloğu (editörde seçilebilen tüm tablolar) ───────────────────────
var PB_DEFS = {
  // ── Özet / kişisel ──
  kpi:       { title: "Özet sayılar",   desc: "Aktif · geciken · müşteride · kapasite", grp: "Özet", w: 6, h: 2, dot: "var(--ember)" },
  capacity:  { title: "Kapasitem",      desc: "Doluluk ve rol kapasiten",               grp: "Özet", w: 4, h: 3, dot: "var(--ember)" },
  risk:      { title: "Riskli işlerim", desc: "Bana ait, ≤24sa veya gecikmiş",          grp: "Kişisel", w: 4, h: 3, dot: "var(--prio-red)" },
  mine:      { title: "İşlerim",        desc: "Bana atanmış tüm aktif işler",           grp: "Kişisel", w: 4, h: 4, dot: "var(--info, #3B82C4)" },
  // ── İş listeleri (Aktif işler / Kanban / Plan sayfalarındaki tablolar) ──
  allactive: { title: "Tüm aktif işler",desc: "Müşteride hariç tüm açık işler",         grp: "İşler", w: 6, h: 5, dot: "var(--ink-3)" },
  working:   { title: "İş planında",    desc: "Durumu 'iş planında' olanlar",           grp: "İşler", w: 6, h: 4, dot: "var(--info, #3B82C4)" },
  review:    { title: "İncelemede",     desc: "Durumu 'incelemede' olanlar",            grp: "İşler", w: 4, h: 3, dot: "var(--prio-yellow)" },
  blocked:   { title: "Blokeli işler",  desc: "Durumu 'blokeli' olanlar",               grp: "İşler", w: 4, h: 3, dot: "var(--prio-red)" },
  stale:     { title: "Hareketsiz",     desc: "Uzun süredir dokunulmamış işler",        grp: "İşler", w: 4, h: 3, dot: "var(--ink-4)" },
  recent:    { title: "Son eklenenler", desc: "En yeni açılan briefler",                grp: "İşler", w: 6, h: 4, dot: "var(--info, #3B82C4)" },
  // ── Termin / müşteri (Plan / Müşteri Onayı sayfaları) ──
  today:     { title: "Bugün ve yarın", desc: "Termini 48 saat içinde",                 grp: "Termin", w: 6, h: 4, dot: "var(--prio-yellow)" },
  deadlines: { title: "Yaklaşan terminler", desc: "Önümüzdeki 7 gün",                    grp: "Termin", w: 6, h: 4, dot: "var(--prio-orange)" },
  overdue:   { title: "Geciken işler",  desc: "Deadline'ı geçmiş aktif işler",          grp: "Termin", w: 6, h: 3, dot: "var(--prio-red)" },
  client:    { title: "Müşteride",      desc: "Müşteri onayı bekleyenler",              grp: "Termin", w: 4, h: 3, dot: "var(--prio-orange)" },
  // ── Kırılımlar (Marka / Departman / Ekip / Tamamlananlar) ──
  brandload: { title: "Marka yoğunluğu",desc: "Markaya göre aktif iş sayısı",           grp: "Kırılım", w: 4, h: 3, dot: "var(--info, #3B82C4)" },
  dept:      { title: "Departman özeti",desc: "Departman bazında yük",                  grp: "Kırılım", w: 4, h: 3, dot: "var(--prio-green)" },
  team:      { title: "Ekip yükü",      desc: "Kişi başına aktif iş",                   grp: "Kırılım", w: 4, h: 4, dot: "var(--info, #3B82C4)" },
  completed: { title: "Son tamamlanan", desc: "En son biten işler",                     grp: "Kırılım", w: 6, h: 3, dot: "var(--prio-green)" }
};
var PB_ORDER = ["kpi", "capacity", "risk", "mine", "allactive", "working", "review", "blocked", "stale", "recent", "today", "deadlines", "overdue", "client", "brandload", "dept", "team", "completed"];
// Tip listesini 12 kolonlu ızgaraya akıtarak başlangıç düzeni üret (çakışmasız).
function pbBuildLayout(types) {
  var out = [], x = 0, y = 0, rowH = 0;
  types.forEach(function (t) { var d = PB_DEFS[t]; if (!d) return; if (x + d.w > 12) { x = 0; y += rowH; rowH = 0; } out.push({ id: t, type: t, x: x, y: y, w: d.w, h: d.h }); x += d.w; rowH = Math.max(rowH, d.h); });
  return out;
}
// Departmana göre standart başlangıç panosu (rol/dept anahtarı). İlk açılışta gösterilir; değiştirilebilir.
var PB_DEPT_DEFAULT = {
  yonetici:  ["kpi", "overdue", "client", "dept", "brandload", "team", "working"],
  admin:     ["kpi", "overdue", "client", "dept", "brandload", "team", "working"],
  tasarim:   ["risk", "capacity", "mine", "today", "working", "brandload"],
  editor:    ["risk", "capacity", "mine", "today", "working", "recent"],
  ai:        ["risk", "capacity", "mine", "today", "working", "completed"],
  freelance: ["mine", "capacity", "today", "completed"],
  _default:  ["risk", "capacity", "client", "working", "today"]
};
function pbDefaultFor(role) { return pbBuildLayout(PB_DEPT_DEFAULT[role] || PB_DEPT_DEFAULT._default); }

function PanomScreen(props) {
  var data = props.data || {}, currentUser = props.currentUser || null;
  var h = React.createElement;
  var API = (typeof window !== "undefined" && window.BNS_API_BASE) || "https://benseno-api-production.up.railway.app";
  var tok = function () { return (typeof localStorage !== "undefined" && localStorage.getItem("bns_token")) || ""; };

  // ── kalıcı durum ──
  var loadSaved = function () { try { return JSON.parse(localStorage.getItem("bns_panom_v2")); } catch (e) { return null; } };
  // Kullanıcının rol/departmanı → başlangıç panosu seçimi
  var meRole = (function () { var u = currentUser || {}; var sid = u.slack_id || u.id; var mu = (data.USERS || []).find(function (x) { return x.id === sid; }); return (mu && (mu.rol || mu.dept)) || ""; })();
  var initItems = function () {
    var s = loadSaved();
    if (s && s.length) { var v = s.filter(function (w) { return PB_DEFS[w.type]; }); if (v.length) return v; }
    return pbDefaultFor(meRole);
  };
  var st = React.useState(initItems); var items = st[0], setItems = st[1];
  var es = React.useState(false); var edit = es[0], setEdit = es[1];

  var gridRef = React.useRef(null);     // .grid-stack DOM
  var gi = React.useRef(null);          // GridStack örneği
  var geom = React.useRef({});          // id → {x,y,w,h} (sürükleme sonrası korunur)
  var itemsRef = React.useRef(items); itemsRef.current = items;
  var editRef = React.useRef(edit); editRef.current = edit;

  // başlangıç geometrisini geom'a yaz
  if (Object.keys(geom.current).length === 0) items.forEach(function (w) { geom.current[w.id] = { x: w.x, y: w.y, w: w.w, h: w.h }; });

  var persist = function () {
    var g = gi.current; if (!g || !g.save) return;
    var nodes = g.save(false) || [];
    var byId = {}; nodes.forEach(function (n) { if (n.id != null) { byId[n.id] = n; geom.current[n.id] = { x: n.x, y: n.y, w: n.w, h: n.h }; } });
    var layout = itemsRef.current.map(function (w) { var n = byId[w.id] || geom.current[w.id] || w; return { id: w.id, type: w.type, x: n.x, y: n.y, w: n.w, h: n.h }; });
    try { localStorage.setItem("bns_panom_v2", JSON.stringify(layout)); } catch (e) {}
    try { fetch(API + "/api/layout", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + tok() }, body: JSON.stringify({ layout: layout }) }).catch(function () {}); } catch (e) {}
  };
  var persistRef = React.useRef(persist); persistRef.current = persist;

  // sunucudan kişiye özel layout (kayıtlı yerel yoksa) — bir kez
  React.useEffect(function () {
    if (loadSaved()) return;
    (async function () {
      try {
        var r = await fetch(API + "/api/layout", { headers: { Authorization: "Bearer " + tok() } });
        if (!r.ok) return; var j = await r.json();
        if (j && Array.isArray(j.layout) && j.layout.length) {
          var v = j.layout.filter(function (w) { return PB_DEFS[w.type]; });
          if (v.length) { v.forEach(function (w) { geom.current[w.id] = { x: w.x, y: w.y, w: w.w, h: w.h }; }); setItems(v); }
        }
      } catch (e) {}
    })();
  }, []);

  var idsKey = items.map(function (w) { return w.id; }).join(",");

  // GridStack init/re-init — yalnız tablo seti değişince (ekle/çıkar). Veri poll'leri yeniden init etmez.
  React.useEffect(function () {
    if (typeof window === "undefined" || !window.GridStack || !gridRef.current) return;
    if (gi.current) { try { gi.current.destroy(false); } catch (e) {} gi.current = null; }
    var g = window.GridStack.init({
      column: 12, cellHeight: 90, margin: 8, float: false, minRow: 1,
      handle: ".pb-drag", disableDrag: !editRef.current, disableResize: !editRef.current,
      resizable: { handles: "se" }
    }, gridRef.current);
    var onChg = function () { persistRef.current(); };
    g.on("change", onChg); g.on("resizestop", onChg); g.on("dragstop", onChg);
    gi.current = g;
    return function () { try { g.offAll(); } catch (e) {} };
  }, [idsKey]);

  // düzenle aç/kapa → sürükle/boyutlandır kilidi (re-init gerekmez)
  React.useEffect(function () {
    var g = gi.current; if (!g) return;
    try { g.enableMove(edit); g.enableResize(edit); } catch (e) {}
  }, [edit, idsKey]);

  // ── ekle / çıkar ──
  var addType = function (type) {
    if (itemsRef.current.some(function (w) { return w.type === type; })) return;
    var def = PB_DEFS[type];
    var maxY = itemsRef.current.reduce(function (m, w) { var gm = geom.current[w.id] || w; return Math.max(m, (gm.y || 0) + (gm.h || 0)); }, 0);
    geom.current[type] = { x: 0, y: maxY, w: def.w, h: def.h };
    setItems(function (ws) { return ws.concat([{ id: type, type: type, x: 0, y: maxY, w: def.w, h: def.h }]); });
  };
  var removeType = function (type) {
    setItems(function (ws) { return ws.filter(function (w) { return w.type !== type; }); });
  };
  // ekle/çıkar sonrası kaydet (DOM + grid kurulduktan sonra)
  React.useEffect(function () { var t = setTimeout(function () { persistRef.current(); }, 60); return function () { clearTimeout(t); }; }, [idsKey]);

  // ── veri yardımcıları ──
  var briefs = data.briefs || [];
  var completed = data.completed || data._allCompleted || [];
  var me = (function () { var u = currentUser || {}; var sid = u.slack_id || u.id; return (data.USERS || []).find(function (x) { return x.id === sid; }) || { id: sid, name: u.name, rol: "" }; })();
  var mine = function (b) { return (me && window.bnsIsLead(b, me.id)) || (Array.isArray(b.contributors) && b.contributors.some(function (c) { return c && c.id === me.id; })); };
  var brandColor = function (b) { return (b.brand && b.brand.color) || (data.BR && data.BR[b.marka] && data.BR[b.marka].color) || "var(--ink-4)"; };
  var fmtDelta = function (dh) { var late = dh <= 0; return late ? Math.abs(Math.round(dh)) + "sa↑" : Math.round(dh) + "sa"; };
  var deltaCol = function (dh) { return dh <= 0 ? "var(--prio-red)" : dh <= 24 ? "var(--prio-orange)" : "var(--prio-yellow)"; };
  var actions = function (b) { return window.BriefActions ? h(window.BriefActions, { key: "act", brief: b, currentUser: me, onStatusChange: props.onStatusChange, onRemind: props.onRemind, compact: true }) : null; };

  var empty = function (msg, emoji) { return h("div", { style: { flex: 1, minHeight: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--ink-4)" } }, emoji ? h("div", { style: { fontSize: 24 } }, emoji) : null, h("div", { style: { font: "400 13px/1.4 var(--font-sans)" } }, msg)); };
  var listRow = function (b, right, rightCol) {
    return h("div", { key: b.no, style: { display: "flex", alignItems: "center", gap: 9, padding: "6px 0", borderBottom: "0.5px solid var(--line)" } },
      h("span", { style: { width: 8, height: 8, borderRadius: "50%", background: brandColor(b), flex: "none" } }),
      h("span", { style: { flex: 1, font: "400 12.5px/1.35 var(--font-sans)", color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, b.baslik || ""),
      right != null ? h("span", { style: { font: "700 11px/1 var(--font-mono)", color: rightCol || "var(--ink-4)", flex: "none" } }, right) : h("span", { style: { font: "500 11px/1 var(--font-mono)", color: "var(--ink-4)", flex: "none" } }, b.marka || ""));
  };

  var renderBody = function (type) {
    if (type === "kpi") {
      var act = briefs.filter(function (b) { return b.durum !== "tamamlandi" && b.durum !== "musteride"; });
      var over = act.filter(function (b) { return b.deltaH != null && b.deltaH <= 0; });
      var cli = briefs.filter(function (b) { return b.durum === "musteride"; });
      var aktifMine = briefs.filter(function (b) { return mine(b) && b.durum !== "musteride" && b.durum !== "tamamlandi"; }).length;
      // Rol ağırlıklı yük (işçi 5/lead 2/gözlemci 0) → işçi-eşdeğeri (yük/5) → kapasite %.
      var loadMine = (window.bnsPersonLoad && me) ? window.bnsPersonLoad(briefs, me.id) / 5 : aktifMine;
      var pct = window.bnsPersonCapPct ? window.bnsPersonCapPct(me, loadMine) : 0;
      var cell = function (v, lbl, col) { return h("div", { style: { flex: 1, textAlign: "center" } }, h("div", { style: { font: "600 30px/1 var(--font-display, serif)", color: col || "var(--ink)" } }, v), h("div", { style: { font: "400 10.5px/1 var(--font-sans)", color: "var(--ink-4)", marginTop: 5, textTransform: "uppercase", letterSpacing: ".05em" } }, lbl)); };
      return h("div", { style: { flex: 1, display: "flex", alignItems: "center", gap: 8 } },
        cell(act.length, "aktif"), cell(over.length, "geciken", over.length ? "var(--prio-red)" : null), cell(cli.length, "müşteride", "var(--ember)"), cell("%" + pct, "kapasiten", pct >= 90 ? "var(--prio-red)" : pct >= 70 ? "var(--prio-orange)" : "var(--prio-green)"));
    }
    if (type === "risk") {
      var rows = briefs.filter(function (b) { return mine(b) && window.bnsIsRisk && window.bnsIsRisk(b.durum, b.deltaH); }).sort(function (a, b) { return a.deltaH - b.deltaH; });
      if (!rows.length) return empty("Risk yok — temiz.", "👍");
      return rows.map(function (b) { return h("div", { key: b.no, style: { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--prio-red-bg)", borderRadius: 0, marginBottom: 7 } }, h("span", { style: { font: "500 10.5px/1 var(--font-mono)", color: "var(--ink-4)" } }, "#" + b.no), h("span", { style: { flex: 1, font: "500 12.5px/1.3 var(--font-sans)", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, b.baslik || ""), h("span", { style: { font: "700 11px/1 var(--font-mono)", color: "var(--prio-red)" } }, fmtDelta(b.deltaH)), actions(b)); });
    }
    if (type === "mine") {
      var rm = briefs.filter(function (b) { return mine(b) && b.durum !== "tamamlandi"; }).sort(function (a, b) { return (a.deltaH || 999) - (b.deltaH || 999); });
      if (!rm.length) return empty("Sana atanmış aktif iş yok.");
      return rm.map(function (b) { var a = actions(b); return a ? h("div", { key: b.no, style: { display: "flex", alignItems: "center", gap: 8 } }, h("div", { style: { flex: 1, minWidth: 0 } }, listRow(b, b.deltaH != null ? fmtDelta(b.deltaH) : null, b.deltaH != null ? deltaCol(b.deltaH) : null)), a) : listRow(b, b.deltaH != null ? fmtDelta(b.deltaH) : null, b.deltaH != null ? deltaCol(b.deltaH) : null); });
    }
    if (type === "capacity") {
      var aktif = briefs.filter(function (b) { return mine(b) && b.durum !== "musteride" && b.durum !== "tamamlandi"; }).length;
      var limit = window.bnsPersonCapLimit ? window.bnsPersonCapLimit(me) : 6;
      // Rol ağırlıklı yük (işçi 5/lead 2/gözlemci 0) → işçi-eşdeğeri (yük/5) → kapasite %.
      var loadEq = (window.bnsPersonLoad && me) ? window.bnsPersonLoad(briefs, me.id) / 5 : aktif;
      var p2 = window.bnsPersonCapPct ? window.bnsPersonCapPct(me, loadEq) : 0;
      var col = p2 >= 90 ? "var(--prio-red)" : p2 >= 70 ? "var(--prio-orange)" : "var(--prio-green)";
      return h(React.Fragment, null,
        h("div", { style: { display: "flex", alignItems: "baseline", gap: 10 } }, h("div", { style: { font: "500 48px/0.9 var(--font-display, serif)", color: col } }, "%" + p2), h("div", { style: { font: "400 13px/1 var(--font-mono)", color: "var(--ink-4)" } }, aktif + "/" + limit)),
        h("div", { style: { font: "400 12px/1.3 var(--font-sans)", color: "var(--ink-4)", marginTop: 6 } }, aktif + " aktif iş"),
        h("div", { style: { marginTop: 14, height: 8, borderRadius: 99, background: "var(--surface-sub)", overflow: "hidden" } }, h("div", { style: { height: "100%", width: Math.min(100, p2) + "%", borderRadius: 99, background: col, transition: "width .4s ease" } })));
    }
    if (type === "client") {
      var cl = briefs.filter(function (b) { return b.durum === "musteride"; });
      return h(React.Fragment, null,
        h("div", { style: { font: "500 48px/0.9 var(--font-display, serif)", color: "var(--ember)" } }, cl.length),
        h("div", { style: { font: "400 12px/1.3 var(--font-sans)", color: "var(--ink-4)", marginTop: 4 } }, "onay bekliyor"),
        h("div", { style: { marginTop: 10 } }, cl.slice(0, 8).map(function (b) { return listRow(b); })));
    }
    if (type === "working") {
      var rw = briefs.filter(function (b) { return b.durum === "calisiliyor"; }).slice(0, 40);
      if (!rw.length) return empty("Aktif iş yok");
      return rw.map(function (b) { return listRow(b); });
    }
    if (type === "today") {
      var rt = briefs.filter(function (b) { return b.deltaH != null && b.deltaH <= 48 && b.durum !== "tamamlandi" && b.durum !== "musteride"; }).sort(function (a, b) { return a.deltaH - b.deltaH; }).slice(0, 40);
      if (!rt.length) return empty("48 saatte termin yok");
      return rt.map(function (b) { var a = actions(b); return a ? h("div", { key: b.no, style: { display: "flex", alignItems: "center", gap: 8 } }, h("div", { style: { flex: 1, minWidth: 0 } }, listRow(b, fmtDelta(b.deltaH), deltaCol(b.deltaH))), a) : listRow(b, fmtDelta(b.deltaH), deltaCol(b.deltaH)); });
    }
    if (type === "overdue") {
      var ro = briefs.filter(function (b) { return b.deltaH != null && b.deltaH <= 0 && b.durum !== "tamamlandi" && b.durum !== "musteride"; }).sort(function (a, b) { return a.deltaH - b.deltaH; }).slice(0, 40);
      if (!ro.length) return empty("Geciken iş yok 🎉");
      return ro.map(function (b) { return listRow(b, fmtDelta(b.deltaH), "var(--prio-red)"); });
    }
    if (type === "brandload") {
      var ab = briefs.filter(function (b) { return b.durum !== "tamamlandi"; });
      var by = {}; ab.forEach(function (b) { var k = b.marka || "?"; by[k] = (by[k] || 0) + 1; });
      var arr = Object.keys(by).map(function (k) { return { n: k, v: by[k] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 8);
      var mx = arr.reduce(function (m, x) { return Math.max(m, x.v); }, 1);
      if (!arr.length) return empty("Aktif iş yok");
      return arr.map(function (x) { var c = (data.BR && data.BR[x.n] && data.BR[x.n].color) || "var(--ember)"; return h("div", { key: x.n, style: { marginBottom: 9 } }, h("div", { style: { display: "flex", alignItems: "center", gap: 8, font: "400 12px/1.3 var(--font-sans)", marginBottom: 4 } }, h("span", { style: { width: 8, height: 8, borderRadius: "50%", background: c, flex: "none" } }), h("span", { style: { flex: 1, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.n), h("span", { style: { color: "var(--ink-4)", font: "500 11px/1 var(--font-mono)" } }, x.v)), h("div", { style: { height: 5, borderRadius: 99, background: "var(--surface-sub)", overflow: "hidden" } }, h("div", { style: { height: "100%", width: (x.v / mx * 100) + "%", borderRadius: 99, background: c } }))); });
    }
    if (type === "dept") {
      var ds = data.deptStats || {}; var TR = { ai: "AI", editor: "Editör", tasarim: "Tasarım", freelance: "Freelance" };
      var keys = Object.keys(ds); if (!keys.length) return empty("Veri yok");
      var mxA = keys.reduce(function (m, k) { return Math.max(m, ds[k].active || 0); }, 1);
      return keys.map(function (k) { var d = ds[k] || {}; return h("div", { key: k, style: { marginBottom: 11 } }, h("div", { style: { display: "flex", alignItems: "center", gap: 8, font: "400 12.5px/1.3 var(--font-sans)", marginBottom: 5 } }, h("span", { style: { flex: 1, fontWeight: 600, color: "var(--ink)" } }, TR[k] || k), h("span", { style: { color: "var(--ink-3)" } }, (d.active || 0)), h("span", { style: { color: "var(--prio-red)" } }, (d.overdue || 0))), h("div", { style: { height: 6, borderRadius: 99, background: "var(--surface-sub)", overflow: "hidden" } }, h("div", { style: { height: "100%", width: ((d.active || 0) / mxA * 100) + "%", borderRadius: 99, background: "var(--ember)" } }))); });
    }
    if (type === "allactive") {
      var ra = briefs.filter(function (b) { return b.durum !== "tamamlandi" && b.durum !== "musteride"; }).sort(function (a, b) { return (a.deltaH != null ? a.deltaH : 9999) - (b.deltaH != null ? b.deltaH : 9999); }).slice(0, 60);
      if (!ra.length) return empty("Aktif iş yok");
      return ra.map(function (b) { return listRow(b, b.deltaH != null ? fmtDelta(b.deltaH) : null, b.deltaH != null ? deltaCol(b.deltaH) : null); });
    }
    if (type === "review") {
      var rv = briefs.filter(function (b) { return b.durum === "incelemede"; });
      if (!rv.length) return empty("İncelemede iş yok");
      return rv.map(function (b) { return listRow(b); });
    }
    if (type === "blocked") {
      var rb = briefs.filter(function (b) { return b.durum === "blokeli"; });
      if (!rb.length) return empty("Blokeli iş yok 🎉");
      return rb.map(function (b) { return listRow(b, b.deltaH != null ? fmtDelta(b.deltaH) : null, "var(--prio-red)"); });
    }
    if (type === "stale") {
      var rsl = briefs.filter(function (b) { return b.stale && b.durum !== "tamamlandi"; });
      if (!rsl.length) return empty("Hareketsiz iş yok");
      return rsl.map(function (b) { return listRow(b); });
    }
    if (type === "recent") {
      var rr = briefs.slice().sort(function (a, b) { return (b.created_at || b.no || 0) - (a.created_at || a.no || 0); }).slice(0, 30);
      if (!rr.length) return empty("Brief yok");
      return rr.map(function (b) { return listRow(b); });
    }
    if (type === "deadlines") {
      var rd = briefs.filter(function (b) { return b.deltaH != null && b.deltaH > 0 && b.deltaH <= 168 && b.durum !== "tamamlandi" && b.durum !== "musteride"; }).sort(function (a, b) { return a.deltaH - b.deltaH; }).slice(0, 40);
      if (!rd.length) return empty("7 günde termin yok");
      return rd.map(function (b) { return listRow(b, fmtDelta(b.deltaH), deltaCol(b.deltaH)); });
    }
    if (type === "team") {
      var counts = {}; briefs.filter(function (b) { return b.durum !== "tamamlandi" && b.durum !== "musteride"; }).forEach(function (b) { window.bnsLeadList(b).concat(b.contributors || []).forEach(function (p) { if (p && p.id) counts[p.id] = (counts[p.id] || 0) + 1; }); });
      var tarr = (data.USERS || []).map(function (u) { return { name: u.name || u.id, v: counts[u.id] || 0 }; }).filter(function (x) { return x.v > 0; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 14);
      if (!tarr.length) return empty("Veri yok");
      var tmx = tarr.reduce(function (m, x) { return Math.max(m, x.v); }, 1);
      return tarr.map(function (x) { var col = x.v > 8 ? "var(--prio-red)" : x.v > 5 ? "var(--prio-orange)" : "var(--ember)"; return h("div", { key: x.name, style: { marginBottom: 8 } }, h("div", { style: { display: "flex", alignItems: "center", gap: 8, font: "400 12px/1.3 var(--font-sans)", marginBottom: 4 } }, h("span", { style: { flex: 1, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.name), h("span", { style: { color: "var(--ink-4)", font: "500 11px/1 var(--font-mono)" } }, x.v)), h("div", { style: { height: 5, borderRadius: 99, background: "var(--surface-sub)", overflow: "hidden" } }, h("div", { style: { height: "100%", width: (x.v / tmx * 100) + "%", borderRadius: 99, background: col } }))); });
    }
    if (type === "completed") {
      var rc = completed.slice().sort(function (a, b) { return (b.bitis || 0) - (a.bitis || 0); }).slice(0, 30);
      if (!rc.length) return empty("Tamamlanan iş yok");
      return rc.map(function (b) { return h("div", { key: b.no || b.id, style: { display: "flex", alignItems: "center", gap: 9, padding: "6px 0", borderBottom: "0.5px solid var(--line)" } }, h("span", { style: { color: "var(--prio-green)", flex: "none", fontSize: 12 } }, "✓"), h("span", { style: { flex: 1, font: "400 12.5px/1.35 var(--font-sans)", color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, b.baslik || b.is || ""), h("span", { style: { font: "500 11px/1 var(--font-mono)", color: "var(--ink-4)", flex: "none" } }, b.marka || "")); });
    }
    return null;
  };

  // ── stiller ──
  var btn = { padding: "7px 13px", border: "0.5px solid var(--line)", borderRadius: 9, background: "var(--surface)", color: "var(--ink-2)", font: "500 12px/1 var(--font-sans)", cursor: "pointer" };
  var cardChrome = { height: "100%", background: "var(--surface)", border: "0.5px solid var(--line)", borderRadius: 16, boxShadow: "var(--shadow-card, 0 1px 2px rgba(0,0,0,.05))", padding: "14px 16px", overflow: "hidden", display: "flex", flexDirection: "column", boxSizing: "border-box" };

  var noLib = typeof window === "undefined" || !window.GridStack;

  // ── editör paneli (tüm tablolar, toggle) ──
  // Editör: dropdown'dan tablo ekle (gruplu). Çıkarma kart sağ-üst ×'inden.
  var addable = PB_ORDER.filter(function (t) { return !items.some(function (w) { return w.type === t; }); });
  var grps = []; var gmap = {}; addable.forEach(function (t) { var g = PB_DEFS[t].grp || "Diğer"; if (!gmap[g]) { gmap[g] = []; grps.push(g); } gmap[g].push(t); });
  var editor = edit ? h("div", { style: { marginBottom: 16, padding: "12px 14px", border: "0.5px solid var(--line)", borderRadius: 14, background: "var(--surface-sub)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" } },
    h("span", { style: { font: "600 11px/1 var(--font-sans)", color: "var(--ink-3)" } }, "Tablo ekle:"),
    h("div", { style: { position: "relative", display: "inline-flex", alignItems: "center" } },
      h("select", {
        value: "",
        onChange: function (e) { var v = e.target.value; if (v) { addType(v); e.target.value = ""; } },
        disabled: !addable.length,
        style: { appearance: "none", WebkitAppearance: "none", padding: "8px 32px 8px 12px", border: "0.5px solid var(--line)", borderRadius: 9, background: "var(--surface)", color: "var(--ink-2)", font: "500 12.5px/1 var(--font-sans)", cursor: addable.length ? "pointer" : "default", minWidth: 200 }
      },
        h("option", { value: "" }, addable.length ? "Tablo seç…" : "Tüm tablolar ekli"),
        grps.map(function (g) { return h("optgroup", { key: g, label: g }, gmap[g].map(function (t) { return h("option", { key: t, value: t }, PB_DEFS[t].title); })); })),
      h("span", { style: { position: "absolute", right: 11, pointerEvents: "none", color: "var(--ink-4)", fontSize: 10 } }, "▾")),
    h("span", { style: { font: "400 11.5px/1.3 var(--font-sans)", color: "var(--ink-4)" } }, "kartı çıkarmak için sağ-üst ×")) : null;

  // ── widget kartı (grid-stack-item) ──
  var card = function (w) {
    var def = PB_DEFS[w.type]; var gm = geom.current[w.id] || w;
    var header = h("div", { className: edit ? "pb-drag" : "", style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 11, flex: "none", cursor: edit ? "move" : "default" } },
      edit ? h("span", { style: { color: "var(--ink-5, #b9b2a6)", fontSize: 12, flex: "none" } }, "⋮⋮") : null,
      h("span", { style: { width: 8, height: 8, borderRadius: "50%", background: def.dot, flex: "none" } }),
      h("span", { style: { flex: 1, font: "600 11px/1 var(--font-sans)", letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, def.title),
      edit ? h("button", { onClick: function (e) { e.stopPropagation(); removeType(w.type); }, title: "Kaldır", style: { width: 22, height: 22, borderRadius: "50%", border: "0.5px solid var(--line)", background: "var(--surface)", color: "var(--ink-3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flex: "none" } }, "×") : null);
    return h("div", { key: w.id, className: "grid-stack-item", "gs-id": w.id, "gs-x": gm.x, "gs-y": gm.y, "gs-w": gm.w, "gs-h": gm.h, "gs-min-w": 3, "gs-min-h": 2 },
      h("div", { className: "grid-stack-item-content" },
        h("div", { style: cardChrome }, header, h("div", { style: { flex: 1, minHeight: 0, overflow: "auto" } }, renderBody(w.type)))));
  };

  return h("div", { style: { padding: "22px 24px 32px" } },
    h("div", { style: { display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18 } },
      h("div", { style: { font: "500 30px/1 var(--font-display, serif)", color: "var(--ink)" } }, "Panom"),
      h("div", { style: { flex: 1, font: "400 12.5px/1 var(--font-sans)", color: "var(--ink-4)" } }, edit ? "tablo seç · başlıktan sürükle · sağ-alt köşeden boyutlandır" : "kişisel iş panon"),
      h("button", { onClick: function () { if (props.onGoBugun) props.onGoBugun(); }, title: "Kişisel Bugün bakışı", style: { display: "inline-flex", alignItems: "center", gap: 5, font: "600 12px/1 var(--font-sans)", padding: "6px 11px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--paper-2)", color: "var(--ink)", cursor: "pointer" } }, "🗓️ Bugün"),
      h("button", { onClick: function () { setEdit(function (e) { return !e; }); }, style: Object.assign({}, btn, edit ? { background: "var(--ember)", borderColor: "var(--ember)", color: "#fff" } : {}) }, edit ? "✓ bitti" : "düzenle")),
    editor,
    items.length === 0
      ? h("div", { style: { padding: "60px 0", textAlign: "center", font: "400 13px/1.5 var(--font-sans)", color: "var(--ink-4)" } }, edit ? "Yukarıdan tablo seç" : "Panon boş — düzenle ile tablo ekle")
      : h("div", { className: "grid-stack", ref: gridRef, style: noLib ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, gridAutoRows: 200 } : undefined }, items.map(card)));
}
try { window.PanomScreen = PanomScreen; } catch (e) {}
