// Panom — ana çalışma panosu (handoff tasarımının React-UMD portu, gerçek veriye bağlı).
// Sidebar flyout, topbar, 12-kolon absolute grid (sürükle/boyutlandır/pack), mobil yeniden sıralama,
// kütüphane çekmecesi, alan renkleri, tema, skeleton, Ody maskotu (tüm ifadeler + fx + panel + sohbet).
var H = React.createElement;
var API_V2 = window.BNS_API_BASE || "https://benseno-api-production.up.railway.app";
function tokV2() { return (typeof localStorage !== "undefined" && localStorage.getItem("bns_token")) || ""; }

var BNS_DEFS = {
  risk:     { title: 'Riskli işlerim',  desc: 'Senin üstünde, termine ≤24sa veya gecikmiş', w: 4, h: 3 },
  capacity: { title: 'Kapasitem',       desc: 'Doluluk yüzden ve rol kapasiten',     w: 4, h: 3 },
  working:  { title: 'Çalışılıyor',     desc: 'Ekipte şu an çalışılan tüm işler',    w: 6, h: 4 },
  client:   { title: 'Müşteride',       desc: 'Müşteri onayı bekleyen işler',        w: 4, h: 3 },
  today:    { title: 'Bugün ve yarın',  desc: 'Termini 48 saat içindeki işler',      w: 6, h: 4 },
  brandload:{ title: 'Marka yoğunluğu', desc: 'Markalara göre aktif iş dağılımı',    w: 4, h: 3, soon: true },
  output:   { title: 'Çıktı hızı',      desc: 'Haftalık tamamlanan iş sayısı',       w: 4, h: 3, soon: true },
  gallery:  { title: 'Son teslimler',   desc: 'En son teslim edilen işlerin galerisi', w: 6, h: 3, soon: true },
  dept:     { title: 'Departman özeti', desc: 'Departman bazında özet görünüm',      w: 4, h: 3, soon: true },
  aktif:    { title: 'Aktif işler',     desc: 'Tüm ekibin açık işleri',              w: 6, h: 4, soon: true },
  kanban:   { title: 'Kanban özeti',    desc: 'Durum bazlı kolon sayıları',          w: 4, h: 3, soon: true },
  onay:     { title: 'Müşteri onayı',   desc: 'Onay bekleyen işler',                 w: 4, h: 3, soon: true },
  tamam:    { title: 'Tamamlananlar',   desc: 'Son tamamlanan işler ve puanlar',     w: 4, h: 3, soon: true },
  gecmis:   { title: 'Geçmiş akışı',    desc: 'Son sistem aktiviteleri',             w: 4, h: 4, soon: true },
  marka:    { title: 'Marka tablosu',   desc: 'Markalara göre yük ve risk',          w: 6, h: 4, soon: true },
  ekip:     { title: 'Ekip matrisi',    desc: 'Kişi × marka yoğunluk haritası',      w: 6, h: 4, soon: true },
  plan:     { title: 'Plan / Gantt',    desc: 'Zaman çizelgesi (mini)',              w: 6, h: 3, soon: true },
  karsi:    { title: 'Karşılaştırma',   desc: 'Departman metrik karşılaştırması',    w: 4, h: 3, soon: true }
};
window.BNS_DEFS = BNS_DEFS;
var BNS_NAV = [
  { label: 'Ana', items: [{ key: 'panom', label: 'Panom', icon: 'sparkle' }, { key: 'genel', label: 'Genel bakış', icon: 'home' }, { key: 'aktif', label: 'Aktif işler', icon: 'briefcase', badge: '36' }] },
  { label: 'Planlama', items: [{ key: 'plan', label: 'Plan / Gantt', icon: 'calendar' }, { key: 'kanban', label: 'Kanban', icon: 'kanban' }, { key: 'onay', label: 'Müşteri Onayı', icon: 'clock', badge: '2' }] },
  { label: 'Raporlar', items: [{ key: 'tamam', label: 'Tamamlananlar', icon: 'check' }, { key: 'karsi', label: 'Karşılaştırma', icon: 'chart' }, { key: 'gecmis', label: 'Geçmiş', icon: 'archive' }] },
  { label: 'Departmanlar', items: [{ key: 'tasarim', label: 'Tasarım', icon: 'pen' }, { key: 'editor', label: 'Editör', icon: 'type' }, { key: 'ai', label: 'AI', icon: 'zap' }, { key: 'freelance', label: 'Freelance', icon: 'users' }] },
  { label: 'Diğer', items: [{ key: 'galeri', label: 'Galeri', icon: 'image' }, { key: 'sirali', label: 'Sıralı İşler', icon: 'list' }, { key: 'marka', label: 'Marka', icon: 'tag' }, { key: 'ekip', label: 'Ekip matrisi', icon: 'grid' }, { key: 'profil', label: 'Profil', icon: 'user' }, { key: 'yardim', label: 'Yardım', icon: 'help' }, { key: 'kilavuz', label: 'Kullanım Kılavuzu', icon: 'book' }] }
];

class Panom extends React.Component {
  constructor(props) {
    super(props);
    this.GAP = 14; this.ROW = 86;
    var saved = this.load();
    this.state = {
      widgets: saved.widgets || this.defaultLayout(),
      editMode: false, dark: saved.dark != null ? saved.dark : false,
      isMobile: typeof window !== 'undefined' && window.innerWidth < 820,
      removingId: null, dragId: null, dragMode: null, dragPx: null,
      odyX: saved.odyX != null ? saved.odyX : null, odyY: saved.odyY != null ? saved.odyY : null,
      odyOpen: false, odyUnread: 2, odyMood: 'neseli', notifIndex: 0,
      libOpen: false, chat: [], capAnim: 0, clientAnim: 0, loading: true,
      mobileOrder: saved.mobileOrder || null, mDragId: null, mDragIndex: -1, mDragDy: 0,
      sidebarOpen: false, scope: 'Tümü', activeNav: 'panom', toast: null, liveSec: 33,
      dataReady: false, odyBrief: ''
    };
    this._drag = null; this._raf = null; this._mdrag = null; this._mrefs = {};
    this._wc = {};
    ['onWidgetPointerDown','onResizePointerDown','onPointerMove','onPointerUp','onMobileDown','onMobileMove','onMobileUp','onToggleTheme','onToggleEdit','onOpenLib','onCloseLib','onColor','onRemove','onRemovePointer','onAdd','onToggleSidebar','onCloseSidebar','onScope','onNav','onShortcuts','onBell','onYeniBrief','onProfile','onOdyPointerDown','onCloseOdy','onChatKey','onSend','gridRef','chatRef']
      .forEach(function (m) { this[m] = this[m].bind(this); }, this);
  }
  defaultLayout() { return window.bnsV2DefaultLayout(); }
  load() { try { return JSON.parse(localStorage.getItem('panom.v3')) || {}; } catch (e) { return {}; } }
  persist() {
    try { localStorage.setItem('panom.v3', JSON.stringify({ widgets: this.state.widgets, dark: this.state.dark, odyX: this.state.odyX, odyY: this.state.odyY, mobileOrder: this.state.mobileOrder })); } catch (e) {}
    try {
      fetch(API_V2 + '/api/layout', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + tokV2() }, body: JSON.stringify({ layout: window.bnsV2Serialize(this.state.widgets) }) }).catch(function () {});
    } catch (e) {}
  }

  componentDidMount() {
    var self = this;
    // canlı veri
    (async function () {
      try {
        var r = await fetch(API_V2 + '/api/embedded?t=' + Date.now(), { cache: 'no-store', headers: { Authorization: 'Bearer ' + tokV2() } });
        if (r.status === 401) { localStorage.removeItem('bns_token'); localStorage.removeItem('bns_user'); location.href = '../dashboard/'; return; }
        if (r.ok && window.bnsApplyEmbedded) window.bnsApplyEmbedded(await r.json());
      } catch (e) {}
      self.setState({ dataReady: true });
      self.startAnims();
      // sunucudan kişiye özel yerleşim (varsa localStorage'ın önüne geçer)
      try {
        var lr = await fetch(API_V2 + '/api/layout', { headers: { Authorization: 'Bearer ' + tokV2() } });
        if (lr.ok) { var lj = await lr.json(); if (lj && Array.isArray(lj.layout) && lj.layout.length) self.setState({ widgets: window.bnsV2Validate(lj.layout) }); }
      } catch (e) {}
    })();
    this._loadT = setTimeout(function () { self.setState({ loading: false }); }, 900);
    this._onResize = function () { self.setState({ isMobile: window.innerWidth < 820 }); };
    window.addEventListener('resize', this._onResize);
    this._liveTimer = setInterval(function () { self.setState(function (s) { return { liveSec: (s.liveSec % 59) + 1 }; }); }, 1000);
    var NOTIFS = window.BNS_NOTIFS;
    this._notifTimer = setInterval(function () {
      if (self.state.odyOpen) return;
      var i = (self.state.notifIndex + 1) % NOTIFS.length;
      self.setState({ notifIndex: i, odyMood: NOTIFS[i].mood, odyUnread: Math.min(9, self.state.odyUnread + 1) });
      self.fx(NOTIFS[i].mood);
      clearTimeout(self._restT); self._restT = setTimeout(function () { if (!self.state.odyOpen) self.setState({ odyMood: self.resting() }); }, 2700);
    }, 5200);
    this.odyBrief();
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('pointermove', this.onPointerMove); window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointermove', this.onMobileMove); window.removeEventListener('pointerup', this.onMobileUp);
    clearInterval(this._liveTimer); clearInterval(this._notifTimer); clearTimeout(this._toastT); clearTimeout(this._restT); clearTimeout(this._loadT); clearTimeout(this._moodT);
  }
  startAnims() {
    var self = this, st = window.bnsPanomStats(window.bnsV2Me());
    var capT = st.cap || 0, cliT = (window.bnsBriefs ? 0 : 0);
    var briefs = (window.BNS_DATA && window.BNS_DATA.briefs) || [];
    cliT = briefs.filter(function (b) { return b.durum === 'musteride'; }).length;
    this.setState({ odyMood: this.resting() });
    var start = performance.now(), dur = 1000;
    var tick = function (now) {
      var t = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - t, 3);
      self.setState({ capAnim: capT * e, clientAnim: cliT * e });
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  resting() { return window.bnsRestingMood(window.bnsPanomStats(window.bnsV2Me())); }
  odyBrief() {
    var self = this, tk = tokV2();
    fetch(API_V2 + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + tk }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Bugünkü kısa kişisel özetim: aktif iş, riskli/gecikmiş, müşteride, kapasite. 2-3 cümle, samimi, selamla.' }] }) })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.reply) self.setState({ odyBrief: j.reply }); }).catch(function () {});
  }

  // ── grid: collide + pack ──
  collide(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  pack(items, priorityId) {
    var self = this, placed = [];
    if (priorityId) { var d = items.find(function (w) { return w.id === priorityId; }); if (d) placed.push(Object.assign({}, d, { y: Math.max(0, d.y) })); }
    var rest = items.filter(function (w) { return w.id !== priorityId; }).sort(function (a, b) { return (a.y - b.y) || (a.x - b.x); });
    rest.forEach(function (it) { var w = Object.assign({}, it), y = 0; while (placed.some(function (p) { return self.collide(Object.assign({}, w, { y: y }), p); })) y++; w.y = y; placed.push(w); });
    return placed;
  }
  onWidgetPointerDown(e) {
    if (!this.state.editMode || this.state.isMobile) return;
    var id = e.currentTarget.getAttribute('data-id'), container = this._grid; if (!container) return;
    var rect = container.getBoundingClientRect(), w = this.state.widgets.find(function (x) { return x.id === id; }); if (!w) return;
    var colW = (rect.width - 11 * this.GAP) / 12, cardLeft = w.x * (colW + this.GAP), cardTop = w.y * (this.ROW + this.GAP);
    this._drag = { id: id, mode: 'move', colW: colW, rect: rect, offX: e.clientX - rect.left - cardLeft, offY: e.clientY - rect.top - cardTop };
    this.setState({ dragId: id, dragMode: 'move', dragPx: { left: cardLeft, top: cardTop } });
    window.addEventListener('pointermove', this.onPointerMove); window.addEventListener('pointerup', this.onPointerUp); e.preventDefault();
  }
  onResizePointerDown(e) {
    e.stopPropagation(); if (!this.state.editMode || this.state.isMobile) return;
    var id = e.currentTarget.getAttribute('data-id'), container = this._grid; if (!container) return;
    var rect = container.getBoundingClientRect(), colW = (rect.width - 11 * this.GAP) / 12;
    this._drag = { id: id, mode: 'resize', colW: colW, rect: rect };
    this.setState({ dragId: id, dragMode: 'resize' });
    window.addEventListener('pointermove', this.onPointerMove); window.addEventListener('pointerup', this.onPointerUp); e.preventDefault();
  }
  onPointerMove(e) {
    if (!this._drag || this._raf) return;
    var self = this, cx = e.clientX, cy = e.clientY;
    this._raf = requestAnimationFrame(function () {
      self._raf = null; var dr = self._drag; if (!dr) return;
      var colW = dr.colW, rect = dr.rect, GAP = self.GAP, ROW = self.ROW;
      var widgets = self.state.widgets.map(function (w) { return Object.assign({}, w); });
      var w = widgets.find(function (x) { return x.id === dr.id; }); if (!w) return;
      if (dr.mode === 'move') {
        var left = cx - rect.left - dr.offX, top = cy - rect.top - dr.offY;
        var nx = Math.round(left / (colW + GAP)), ny = Math.round(top / (ROW + GAP));
        nx = Math.max(0, Math.min(12 - w.w, nx)); ny = Math.max(0, ny); w.x = nx; w.y = ny;
        self.setState({ widgets: self.pack(widgets, dr.id), dragPx: { left: left, top: top } });
      } else {
        var cardLeft = w.x * (colW + GAP), cardTop = w.y * (ROW + GAP);
        var nw = Math.round((cx - rect.left - cardLeft + GAP) / (colW + GAP));
        var nh = Math.round((cy - rect.top - cardTop + GAP) / (ROW + GAP));
        nw = Math.max(3, Math.min(12 - w.x, nw)); nh = Math.max(2, Math.min(8, nh)); w.w = nw; w.h = nh;
        self.setState({ widgets: self.pack(widgets, dr.id) });
      }
    });
  }
  onPointerUp() {
    if (!this._drag) return; this._drag = null;
    window.removeEventListener('pointermove', this.onPointerMove); window.removeEventListener('pointerup', this.onPointerUp);
    var self = this; this.setState({ dragId: null, dragMode: null, dragPx: null }, function () { self.persist(); });
  }

  // ── mobil yeniden sıralama ──
  mobileIds() {
    var ids = this.state.widgets.map(function (w) { return w.id; });
    var order = (this.state.mobileOrder || []).filter(function (id) { return ids.indexOf(id) >= 0; });
    this.state.widgets.slice().sort(function (a, b) { return (a.y - b.y) || (a.x - b.x); }).forEach(function (w) { if (order.indexOf(w.id) < 0) order.push(w.id); });
    return order;
  }
  mRef(id) {
    if (!this._mrefCbs) this._mrefCbs = {};
    var self = this;
    if (!this._mrefCbs[id]) this._mrefCbs[id] = function (el) { if (el) self._mrefs[id] = el; else delete self._mrefs[id]; };
    return this._mrefCbs[id];
  }
  onMobileDown(e) {
    if (!this.state.editMode) return; e.preventDefault(); e.stopPropagation();
    var id = e.currentTarget.getAttribute('data-id');
    this._mdrag = { id: id, startY: e.clientY };
    this.setState({ mDragId: id, mDragIndex: this.mobileIds().indexOf(id), mDragDy: 0 });
    window.addEventListener('pointermove', this.onMobileMove); window.addEventListener('pointerup', this.onMobileUp);
  }
  onMobileMove(e) {
    var dr = this._mdrag; if (!dr) return; e.preventDefault();
    var cy = e.clientY, order = this.mobileIds(), cur = order.indexOf(dr.id), target = cur;
    for (var i = 0; i < order.length; i++) { var el = this._mrefs[order[i]]; if (!el) continue; var r = el.getBoundingClientRect(); if (cy >= r.top && cy <= r.bottom) { target = i; break; } }
    if (target !== cur && target >= 0) { order.splice(target, 0, order.splice(cur, 1)[0]); dr.startY = cy; this.setState({ mobileOrder: order, mDragDy: 0, mDragIndex: target }); }
    else { this.setState({ mDragDy: cy - dr.startY }); }
  }
  onMobileUp() {
    if (!this._mdrag) return; this._mdrag = null;
    window.removeEventListener('pointermove', this.onMobileMove); window.removeEventListener('pointerup', this.onMobileUp);
    var self = this; this.setState({ mDragId: null, mDragIndex: -1, mDragDy: 0 }, function () { self.persist(); });
  }

  toast(msg) { var self = this; clearTimeout(this._toastT); this.setState({ toast: msg }); this._toastT = setTimeout(function () { self.setState({ toast: null }); }, 2400); }
  onToggleTheme() { var self = this; this.setState(function (s) { return { dark: !s.dark }; }, function () { self.persist(); }); }
  onToggleEdit() { this.setState(function (s) { return { editMode: !s.editMode, libOpen: false }; }); }
  onOpenLib() { this.setState({ libOpen: true }); }
  onCloseLib() { this.setState({ libOpen: false }); }
  onColor(e) { var t = e.currentTarget.getAttribute('data-w'), c = e.currentTarget.getAttribute('data-c'); this._wc[t] = c; this.forceUpdate(); }
  onRemovePointer(e) { e.stopPropagation(); }
  onRemove(e) {
    e.stopPropagation(); var id = e.currentTarget.getAttribute('data-id'), self = this;
    this.setState({ removingId: id });
    setTimeout(function () { self.setState(function (s) { return { widgets: self.pack(s.widgets.filter(function (w) { return w.id !== id; })), removingId: null }; }, function () { self.persist(); }); }, 240);
  }
  onAdd(e) {
    var type = e.currentTarget.getAttribute('data-type'), def = BNS_DEFS[type], self = this;
    this.setState(function (s) {
      var maxY = s.widgets.reduce(function (m, w) { return Math.max(m, w.y + w.h); }, 0);
      return { widgets: self.pack(s.widgets.concat([{ id: type, type: type, x: 0, y: maxY, w: def.w, h: def.h }]), type), libOpen: false };
    }, function () { self.persist(); });
  }
  onToggleSidebar() { this.setState(function (s) { return { sidebarOpen: !s.sidebarOpen }; }); }
  onCloseSidebar() { this.setState({ sidebarOpen: false }); }
  onScope(e) { this.setState({ scope: e.currentTarget.getAttribute('data-scope') }); }
  onNav(e) {
    var k = e.currentTarget.getAttribute('data-key'), label = e.currentTarget.getAttribute('data-label');
    this.setState({ activeNav: k, sidebarOpen: false });
    if (k !== 'panom') this.toast(label + ' · bu görünüm yakında');
  }
  onShortcuts() { this.toast('Kısayollar · yakında'); }
  onBell() {
    var NOTIFS = window.BNS_NOTIFS, i = (this.state.notifIndex + 1) % NOTIFS.length, self = this;
    this.setState({ notifIndex: i, odyMood: NOTIFS[i].mood, odyUnread: 0 }, function () { self.toast(NOTIFS[i].text); });
    this.fx(NOTIFS[i].mood); clearTimeout(this._restT); this._restT = setTimeout(function () { if (!self.state.odyOpen) self.setState({ odyMood: self.resting() }); }, 2700);
  }
  onYeniBrief() { this.toast('Yeni brief · Slack üzerinden açılır'); }
  onProfile() { this.toast('Profil · yakında'); }

  odyPos() {
    var vw = typeof window !== 'undefined' ? window.innerWidth : 1280, vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    return { x: this.state.odyX != null ? this.state.odyX : (vw - 82), y: this.state.odyY != null ? this.state.odyY : (vh - 96) };
  }
  onOdyPointerDown(e) {
    var sx = e.clientX, sy = e.clientY, p = this.odyPos(), moved = false, self = this;
    var move = function (ev) { var dx = ev.clientX - sx, dy = ev.clientY - sy; if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true; self.setState({ odyX: Math.max(8, Math.min(window.innerWidth - 66, p.x + dx)), odyY: Math.max(8, Math.min(window.innerHeight - 66, p.y + dy)) }); };
    var up = function () { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); if (!moved) self.setState(function (s) { return { odyOpen: !s.odyOpen, odyUnread: 0 }; }); else self.persist(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); e.preventDefault();
  }
  onCloseOdy() { this.setState({ odyOpen: false }); }
  chatRef(el) { this._chat = el; }
  gridRef(el) { this._grid = el; }
  onChatKey(e) { if (e.key === 'Enter') this.onSend(); }
  onSend() {
    var el = this._chat; if (!el) return; var txt = (el.value || '').trim(); if (!txt) return; el.value = '';
    var self = this, tk = tokV2();
    this.setState(function (s) { return { chat: s.chat.concat([{ from: 'me', text: txt }]) }; });
    this.setMood('dusunuyor');
    var history = this.state.chat.map(function (m) { return { role: m.from === 'me' ? 'user' : 'assistant', content: m.text }; }).concat([{ role: 'user', content: txt }]);
    fetch(API_V2 + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + tk }, body: JSON.stringify({ messages: history }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { self.setState(function (s) { return { chat: s.chat.concat([{ from: 'ody', text: (j && j.reply) || 'Şu an cevap veremedim.' }]) }; }); self.setMood('mutlu', 'sakin', 1500); })
      .catch(function () { self.setState(function (s) { return { chat: s.chat.concat([{ from: 'ody', text: 'Bağlantı hatası.' }]) }; }); self.setMood('uzgun', 'sakin', 1500); });
  }
  setMood(m, revertTo, ms) { var self = this; clearTimeout(this._moodT); this.setState({ odyMood: m }); this.fx(m); if (revertTo) this._moodT = setTimeout(function () { self.setState({ odyMood: revertTo }); }, ms || 1200); }
  fx(mood) { if (window.bnsOdyFx) window.bnsOdyFx(this._odyBlob, mood); }

  // ── palet / renk ──
  rgba(h, a) { h = h.replace('#', ''); var n = parseInt(h.length === 3 ? h.split('').map(function (c) { return c + c; }).join('') : h, 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  mixHex(c1, c2, t) { var p = function (x) { x = (x || '#000').replace('#', ''); if (x.length === 3) x = x.split('').map(function (c) { return c + c; }).join(''); return [parseInt(x.slice(0, 2), 16) || 0, parseInt(x.slice(2, 4), 16) || 0, parseInt(x.slice(4, 6), 16) || 0]; }; var a = p(c1), b = p(c2); var m = a.map(function (v, i) { return Math.round(v * (1 - t) + b[i] * t); }); return '#' + m.map(function (v) { return v.toString(16).padStart(2, '0'); }).join(''); }
  palette(dark) {
    var self = this;
    var base = dark
      ? { bg: '#0E1322', card: '#172037', ink: '#EBEEF8', ink2: '#9BA4BD', line: '#283250', accent: '#E8703F', brand: '#88A0E0', chip: '#1B2540', accentSoft: 'rgba(232,112,63,.18)', sidebar: '#141B2E', topbar: 'rgba(14,19,34,.86)', briefBg: '#141C30', blob1: 'rgba(120,150,230,.12)', blob2: 'rgba(232,112,63,.08)', blob3: 'rgba(120,150,230,.08)', shadow: '0 1px 2px rgba(0,0,0,.4), 0 16px 34px -18px rgba(0,0,0,.6)', tableBg: '#221F16', head: '#2B2719', zebra: 'rgba(220,200,150,.06)' }
      : { bg: '#ECE4D3', card: '#FFFFFF', ink: '#1B1A16', ink2: '#6E6960', line: '#EAE6DE', accent: '#D9542B', brand: '#2848A0', chip: '#F2EFE9', accentSoft: 'rgba(217,84,43,.10)', sidebar: '#E7DDC6', topbar: 'rgba(236,228,211,.86)', briefBg: '#F7F5F1', blob1: 'rgba(40,72,160,.07)', blob2: 'rgba(217,84,43,.06)', blob3: 'rgba(40,72,160,.05)', shadow: '0 1px 2px rgba(40,30,15,.04), 0 14px 30px -18px rgba(60,45,25,.18)', tableBg: '#F4ECD9', head: '#E6DCC4', zebra: 'rgba(150,120,50,.07)' };
    var P = dark ? { risk: '#E8736F', orange: '#E59A4A', yellow: '#D9C153', green: '#5FBE8A', purple: '#A78BEE' } : { risk: '#CF4646', orange: '#D9842B', yellow: '#B8962E', green: '#2E8B57', purple: '#6E54CF' };
    var W = '#FFFFFF', BK = dark ? '#0A0F1E' : '#10204A';
    var bscale = [0.50, 0.33, 0.16, 0, -0.18, -0.36, -0.52, -0.68, -0.82].map(function (t) { return t >= 0 ? self.mixHex(base.brand, BK, t) : self.mixHex(base.brand, W, -t); });
    var bt = { risk: bscale[dark ? 2 : 1], capacity: bscale[3], working: bscale[4], client: bscale[6], today: bscale[7] };
    base.P = P; base.bscale = bscale; base.bt = bt; return base;
  }
  icon(name) {
    var h = React.createElement, k = 0;
    var svg = function () { var ch = Array.prototype.slice.call(arguments); return h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }, ch); };
    var p = function (d) { return h('path', { d: d, key: k++ }); }, c = function (cx, cy, r) { return h('circle', { cx: cx, cy: cy, r: r, key: k++ }); }, l = function (x1, y1, x2, y2) { return h('line', { x1: x1, y1: y1, x2: x2, y2: y2, key: k++ }); }, rc = function (x, y, w, ht, rx) { return h('rect', { x: x, y: y, width: w, height: ht, rx: rx, key: k++ }); };
    switch (name) {
      case 'sparkle': return svg(p('M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9z'));
      case 'home': return svg(p('M3 10.5 12 3l9 7.5'), p('M5 9.5V20h14V9.5'));
      case 'briefcase': return svg(rc(3, 7, 18, 13, 2), p('M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7'));
      case 'calendar': return svg(rc(3, 5, 18, 16, 2), l(3, 9, 21, 9), l(8, 3, 8, 6), l(16, 3, 16, 6));
      case 'kanban': return svg(l(6, 4, 6, 20), l(12, 4, 12, 14), l(18, 4, 18, 17));
      case 'clock': return svg(c(12, 12, 8.5), p('M12 8v4l2.5 1.5'));
      case 'check': return svg(rc(3.5, 3.5, 17, 17, 3), p('M8.5 12l2.5 2.5 4.5-5'));
      case 'chart': return svg(l(5, 20, 5, 11), l(12, 20, 12, 4), l(19, 20, 19, 8));
      case 'archive': return svg(rc(3, 4, 18, 5, 1), p('M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9'), l(10, 13, 14, 13));
      case 'pen': return svg(p('M12.5 6.5l5 5'), p('M4 20l1-4L16 5a2.1 2.1 0 0 1 3 3L8 19z'));
      case 'type': return svg(p('M5 7V5h14v2'), l(12, 5, 12, 19), l(9, 19, 15, 19));
      case 'zap': return svg(p('M13 2 4 14h6l-1 8 9-12h-6z'));
      case 'users': return svg(c(9, 8, 3.2), p('M3.5 20a5.5 5.5 0 0 1 11 0'), p('M16 5.2a3.2 3.2 0 0 1 0 6.1'), p('M17 20a5.5 5.5 0 0 0-2.5-4.6'));
      case 'image': return svg(rc(3, 4, 18, 16, 2), c(8.5, 9.5, 1.8), p('M5 18l5-5 3 3 3-3 3 3'));
      case 'list': return svg(l(8, 6, 20, 6), l(8, 12, 20, 12), l(8, 18, 20, 18), l(4, 6, 4.01, 6), l(4, 12, 4.01, 12), l(4, 18, 4.01, 18));
      case 'tag': return svg(p('M20 12.5 12.5 20 4 11.5V4h7.5z'), c(9, 9, 1.3));
      case 'grid': return svg(rc(4, 4, 7, 7, 1.5), rc(13, 4, 7, 7, 1.5), rc(4, 13, 7, 7, 1.5), rc(13, 13, 7, 7, 1.5));
      case 'user': return svg(c(12, 8, 3.6), p('M5 20a7 7 0 0 1 14 0'));
      case 'help': return svg(c(12, 12, 8.5), p('M9.6 9.6a2.4 2.4 0 0 1 4.2 1.5c0 1.6-2.4 2-2.4 3.4'), l(12, 17.4, 12.01, 17.4));
      case 'book': return svg(p('M5 4.6A1.6 1.6 0 0 1 6.6 3H19v15H6.6A1.6 1.6 0 0 0 5 19.6z'), p('M5 19.6A1.6 1.6 0 0 1 6.6 18H19v3H6.6A1.6 1.6 0 0 1 5 19.6z'));
      case 'command': return svg(p('M9 6.5A2.5 2.5 0 1 0 11.5 9v6A2.5 2.5 0 1 0 14 12.5h-4A2.5 2.5 0 1 0 12.5 15V9A2.5 2.5 0 1 0 10 6.5z'));
      case 'search': return svg(c(11, 11, 6.5), l(20, 20, 15.8, 15.8));
      case 'bell': return svg(p('M6 9a6 6 0 0 1 12 0c0 5 2.3 6.5 2.3 6.5H3.7S6 14 6 9z'), p('M10 19a2 2 0 0 0 4 0'));
      case 'plus': return svg(l(12, 5, 12, 19), l(5, 12, 19, 12));
      case 'menu': return svg(l(4, 7, 20, 7), l(4, 12, 20, 12), l(4, 17, 20, 17));
      case 'moon': return svg(p('M20 13A8 8 0 1 1 11 4a6.3 6.3 0 0 0 9 9z'));
      case 'sun': return svg(c(12, 12, 4), l(12, 2.5, 12, 5), l(12, 19, 12, 21.5), l(2.5, 12, 5, 12), l(19, 12, 21.5, 12), l(5.5, 5.5, 7, 7), l(17, 17, 18.5, 18.5), l(18.5, 5.5, 17, 7), l(7, 17, 5.5, 18.5));
      default: return svg(c(12, 12, 8));
    }
  }

  render() { return window.bnsPanomRender(this); }
}
window.PanomApp = Panom;
