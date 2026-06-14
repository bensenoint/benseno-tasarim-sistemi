// Panom nav sayfaları — PanomPages handoff'u GERÇEK veriye (BNS_DATA + calc.js) bağlı port.
// window.bnsRenderPage(page, ctx). ctx = { dark, pal, me }.
var _ph = React.createElement;
var BNS_PAGE_SORT = { key: null, dir: 1 };

function bnsRenderPage(page, ctx) {
  var h = _ph, dark = ctx.dark, pal = ctx.pal, P = pal.P, me = ctx.me;
  var D = window.BNS_DATA || {};
  var briefs = D.briefs || [], completed = D.completed || [], users = D.USERS || [], BR = D.BR || {};
  var rgba = function (hx, a) { return window.bnsRgbaW ? window.bnsRgbaW(hx, a) : hx; };
  var brandColor = function (n) { return (BR[n] && BR[n].color) || pal.ink2; };
  var ROL_TR = { ai: 'AI', editor: 'Editör', tasarim: 'Tasarım', freelance: 'Freelance', yonetici: 'Yönetici' };
  var DUR_TR = { yeni: 'Yeni', calisiliyor: 'Çalışılıyor', incelemede: 'İncelemede', beklemede: 'Beklemede', revizyon: 'Revizyon', musteride: 'Müşteride', blokeli: 'Blokeli', tamamlandi: 'Tamamlandı' };
  var stColor = { yeni: P.gray || pal.ink2, calisiliyor: P.blue || pal.brand, incelemede: P.orange, beklemede: P.gray || pal.ink2, revizyon: P.orange, musteride: P.purple, blokeli: P.risk, tamamlandi: P.green };
  var chip = function (c, over) { return { display: 'inline-block', fontFamily: "'Geist', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '.03em', padding: '3px 8px', borderRadius: '7px', color: over ? '#fff' : c, background: over ? c : rgba(c, dark ? 0.20 : 0.12), whiteSpace: 'nowrap' }; };
  var dot = function (c) { return { width: '8px', height: '8px', borderRadius: '50%', flex: 'none', background: c, display: 'inline-block' }; };
  var markaPill = function (n) { return { display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: "'Geist', sans-serif", fontSize: '11.5px', fontWeight: 500, padding: '3px 9px 3px 8px', borderRadius: '999px', border: '1px solid var(--line)', background: 'var(--bg)', whiteSpace: 'nowrap' }; };
  var ava = function (name, i) { var col = pal.bscale[(name ? name.charCodeAt(0) : 0) % pal.bscale.length]; return { t: (name || '?')[0], style: { width: '22px', height: '22px', borderRadius: '50%', flex: 'none', background: col, color: '#fff', fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--table-bg)', marginLeft: i ? '-7px' : '0' } }; };
  var people = function (b) { var arr = []; if (b.lead) arr.push(b.lead); (b.contributors || []).forEach(function (c) { arr.push(c); }); return arr; };
  var kalanLabel = function (b) {
    var d = b.deltaH; if (d == null) return { t: '—', over: false, sahas: false };
    if (d < 0) { var a = Math.abs(d); return a < 24 ? { t: Math.round(a) + ' SA GECİKTİ', over: true, sa: true } : { t: Math.round(a / 24) + ' GÜN GECİKTİ', over: true, sa: false }; }
    return d <= 48 ? { t: Math.round(d) + ' SA', over: false, sa: true } : { t: Math.round(d / 24) + ' GÜN', over: false, sa: false };
  };
  var kalanChipStyle = function (kl) { var c = kl.over ? P.risk : kl.sa ? (parseInt(kl.t) <= 24 ? P.orange : P.yellow) : P.green; return chip(c, kl.over); };
  var priLabel = function (b) { var d = b.deltaH; if (d == null) return ['NORMAL', P.yellow]; if (d <= 0) return ['ACİL', P.risk]; if (d <= 24) return ['ACİL', P.risk]; if (d <= 48) return ['YÜKSEK', P.orange]; if (d <= 96) return ['NORMAL', P.yellow]; return ['DÜŞÜK', P.green]; };
  var fmtDate = function (ms) { if (!ms) return '—'; try { return new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + ' · ' + new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return '—'; } };
  var active = briefs.filter(function (b) { return b.durum !== 'tamamlandi'; });
  var overdue = active.filter(function (b) { return b.deltaH != null && b.deltaH < 0; });
  var card = function (extra) { return Object.assign({ background: 'var(--table-bg)', border: '1px solid var(--line)', borderRadius: '18px', padding: '18px 20px' }, extra || {}); };

  var titles = {
    genel: ['Genel bakış', 'aktif yük, geciken ve önce-bunlar'], aktif: ['Aktif işler', active.length + ' açık iş · sırala'],
    kanban: ['Kanban', 'durum bazlı kolonlar'], profil: ['Profil · ' + ((me && me.name) || ''), 'kişisel yük ve kapasite'],
    plan: ['Plan · 14 günlük', 'brief süreleri, öncelik renkleriyle'], karsi: ['Karşılaştırma', 'departman metrikleri'],
    gecmis: ['Geçmiş', 'sistem aktivite logu'], marka: ['Marka', 'marka başına yük ve risk'],
    onay: ['Müşteri Onayında', 'müşteri dönüşü bekleyenler'], tamam: ['Tamamlananlar', 'süre, gecikme ve puanlar'],
    tasarim: ['Tasarım departmanı', 'yüke göre ekip'], editor: ['Editör departmanı', 'yüke göre ekip'],
    ai: ['AI departmanı', 'yüke göre ekip'], freelance: ['Freelance', 'dış ekip yükü'],
    ekip: ['Ekip matrisi', 'kişi × marka yoğunluğu'], sirali: ['Sıralı İşler', 'onay zinciri']
  };
  var t = titles[page] || ['Görünüm', ''];
  var head = h('div', { style: { marginBottom: '20px' } },
    h('div', { style: { fontFamily: "'Newsreader',serif", fontSize: '40px', lineHeight: '.95', color: 'var(--ink)' } }, t[0]),
    h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '13.5px', color: 'var(--ink2)', marginTop: '6px' } }, t[1]));

  var kpiCard = function (a) { return { background: 'var(--table-bg)', border: '1px solid var(--line)', borderLeft: a ? ('3px solid ' + a) : '1px solid var(--line)', borderRadius: '14px', padding: '15px 16px' }; };
  var kpiGrid = function (items, min) {
    return h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(' + (min || 148) + 'px,1fr))', gap: '12px', marginBottom: '20px' } },
      items.map(function (k, i) { return h('div', { key: i, style: kpiCard(k.ac) },
        h('div', { style: { fontFamily: "'Geist', sans-serif", fontSize: '9.5px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink2)' } }, k.label),
        h('div', { style: { fontFamily: "'Geist',sans-serif", fontWeight: 700, fontSize: '30px', lineHeight: 1, margin: '9px 0 4px', color: 'var(--ink)' } }, k.value),
        k.sub ? h('div', { style: { fontFamily: "'Geist', sans-serif", fontSize: '11px', color: k.subc || 'var(--ink2)' } }, k.sub) : null); }));
  };
  var tableHead = function (cols) { return h('div', { style: { display: 'flex', gap: '12px', padding: '13px 16px 11px', background: 'var(--head)', borderRadius: '13px 13px 0 0', fontFamily: "'Geist', sans-serif", fontSize: '9.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink2)' } }, cols.map(function (c, i) { return h('div', { key: i, 'data-sortkey': c.sk || null, onClick: c.sk ? ctx.onSort : null, style: Object.assign({ cursor: c.sk ? 'pointer' : 'default', userSelect: 'none' }, c.w ? { width: c.w + 'px' } : { flex: 1 }) }, c.t + (c.sk && BNS_PAGE_SORT.key === c.sk ? (BNS_PAGE_SORT.dir > 0 ? ' ↑' : ' ↓') : '')); })); };
  var avatarsEl = function (b) { return h('div', { style: { display: 'flex' } }, people(b).slice(0, 3).map(function (u, i) { var a = ava(u.name, i); return h('div', { key: i, style: a.style }, a.t); })); };
  var panel = function (title, sub, body, extra) { return h('div', { style: card(extra) }, h('div', { style: { fontFamily: "'Geist',sans-serif", fontWeight: 600, fontSize: '15px' } }, title), sub ? h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '11px', color: 'var(--ink2)', marginBottom: '14px' } }, sub) : h('div', { style: { marginBottom: '8px' } }), body); };

  var body;

  if (page === 'genel') {
    var bugun = active.filter(function (b) { return b.deltaH != null && b.deltaH <= 48; }).sort(function (a, b) { return a.deltaH - b.deltaH; });
    var teslimBugun = active.filter(function (b) { return b.deltaH != null && b.deltaH >= 0 && b.deltaH <= 24; }).length;
    var musteride = active.filter(function (b) { return b.durum === 'musteride'; }).length;
    var ekipCap = users.length ? Math.round(users.reduce(function (m, u) { var ak = active.filter(function (b) { return (b.lead && b.lead.id === u.id) || (b.contributors || []).some(function (c) { return c.id === u.id; }); }).length; return m + (window.bnsPersonCapPct ? window.bnsPersonCapPct(u, ak) : 0); }, 0) / users.length) : 0;
    var kpis = [
      { label: 'Aktif brief', value: active.length, ac: null }, { label: 'Geciken', value: overdue.length, ac: overdue.length ? P.risk : null, subc: overdue.length ? P.risk : null, sub: overdue.length ? 'dikkat' : 'temiz' },
      { label: 'Bugün teslim', value: teslimBugun, ac: null }, { label: 'Müşteride', value: musteride, ac: P.purple, sub: '✈ dönüş bekliyor' },
      { label: 'Ekip kapasite', value: '%' + ekipCap, ac: P.green, subc: P.green, sub: 'ortalama' }
    ];
    var bugunTable = panel('Bugün ve yarın', bugun.length + ' brief · ' + overdue.length + ' gecikmiş',
      h('div', { className: 'pscroll', style: { overflowX: 'auto' } }, h('div', { style: { minWidth: '680px' } },
        tableHead([{ t: '#', w: 40 }, { t: 'Öncelik', w: 74 }, { t: 'Kalan', w: 110 }, { t: 'Marka', w: 110 }, { t: 'İş' }, { t: 'Atanan', w: 70 }, { t: 'Durum', w: 96 }]),
        bugun.slice(0, 8).map(function (b, i) { var kl = kalanLabel(b), pr = priLabel(b); return h('div', { key: b.no, style: { display: 'flex', gap: '12px', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid var(--line)', fontFamily: "'Geist',sans-serif", fontSize: '12.5px', background: i % 2 ? 'var(--zebra)' : 'transparent' } },
          h('div', { style: { width: '40px', color: 'var(--ink2)' } }, '#' + b.no),
          h('div', { style: { width: '74px' } }, h('span', { style: chip(pr[1]) }, pr[0])),
          h('div', { style: { width: '110px' } }, h('span', { style: kalanChipStyle(kl) }, kl.t)),
          h('div', { style: { width: '110px' } }, h('span', { style: markaPill(b.marka) }, h('span', { style: dot(brandColor(b.marka)) }), b.marka)),
          h('div', { style: { flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, b.baslik),
          h('div', { style: { width: '70px' } }, avatarsEl(b)),
          h('div', { style: { width: '96px', display: 'flex', alignItems: 'center', gap: '6px' } }, h('span', { style: dot(stColor[b.durum] || pal.ink2) }), h('span', { style: { fontSize: '12px' } }, DUR_TR[b.durum] || b.durum))); }))));
    var ds = D.deptStats || {};
    var deptOzet = panel('Departman özeti', 'aktif · geciken · kapasite', Object.keys(ds).map(function (k) {
      var d = ds[k] || {}, pct = Math.min(100, (d.active || 0) * 12);
      return h('div', { key: k, style: { marginBottom: '13px' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', marginBottom: '5px' } }, h('span', { style: dot(pal.bscale[3]) }), h('span', { style: { fontWeight: 600, flex: 1 } }, ROL_TR[k] || k), h('span', null, (d.active || 0)), h('span', { style: { color: 'var(--risk)' } }, (d.overdue || 0))),
        h('div', { style: { height: '6px', borderRadius: '999px', background: 'var(--line)', overflow: 'hidden' } }, h('div', { style: { height: '100%', width: pct + '%', borderRadius: '999px', background: pal.bscale[3] } })));
    }));
    body = h(React.Fragment, null, kpiGrid(kpis), bugunTable, h('div', { style: { marginTop: '16px' } }, deptOzet));
  }

  else if (page === 'aktif') {
    var cols = [{ t: '#', w: 40, sk: 'no' }, { t: 'Öncelik', w: 74 }, { t: 'Kalan', w: 110, sk: 'kalan' }, { t: 'Marka', w: 110 }, { t: 'İş' }, { t: 'Atanan', w: 64 }, { t: 'Teslim', w: 110, sk: 'teslim' }, { t: 'Durum', w: 96 }];
    var rows = active.slice();
    if (BNS_PAGE_SORT.key === 'no') rows.sort(function (a, b) { return (a.no - b.no) * BNS_PAGE_SORT.dir; });
    else if (BNS_PAGE_SORT.key === 'kalan') rows.sort(function (a, b) { return ((a.deltaH == null ? 1e9 : a.deltaH) - (b.deltaH == null ? 1e9 : b.deltaH)) * BNS_PAGE_SORT.dir; });
    else if (BNS_PAGE_SORT.key === 'teslim') rows.sort(function (a, b) { return ((a.deadline || 0) - (b.deadline || 0)) * BNS_PAGE_SORT.dir; });
    else rows.sort(function (a, b) { return (a.deltaH == null ? 1e9 : a.deltaH) - (b.deltaH == null ? 1e9 : b.deltaH); });
    body = h('div', { className: 'pscroll', style: card({ padding: '6px 4px', overflowX: 'auto' }) }, h('div', { style: { minWidth: '900px' } },
      tableHead(cols),
      rows.map(function (b, i) { var kl = kalanLabel(b), pr = priLabel(b); return h('div', { key: b.no, style: { display: 'flex', gap: '12px', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid var(--line)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', background: i % 2 ? 'var(--zebra)' : 'transparent' } },
        h('div', { style: { width: '40px', color: 'var(--ink2)' } }, '#' + b.no),
        h('div', { style: { width: '74px' } }, h('span', { style: chip(pr[1]) }, pr[0])),
        h('div', { style: { width: '110px' } }, h('span', { style: kalanChipStyle(kl) }, kl.t)),
        h('div', { style: { width: '110px' } }, h('span', { style: markaPill(b.marka) }, h('span', { style: dot(brandColor(b.marka)) }), b.marka)),
        h('div', { style: { flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, b.baslik),
        h('div', { style: { width: '64px' } }, avatarsEl(b)),
        h('div', { style: { width: '110px', fontSize: '11px', color: 'var(--ink2)' } }, fmtDate(b.deadline)),
        h('div', { style: { width: '96px', display: 'flex', alignItems: 'center', gap: '6px' } }, h('span', { style: dot(stColor[b.durum] || pal.ink2) }), h('span', null, DUR_TR[b.durum] || b.durum))); })));
  }

  else if (page === 'kanban') {
    var colDefs = [['yeni', 'Yeni'], ['calisiliyor', 'Çalışılıyor'], ['incelemede', 'İncelemede'], ['musteride', 'Müşteride'], ['blokeli', 'Blokeli']];
    body = h('div', { className: 'pscroll', style: { display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '10px', alignItems: 'flex-start' } },
      colDefs.map(function (cd) {
        var list = briefs.filter(function (b) { return b.durum === cd[0]; });
        return h('div', { key: cd[0], style: { flex: 'none', width: '262px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '16px', padding: '12px' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px 12px' } }, h('span', { style: dot(stColor[cd[0]]) }), h('span', { style: { fontFamily: "'Geist',sans-serif", fontWeight: 600, fontSize: '13px', flex: 1 } }, cd[1]), h('span', { style: { fontFamily: "'Geist', sans-serif", fontSize: '11px', color: 'var(--ink2)', background: 'var(--chip)', borderRadius: '999px', padding: '1px 8px' } }, list.length)),
          list.length ? list.slice(0, 8).map(function (b) { var kl = kalanLabel(b); return h('div', { key: b.no, style: { background: 'var(--table-bg)', border: '1px solid var(--line)', borderRadius: '13px', padding: '12px', marginBottom: '10px' } },
            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' } }, h('span', { style: markaPill(b.marka) }, h('span', { style: dot(brandColor(b.marka)) }), b.marka), h('span', { style: { fontFamily: "'Geist', sans-serif", fontSize: '10.5px', color: 'var(--ink2)' } }, '#' + b.no)),
            h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '13px', lineHeight: '1.35', marginBottom: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, b.baslik),
            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, h('span', { style: kalanChipStyle(kl) }, kl.t), avatarsEl(b))); })
            : h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '9px', padding: '24px 0', opacity: .7 } }, h('div', { style: { width: '32px', height: '32px', borderRadius: '50%', border: '2px dashed var(--line)' } }), h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '11.5px', color: 'var(--ink2)' } }, 'şu an boş')));
      }));
  }

  else if (page === 'profil' || page === 'tasarim' || page === 'editor' || page === 'ai' || page === 'freelance') {
    var isDept = page !== 'profil';
    if (isDept) {
      var deptUsers = users.filter(function (u) { return (u.dept || u.rol) === page; });
      var loadOf = function (u) { return active.filter(function (b) { return (b.lead && b.lead.id === u.id) || (b.contributors || []).some(function (c) { return c.id === u.id; }); }); };
      var team = deptUsers.map(function (u) { var ak = loadOf(u).length, pct = window.bnsPersonCapPct ? window.bnsPersonCapPct(u, ak) : 0; return { u: u, ak: ak, pct: pct }; }).sort(function (a, b) { return b.pct - a.pct; });
      var deptJobs = active.filter(function (b) { return b.dept === page; }).sort(function (a, b) { return (a.deltaH == null ? 1e9 : a.deltaH) - (b.deltaH == null ? 1e9 : b.deltaH); }).slice(0, 8);
      var dk = (D.deptStats && D.deptStats[page]) || {};
      body = h(React.Fragment, null,
        kpiGrid([{ label: 'Aktif iş', value: dk.active != null ? dk.active : deptJobs.length, ac: null }, { label: 'Kişi', value: deptUsers.length, ac: null }, { label: 'Geciken', value: dk.overdue || 0, ac: P.risk }, { label: 'Müşteride', value: dk.musteride || 0, ac: P.purple }], 150),
        h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' } },
          panel('Ekip · yüke göre', null, h('div', null, team.map(function (x) { var a = ava(x.u.name, 0); return h('div', { key: x.u.id, style: { display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 0', borderBottom: '1px solid var(--line)' } },
            h('div', { style: a.style }, a.t),
            h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, x.u.name), h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '11px', color: 'var(--ink2)' } }, x.ak + ' aktif')),
            h('div', { style: { width: '84px', height: '6px', borderRadius: '999px', background: 'var(--line)', overflow: 'hidden', flex: 'none' } }, h('div', { style: { height: '100%', width: Math.min(100, x.pct) + '%', background: x.pct >= 80 ? P.risk : x.pct >= 60 ? P.orange : P.green, borderRadius: '999px' } })),
            h('div', { style: { width: '34px', textAlign: 'right', fontFamily: "'Geist',sans-serif", fontSize: '11.5px', color: 'var(--ink2)', flex: 'none' } }, '%' + x.pct)); }))),
          panel('Departman işleri', null, h('div', null, deptJobs.map(function (b) { var kl = kalanLabel(b); return h('div', { key: b.no, style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: '1px solid var(--line)', fontFamily: "'Geist',sans-serif", fontSize: '12.5px' } }, h('div', { style: { width: '34px', color: 'var(--ink2)', flex: 'none' } }, '#' + b.no), h('span', { style: markaPill(b.marka) }, h('span', { style: dot(brandColor(b.marka)) }), b.marka), h('div', { style: { flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, b.baslik), h('span', { style: kalanChipStyle(kl) }, kl.t)); })))));
    } else {
      var uid = me && me.id;
      var mine = active.filter(function (b) { return (b.lead && b.lead.id === uid) || (b.contributors || []).some(function (c) { return c.id === uid; }); });
      var myActive = mine.filter(function (b) { return b.durum !== 'musteride'; }).length;
      var limit = window.bnsPersonCapLimit ? window.bnsPersonCapLimit(me) : 6;
      var pct = window.bnsPersonCapPct ? window.bnsPersonCapPct(me, myActive) : 0;
      var bd = {}; mine.forEach(function (b) { bd[b.marka] = (bd[b.marka] || 0) + 1; });
      var bdArr = Object.keys(bd).map(function (k) { return { n: k, v: bd[k] }; }).sort(function (a, b) { return b.v - a.v; }), bdMax = bdArr.reduce(function (m, x) { return Math.max(m, x.v); }, 1);
      body = h('div', { style: { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '16px', alignItems: 'start' } },
        panel('Üzerimdeki aktif işler', 'toplam ' + mine.length, h('div', null, mine.sort(function (a, b) { return (a.deltaH == null ? 1e9 : a.deltaH) - (b.deltaH == null ? 1e9 : b.deltaH); }).map(function (b) { var kl = kalanLabel(b); return h('div', { key: b.no, style: { display: 'flex', gap: '11px', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)', fontFamily: "'Geist',sans-serif", fontSize: '12.5px' } }, h('div', { style: { width: '32px', color: 'var(--ink2)' } }, '#' + b.no), h('span', { style: markaPill(b.marka) }, h('span', { style: dot(brandColor(b.marka)) }), b.marka), h('div', { style: { flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, b.baslik), h('span', { style: kalanChipStyle(kl) }, kl.t)); }))),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
          h('div', { style: card() },
            h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' } }, h('div', { style: { fontFamily: "'Geist',sans-serif", fontWeight: 600, fontSize: '15px' } }, 'Kapasite'), h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '12px', color: pct >= 90 ? P.risk : P.green, fontWeight: 600 } }, pct >= 90 ? 'Dolu' : pct >= 70 ? 'Yoğun' : 'Müsait')),
            h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '11px', color: 'var(--ink2)', marginBottom: '12px' } }, myActive + ' / ' + limit + ' iş limiti'),
            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' } }, h('div', { style: { fontFamily: "'Newsreader',serif", fontSize: '46px', lineHeight: '.85' } }, '%' + pct), h('div', { style: { width: '64px', height: '64px', borderRadius: '50%', background: 'conic-gradient(' + P.green + ' 0% ' + pct + '%, var(--line) ' + pct + '% 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' } }, h('div', { style: { width: '47px', height: '47px', borderRadius: '50%', background: 'var(--table-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Geist',sans-serif", fontWeight: 600, fontSize: '13px', color: P.green } }, myActive + '/' + limit)))),
          panel('Marka dağılımı', 'aktif işlerin', h('div', null, bdArr.map(function (x) { return h('div', { key: x.n, style: { marginBottom: '11px' } }, h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', marginBottom: '5px' } }, h('span', { style: dot(brandColor(x.n)) }), h('span', { style: { flex: 1 } }, x.n), h('span', { style: { color: 'var(--ink2)' } }, x.v)), h('div', { style: { height: '5px', borderRadius: '999px', background: 'var(--line)', overflow: 'hidden' } }, h('div', { style: { height: '100%', width: (x.v / bdMax * 100) + '%', borderRadius: '999px', background: brandColor(x.n) } }))); })))));
    }
  }

  else if (page === 'onay') {
    var rows = active.filter(function (b) { return b.durum === 'musteride'; });
    body = h(React.Fragment, null, kpiGrid([{ label: 'Müşteride', value: rows.length, ac: P.purple, sub: 'dönüş bekliyor' }], 160),
      h('div', { className: 'pscroll', style: card({ padding: '6px 4px', overflowX: 'auto' }) }, h('div', { style: { minWidth: '560px' } },
        tableHead([{ t: '#', w: 40 }, { t: 'Marka', w: 130 }, { t: 'İş' }, { t: 'Termin', w: 120 }]),
        rows.map(function (b) { return h('div', { key: b.no, style: { display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--line)', fontFamily: "'Geist',sans-serif", fontSize: '12.5px' } }, h('div', { style: { width: '40px', color: 'var(--ink2)' } }, '#' + b.no), h('div', { style: { width: '130px' } }, h('span', { style: markaPill(b.marka) }, h('span', { style: dot(brandColor(b.marka)) }), b.marka)), h('div', { style: { flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, b.baslik), h('div', { style: { width: '120px', color: 'var(--ink2)' } }, fmtDate(b.deadline))); }))));
  }

  else if (page === 'tamam') {
    var star = function (n) { n = Math.round(n || 0); return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); };
    var avgPuan = completed.length ? (completed.reduce(function (m, c) { return m + (c.puan || c.rating || 0); }, 0) / completed.filter(function (c) { return c.puan || c.rating; }).length || 0) : 0;
    body = h(React.Fragment, null,
      kpiGrid([{ label: 'Tamamlanan', value: completed.length, ac: null }, { label: 'Ort. puan', value: (avgPuan ? avgPuan.toFixed(1) : '—') + ' / 5', ac: P.green }], 148),
      h('div', { className: 'pscroll', style: card({ padding: '6px 4px', overflowX: 'auto' }) }, h('div', { style: { minWidth: '660px' } },
        tableHead([{ t: 'Marka', w: 130 }, { t: 'İş' }, { t: 'Süre', w: 70 }, { t: 'Puan', w: 100 }]),
        completed.slice(0, 40).map(function (c, i) { var sure = (window.bnsSureH ? window.bnsSureH(c) : c.sureH) || null; return h('div', { key: c.id || i, style: { display: 'flex', gap: '12px', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid var(--line)', fontFamily: "'Geist',sans-serif", fontSize: '12.5px' } }, h('div', { style: { width: '130px', display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 } }, h('span', { style: dot(brandColor(c.marka)) }), h('span', { style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, c.marka)), h('div', { style: { flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, c.baslik), h('div', { style: { width: '70px', color: 'var(--ink2)' } }, sure != null && sure > 0 ? sure.toFixed(1) + ' sa' : '—'), h('div', { style: { width: '100px', color: '#E0A92B', letterSpacing: '2px', fontSize: '13px' } }, star(c.puan || c.rating))); }))));
  }

  else if (page === 'marka') {
    var byBrand = {}; briefs.forEach(function (b) { var k = b.marka || '?'; (byBrand[k] = byBrand[k] || { aktif: 0, total: 0 }); byBrand[k].total++; if (b.durum !== 'tamamlandi') byBrand[k].aktif++; });
    var rows = Object.keys(byBrand).map(function (k) { return { marka: k, aktif: byBrand[k].aktif, total: byBrand[k].total }; }).sort(function (a, b) { return b.aktif - a.aktif; });
    body = h(React.Fragment, null,
      kpiGrid([{ label: 'Toplam marka', value: rows.length, ac: null }, { label: 'En yoğun', value: (rows[0] && rows[0].aktif) || 0, ac: P.yellow, sub: (rows[0] && rows[0].marka) || '' }], 150),
      h('div', { className: 'pscroll', style: card({ padding: '6px 4px', overflowX: 'auto' }) }, h('div', { style: { minWidth: '480px' } },
        tableHead([{ t: 'Marka' }, { t: 'Aktif', w: 70 }, { t: 'Toplam', w: 70 }]),
        rows.map(function (r) { return h('div', { key: r.marka, style: { display: 'flex', gap: '12px', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid var(--line)', fontFamily: "'Geist',sans-serif", fontSize: '12.5px' } }, h('div', { style: { flex: 1, display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 } }, h('span', { style: dot(brandColor(r.marka)) }), h('span', { style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, r.marka)), h('div', { style: { width: '70px', fontWeight: 600 } }, r.aktif), h('div', { style: { width: '70px', color: 'var(--ink2)' } }, r.total)); }))));
  }

  else if (page === 'karsi') {
    var ds = D.deptStats || {}, keys = Object.keys(ds);
    var maxAk = keys.reduce(function (m, k) { return Math.max(m, ds[k].active || 0); }, 1);
    body = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '14px' } },
      keys.map(function (k) { var d = ds[k]; return h('div', { key: k, style: card({ borderRadius: '16px', padding: '16px 18px' }) },
        h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink2)' } }, (ROL_TR[k] || k) + ' · ' + (d.people || 0) + ' kişi'),
        h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', margin: '8px 0' } }, h('span', { style: { fontFamily: "'Geist',sans-serif", fontWeight: 700, fontSize: '28px' } }, d.active || 0), h('span', { style: { fontFamily: "'Geist',sans-serif", fontSize: '11px', color: 'var(--ink2)' } }, 'aktif · ' + (d.overdue || 0) + ' geciken')),
        h('div', { style: { height: '7px', borderRadius: '999px', background: 'var(--line)', overflow: 'hidden' } }, h('div', { style: { height: '100%', width: ((d.active || 0) / maxAk * 100) + '%', background: pal.bscale[3], borderRadius: '999px' } }))); }));
  }

  else if (page === 'gecmis') {
    var evs = (D.events || D.activity || []).slice(0, 60);
    if (!evs.length) body = h('div', { style: card({ padding: '40px', textAlign: 'center', color: 'var(--ink2)', fontFamily: "'Geist',sans-serif" }) }, 'Henüz aktivite kaydı yok.');
    else { var byDay = {}; evs.forEach(function (e) { var ms = e.t || e.ts; var day = ms ? (function () { try { return new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }); } catch (x) { return 'Bugün'; } })() : 'Bugün'; (byDay[day] = byDay[day] || []).push(e); });
      body = h('div', { style: card({ padding: '8px 20px 16px' }) }, Object.keys(byDay).map(function (day) {
        return h('div', { key: day }, h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink2)', padding: '16px 0 8px', borderBottom: '1px solid var(--line)' } }, day),
          byDay[day].map(function (e, i) { var who = (users.find(function (u) { return u.id === (e.who || e.user); }) || {}).name || (e.who || ''); var a = ava(who, 0); var ti = (e.t || e.ts) ? (function () { try { return new Date(e.t || e.ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); } catch (x) { return ''; } })() : ''; return h('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 0', borderBottom: '1px solid var(--line)', fontFamily: "'Geist',sans-serif", fontSize: '12.5px' } }, h('div', { style: { width: '40px', color: 'var(--ink2)', fontSize: '11px', flex: 'none' } }, ti), h('div', { style: a.style }, a.t), h('div', { style: { flex: 'none' } }, h('span', { style: { fontWeight: 600 } }, who), ' ', h('span', { style: { color: 'var(--ink2)' } }, (e.verb || '').split(':')[0] || 'güncelledi')), e.marka ? h('span', { style: markaPill(e.marka) }, h('span', { style: dot(brandColor(e.marka)) }), e.marka) : null, h('div', { style: { flex: 1, minWidth: 0, color: 'var(--ink2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, e.baslik ? ('#' + (e.no || '') + ' ' + e.baslik) : '')); })); }));
    }
  }

  else if (page === 'ekip') {
    var brandsTop = Object.keys((function () { var c = {}; active.forEach(function (b) { c[b.marka] = (c[b.marka] || 0) + 1; }); return c; })()).sort(function (a, b) { var ca = active.filter(function (x) { return x.marka === a; }).length, cb = active.filter(function (x) { return x.marka === b; }).length; return cb - ca; }).slice(0, 6);
    var topUsers = users.map(function (u) { return { u: u, load: active.filter(function (b) { return (b.lead && b.lead.id === u.id) || (b.contributors || []).some(function (c) { return c.id === u.id; }); }).length }; }).filter(function (x) { return x.load > 0; }).sort(function (a, b) { return b.load - a.load; }).slice(0, 14);
    var cellVal = function (u, brand) { return active.filter(function (b) { return b.marka === brand && ((b.lead && b.lead.id === u.id) || (b.contributors || []).some(function (c) { return c.id === u.id; })); }).length; };
    body = h('div', { className: 'pscroll', style: card({ padding: '6px 4px', overflowX: 'auto' }) }, h('div', { style: { minWidth: '720px' } },
      h('div', { style: { display: 'flex', padding: '13px 14px 11px', background: 'var(--head)', borderRadius: '13px 13px 0 0', fontFamily: "'Geist',sans-serif", fontSize: '9.5px', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink2)' } }, h('div', { style: { width: '180px', flex: 'none' } }, 'Kişi / Marka'), brandsTop.map(function (b, i) { return h('div', { key: i, style: { flex: 1, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, b); })),
      topUsers.map(function (x) { var a = ava(x.u.name, 0); return h('div', { key: x.u.id, style: { display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line)' } }, h('div', { style: { width: '180px', flex: 'none', display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 14px' } }, h('div', { style: a.style }, a.t), h('div', { style: { minWidth: 0 } }, h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '12.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, x.u.name), h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '10px', color: 'var(--ink2)' } }, ROL_TR[x.u.rol || x.u.dept] || ''))), brandsTop.map(function (br, ci) { var v = cellVal(x.u, br); return h('div', { key: ci, style: { flex: 1, height: '36px', background: v ? rgba(P.risk, Math.min(.55, v * 0.16)) : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Geist',sans-serif", fontSize: '12px', fontWeight: 600, color: v ? 'var(--ink)' : 'var(--ink2)', borderLeft: '1px solid var(--line)' } }, v || ''); })); })));
  }

  else if (page === 'sirali') {
    var seq = briefs.filter(function (b) { return (b.akis === 'sirali' || b.akis === 'Sıralı') || (Array.isArray(b.zincir) && b.zincir.length); });
    body = h(React.Fragment, null,
      kpiGrid([{ label: 'Sıralı iş', value: seq.length, ac: 'var(--accent)', sub: 'onay zinciri' }], 180),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '13px' } }, seq.length ? seq.map(function (b) { var kl = kalanLabel(b); var chain = (b.zincir && b.zincir.length ? b.zincir : people(b)); return h('div', { key: b.no, style: card({ borderRadius: '16px', padding: '16px 18px' }) },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' } }, h('span', { style: { fontFamily: "'Geist',sans-serif", fontSize: '9.5px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: '6px', padding: '2px 7px' } }, 'Sıralı'), h('span', { style: markaPill(b.marka) }, h('span', { style: dot(brandColor(b.marka)) }), b.marka), h('span', { style: { fontFamily: "'Geist',sans-serif", fontSize: '11px', color: 'var(--ink2)' } }, '#' + b.no), h('div', { style: { flex: 1 } }), h('span', { style: kalanChipStyle(kl) }, kl.t)),
        h('div', { style: { fontFamily: "'Geist',sans-serif", fontSize: '14px', fontWeight: 500, marginBottom: '12px' } }, b.baslik),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } }, chain.map(function (m, i) { var nm = m.name || m, a = ava(nm, 0); return h('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: '5px' } }, h('div', { style: a.style }, a.t), h('span', { style: { fontFamily: "'Geist',sans-serif", fontSize: '11.5px', color: 'var(--ink)' } }, nm), (m.onay || (b.lead && b.lead.id === m.id)) ? h('span', { style: { fontFamily: "'Geist',sans-serif", fontSize: '9px', color: 'var(--accent)', textTransform: 'uppercase' } }, 'lead') : null); }))); })
        : h('div', { style: card({ padding: '40px', textAlign: 'center', color: 'var(--ink2)', fontFamily: "'Geist',sans-serif" }) }, 'Sıralı (zincir) iş yok.')));
  }

  else if (page === 'plan') {
    var planRows = active.filter(function (b) { return b.deltaH != null; }).sort(function (a, b) { return a.deltaH - b.deltaH; }).slice(0, 12);
    var maxH = planRows.reduce(function (m, b) { return Math.max(m, b.deltaH); }, 24);
    body = h('div', { className: 'pscroll', style: card({ padding: '14px 16px', overflowX: 'auto' }) }, h('div', { style: { minWidth: '720px' } },
      planRows.map(function (b) { var pr = priLabel(b); var pos = Math.max(0, Math.min(95, (1 - b.deltaH / maxH) * 90)); var w = Math.max(6, (b.deltaH / maxH) * 60); return h('div', { key: b.no, style: { display: 'flex', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--line)' } }, h('div', { style: { width: '210px', flex: 'none', display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '10px' } }, h('span', { style: markaPill(b.marka) }, h('span', { style: dot(brandColor(b.marka)) }), b.marka), h('span', { style: { fontFamily: "'Geist',sans-serif", fontSize: '11.5px', color: 'var(--ink2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, b.baslik)), h('div', { style: { flex: 1, position: 'relative', height: '34px' } }, h('div', { style: { position: 'absolute', left: pos + '%', width: w + '%', top: '6px', height: '22px', background: pr[1], borderRadius: '6px', display: 'flex', alignItems: 'center', paddingLeft: '9px', color: '#fff', fontFamily: 'Geist, sans-serif', fontSize: '10.5px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden' } }, Math.round(b.deltaH) + 'sa'))); })));
  }

  else { body = h('div', { style: card({ padding: '40px', textAlign: 'center', color: 'var(--ink2)', fontFamily: "'Geist',sans-serif" }) }, 'Görünüm hazırlanıyor.'); }

  return h('div', { style: { fontFamily: "'Geist',sans-serif", color: 'var(--ink)', minHeight: '560px' } }, head, body);
}
window.bnsRenderPage = bnsRenderPage;
window.BNS_PAGE_SORT = BNS_PAGE_SORT;
