// Widget kayıt defteri. Her tip: { title, minW, minH, Component }.
// Component, BNS_DATA'dan okuyan bir React fonksiyon bileşenidir. Hesaplar calc.js
// global'lerinden (bnsIsRisk, bnsPersonCapPct) gelir — yeni hesap TANIMLANMAZ (magic-guard).

// Giriş yapan kişi: localStorage 'bns_user' = {id, slack_id, name, role}. Kapasite formülü
// kanonik USERS kaydını (rol/yetki/dept) ister; brief lead/contributor'ları SLACK ID taşır.
// Bu yüzden kanonik kullanıcıyı USERS içinde slack_id ile bulup döneriz (id === slack_id).
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

function WCard(props) {
  return React.createElement("div", { style: { height: "100%", display: "flex", flexDirection: "column" } },
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8 } },
      React.createElement("span", { className: "bns-grip", style: { cursor: "move", color: "var(--ink-4)" } }, "⋮"),
      React.createElement("span", { style: { font: "500 12px/1 var(--font-sans)", color: "var(--ink-3)" } }, props.title)),
    React.createElement("div", { style: { flex: 1, overflow: "auto" } }, props.children));
}
function WEmpty(t) { return React.createElement("div", { style: { color: "var(--ink-4)", fontSize: 12 } }, t); }

function RiskliIslerim() {
  var me = v2Me(), uid = me && me.id;
  var rows = v2Briefs().filter(function (b) {
    return v2Mine(b, uid) && window.bnsIsRisk && window.bnsIsRisk(b.durum, b.deltaH);
  });
  return React.createElement(WCard, { title: "Riskli işlerim" },
    rows.length ? rows.map(function (b) {
      return React.createElement("div", { key: b.no,
        style: { borderLeft: "3px solid var(--prio-red)", padding: "4px 8px", marginBottom: 4, fontSize: 12 } },
        "#" + b.no + " " + (b.baslik || "") + " · " +
        (b.deltaH <= 0 ? Math.abs(Math.round(b.deltaH)) + "sa↑" : Math.round(b.deltaH) + "sa"));
    }) : WEmpty("risk yok 👍"));
}
function Kapasitem() {
  var me = v2Me(), uid = me && me.id;
  var aktif = v2Briefs().filter(function (b) { return v2Mine(b, uid) && b.durum !== "musteride" && b.durum !== "tamamlandi"; }).length;
  var pct = (window.bnsPersonCapPct && me) ? window.bnsPersonCapPct(me, aktif) : 0;
  return React.createElement(WCard, { title: "Kapasitem" },
    React.createElement("div", { style: { font: "500 28px/1 var(--font-sans)" } }, "%" + pct),
    React.createElement("div", { style: { fontSize: 11, color: "var(--ink-4)", marginTop: 4 } }, aktif + " aktif iş"));
}
function KartAkisi() {
  var rows = v2Briefs().filter(function (b) { return b.durum === "calisiliyor"; }).slice(0, 8);
  return React.createElement(WCard, { title: "Çalışılıyor" },
    rows.length ? rows.map(function (b) {
      return React.createElement("div", { key: b.no,
        style: { border: "0.5px solid var(--line)", borderRadius: 6, padding: "6px 9px", marginBottom: 5, fontSize: 12 } },
        b.baslik || "",
        React.createElement("div", { style: { fontSize: 10, color: "var(--ink-4)" } }, b.marka || ""));
    }) : WEmpty("—"));
}
function Musteride() {
  var m = v2Briefs().filter(function (b) { return b.durum === "musteride"; });
  return React.createElement(WCard, { title: "Müşteride" },
    React.createElement("div", { style: { font: "500 28px/1 var(--font-sans)", color: "#7c5cff" } }, m.length),
    React.createElement("div", { style: { fontSize: 11, color: "var(--ink-4)", marginTop: 4 } }, "dönüş bekliyor"));
}
function BugunYarin() {
  var rows = v2Briefs().filter(function (b) { return b.deltaH != null && b.deltaH <= 48 && b.durum !== "tamamlandi"; })
    .sort(function (a, b) { return a.deltaH - b.deltaH; }).slice(0, 8);
  return React.createElement(WCard, { title: "Bugün ve yarın" },
    rows.length ? rows.map(function (b) {
      return React.createElement("div", { key: b.no, style: { fontSize: 12, padding: "3px 0" } },
        "#" + b.no + " " + (b.baslik || "") + " · " + Math.round(b.deltaH) + "sa");
    }) : WEmpty("—"));
}

window.BNS_V2_REGISTRY = {
  "riskli-islerim": { title: "Riskli işlerim", minW: 4, minH: 2, Component: RiskliIslerim },
  "kapasitem":      { title: "Kapasitem",      minW: 3, minH: 2, Component: Kapasitem },
  "kart-akisi":     { title: "Çalışılıyor",    minW: 5, minH: 3, Component: KartAkisi },
  "musteride":      { title: "Müşteride",      minW: 3, minH: 2, Component: Musteride },
  "bugun-yarin":    { title: "Bugün ve yarın", minW: 4, minH: 2, Component: BugunYarin },
};
