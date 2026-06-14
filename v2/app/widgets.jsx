// Panom widget'ları — buildPayload GERÇEK veriden (BNS_DATA + calc.js), renderWidget payload'ı çizer.
// Prototipteki PanomWidget şablonu + buildPayload mock'u birleştirildi; mock yerine canlı veri.
var _h = React.createElement;

function bnsV2Me() {
  var stored = null;
  try { stored = JSON.parse(localStorage.getItem("bns_user") || "null"); } catch (e) {}
  if (!stored) return null;
  var sid = stored.slack_id || stored.id;
  var users = (window.BNS_DATA && window.BNS_DATA.USERS) || [];
  var canon = users.filter(function (u) { return u && u.id === sid; })[0];
  return canon || { id: sid, name: stored.name, rol: "" };
}
function bnsBriefs() { return (window.BNS_DATA && window.BNS_DATA.briefs) || []; }
function bnsMine(b, uid) {
  return (b.lead && b.lead.id === uid) ||
    (Array.isArray(b.contributors) && b.contributors.some(function (c) { return c && c.id === uid; }));
}
function bnsBrandColor(b, fallback) {
  return (b.brand && b.brand.color) || b.marka_color ||
    (window.WHEEL && window.brandHash ? window.WHEEL[window.brandHash(b.marka || "")] : null) || fallback;
}
var ROL_TR = { ai: "AI", editor: "Editör", tasarim: "Tasarım", freelance: "Freelance", yonetici: "Yönetici" };

function bnsRgba(hx, a) { hx = (hx || "#888").replace("#", ""); if (hx.length === 3) hx = hx.split("").map(function (c) { return c + c; }).join(""); var n = parseInt(hx, 16); return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")"; }

// Panom üst-bilgi + Ody için özet metrikler
function bnsPanomStats(me) {
  var uid = me && me.id, briefs = bnsBriefs();
  var active = briefs.filter(function (b) { return b.durum !== "tamamlandi"; });
  var overdue = active.filter(function (b) { return b.deltaH != null && b.deltaH < 0; });
  var myRisk = briefs.filter(function (b) { return bnsMine(b, uid) && window.bnsIsRisk && window.bnsIsRisk(b.durum, b.deltaH); });
  var aktif = briefs.filter(function (b) { return bnsMine(b, uid) && b.durum !== "musteride" && b.durum !== "tamamlandi"; }).length;
  var pct = (window.bnsPersonCapPct && me) ? window.bnsPersonCapPct(me, aktif) : 0;
  var futures = active.map(function (b) { return b.deltaH; }).filter(function (d) { return d != null && d > 0; });
  var nearestH = futures.length ? Math.min.apply(null, futures) : null;
  return { aktif: active.length, overdue: overdue.length, risk: myRisk.length, cap: pct, myAktif: aktif, nearestH: nearestH };
}

function bnsBuildPayload(type, ctx) {
  var dark = ctx.dark, pal = ctx.pal, P = pal.P, me = ctx.me, uid = me && me.id, wc = ctx.wc || {};
  var bt = pal.bt;
  var chip = function (c) { return { fontFamily: "'Geist', sans-serif", fontSize: "10.5px", fontWeight: 600, padding: "2px 7px", borderRadius: "999px", color: c, background: bnsRgba(c, dark ? 0.20 : 0.11), whiteSpace: "nowrap", flex: "none" }; };
  var dot = function (c) { return { width: "9px", height: "9px", borderRadius: "50%", background: c, flex: "none" }; };
  var rndH = function (d) { return Math.round(d); };

  if (type === "risk") {
    var rrows = bnsBriefs().filter(function (b) { return bnsMine(b, uid) && window.bnsIsRisk && window.bnsIsRisk(b.durum, b.deltaH); })
      .sort(function (a, b) { return a.deltaH - b.deltaH; })
      .map(function (b) {
        var late = b.deltaH <= 0;
        return { no: "#" + b.no, title: b.baslik || "", time: late ? Math.abs(rndH(b.deltaH)) + "sa ↑" : rndH(b.deltaH) + "sa", chipStyle: chip(P.risk) };
      });
    return { type: type, title: "Riskli işlerim", dotColor: wc.risk || bt.risk, badge: rrows.length ? rrows.length : null, badgeKind: "risk", rows: rrows };
  }
  if (type === "capacity") {
    var aktif = bnsBriefs().filter(function (b) { return bnsMine(b, uid) && b.durum !== "musteride" && b.durum !== "tamamlandi"; }).length;
    var limit = (window.bnsPersonCapLimit && me) ? window.bnsPersonCapLimit(me) : 6;
    var pct = ctx.capAnim != null ? ctx.capAnim : ((window.bnsPersonCapPct && me) ? window.bnsPersonCapPct(me, aktif) : 0);
    var rol = ROL_TR[(me && (me.yetki === "yonetici" ? "yonetici" : (me.rol || me.dept))) || ""] || "Ekip";
    return { type: type, title: "Kapasitem", dotColor: wc.capacity || bt.capacity, capText: "%" + Math.round(pct), capSub: aktif + "/" + limit, role: rol + " · " + aktif + " aktif iş", capState: pct >= 90 ? "dolu" : pct >= 70 ? "yoğun" : "müsait", capFillStyle: { height: "100%", width: Math.min(100, pct) + "%", borderRadius: "999px", background: pct >= 90 ? P.risk : pct >= 70 ? P.orange : P.green } };
  }
  if (type === "working") {
    var wrows = bnsBriefs().filter(function (b) { return b.durum === "calisiliyor"; }).slice(0, 30)
      .map(function (b) { return { title: b.baslik || "", brand: b.marka || "", dotStyle: dot(bnsBrandColor(b, pal.ink2)) }; });
    return { type: type, title: "Çalışılıyor", dotColor: wc.working || bt.working, badge: wrows.length || null, rows: wrows };
  }
  if (type === "client") {
    var crows = bnsBriefs().filter(function (b) { return b.durum === "musteride"; });
    var rows = crows.slice(0, 12).map(function (b) { return { title: b.baslik || "", brand: b.marka || "", dotStyle: dot(bnsBrandColor(b, pal.ink2)) }; });
    return { type: type, title: "Müşteride", dotColor: wc.client || bt.client, badge: crows.length || null, count: ctx.clientAnim != null ? Math.round(ctx.clientAnim) : crows.length, rows: rows };
  }
  if (type === "today") {
    var trows = bnsBriefs().filter(function (b) { return b.deltaH != null && b.deltaH <= 48 && b.durum !== "tamamlandi" && b.durum !== "musteride"; })
      .sort(function (a, b) { return a.deltaH - b.deltaH; }).slice(0, 30)
      .map(function (b) {
        var late = b.deltaH <= 0, col = late ? P.risk : b.deltaH <= 24 ? P.orange : P.yellow;
        return { no: "#" + b.no, title: b.baslik || "", h: late ? Math.abs(rndH(b.deltaH)) + "sa ↑" : rndH(b.deltaH) + "sa", chipStyle: chip(col) };
      });
    return { type: type, title: "Bugün ve yarın", dotColor: wc.today || bt.today, badge: trows.length || null, rows: trows };
  }
  var def = (window.BNS_DEFS && window.BNS_DEFS[type]) || {};
  return { type: "soon", title: def.title || "Widget", dotColor: pal.ink2 };
}

// Payload → kart gövdesi (PanomWidget şablonu port edildi)
function bnsRenderWidget(d) {
  d = d || {};
  var headDot = { width: "9px", height: "9px", borderRadius: "50%", background: d.dotColor || "var(--accent)", flex: "none" };
  var badge = d.badge != null ? _h("div", { style: { fontFamily: "'Geist', sans-serif", fontSize: "11px", fontWeight: 600, padding: "1px 8px", borderRadius: "999px", flex: "none", color: d.badgeKind === "risk" ? "#fff" : "var(--ink)", background: d.badgeKind === "risk" ? "var(--risk)" : "var(--line)" } }, d.badge) : null;
  var head = _h("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "11px", flex: "none" } },
    _h("div", { style: headDot }),
    _h("div", { style: { fontFamily: "'Geist',sans-serif", fontSize: "11px", fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink2)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, d.title),
    badge);
  var body;
  var rows = d.rows || [];
  if (d.type === "risk") {
    body = rows.length === 0
      ? _h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "6px", color: "var(--ink2)" } },
          _h("div", { style: { fontSize: "26px" } }, "👍"), _h("div", { style: { fontFamily: "'Geist',sans-serif", fontSize: "13px" } }, "Risk yok — temiz."))
      : _h("div", { className: "pscroll", style: { flex: 1, overflow: "auto", margin: "-2px -3px", padding: "2px 3px" } },
          rows.map(function (r, i) {
            return _h("div", { key: i, style: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderLeft: "3px solid var(--risk)", background: "var(--risk-tint)", borderRadius: "0 10px 10px 0", marginBottom: "7px" } },
              _h("div", { style: { fontFamily: "'Geist', sans-serif", fontSize: "10.5px", color: "var(--ink2)", flex: "none" } }, r.no),
              _h("div", { style: { fontFamily: "'Geist',sans-serif", fontSize: "12.5px", color: "var(--ink)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, r.title),
              _h("div", { style: r.chipStyle }, r.time));
          }));
  } else if (d.type === "capacity") {
    body = _h(React.Fragment, null,
      _h("div", { style: { display: "flex", alignItems: "baseline", gap: "13px" } },
        _h("div", { style: { fontFamily: "'Newsreader',serif", fontSize: "60px", lineHeight: ".78", color: "var(--ink)" } }, d.capText),
        _h("div", { style: { fontFamily: "'Geist', sans-serif", fontSize: "13px", color: "var(--ink2)" } }, d.capSub)),
      _h("div", { style: { fontFamily: "'Geist',sans-serif", fontSize: "12px", color: "var(--ink2)", marginTop: "6px" } }, d.role),
      _h("div", { style: { marginTop: "auto", paddingTop: "16px" } },
        _h("div", { style: { height: "8px", borderRadius: "999px", background: "var(--line)", overflow: "hidden" } }, _h("div", { style: Object.assign({ transition: "width .4s ease" }, d.capFillStyle) })),
        _h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: "7px", fontFamily: "'Geist', sans-serif", fontSize: "10px", color: "var(--ink2)" } },
          _h("span", null, "boş"), _h("span", null, d.capState), _h("span", null, "dolu"))));
  } else if (d.type === "working") {
    body = _h("div", { className: "pscroll", style: { flex: 1, overflow: "auto", margin: "0 -2px", padding: "0 2px" } },
      rows.length ? rows.map(function (r, i) {
        return _h("div", { key: i, style: { display: "flex", alignItems: "center", gap: "10px", padding: "7px 0", borderBottom: "1px solid var(--line)" } },
          _h("div", { style: r.dotStyle }),
          _h("div", { style: { fontFamily: "'Geist',sans-serif", fontSize: "12.5px", color: "var(--ink)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, r.title),
          _h("div", { style: { fontFamily: "'Geist',sans-serif", fontSize: "11px", color: "var(--ink2)", flex: "none" } }, r.brand));
      }) : _h("div", { style: { color: "var(--ink2)", fontSize: "13px", fontFamily: "'Geist',sans-serif", padding: "8px 0" } }, "Aktif iş yok"));
  } else if (d.type === "client") {
    body = _h(React.Fragment, null,
      _h("div", { style: { display: "flex", alignItems: "baseline", gap: "11px", marginBottom: "10px" } },
        _h("div", { style: { fontFamily: "'Newsreader',serif", fontSize: "60px", lineHeight: ".78", color: "var(--brand)" } }, d.count),
        _h("div", { style: { fontFamily: "'Geist',sans-serif", fontSize: "12px", color: "var(--ink2)" } }, "onay bekliyor")),
      _h("div", { className: "pscroll", style: { flex: 1, overflow: "auto", margin: "0 -2px", padding: "0 2px" } },
        rows.map(function (r, i) {
          return _h("div", { key: i, style: { display: "flex", alignItems: "center", gap: "10px", padding: "6px 0" } },
            _h("div", { style: r.dotStyle }),
            _h("div", { style: { fontFamily: "'Geist',sans-serif", fontSize: "12.5px", color: "var(--ink)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, r.title),
            _h("div", { style: { fontFamily: "'Geist',sans-serif", fontSize: "11px", color: "var(--ink2)", flex: "none" } }, r.brand));
        })));
  } else if (d.type === "today") {
    body = _h("div", { className: "pscroll", style: { flex: 1, overflow: "auto", margin: "0 -2px", padding: "0 2px" } },
      rows.length ? rows.map(function (r, i) {
        return _h("div", { key: i, style: { display: "flex", alignItems: "center", gap: "10px", padding: "7px 0", borderBottom: "1px solid var(--line)" } },
          _h("div", { style: { fontFamily: "'Geist', sans-serif", fontSize: "10.5px", color: "var(--ink2)", flex: "none", width: "30px" } }, r.no),
          _h("div", { style: { fontFamily: "'Geist',sans-serif", fontSize: "12.5px", color: "var(--ink)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, r.title),
          _h("div", { style: r.chipStyle }, r.h));
      }) : _h("div", { style: { color: "var(--ink2)", fontSize: "13px", fontFamily: "'Geist',sans-serif", padding: "8px 0" } }, "48 saatte termin yok"));
  } else {
    body = _h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", textAlign: "center" } },
      _h("div", { style: { width: "46px", height: "46px", borderRadius: "58% 42% 55% 45% / 52% 48% 55% 45%", background: "var(--line)" } }),
      _h("div", { style: { fontFamily: "'Geist', sans-serif", fontSize: "10px", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink2)" } }, "Yakında"));
  }
  return _h("div", { style: { display: "flex", flexDirection: "column", height: "100%", minWidth: 0 } }, head,
    _h("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } }, body));
}

// EMBEDDED → BNS_DATA köprüsü, v2 bundle'ında (taze yol). data.js'in Fastly cache durumuna
// BAĞIMLI DEĞİL; hidrasyon helper'ları (bnsHydrateBrief vb.) eski data.js'te bile mevcut.
function bnsV2Apply(ed) {
  if (!ed || typeof ed !== "object") return;
  window.EMBEDDED_DATA = ed;
  var D = window.BNS_DATA = window.BNS_DATA || {};
  var sm = window.bnsSafeMap || function (a, f) { return (a || []).map(f); };
  try {
    if (Array.isArray(ed.bns_brands)) {
      D.BRANDS = ed.bns_brands;
      D.BR = {}; ed.bns_brands.forEach(function (b) { if (b && b.name) D.BR[b.name] = b; });
    }
    if (Array.isArray(ed.bns_users)) D.USERS = window.bnsMergeUser ? ed.bns_users.map(window.bnsMergeUser) : ed.bns_users;
    if (Array.isArray(ed.bns_briefs)) D.briefs = window.bnsHydrateBrief ? sm(ed.bns_briefs, window.bnsHydrateBrief, "brief") : ed.bns_briefs;
    if (Array.isArray(ed.bns_completed)) D.completed = window.bnsHydrateCompleted ? sm(ed.bns_completed, window.bnsHydrateCompleted, "completed") : ed.bns_completed;
    if (ed.bns_dept_stats) D.deptStats = window.bnsNormDeptStats ? window.bnsNormDeptStats(ed.bns_dept_stats) : ed.bns_dept_stats;
    if (typeof window.bnsApplyExtras === "function") window.bnsApplyExtras(ed);
    D.__source = "live_briefs";
  } catch (e) { console.warn("[v2] apply hata:", e.message); }
}
window.bnsV2Apply = bnsV2Apply;
window.bnsV2Me = bnsV2Me;
window.bnsBuildPayload = bnsBuildPayload;
window.bnsRenderWidget = bnsRenderWidget;
window.bnsPanomStats = bnsPanomStats;
window.bnsRgbaW = bnsRgba;
