// Widget kayıt defteri. Her tip: { title, minW, minH, Component }.
// Component, BNS_DATA'dan okuyan bir React fonksiyon bileşenidir. Hesaplar calc.js
// global'lerinden (bnsIsRisk, bnsPersonCapPct/CapLimit) gelir — yeni hesap TANIMLANMAZ (magic-guard).
// Görsel chrome v2/index.html <style> bloğundadır (.w-* sınıfları).

function v2Me() {
  var stored = null;
  try { stored = JSON.parse(localStorage.getItem("bns_user") || "null"); } catch (e) {}
  if (!stored) return null;
  var sid = stored.slack_id || stored.id;
  var users = (window.BNS_DATA && window.BNS_DATA.USERS) || [];
  var canon = users.filter(function (u) { return u && u.id === sid; })[0];
  return canon || { id: sid, name: stored.name, rol: "" };
}
function v2Briefs() { return (window.BNS_DATA && window.BNS_DATA.briefs) || []; }
function v2Mine(b, uid) {
  return (b.lead && b.lead.id === uid) ||
    (Array.isArray(b.contributors) && b.contributors.some(function (c) { return c && c.id === uid; }));
}
function v2BrandColor(b) {
  return (b.brand && b.brand.color) || b.marka_color ||
    (window.WHEEL && window.brandHash ? window.WHEEL[window.brandHash(b.marka || "")] : null) || "var(--ink-5)";
}
var h = React.createElement;

function WCard(props) {
  return h("div", { className: "w-card", style: { height: "100%", display: "flex", flexDirection: "column" } },
    h("div", { className: "w-head" },
      h("span", { className: "bns-grip" }, "⋮⋮"),
      h("span", { className: "w-dot", style: { background: props.accent } }),
      h("span", { className: "w-title" }, props.title),
      props.badge != null && h("span", { className: "w-badge" }, props.badge)),
    h("div", { className: "w-body" }, props.children));
}
function WEmpty(t) { return h("div", { className: "w-empty" }, t); }

function RiskliIslerim() {
  var me = v2Me(), uid = me && me.id;
  var rows = v2Briefs().filter(function (b) {
    return v2Mine(b, uid) && window.bnsIsRisk && window.bnsIsRisk(b.durum, b.deltaH);
  }).sort(function (a, b) { return a.deltaH - b.deltaH; });
  return h(WCard, { title: "Riskli işlerim", accent: "var(--prio-red)", badge: rows.length || null },
    rows.length ? rows.map(function (b) {
      var late = b.deltaH <= 0;
      return h("div", { key: b.no, className: "w-risk" },
        h("span", { className: "n", style: { color: "var(--prio-red)", minWidth: 26 } }, "#" + b.no),
        h("span", { className: "t" }, b.baslik || ""),
        h("span", { className: "meta" }, late ? Math.abs(Math.round(b.deltaH)) + "sa ↑" : Math.round(b.deltaH) + "sa"));
    }) : WEmpty("risk yok 👍"));
}

function Kapasitem() {
  var me = v2Me(), uid = me && me.id;
  var aktif = v2Briefs().filter(function (b) { return v2Mine(b, uid) && b.durum !== "musteride" && b.durum !== "tamamlandi"; }).length;
  var pct = (window.bnsPersonCapPct && me) ? window.bnsPersonCapPct(me, aktif) : 0;
  var limit = (window.bnsPersonCapLimit && me) ? window.bnsPersonCapLimit(me) : 6;
  var col = pct >= 90 ? "var(--prio-red)" : pct >= 70 ? "var(--prio-orange)" : "var(--prio-green)";
  return h(WCard, { title: "Kapasitem", accent: "var(--ember)" },
    h("div", { style: { display: "flex", alignItems: "baseline", gap: 8 } },
      h("span", { className: "w-kpi", style: { color: col } }, "%" + pct),
      h("span", { style: { font: "400 14px/1 var(--font-mono)", color: "var(--ink-4)" } }, aktif + "/" + limit)),
    h("div", { className: "w-kpi-sub" }, aktif + " aktif iş · " + limit + " kapasite"),
    h("div", { className: "w-bar" }, h("i", { style: { width: Math.min(100, pct) + "%", background: col } })));
}

function KartAkisi() {
  var rows = v2Briefs().filter(function (b) { return b.durum === "calisiliyor"; });
  return h(WCard, { title: "Çalışılıyor", accent: "var(--info, #3B82C4)", badge: rows.length || null },
    rows.length ? rows.slice(0, 12).map(function (b) {
      return h("div", { key: b.no, className: "w-row" },
        h("span", { className: "w-bdot", style: { background: v2BrandColor(b) } }),
        h("span", { className: "t" }, b.baslik || ""),
        h("span", { className: "meta" }, b.marka || ""));
    }) : WEmpty("aktif iş yok"));
}

function Musteride() {
  var m = v2Briefs().filter(function (b) { return b.durum === "musteride"; });
  return h(WCard, { title: "Müşteride", accent: "#7C5CFF" },
    h("div", { className: "w-kpi", style: { color: "#7C5CFF" } }, m.length),
    h("div", { className: "w-kpi-sub" }, "müşteri dönüşü bekliyor"),
    m.length ? h("div", { style: { marginTop: 12 } }, m.slice(0, 5).map(function (b) {
      return h("div", { key: b.no, className: "w-row", style: { padding: "6px 0" } },
        h("span", { className: "w-bdot", style: { background: v2BrandColor(b) } }),
        h("span", { className: "t" }, b.baslik || ""),
        h("span", { className: "meta" }, b.marka || ""));
    })) : null);
}

function BugunYarin() {
  var rows = v2Briefs().filter(function (b) { return b.deltaH != null && b.deltaH <= 48 && b.durum !== "tamamlandi" && b.durum !== "musteride"; })
    .sort(function (a, b) { return a.deltaH - b.deltaH; });
  return h(WCard, { title: "Bugün ve yarın", accent: "var(--prio-orange)", badge: rows.length || null },
    rows.length ? rows.slice(0, 12).map(function (b) {
      var col = b.deltaH <= 8 ? "var(--prio-red)" : b.deltaH <= 24 ? "var(--prio-orange)" : "var(--prio-yellow)";
      return h("div", { key: b.no, className: "w-row" },
        h("span", { className: "n" }, "#" + b.no),
        h("span", { className: "t" }, b.baslik || ""),
        h("span", { className: "meta", style: { color: col } }, Math.round(b.deltaH) + "sa"));
    }) : WEmpty("48 saatte termin yok"));
}

window.BNS_V2_REGISTRY = {
  "riskli-islerim": { title: "Riskli işlerim", minW: 4, minH: 2, Component: RiskliIslerim },
  "kapasitem":      { title: "Kapasitem",      minW: 3, minH: 2, Component: Kapasitem },
  "kart-akisi":     { title: "Çalışılıyor",    minW: 5, minH: 3, Component: KartAkisi },
  "musteride":      { title: "Müşteride",      minW: 3, minH: 2, Component: Musteride },
  "bugun-yarin":    { title: "Bugün ve yarın", minW: 4, minH: 2, Component: BugunYarin },
};
