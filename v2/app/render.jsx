// Panom render — handoff <x-dc> şablonu + renderVals port edildi. window.bnsPanomRender(self).
function bnsPanomRender(self) {
  var h = React.createElement, s = self.state, dark = s.dark, pal = self.palette(dark), P = pal.P;
  var GAP = self.GAP, ROW = self.ROW;
  var me = window.bnsV2Me(), stats = window.bnsPanomStats(me);
  var leftCalc = function (x) { return 'calc((100% - ' + (11 * GAP) + 'px) / 12 * ' + x + ' + ' + (x * GAP) + 'px)'; };
  var widthCalc = function (w) { return 'calc((100% - ' + (11 * GAP) + 'px) / 12 * ' + w + ' + ' + ((w - 1) * GAP) + 'px)'; };
  var topPx = function (y) { return (y * (ROW + GAP)) + 'px'; };
  var heightPx = function (ht) { return (ht * ROW + (ht - 1) * GAP) + 'px'; };

  var rootStyle = {
    position: 'relative', minHeight: '100vh', width: '100%', overflowX: 'hidden',
    fontFamily: "'Geist', sans-serif", background: 'var(--bg)', color: 'var(--ink)', transition: 'background .3s ease, color .3s ease',
    '--bg': pal.bg, '--card': pal.card, '--ink': pal.ink, '--ink2': pal.ink2, '--line': pal.line,
    '--accent': pal.accent, '--brand': pal.brand, '--chip': pal.chip, '--accent-soft': pal.accentSoft,
    '--sidebar': pal.sidebar, '--topbar': pal.topbar, '--ody-brief-bg': pal.briefBg,
    '--blob1': pal.blob1, '--blob2': pal.blob2, '--blob3': pal.blob3,
    '--risk': P.risk, '--risk-tint': self.rgba(P.risk, dark ? 0.14 : 0.07), '--purple': P.purple, '--green': P.green,
    '--head': pal.head, '--zebra': pal.zebra, '--table-bg': pal.tableBg,
    '--skel1': dark ? 'rgba(255,255,255,.05)' : 'rgba(60,45,25,.055)', '--skel2': dark ? 'rgba(255,255,255,.11)' : 'rgba(60,45,25,.12)'
  };

  var sk = function (st2) { return h('div', { className: 'shim', style: Object.assign({ borderRadius: '8px' }, st2) }); };
  var skeletonEl = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' } },
    h('div', { key: 'h', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, sk({ width: '9px', height: '9px', borderRadius: '50%' }), sk({ height: '10px', width: '46%' })),
    sk({ key: 'b', height: '38px', width: '60%', borderRadius: '10px' }),
    sk({ key: 'c', flex: 1, width: '100%', minHeight: '34px', borderRadius: '12px' }));

  var cardStyle = { position: 'absolute', inset: 0, background: 'var(--table-bg)', border: '1px solid var(--line)', borderRadius: '20px', boxShadow: pal.shadow, padding: '17px 18px', overflow: 'auto', transition: 'box-shadow .2s ease, background .25s ease' };
  var ctx = { dark: dark, pal: pal, me: me, wc: self._wc, capAnim: s.capAnim, clientAnim: s.clientAnim };

  var maxRows = s.widgets.reduce(function (m, w) { return Math.max(m, w.y + w.h); }, 0) + (s.editMode ? 1 : 0);
  var gridHeightPx = (Math.max(1, maxRows) * (ROW + GAP) - GAP) + 'px';

  // ── BG blobs ──
  var blobs = h('div', { key: 'blobs', style: { position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 } },
    h('div', { style: { position: 'absolute', top: '-180px', right: '-120px', width: '520px', height: '520px', borderRadius: '58% 42% 55% 45% / 55% 45% 60% 40%', background: 'var(--blob1)', filter: 'blur(22px)', animation: 'blobBreathe 15s ease-in-out infinite' } }),
    h('div', { style: { position: 'absolute', bottom: '-220px', left: '8%', width: '480px', height: '480px', borderRadius: '50% 50% 45% 55% / 60% 40% 55% 45%', background: 'var(--blob2)', filter: 'blur(26px)', animation: 'blobBreathe 19s ease-in-out infinite' } }),
    h('div', { style: { position: 'absolute', top: '42%', left: '60%', width: '320px', height: '320px', borderRadius: '50%', background: 'var(--blob3)', filter: 'blur(32px)', animation: 'blobBreathe 23s ease-in-out infinite' } }));

  // ── SIDEBAR ──
  var navGroups = BNS_NAV.map(function (g) {
    return h('div', { key: g.label },
      h('div', { className: 'sb-grp', style: { fontFamily: "'Geist', sans-serif", fontSize: '10px', letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--ink2)', padding: '0 12px' } }, g.label),
      g.items.map(function (it) {
        var active = it.key === s.activeNav;
        return h('div', { key: it.key, 'data-key': it.key, 'data-label': it.label, onClick: self.onNav,
          style: { display: 'flex', alignItems: 'center', gap: '11px', padding: '7px 12px', borderRadius: '11px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: active ? 600 : 500, color: active ? 'var(--accent)' : 'var(--ink2)', background: active ? 'var(--accent-soft)' : 'transparent', transition: 'background .15s ease, color .15s ease' } },
          h('span', { style: { display: 'flex', flex: 'none', color: active ? 'var(--accent)' : 'var(--ink2)' } }, self.icon(it.icon)),
          h('span', { className: 'sb-text', style: { flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, it.label),
          it.badge ? h('span', { className: 'sb-text', style: { fontFamily: "'Geist', sans-serif", fontSize: '10.5px', color: 'var(--ink2)', background: 'var(--chip)', borderRadius: '999px', padding: '1px 7px', flex: 'none' } }, it.badge) : null);
      }));
  });
  var sbInner = h('div', { className: s.isMobile ? 'sbcontent' : 'sbpanel', style: s.isMobile ? { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minHeight: 0 } : {} },
    h('div', { className: 'sblogo', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '14px 18px 10px', flex: 'none' } },
      h('span', { className: 'sb-mark', style: { alignItems: 'center', justifyContent: 'center', flex: 'none' } }, h('img', { src: 'assets/logo-benseno.png', alt: 'benseno', style: { width: '46px', height: 'auto', maxWidth: 'none', display: 'block' } })),
      h('img', { className: 'sb-full', src: 'assets/logo-benseno.png', alt: 'benseno', style: { height: '30px', width: 'auto', maxWidth: '150px' } }),
      s.isMobile ? h('div', { onClick: self.onCloseSidebar, style: { width: '30px', height: '30px', borderRadius: '50%', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink2)', cursor: 'pointer', fontSize: '15px', flex: 'none' } }, '×') : null),
    h('div', { style: { padding: '0 18px 8px', flex: 'none' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', background: 'var(--chip)', border: '1px solid var(--line)', borderRadius: '12px', padding: '9px 12px', color: 'var(--ink2)' } },
        h('span', { style: { display: 'flex', flex: 'none' } }, self.icon('search')),
        h('span', { className: 'sb-text', style: { flex: 1, fontFamily: "'Geist',sans-serif", fontSize: '13px' } }, 'Ara…'),
        h('span', { className: 'sb-text', style: { fontFamily: "'Geist', sans-serif", fontSize: '11px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '6px', padding: '1px 6px' } }, '⌘K'))),
    h('nav', { className: 'sbnav', style: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '2px 14px 8px' } }, navGroups),
    h('div', { style: { padding: '12px 18px 18px', flex: 'none' } },
      h('div', { onClick: self.onShortcuts, style: { display: 'flex', alignItems: 'center', gap: '9px', color: 'var(--ink2)', fontFamily: "'Geist',sans-serif", fontSize: '12.5px', cursor: 'pointer', padding: '8px 12px', border: '1px solid var(--line)', borderRadius: '11px' } },
        h('span', { style: { display: 'flex' } }, self.icon('command')), h('span', { className: 'sb-text' }, 'Kısayollar'))));
  var sidebarStyle = s.isMobile
    ? { position: 'fixed', top: 0, left: 0, bottom: 0, width: '280px', background: 'var(--sidebar)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', zIndex: 46, overflowY: 'auto', transform: s.sidebarOpen ? 'translateX(0)' : 'translateX(-110%)', transition: 'transform .28s cubic-bezier(.2,.8,.2,1)', boxShadow: s.sidebarOpen ? '20px 0 50px -20px rgba(0,0,0,.4)' : 'none' }
    : { position: 'sticky', top: 0, height: '100vh', width: '78px', flexShrink: 0, overflow: 'visible', zIndex: 40 };
  var aside = h('aside', { className: s.isMobile ? 'pscroll' : 'sbrail', style: sidebarStyle }, sbInner);

  // ── TOPBAR ──
  var seg = function (name) { return { fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, padding: '6px 13px', borderRadius: '999px', cursor: 'pointer', color: s.scope === name ? 'var(--ink)' : 'var(--ink2)', background: s.scope === name ? 'var(--card)' : 'transparent', boxShadow: s.scope === name ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }; };
  var topbar = h('header', { style: { position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 22px', background: 'var(--topbar)', backdropFilter: 'blur(10px) saturate(1.1)', WebkitBackdropFilter: 'blur(10px) saturate(1.1)', borderBottom: '1px solid var(--line)' } },
    s.isMobile ? h('div', { onClick: self.onToggleSidebar, style: { width: '38px', height: '38px', borderRadius: '11px', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', cursor: 'pointer' } }, self.icon('menu')) : null,
    s.isMobile ? h('img', { src: 'assets/logo-benseno.png', alt: 'benseno', style: { height: '24px', width: 'auto' } }) : null,
    h('div', { style: { flex: 1 } }),
    !s.isMobile ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '7px', fontFamily: "'Geist', sans-serif", fontSize: '11.5px', color: 'var(--ink2)', background: 'var(--chip)', borderRadius: '999px', padding: '6px 12px' } },
      h('span', { style: { width: '7px', height: '7px', borderRadius: '50%', background: '#3C9A6A', boxShadow: '0 0 0 3px rgba(60,154,106,.18)' } }), 'Canlı · ' + s.liveSec + 'sn') : null,
    !s.isMobile ? h('div', { style: { display: 'flex', background: 'var(--chip)', borderRadius: '999px', padding: '3px' } },
      ['Ben', 'Dept', 'Tümü'].map(function (n) { return h('div', { key: n, 'data-scope': n, onClick: self.onScope, style: seg(n) }, n); })) : null,
    h('div', { onClick: self.onToggleTheme, style: { width: '38px', height: '38px', borderRadius: '50%', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink2)' } }, self.icon(dark ? 'sun' : 'moon')),
    h('div', { onClick: self.onBell, style: { position: 'relative', width: '38px', height: '38px', borderRadius: '50%', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink2)' } },
      self.icon('bell'), s.odyUnread > 0 ? h('span', { style: { position: 'absolute', top: '7px', right: '8px', width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', border: '1.5px solid var(--bg)' } }) : null),
    h('div', { onClick: self.onYeniBrief, style: { display: 'flex', alignItems: 'center', gap: '7px', background: 'var(--accent)', color: '#fff', fontFamily: "'Geist',sans-serif", fontSize: '13px', fontWeight: 600, borderRadius: '999px', padding: '9px 15px', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 6px 16px -6px var(--accent)' } },
      self.icon('plus'), !s.isMobile ? h('span', null, 'Yeni brief') : null),
    h('div', { onClick: self.onProfile, style: { display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', padding: '4px' } },
      h('div', { style: { width: '34px', height: '34px', borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Geist',sans-serif", fontWeight: 700, fontSize: '12.5px' } }, ((me && me.initials) || (me && me.name ? me.name.slice(0, 2).toUpperCase() : 'GK'))),
      !s.isMobile ? h('span', { style: { fontFamily: "'Geist',sans-serif", fontSize: '13.5px', fontWeight: 500, color: 'var(--ink)' } }, (me && me.name) || 'Görkem') : null,
      !s.isMobile ? h('span', { style: { color: 'var(--ink2)', fontSize: '11px' } }, '▾') : null));

  // ── HEADER bloğu (Panom) ──
  var hh = new Date().getHours();
  var greeting = hh < 6 ? 'İyi geceler' : hh < 11 ? 'Günaydın' : hh < 18 ? 'İyi günler' : 'İyi akşamlar';
  var now = new Date();
  var dateStr;
  try { dateStr = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' + now.toLocaleDateString('tr-TR', { weekday: 'long' }) + ' · İstanbul'; }
  catch (e) { dateStr = 'İstanbul'; }
  var nearestTxt = stats.nearestH != null ? ('en yakın teslim ' + (stats.nearestH < 24 ? Math.round(stats.nearestH) + ' saat' : Math.ceil(stats.nearestH / 24) + ' gün') + ' sonra') : 'yaklaşan teslim yok';
  var summary = h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '13.5px', color: 'var(--ink2)', marginTop: '7px' } },
    stats.aktif + ' aktif iş · ', h('span', { style: { color: stats.overdue ? 'var(--risk)' : 'var(--green)', fontWeight: 600 } }, stats.overdue + ' geciken'), ' · ' + nearestTxt + (stats.overdue ? '' : ' — içiniz rahat ☕'));
  var editBtnStyle = { fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.editMode ? '#fff' : 'var(--ink)', background: s.editMode ? 'var(--accent)' : 'transparent', border: s.editMode ? '1px solid var(--accent)' : '1px solid var(--line)' };
  var headerBlock = h('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '24px' } },
    h('div', { style: { minWidth: 0 } },
      h('div', { style: { display: 'inline-block', fontFamily: "'Geist', sans-serif", fontSize: '10.5px', letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--ink2)', background: 'var(--chip)', borderRadius: '999px', padding: '5px 11px' } }, dateStr),
      h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '15px', marginTop: '14px', flexWrap: 'wrap' } },
        h('div', { style: { fontFamily: "'Newsreader',serif", fontSize: '52px', lineHeight: '.9', color: 'var(--ink)' } }, 'Panom'),
        h('div', { style: { fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: '25px', color: 'var(--ink2)' } }, greeting + ', ' + ((me && me.name && me.name.split(' ')[0]) || 'Görkem') + '.')),
      summary),
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
      s.editMode ? h('div', { onClick: self.onOpenLib, style: { display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap', fontFamily: "'Geist',sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: '999px', padding: '9px 16px', cursor: 'pointer' } }, '+ Alan ekle') : null,
      h('div', { onClick: self.onToggleEdit, style: editBtnStyle, title: 'Panomu düzenle' }, self.icon(s.editMode ? 'check' : 'pen'))));

  // ── GRID (desktop) ──
  var ghost = null;
  if (s.dragId && !s.isMobile) { var gw = s.widgets.find(function (x) { return x.id === s.dragId; }); if (gw) ghost = h('div', { style: { position: 'absolute', left: leftCalc(gw.x), top: topPx(gw.y), width: widthCalc(gw.w), height: heightPx(gw.h), borderRadius: '20px', border: '2px dashed var(--accent)', background: 'var(--accent-soft)', transition: 'left .18s ease, top .18s ease, width .18s ease, height .18s ease', zIndex: 0 } }); }
  var gridKids = s.widgets.map(function (w) {
    var dragged = w.id === s.dragId, style;
    if (dragged && s.dragPx) style = { position: 'absolute', left: s.dragPx.left + 'px', top: s.dragPx.top + 'px', width: widthCalc(w.w), height: heightPx(w.h), transition: 'none', zIndex: 40, transform: 'scale(1.03) rotate(.4deg)', cursor: 'grabbing', boxShadow: '0 36px 64px -24px rgba(0,0,0,.5)', borderRadius: '20px' };
    else style = { position: 'absolute', left: leftCalc(w.x), top: topPx(w.y), width: widthCalc(w.w), height: heightPx(w.h), transition: 'left .26s cubic-bezier(.2,.85,.25,1), top .26s cubic-bezier(.2,.85,.25,1), width .2s ease, height .2s ease, transform .22s ease, opacity .22s ease', cursor: s.editMode ? 'grab' : 'default', zIndex: 1, transform: s.removingId === w.id ? 'scale(.92)' : 'scale(1)', opacity: s.removingId === w.id ? 0 : 1 };
    return h('div', { key: w.id, 'data-id': w.id, onPointerDown: self.onWidgetPointerDown, style: style },
      h('div', { className: 'pscroll', style: cardStyle }, s.loading ? skeletonEl : window.bnsRenderWidget(window.bnsBuildPayload(w.type, ctx))),
      s.editMode ? h('div', { 'data-id': w.id, onPointerDown: self.onRemovePointer, onClick: self.onRemove, style: { position: 'absolute', top: '-9px', right: '-9px', width: '26px', height: '26px', borderRadius: '50%', background: 'var(--card)', border: '1px solid var(--line)', boxShadow: '0 4px 10px -3px rgba(0,0,0,.25)', color: 'var(--ink2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', cursor: 'pointer', zIndex: 3 } }, '×') : null,
      s.editMode ? h('div', { 'data-id': w.id, onPointerDown: self.onResizePointerDown, style: { position: 'absolute', right: '2px', bottom: '2px', width: '20px', height: '20px', cursor: 'nwse-resize', zIndex: 3, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '3px' } }, h('div', { style: { width: '9px', height: '9px', borderRight: '2px solid var(--ink2)', borderBottom: '2px solid var(--ink2)', borderRadius: '0 0 3px 0', opacity: .6 } })) : null);
  });
  var grid = h('div', { ref: self.gridRef, style: { position: 'relative', width: '100%', height: gridHeightPx, transition: 'height .26s ease' } }, ghost, gridKids);

  // ── GRID (mobile) ──
  var dragDots = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' } }, [0, 1, 2, 3, 4, 5].map(function (i) { return h('span', { key: i, style: { width: '3px', height: '3px', borderRadius: '50%', background: 'var(--ink2)' } }); }));
  var wmap = {}; s.widgets.forEach(function (w) { wmap[w.id] = w; });
  var mobileGrid = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '13px' } },
    self.mobileIds().map(function (id) {
      var w = wmap[id]; if (!w) return null;
      var dragging = s.mDragId === id;
      return h('div', { key: id, ref: self.mRef(id), style: { position: 'relative', transform: dragging ? 'translateY(' + s.mDragDy + 'px) scale(1.02)' : 'none', zIndex: dragging ? 30 : 1, transition: dragging ? 'none' : 'transform .2s ease', opacity: dragging ? 0.98 : 1 } },
        h('div', { className: 'pscroll', style: { position: 'relative', background: 'var(--table-bg)', border: '1px solid var(--line)', borderRadius: '18px', boxShadow: dragging ? '0 26px 50px -18px rgba(0,0,0,.42)' : pal.shadow, padding: '17px 18px', minHeight: (w.h * 70) + 'px', overflow: 'auto', transition: 'box-shadow .2s ease' } }, s.loading ? skeletonEl : window.bnsRenderWidget(window.bnsBuildPayload(w.type, ctx))),
        s.editMode ? h('div', { 'data-id': id, onPointerDown: self.onMobileDown, style: { position: 'absolute', top: '-9px', left: '-9px', width: '30px', height: '30px', borderRadius: '50%', background: 'var(--card)', border: '1px solid var(--line)', boxShadow: '0 4px 10px -3px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', touchAction: 'none', zIndex: 4 } }, dragDots) : null,
        s.editMode ? h('div', { 'data-id': id, onClick: self.onRemove, style: { position: 'absolute', top: '-9px', right: '-9px', width: '30px', height: '30px', borderRadius: '50%', background: 'var(--card)', border: '1px solid var(--line)', boxShadow: '0 4px 10px -3px rgba(0,0,0,.25)', color: 'var(--ink2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', cursor: 'pointer', zIndex: 4 } }, '×') : null);
    }).filter(Boolean));

  // ── MAIN ──
  var panomMain = h(React.Fragment, null, headerBlock, s.isMobile ? mobileGrid : grid);
  var pageCtx = { dark: dark, pal: pal, me: me, onSort: self.onSort };
  var main = h('main', { style: { flex: 1, padding: '28px 30px 18px' } }, s.activeNav === 'panom' ? panomMain : window.bnsRenderPage(s.activeNav, pageCtx));

  var footer = h('footer', { style: { borderTop: '1px solid var(--line)', padding: '16px 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', color: 'var(--ink2)', fontFamily: "'Geist',sans-serif", fontSize: '12px', marginTop: '10px' } },
    h('div', null, '© 2026 ', h('span', { style: { color: 'var(--brand)', fontWeight: 600 } }, 'benseno'), ' · Marketing Technologies'),
    h('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap' } }, h('span', null, '● canlı'), h('span', null, 'son senkron ' + s.liveSec + 'sn önce')));

  var rightCol = h('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' } }, topbar, main, footer);
  var shell = h('div', { style: { position: 'relative', zIndex: 1, display: 'flex', minHeight: '100vh', alignItems: 'flex-start' } },
    (s.isMobile && s.sidebarOpen) ? h('div', { onClick: self.onCloseSidebar, style: { position: 'fixed', inset: 0, background: 'rgba(10,9,6,.45)', zIndex: 44 } }) : null,
    aside, rightCol);

  // ── LIBRARY DRAWER ──
  var lib = null;
  if (s.libOpen) {
    var onBoard = {}; s.widgets.forEach(function (w) { onBoard[w.type] = 1; });
    var order = ['risk', 'capacity', 'working', 'client', 'today', 'brandload', 'output', 'gallery', 'dept', 'aktif', 'kanban', 'onay', 'tamam', 'gecmis', 'marka', 'ekip', 'plan', 'karsi'];
    var libItems = order.filter(function (t) { return !onBoard[t]; }).map(function (t) {
      return h('div', { key: t, 'data-type': t, onClick: self.onAdd, style: { display: 'flex', alignItems: 'center', gap: '13px', padding: '14px 15px', border: '1px solid var(--line)', borderRadius: '16px', cursor: 'pointer', background: 'var(--chip)' } },
        h('div', { style: { width: '11px', height: '11px', borderRadius: '50%', flex: 'none', background: pal.bt[t] || pal.ink2 } }),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)' } }, BNS_DEFS[t].title),
          h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '11.5px', color: 'var(--ink2)', marginTop: '1px' } }, BNS_DEFS[t].desc)),
        h('div', { style: { fontFamily: "'Geist', sans-serif", fontSize: '11px', color: 'var(--accent)', flex: 'none' } }, '+ ekle'));
    });
    var WL = { risk: 'Riskli işlerim', capacity: 'Kapasitem', working: 'Çalışılıyor', client: 'Müşteride', today: 'Bugün ve yarın' };
    var colorRows = ['risk', 'capacity', 'working', 'client', 'today'].map(function (t) {
      return h('div', { key: t, style: { marginBottom: '14px' } },
        h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '12px', color: 'var(--ink)', marginBottom: '7px' } }, WL[t]),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, pal.bscale.map(function (cc, i) {
          return h('div', { key: i, 'data-w': t, 'data-c': cc, onClick: self.onColor, style: { width: '22px', height: '22px', borderRadius: '50%', background: cc, cursor: 'pointer', border: '2px solid var(--table-bg)', boxShadow: (self._wc[t] === cc) ? '0 0 0 2px var(--accent)' : '0 0 0 1px var(--line)' } }); })));
    });
    lib = h(React.Fragment, null,
      h('div', { onClick: self.onCloseLib, style: { position: 'fixed', inset: 0, background: 'rgba(10,9,6,.42)', zIndex: 60 } }),
      h('div', { style: { position: 'fixed', top: 0, right: 0, bottom: 0, width: '380px', maxWidth: '88vw', background: 'var(--card)', borderLeft: '1px solid var(--line)', zIndex: 61, boxShadow: '-30px 0 60px -30px rgba(0,0,0,.4)', display: 'flex', flexDirection: 'column', animation: 'panelIn .26s ease' } },
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 24px 16px' } },
          h('div', null, h('div', { style: { fontFamily: "'Newsreader',serif", fontSize: '26px', color: 'var(--ink)' } }, 'Alan ekle'), h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '12.5px', color: 'var(--ink2)', marginTop: '2px' } }, 'Kütüphaneden panona widget seç')),
          h('div', { onClick: self.onCloseLib, style: { width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink2)', fontSize: '16px' } }, '×')),
        h('div', { className: 'pscroll', style: { flex: 1, overflow: 'auto', padding: '6px 24px 24px', display: 'flex', flexDirection: 'column', gap: '11px' } },
          libItems.length ? libItems : h('div', { style: { textAlign: 'center', color: 'var(--ink2)', fontFamily: "'Geist',sans-serif", fontSize: '13px', padding: '30px 10px' } }, "Tüm widget'lar panonda 🎉"),
          h('div', { style: { borderTop: '1px solid var(--line)', marginTop: '10px', paddingTop: '16px' } },
            h('div', { style: { fontFamily: "'Geist',sans-serif", fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)' } }, 'Alan renkleri'),
            h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '11.5px', color: 'var(--ink2)', margin: '2px 0 14px' } }, 'Her alanın renk noktasını seç'),
            colorRows))));
  }

  // ── ODY ──
  var moodLabels = { sakin: 'Sakin', mutlu: 'Mutlu', coskulu: 'Coşkulu', heyecanli: 'Heyecanlı', korkmus: 'Tedirgin', endiseli: 'Endişeli', sikilmis: 'Canı sıkkın', dusunuyor: 'Düşünüyor', dikkat: 'Meraklı', kizgin: 'Kızgın', uzgun: 'Üzgün', saskin: 'Şaşkın', uykulu: 'Uykulu', neseli: 'Neşeli', mesgul: 'Meşgul' };
  var p = self.odyPos();
  var odyBlob = h('div', { onPointerDown: self.onOdyPointerDown, style: { position: 'fixed', left: p.x + 'px', top: p.y + 'px', width: '58px', height: '58px', zIndex: 55, cursor: 'grab', touchAction: 'none' } },
    h('div', { ref: function (el) { self._odyBlob = el; }, style: { position: 'relative', width: '58px', height: '58px', borderRadius: '64% 36% 60% 40% / 56% 44% 60% 40%', background: pal.brand, boxShadow: '0 18px 22px -7px rgba(18,22,38,.45), 0 7px 11px -4px rgba(18,22,38,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'odyBob 4.5s ease-in-out infinite', transition: 'background .35s ease, box-shadow .35s ease' } },
      window.bnsOdyFace(s.odyMood || 'sakin'),
      h('div', { style: { position: 'absolute', bottom: '-5px', right: '5px', width: '11px', height: '14px', borderRadius: '60% 60% 50% 50% / 75% 75% 40% 40%', background: 'var(--accent)', boxShadow: '0 4px 10px -3px var(--accent)', pointerEvents: 'none' } })),
    s.odyUnread > 0 ? h('div', { style: { position: 'absolute', top: '-2px', right: '-2px', minWidth: '21px', height: '21px', padding: '0 5px', borderRadius: '999px', background: 'var(--brand)', color: '#fff', fontFamily: "'Geist', sans-serif", fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2.5px solid var(--bg)', animation: 'popIn .3s ease' } }, s.odyUnread) : null);

  var odyPanel = null;
  if (s.odyOpen) {
    var vw = window.innerWidth, vh = window.innerHeight, panelW = Math.min(350, vw - 32);
    var curNotif = window.BNS_NOTIFS[s.notifIndex % window.BNS_NOTIFS.length];
    var miniFace = h('div', { style: { position: 'relative', width: '34px', height: '34px' } }, h('div', { style: { position: 'absolute', left: '50%', top: '50%', width: '58px', height: '58px', marginLeft: '-29px', marginTop: '-29px', transform: 'scale(0.56)' } }, window.bnsOdyFace(s.odyMood || 'sakin')));
    var chat = s.chat.map(function (m, i) {
      return h('div', { key: i, style: m.from === 'me'
        ? { alignSelf: 'flex-end', maxWidth: '82%', background: 'var(--accent)', color: '#fff', borderRadius: '16px 16px 4px 16px', padding: '9px 13px', fontFamily: "'Geist', sans-serif", fontSize: '13px', lineHeight: '1.45' }
        : { alignSelf: 'flex-start', maxWidth: '82%', background: 'var(--chip)', color: 'var(--ink)', borderRadius: '16px 16px 16px 4px', padding: '9px 13px', fontFamily: "'Geist', sans-serif", fontSize: '13px', lineHeight: '1.45', whiteSpace: 'pre-wrap' } }, m.text);
    });
    odyPanel = h('div', { className: 'pscroll', style: { position: 'fixed', left: Math.max(16, Math.min(p.x - panelW + 58, vw - panelW - 16)) + 'px', top: Math.max(16, Math.min(p.y - 430, vh - 470)) + 'px', width: panelW + 'px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '24px', boxShadow: '0 30px 70px -28px rgba(0,0,0,.5)', zIndex: 56, padding: '18px 20px 20px', animation: 'panelIn .26s ease' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '14px' } },
        h('div', { style: { width: '34px', height: '34px', borderRadius: '64% 36% 60% 40% / 56% 44% 60% 40%', background: pal.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' } }, miniFace),
        h('div', null, h('div', { style: { fontFamily: "'Newsreader',serif", fontSize: '21px', lineHeight: 1, color: 'var(--ink)' } }, 'Ody'), h('div', { style: { fontFamily: "'Geist', sans-serif", fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--accent)' } }, moodLabels[s.odyMood] || 'Sakin')),
        h('div', { style: { flex: 1 } }),
        h('div', { onClick: self.onCloseOdy, style: { width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink2)', fontSize: '14px' } }, '×')),
      h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '9px', background: 'var(--accent-soft)', borderRadius: '13px', padding: '11px 13px', marginBottom: '11px' } },
        h('span', { style: { width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', flex: 'none', marginTop: '5px' } }),
        h('span', { style: { fontFamily: "'Geist', sans-serif", fontSize: '12.5px', lineHeight: '1.45', color: 'var(--ink)' } }, curNotif.text)),
      h('div', { style: { background: 'var(--ody-brief-bg)', border: '1px solid var(--line)', borderRadius: '16px', padding: '14px 16px', fontFamily: "'Geist',sans-serif", fontSize: '13.5px', lineHeight: '1.6', color: 'var(--ink)', whiteSpace: 'pre-wrap' } }, s.odyBrief || 'Merhaba 👋 Brief’in hazırlanıyor…'),
      h('div', { className: 'pscroll', style: { display: 'flex', flexDirection: 'column', gap: '9px', marginTop: '14px', maxHeight: '200px', overflow: 'auto' } }, chat),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px' } },
        h('input', { ref: self.chatRef, onKeyDown: self.onChatKey, placeholder: "Ody'ye sor…", style: { flex: 1, fontFamily: "'Geist',sans-serif", fontSize: '13px', color: 'var(--ink)', background: 'var(--chip)', border: '1px solid var(--line)', borderRadius: '999px', padding: '10px 15px', outline: 'none' } }),
        h('div', { onClick: self.onSend, style: { width: '40px', height: '40px', flex: 'none', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px' } }, '↑')));
  }

  var toast = s.toast ? h('div', { style: { position: 'fixed', left: '50%', bottom: '26px', transform: 'translateX(-50%)', zIndex: 80, background: 'var(--ink)', color: 'var(--bg)', fontFamily: "'Geist',sans-serif", fontSize: '13px', fontWeight: 500, padding: '11px 18px', borderRadius: '999px', boxShadow: '0 14px 30px -10px rgba(0,0,0,.4)', animation: 'panelIn .2s ease' } }, s.toast) : null;

  return h('div', { style: rootStyle }, blobs, shell, lib, odyPanel, odyBlob, toast);
}
window.bnsPanomRender = bnsPanomRender;
