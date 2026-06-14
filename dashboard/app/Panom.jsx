// PanomScreen — prod dashboard'a kişiye özel widget panosu (sürükle/boyutlandır/ekle-çıkar).
// PROD token'larıyla (sand/lacivert v2 paleti YOK), PROD verisiyle (data.briefs/completed/USERS + calc.js).
// Kalıcılık: localStorage 'bns_panom_prod' + /api/layout (authGuard).
var PANOM_GAP = 14, PANOM_ROW = 84;
var PANOM_DEFS = {
  risk:     { title: 'Riskli işlerim',  desc: 'Üstünde, ≤24sa veya gecikmiş', w: 4, h: 3, dot: 'var(--prio-red)' },
  capacity: { title: 'Kapasitem',       desc: 'Doluluk ve rol kapasiten',    w: 4, h: 3, dot: 'var(--ember)' },
  client:   { title: 'Müşteride',       desc: 'Müşteri onayı bekleyenler',   w: 4, h: 3, dot: 'var(--prio-orange)' },
  working:  { title: 'Çalışılıyor',     desc: 'Şu an çalışılan tüm işler',   w: 6, h: 4, dot: 'var(--info, #3B82C4)' },
  today:    { title: 'Bugün ve yarın',  desc: 'Termini 48 saat içinde',      w: 6, h: 4, dot: 'var(--prio-yellow)' },
  brandload:{ title: 'Marka yoğunluğu', desc: 'Markaya göre aktif iş',        w: 4, h: 3, dot: 'var(--info, #3B82C4)' },
  dept:     { title: 'Departman özeti', desc: 'Departman bazında yük',        w: 4, h: 3, dot: 'var(--prio-green)' }
};
function panomDefaultLayout() {
  return [
    { id: 'risk', type: 'risk', x: 0, y: 0, w: 4, h: 3 },
    { id: 'capacity', type: 'capacity', x: 4, y: 0, w: 4, h: 3 },
    { id: 'client', type: 'client', x: 8, y: 0, w: 4, h: 3 },
    { id: 'working', type: 'working', x: 0, y: 3, w: 6, h: 4 },
    { id: 'today', type: 'today', x: 6, y: 3, w: 6, h: 4 }
  ];
}
function panomCollide(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function panomPack(items, priorityId) {
  var placed = [];
  if (priorityId) { var d = items.find(function (w) { return w.id === priorityId; }); if (d) placed.push(Object.assign({}, d, { y: Math.max(0, d.y) })); }
  items.filter(function (w) { return w.id !== priorityId; }).sort(function (a, b) { return (a.y - b.y) || (a.x - b.x); })
    .forEach(function (it) { var w = Object.assign({}, it), y = 0; while (placed.some(function (p) { return panomCollide(Object.assign({}, w, { y: y }), p); })) y++; w.y = y; placed.push(w); });
  return placed;
}

function PanomScreen(props) {
  var data = props.data || {}, currentUser = props.currentUser || null;
  var h = React.createElement;
  var API = window.BNS_API_BASE || "https://benseno-api-production.up.railway.app";
  var tok = function () { return (typeof localStorage !== "undefined" && localStorage.getItem("bns_token")) || ""; };

  var loadSaved = function () { try { return JSON.parse(localStorage.getItem('bns_panom_prod')) || {}; } catch (e) { return {}; } };
  var saved = React.useRef(loadSaved());
  // Kayıtlı layout her zaman pack'ten geçer → eski/hatalı sürümün kaydettiği çakışık düzen otomatik onarılır.
  var ref = React.useState(saved.current.widgets && saved.current.widgets.length ? panomPack(saved.current.widgets) : panomDefaultLayout());
  var widgets = ref[0], setWidgets = ref[1];
  var er = React.useState(false), edit = er[0], setEdit = er[1];
  var dr = React.useState(null), dragId = dr[0], setDragId = dr[1];
  var dp = React.useState(null), dragPx = dp[0], setDragPx = dp[1];
  var wcRef = React.useRef(saved.current.wc || {});
  var rmRef = React.useState(null), removingId = rmRef[0], setRemovingId = rmRef[1];
  var gridRef = React.useRef(null);
  var dragRef = React.useRef(null);
  var rafRef = React.useRef(null);
  var wRef = React.useRef(widgets); wRef.current = widgets; // her render'da taze widget listesi (closure bayatlamasın)

  var persist = function (ws) {
    try { localStorage.setItem('bns_panom_prod', JSON.stringify({ widgets: ws, wc: wcRef.current })); } catch (e) {}
    try { fetch(API + '/api/layout', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + tok() }, body: JSON.stringify({ layout: ws.map(function (w) { return { id: w.id, type: w.type, x: w.x, y: w.y, w: w.w, h: w.h }; }) }) }).catch(function () {}); } catch (e) {}
  };
  // sunucudan kişiye özel layout (varsa) — bir kez
  React.useEffect(function () {
    (async function () {
      try {
        var r = await fetch(API + '/api/layout', { headers: { Authorization: 'Bearer ' + tok() } });
        if (r.ok) { var j = await r.json(); if (j && Array.isArray(j.layout) && j.layout.length && !(saved.current.widgets && saved.current.widgets.length)) {
          var valid = j.layout.filter(function (w) { return PANOM_DEFS[w.type]; });
          if (valid.length) setWidgets(panomPack(valid));
        } }
      } catch (e) {}
    })();
  }, []);

  // ── sürükle / boyutlandır ── (ref tabanlı: taze widget + doğru listener temizliği)
  var beginDrag = function (id, mode, e) {
    var c = gridRef.current; if (!c) return;
    var rect = c.getBoundingClientRect(), w = wRef.current.find(function (x) { return x.id === id; }); if (!w) return;
    var colW = (rect.width - 11 * PANOM_GAP) / 12, cl = w.x * (colW + PANOM_GAP), ct = w.y * (PANOM_ROW + PANOM_GAP);
    dragRef.current = { id: id, mode: mode, colW: colW, rect: rect, offX: e.clientX - rect.left - cl, offY: e.clientY - rect.top - ct };
    setDragId(id); if (mode === 'move') setDragPx({ left: cl, top: ct });
    var move = function (ev) {
      if (rafRef.current) return;
      var cx = ev.clientX, cy = ev.clientY;
      rafRef.current = requestAnimationFrame(function () {
        rafRef.current = null; var d = dragRef.current; if (!d) return;
        var ws = wRef.current.map(function (x) { return Object.assign({}, x); });
        var ww = ws.find(function (x) { return x.id === d.id; }); if (!ww) return;
        if (d.mode === 'move') {
          var left = cx - d.rect.left - d.offX, top = cy - d.rect.top - d.offY;
          ww.x = Math.max(0, Math.min(12 - ww.w, Math.round(left / (d.colW + PANOM_GAP))));
          ww.y = Math.max(0, Math.round(top / (PANOM_ROW + PANOM_GAP)));
          setWidgets(panomPack(ws, d.id)); setDragPx({ left: left, top: top });
        } else {
          var bcl = ww.x * (d.colW + PANOM_GAP), bct = ww.y * (PANOM_ROW + PANOM_GAP);
          ww.w = Math.max(3, Math.min(12 - ww.x, Math.round((cx - d.rect.left - bcl + PANOM_GAP) / (d.colW + PANOM_GAP))));
          ww.h = Math.max(2, Math.min(8, Math.round((cy - d.rect.top - bct + PANOM_GAP) / (PANOM_ROW + PANOM_GAP))));
          setWidgets(panomPack(ws, d.id));
        }
      });
    };
    var up = function () {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      dragRef.current = null; setDragId(null); setDragPx(null); persist(wRef.current);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); e.preventDefault();
  };
  var onWidgetDown = function (e) { if (!edit) return; beginDrag(e.currentTarget.getAttribute('data-id'), 'move', e); };
  var onResizeDown = function (e) { e.stopPropagation(); if (!edit) return; beginDrag(e.currentTarget.getAttribute('data-id'), 'resize', e); };
  var onRemove = function (e) {
    e.stopPropagation(); var id = e.currentTarget.getAttribute('data-id');
    setRemovingId(id);
    setTimeout(function () { setWidgets(function (ws) { var n = panomPack(ws.filter(function (w) { return w.id !== id; })); persist(n); return n; }); setRemovingId(null); }, 220);
  };
  // Editörden tablo aç/kapa: panoda yoksa ekler (en alta), varsa çıkarır. Hep pack'ten geçer → çakışma olmaz.
  var onToggle = function (type) {
    setWidgets(function (ws) {
      var has = ws.some(function (w) { return w.type === type; });
      var n;
      if (has) { n = panomPack(ws.filter(function (w) { return w.type !== type; })); }
      else { var def = PANOM_DEFS[type]; var maxY = ws.reduce(function (m, w) { return Math.max(m, w.y + w.h); }, 0); n = panomPack(ws.concat([{ id: type, type: type, x: 0, y: maxY, w: def.w, h: def.h }]), type); }
      persist(n); return n;
    });
  };

  // ── widget veri + render (prod token'ları) ──
  var brandColor = function (b) { return (b.brand && b.brand.color) || (data.BR && data.BR[b.marka] && data.BR[b.marka].color) || 'var(--ink-4)'; };
  var me = (function () { var u = currentUser || {}; var sid = u.slack_id || u.id; return (data.USERS || []).find(function (x) { return x.id === sid; }) || { id: sid, name: u.name, rol: '' }; })();
  var briefs = data.briefs || [];
  var mine = function (b) { return (b.lead && b.lead.id === me.id) || (Array.isArray(b.contributors) && b.contributors.some(function (c) { return c && c.id === me.id; })); };
  var dotC = function (w) { return wcRef.current[w.type] || PANOM_DEFS[w.type].dot; };

  var widgetBody = function (type) {
    if (type === 'risk') {
      var rows = briefs.filter(function (b) { return mine(b) && window.bnsIsRisk && window.bnsIsRisk(b.durum, b.deltaH); }).sort(function (a, b) { return a.deltaH - b.deltaH; });
      if (!rows.length) return h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--ink-4)' } }, h('div', { style: { fontSize: 26 } }, '👍'), h('div', { style: { font: '400 13px/1.4 var(--font-sans)' } }, 'Risk yok — temiz.'));
      return rows.map(function (b) { var late = b.deltaH <= 0; return h('div', { key: b.no, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderLeft: '3px solid var(--prio-red)', background: 'var(--prio-red-bg)', borderRadius: '0 10px 10px 0', marginBottom: 7 } }, h('span', { style: { font: '500 10.5px/1 var(--font-mono)', color: 'var(--ink-4)' } }, '#' + b.no), h('span', { style: { flex: 1, font: '500 12.5px/1.3 var(--font-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, b.baslik || ''), h('span', { style: { font: '700 11px/1 var(--font-mono)', color: 'var(--prio-red)' } }, late ? Math.abs(Math.round(b.deltaH)) + 'sa↑' : Math.round(b.deltaH) + 'sa')); });
    }
    if (type === 'capacity') {
      var aktif = briefs.filter(function (b) { return mine(b) && b.durum !== 'musteride' && b.durum !== 'tamamlandi'; }).length;
      var limit = window.bnsPersonCapLimit ? window.bnsPersonCapLimit(me) : 6;
      var pct = window.bnsPersonCapPct ? window.bnsPersonCapPct(me, aktif) : 0;
      var col = pct >= 90 ? 'var(--prio-red)' : pct >= 70 ? 'var(--prio-orange)' : 'var(--prio-green)';
      return h(React.Fragment, null,
        h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 10 } }, h('div', { style: { font: '500 48px/0.9 var(--font-display, serif)', color: col } }, '%' + pct), h('div', { style: { font: '400 13px/1 var(--font-mono)', color: 'var(--ink-4)' } }, aktif + '/' + limit)),
        h('div', { style: { font: '400 12px/1.3 var(--font-sans)', color: 'var(--ink-4)', marginTop: 6 } }, aktif + ' aktif iş'),
        h('div', { style: { marginTop: 14, height: 8, borderRadius: 99, background: 'var(--surface-sub)', overflow: 'hidden' } }, h('div', { style: { height: '100%', width: Math.min(100, pct) + '%', borderRadius: 99, background: col, transition: 'width .4s ease' } })));
    }
    if (type === 'client') {
      var cl = briefs.filter(function (b) { return b.durum === 'musteride'; });
      return h(React.Fragment, null,
        h('div', { style: { font: '500 48px/0.9 var(--font-display, serif)', color: 'var(--ember)' } }, cl.length),
        h('div', { style: { font: '400 12px/1.3 var(--font-sans)', color: 'var(--ink-4)', marginTop: 4 } }, 'onay bekliyor'),
        h('div', { style: { marginTop: 10 } }, cl.slice(0, 6).map(function (b) { return h('div', { key: b.no, style: { display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' } }, h('span', { style: { width: 8, height: 8, borderRadius: '50%', background: brandColor(b), flex: 'none' } }), h('span', { style: { flex: 1, font: '400 12.5px/1.3 var(--font-sans)', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, b.baslik || ''), h('span', { style: { font: '500 11px/1 var(--font-mono)', color: 'var(--ink-4)' } }, b.marka || '')); })));
    }
    if (type === 'working') {
      var rows2 = briefs.filter(function (b) { return b.durum === 'calisiliyor'; }).slice(0, 30);
      if (!rows2.length) return h('div', { style: { color: 'var(--ink-4)', font: '400 13px/1.4 var(--font-sans)', padding: '8px 0' } }, 'Aktif iş yok');
      return rows2.map(function (b) { return h('div', { key: b.no, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '0.5px solid var(--line)' } }, h('span', { style: { width: 8, height: 8, borderRadius: 3, background: brandColor(b), flex: 'none' } }), h('span', { style: { flex: 1, font: '400 12.5px/1.35 var(--font-sans)', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, b.baslik || ''), h('span', { style: { font: '500 11px/1 var(--font-mono)', color: 'var(--ink-4)' } }, b.marka || '')); });
    }
    if (type === 'today') {
      var rows3 = briefs.filter(function (b) { return b.deltaH != null && b.deltaH <= 48 && b.durum !== 'tamamlandi' && b.durum !== 'musteride'; }).sort(function (a, b) { return a.deltaH - b.deltaH; }).slice(0, 30);
      if (!rows3.length) return h('div', { style: { color: 'var(--ink-4)', font: '400 13px/1.4 var(--font-sans)', padding: '8px 0' } }, '48 saatte termin yok');
      return rows3.map(function (b) { var late = b.deltaH <= 0, col = late ? 'var(--prio-red)' : b.deltaH <= 24 ? 'var(--prio-orange)' : 'var(--prio-yellow)'; return h('div', { key: b.no, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '0.5px solid var(--line)' } }, h('span', { style: { width: 30, font: '500 10.5px/1 var(--font-mono)', color: 'var(--ink-4)', flex: 'none' } }, '#' + b.no), h('span', { style: { flex: 1, font: '400 12.5px/1.35 var(--font-sans)', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, b.baslik || ''), h('span', { style: { font: '700 11px/1 var(--font-mono)', color: col } }, late ? Math.abs(Math.round(b.deltaH)) + 'sa↑' : Math.round(b.deltaH) + 'sa')); });
    }
    if (type === 'brandload') {
      var act = briefs.filter(function (b) { return b.durum !== 'tamamlandi'; });
      var by = {}; act.forEach(function (b) { var k = b.marka || '?'; by[k] = (by[k] || 0) + 1; });
      var arr = Object.keys(by).map(function (k) { return { n: k, v: by[k] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 7);
      var mx = arr.reduce(function (m, x) { return Math.max(m, x.v); }, 1);
      if (!arr.length) return h('div', { style: { color: 'var(--ink-4)', font: '400 13px/1.4 var(--font-sans)', padding: '8px 0' } }, 'Aktif iş yok');
      return arr.map(function (x) { return h('div', { key: x.n, style: { marginBottom: 9 } }, h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, font: '400 12px/1.3 var(--font-sans)', marginBottom: 4 } }, h('span', { style: { width: 8, height: 8, borderRadius: '50%', background: (data.BR && data.BR[x.n] && data.BR[x.n].color) || 'var(--ink-4)', flex: 'none' } }), h('span', { style: { flex: 1, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, x.n), h('span', { style: { color: 'var(--ink-4)', font: '500 11px/1 var(--font-mono)' } }, x.v)), h('div', { style: { height: 5, borderRadius: 99, background: 'var(--surface-sub)', overflow: 'hidden' } }, h('div', { style: { height: '100%', width: (x.v / mx * 100) + '%', borderRadius: 99, background: (data.BR && data.BR[x.n] && data.BR[x.n].color) || 'var(--ember)' } }))); });
    }
    if (type === 'dept') {
      var ds = data.deptStats || {}; var TR = { ai: 'AI', editor: 'Editör', tasarim: 'Tasarım', freelance: 'Freelance' };
      var keys = Object.keys(ds); if (!keys.length) return h('div', { style: { color: 'var(--ink-4)', font: '400 13px/1.4 var(--font-sans)', padding: '8px 0' } }, 'Veri yok');
      var mxA = keys.reduce(function (m, k) { return Math.max(m, ds[k].active || 0); }, 1);
      return keys.map(function (k) { var d = ds[k] || {}; return h('div', { key: k, style: { marginBottom: 11 } }, h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, font: '400 12.5px/1.3 var(--font-sans)', marginBottom: 5 } }, h('span', { style: { flex: 1, fontWeight: 600, color: 'var(--ink)' } }, TR[k] || k), h('span', { style: { color: 'var(--ink-3)' } }, (d.active || 0)), h('span', { style: { color: 'var(--prio-red)' } }, (d.overdue || 0))), h('div', { style: { height: 6, borderRadius: 99, background: 'var(--surface-sub)', overflow: 'hidden' } }, h('div', { style: { height: '100%', width: ((d.active || 0) / mxA * 100) + '%', borderRadius: 99, background: 'var(--ember)' } }))); });
    }
    return null;
  };

  var leftCalc = function (x) { return 'calc((100% - ' + (11 * PANOM_GAP) + 'px) / 12 * ' + x + ' + ' + (x * PANOM_GAP) + 'px)'; };
  var widthCalc = function (w) { return 'calc((100% - ' + (11 * PANOM_GAP) + 'px) / 12 * ' + w + ' + ' + ((w - 1) * PANOM_GAP) + 'px)'; };
  var maxRows = widgets.reduce(function (m, w) { return Math.max(m, w.y + w.h); }, 0) + (edit ? 1 : 0);

  var cardChrome = { background: 'var(--surface)', border: '0.5px solid var(--line)', borderRadius: 16, boxShadow: 'var(--shadow-card, 0 1px 2px rgba(0,0,0,.05))', padding: '15px 17px', overflow: 'auto', display: 'flex', flexDirection: 'column' };
  var btn = { padding: '7px 13px', border: '0.5px solid var(--line)', borderRadius: 9, background: 'var(--surface)', color: 'var(--ink-2)', font: '500 12px/1 var(--font-sans)', cursor: 'pointer' };

  var widgetCards = widgets.map(function (w) {
    var dragged = w.id === dragId, style;
    if (dragged && dragPx) style = { position: 'absolute', left: dragPx.left + 'px', top: dragPx.top + 'px', width: widthCalc(w.w), height: (w.h * PANOM_ROW + (w.h - 1) * PANOM_GAP) + 'px', transition: 'none', zIndex: 40, transform: 'scale(1.03) rotate(.4deg)', cursor: 'grabbing', boxShadow: 'var(--shadow-2)' };
    else style = { position: 'absolute', left: leftCalc(w.x), top: (w.y * (PANOM_ROW + PANOM_GAP)) + 'px', width: widthCalc(w.w), height: (w.h * PANOM_ROW + (w.h - 1) * PANOM_GAP) + 'px', transition: 'left .26s cubic-bezier(.2,.85,.25,1), top .26s cubic-bezier(.2,.85,.25,1), transform .2s, opacity .2s', cursor: edit ? 'grab' : 'default', zIndex: 1, transform: removingId === w.id ? 'scale(.92)' : 'scale(1)', opacity: removingId === w.id ? 0 : 1 };
    return h('div', { key: w.id, 'data-id': w.id, onPointerDown: onWidgetDown, style: style },
      h('div', { style: Object.assign({ height: '100%' }, cardChrome) },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flex: 'none' } },
          edit ? h('span', { style: { cursor: 'move', color: 'var(--ink-5, #aaa)', fontSize: 12 } }, '⋮⋮') : null,
          h('span', { style: { width: 8, height: 8, borderRadius: '50%', background: dotC(w), flex: 'none' } }),
          h('span', { style: { font: '600 11px/1 var(--font-sans)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)' } }, PANOM_DEFS[w.type].title)),
        h('div', { style: { flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' } }, widgetBody(w.type))),
      edit ? h('div', { 'data-id': w.id, onClick: onRemove, style: { position: 'absolute', top: -9, right: -9, width: 26, height: 26, borderRadius: '50%', background: 'var(--surface)', border: '0.5px solid var(--line)', boxShadow: 'var(--shadow-2)', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, cursor: 'pointer', zIndex: 3 } }, '×') : null,
      edit ? h('div', { 'data-id': w.id, onPointerDown: onResizeDown, style: { position: 'absolute', right: 2, bottom: 2, width: 20, height: 20, cursor: 'nwse-resize', zIndex: 3, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 3 } }, h('div', { style: { width: 9, height: 9, borderRight: '2px solid var(--ink-4)', borderBottom: '2px solid var(--ink-4)', borderRadius: '0 0 3px 0', opacity: .6 } })) : null);
  });

  return h('div', { style: { padding: '22px 24px 32px' } },
    h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 } },
      h('div', { style: { font: '500 30px/1 var(--font-display, serif)', color: 'var(--ink)' } }, 'Panom'),
      h('div', { style: { flex: 1, font: '400 12.5px/1 var(--font-sans)', color: 'var(--ink-4)' } }, edit ? 'tablo seç · kartları sürükle · köşeden boyutlandır' : 'kişisel iş panon'),
      h('button', { onClick: function () { setEdit(function (e) { return !e; }); }, style: Object.assign({}, btn, edit ? { background: 'var(--ember)', borderColor: 'var(--ember)', color: '#fff' } : {}) }, edit ? '✓ bitti' : 'düzenle')),
    edit ? h('div', { style: { marginBottom: 16, padding: 14, border: '0.5px solid var(--line)', borderRadius: 14, background: 'var(--surface-sub)' } },
      h('div', { style: { font: '600 10px/1 var(--font-sans)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 11 } }, 'Tablolar — panona eklemek/çıkarmak için seç'),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(218px, 1fr))', gap: 8 } },
        Object.keys(PANOM_DEFS).map(function (t) {
          var on = widgets.some(function (w) { return w.type === t; });
          return h('button', { key: t, onClick: function () { onToggle(t); }, style: { display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '9px 11px', borderRadius: 10, cursor: 'pointer', border: on ? '1px solid var(--ember)' : '0.5px solid var(--line)', background: on ? 'var(--ember-tint)' : 'var(--surface)' } },
            h('span', { style: { width: 18, height: 18, borderRadius: 5, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? 'var(--ember)' : 'transparent', border: on ? 'none' : '1.5px solid var(--line)', color: '#fff', font: '700 11px/1 var(--font-sans)' } }, on ? '✓' : ''),
            h('span', { style: { width: 8, height: 8, borderRadius: '50%', flex: 'none', background: PANOM_DEFS[t].dot } }),
            h('div', { style: { flex: 1, minWidth: 0 } },
              h('div', { style: { font: '600 12.5px/1.2 var(--font-sans)', color: 'var(--ink)' } }, PANOM_DEFS[t].title),
              h('div', { style: { font: '400 11px/1.3 var(--font-sans)', color: 'var(--ink-4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, PANOM_DEFS[t].desc)));
        }))) : null,
    h('div', { ref: gridRef, style: { position: 'relative', width: '100%', minHeight: 120, height: (Math.max(1, maxRows) * (PANOM_ROW + PANOM_GAP) - PANOM_GAP) + 'px', transition: 'height .26s ease' } }, widgetCards.length ? widgetCards : h('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '400 13px/1.4 var(--font-sans)', color: 'var(--ink-4)' } }, edit ? 'Yukarıdan tablo seç' : 'Panon boş — düzenle ile tablo ekle')));
}
try { window.PanomScreen = PanomScreen; } catch (e) {}
