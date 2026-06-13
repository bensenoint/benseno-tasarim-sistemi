// Ody — sürüklenebilir avatar buton (sistem kimliği). Konum localStorage'da (bns_v2_ody_pos).
// Tıkla → proaktif kişisel brief paneli. Prod /api/chat brief deseninin v2 sürümü.
function OdyV2() {
  var o = React.useState(false), open = o[0], setOpen = o[1];
  var br = React.useState(""), brief = br[0], setBrief = br[1];
  var ps = React.useState(function () {
    try { var p = JSON.parse(localStorage.getItem("bns_v2_ody_pos") || "null"); if (p) return p; } catch (e) {}
    return { x: 20, y: (typeof window !== "undefined" ? window.innerHeight - 80 : 600) };
  });
  var pos = ps[0], setPos = ps[1];
  var drag = React.useRef(null);

  function start(e) {
    var s = { mx: e.clientX, my: e.clientY, x: pos.x, y: pos.y, moved: false };
    drag.current = s;
    function mv(ev) {
      var dx = ev.clientX - s.mx, dy = ev.clientY - s.my;
      if (Math.abs(dx) + Math.abs(dy) > 4) s.moved = true;
      setPos({ x: Math.min(Math.max(4, s.x + dx), window.innerWidth - 60), y: Math.min(Math.max(4, s.y + dy), window.innerHeight - 60) });
    }
    function up() {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
      setPos(function (p) { try { localStorage.setItem("bns_v2_ody_pos", JSON.stringify(p)); } catch (e) {} return p; });
    }
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  }

  React.useEffect(function () {
    var API = window.BNS_API_BASE || "https://benseno-api-production.up.railway.app";
    var tk = localStorage.getItem("bns_token") || "";
    fetch(API + "/api/chat", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + tk },
      body: JSON.stringify({ messages: [{ role: "user", content: "Bugünkü kısa kişisel özetim: aktif iş, riskli/gecikmiş, müşteride, kapasite. 3 madde, selamla." }] }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.reply) setBrief(j.reply); })
      .catch(function () {});
  }, []);

  return React.createElement(React.Fragment, null,
    !open && React.createElement("button", {
      onPointerDown: start,
      onClick: function () { if (drag.current && drag.current.moved) { drag.current = null; return; } setOpen(true); },
      title: "Ody", style: { position: "fixed", left: pos.x, top: pos.y, zIndex: 90, width: 54, height: 54, borderRadius: "50%",
        border: 0, cursor: "grab", touchAction: "none", background: "var(--ember)", color: "#fff", fontSize: 24,
        display: "flex", alignItems: "center", justifyContent: "center" } }, "🐾"),
    open && React.createElement("div", { style: { position: "fixed", left: Math.min(pos.x, window.innerWidth - 340), top: Math.max(8, pos.y - 360),
        width: 320, maxHeight: 440, background: "var(--surface)", border: "0.5px solid var(--line)", borderRadius: 14,
        zIndex: 91, display: "flex", flexDirection: "column", overflow: "hidden" } },
      React.createElement("div", { style: { padding: "10px 12px", borderBottom: "0.5px solid var(--line)", display: "flex", alignItems: "center" } },
        React.createElement("span", { style: { font: "500 14px/1 var(--font-sans)" } }, "Ody"),
        React.createElement("button", { onClick: function () { setOpen(false); },
          style: { marginLeft: "auto", border: 0, background: "transparent", cursor: "pointer", color: "var(--ink-4)" } }, "✕")),
      React.createElement("div", { style: { padding: 12, overflow: "auto", font: "400 13px/1.5 var(--font-sans)", whiteSpace: "pre-wrap" } },
        brief || "Günaydın 👋")));
}
window.OdyV2 = OdyV2;
