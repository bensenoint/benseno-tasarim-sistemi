// app/Chrome.jsx — Sidebar navigation + slim header (v2).
// Replaces horizontal tab bar with a left sidebar for better scalability.

// ─── Mobile detection hook ────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = React.useState(() => window.innerWidth < 768);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setMobile(e.matches);
    mq.addEventListener ? mq.addEventListener("change", handler) : mq.addListener(handler);
    return () => mq.removeEventListener ? mq.removeEventListener("change", handler) : mq.removeListener(handler);
  }, []);
  return mobile;
}

const NAV_SECTIONS = [
  {
    id: "main",
    label: "Ana",
    items: [
      { id: "overview",  label: "Genel bakış",   icon: "Home" },
      { id: "jobs",      label: "Aktif işler",    icon: "Briefcase" },
    ]
  },
  {
    id: "planlama",
    label: "Planlama",
    items: [
      { id: "gantt",   label: "Plan / Gantt",  icon: "Calendar" },
      { id: "kanban",  label: "Kanban",         icon: "Columns" },
      { id: "musteride", label: "Müşteri Onayı", icon: "Clock" },
    ]
  },
  {
    id: "raporlar",
    label: "Raporlar",
    items: [
      { id: "completed", label: "Tamamlananlar",  icon: "CheckSquare" },
      { id: "dept-comp", label: "Karşılaştırma",  icon: "BarChart2" },
      { id: "history",   label: "Geçmiş",          icon: "Archive" },
    ]
  },
  {
    id: "departmanlar",
    label: "Departmanlar",
    items: [
      { id: "design",  label: "Tasarım",  icon: "Pen" },
      { id: "editor",  label: "Editör",   icon: "Edit3" },
      { id: "ai",      label: "AI",        icon: "Zap" },
      { id: "freelance", label: "Freelance", icon: "Users" },
    ]
  },
  {
    id: "diger",
    label: "Diğer",
    items: [
      { id: "gallery", label: "Galeri",       icon: "Image" },
      { id: "multi",   label: "Sıralı İşler", icon: "Users" },
      { id: "brand",   label: "Marka",         icon: "Tag" },
      { id: "team",    label: "Ekip matrisi",  icon: "Grid" },
      { id: "profile", label: "Profil",        icon: "User" },
      { id: "help",    label: "Yardım",        icon: "HelpCircle" },
    ]
  },
  {
    id: "yonetim",
    label: "Yönetim",
    adminOnly: true,
    items: [
      { id: "users",     label: "Kullanıcılar", icon: "Shield" },
      { id: "silinenler", label: "Silinenler",   icon: "Trash2" },
    ]
  }
];

// Sidebar icons via Lucide — use inline SVG paths via I.*
const NAV_ICONS = {
  Home:        () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Target:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  Briefcase:   () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  Calendar:    () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Columns:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="18" rx="1"/><rect x="13" y="3" width="8" height="18" rx="1"/></svg>,
  Clock:       () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  CheckSquare: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  BarChart2:   () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Archive:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
  Pen:         () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="2" x2="22" y2="6"/><path d="M7.5 20.5 19 9l-4-4L3.5 16.5 2 22z"/></svg>,
  Edit3:       () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Zap:         () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Image:       () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  Users:       () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Tag:         () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  Grid:        () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  User:        () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  HelpCircle:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Shield:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Trash2:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
};

// Metin içindeki http(s) linklerini tıklanabilir yapar — özet/insight/not/sohbet gibi
// tüm serbest-metin alanlarında kullanılır. (Fonksiyon bildirimi: bundle genelinde erişilebilir.)
function Linkify({ text }) {
  if (text == null) return null;
  const parts = String(text).split(/(https?:\/\/[^\s<>"')\]]+)/g);
  return parts.map((p, i) => /^https?:\/\//.test(p)
    ? <a key={i} href={p} target="_blank" rel="noreferrer"
        onClick={e => e.stopPropagation()}
        style={{ color: "var(--ember)", textDecoration: "underline", wordBreak: "break-all" }}>{p}</a>
    : p);
}
try { window.BnsLinkify = Linkify; } catch (e) {}

// Slack linkleri: tarayıcı sekmesi yalnızca desktop uygulamasına köprü görevi görür —
// yönlendirme tetiklendikten sonra sekme otomatik kapanır ki arkada boş Slack sayfası kalmasın.
// Tüm <a href="...slack.com/archives..."> linklerini tek delegasyonla yakalar (her ekranda geçerli).
if (typeof document !== "undefined" && !window.__bnsSlackLinkHook) {
  window.__bnsSlackLinkHook = true;
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href*="slack.com/archives"]');
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    // Thread görünümünde açılsın: /archives/{cid}/p{ts} → ?thread_ts={ts}&cid={cid}
    // (Slack desktop bu parametrelerle mesajı kanal yerine thread paneli olarak açar.)
    let href = a.href;
    const m = href.match(/\/archives\/([A-Z0-9]+)\/p(\d{10})(\d{6})/);
    if (m && !href.includes("thread_ts=")) href += `${href.includes("?") ? "&" : "?"}thread_ts=${m[2]}.${m[3]}&cid=${m[1]}`;
    const w = window.open(href, "_blank");   // handle lazım → noopener KULLANMA (kapatabilmek için)
    if (w) setTimeout(() => { try { w.close(); } catch (err) {} }, 3500);
  }, true);
}

// 🤖 Ody (sistem asistanı) — sağ altta yüzen sohbet. Kullanım soruları + canlı veri
// (marka/iş/kişi) soruları /api/chat üzerinden yanıtlanır (JWT'li, kişiye özel).
// ── Ody maskotu: animasyonlu yüz ifadeleri + fx partikülleri (prod renkleriyle) ──
// Gelen bildirim metninden ruh hâli çıkar (API'de tip alanı yok → anahtar kelime).
function odyMoodFromText(t) {
  var s = (t || '').toLowerCase();
  if (/(gecik|24 saat|süre|acil|risk|uyar|kaldı|bekliyor çok)/.test(s)) return 'endiseli';
  if (/(blok|iptal|reddedil|sorun|hata|olumsuz)/.test(s)) return 'uzgun';
  if (/(tamamlan|bitti|onaylandı|teslim|tebrik|👏)/.test(s)) return 'mutlu';
  if (/(revizyon|düzelt|tekrar|geri gönder)/.test(s)) return 'mesgul';
  if (/(yeni brief|atandı|atanmış|eklendi|başladı|yeni iş)/.test(s)) return 'heyecanli';
  if (/(onay|müşteride)/.test(s)) return 'neseli';
  return 'heyecanli';
}
function odyRestingMood() {
  try {
    var b = (window.BNS_DATA && window.BNS_DATA.briefs) || [];
    var overdue = b.filter(function (x) { return x.durum !== 'tamamlandi' && x.deltaH != null && x.deltaH < 0; }).length;
    var risk = b.filter(function (x) { return window.bnsIsRisk && window.bnsIsRisk(x.durum, x.deltaH); }).length;
    if (overdue > 0) return 'kizgin';
    if (risk > 0) return 'endiseli';
    return 'neseli';
  } catch (e) { return 'neseli'; }
}
function odyFaceProd(mood) {
  var h = React.createElement, W = '#fff', PUP = '#16265c';
  var mk = function (k, st) { return h('div', { key: k, style: Object.assign({ background: W, borderRadius: '50%' }, st) }); };
  var left, right, anim = 'odyPop .42s ease', extra = null, gap = 8;
  if (mood === 'mutlu' || mood === 'neseli') {
    var arc = function (k) { return h('div', { key: k, style: { width: '12px', height: '6px', borderTop: '3px solid ' + W, borderRadius: '12px 12px 0 0' } }); };
    left = arc('l'); right = arc('r'); if (mood === 'neseli') anim = 'odyBounce .8s ease-in-out infinite';
  } else if (mood === 'coskulu') {
    var star = function (k) { return h('div', { key: k, style: { width: '13px', height: '13px', background: W, clipPath: 'polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%)' } }); };
    left = star('l'); right = star('r'); anim = 'odyBounce .62s ease-in-out infinite';
  } else if (mood === 'heyecanli') {
    var ex = function (k) { return h('div', { key: k, style: { position: 'relative', width: '12px', height: '12px', background: W, borderRadius: '50%' } }, h('div', { key: 'p', style: { position: 'absolute', width: '4px', height: '4px', background: PUP, borderRadius: '50%', left: '4px', top: '5px' } })); };
    left = ex('l'); right = ex('r'); anim = 'odyBounce .72s ease-in-out infinite';
  } else if (mood === 'endiseli') {
    var we = function (k, rot) { return h('div', { key: k, style: { position: 'relative', width: '7px', height: '10px', background: W, borderRadius: '50%', transform: 'rotate(' + rot + 'deg)' } }, h('div', { key: 'p', style: { position: 'absolute', width: '3px', height: '3px', background: PUP, borderRadius: '50%', left: '2px', top: '1.5px' } })); };
    left = we('l', 15); right = we('r', -15); gap = 9;
  } else if (mood === 'kizgin') {
    left = mk('l', { width: '7px', height: '8px' }); right = mk('r', { width: '7px', height: '8px' }); anim = 'odyShake .24s linear infinite';
    extra = h('div', { key: 'x', style: { position: 'absolute', inset: 0, pointerEvents: 'none' } }, h('div', { key: 'bl', style: { position: 'absolute', top: '13px', left: '13px', width: '11px', height: '3px', background: W, borderRadius: '2px', transform: 'rotate(20deg)' } }), h('div', { key: 'br', style: { position: 'absolute', top: '13px', left: '26px', width: '11px', height: '3px', background: W, borderRadius: '2px', transform: 'rotate(-20deg)' } }));
  } else if (mood === 'mesgul') {
    left = mk('l', { width: '6px', height: '8px' }); right = mk('r', { width: '6px', height: '8px' });
  } else if (mood === 'dusunuyor') {
    left = mk('l', { width: '6px', height: '6px', transform: 'translateY(-2px)' }); right = mk('r', { width: '6px', height: '6px', transform: 'translateY(-2px)' });
  } else if (mood === 'uykulu') {
    var lid = function (k) { return h('div', { key: k, style: { width: '10px', height: '4px', background: W, borderRadius: '0 0 10px 10px' } }); };
    left = lid('l'); right = lid('r');
  } else if (mood === 'uzgun') {
    left = mk('l', { width: '7px', height: '8px', transform: 'translateY(2px)' }); right = mk('r', { width: '7px', height: '8px', transform: 'translateY(2px)' });
  } else {
    left = mk('l', { width: '7px', height: '11px', animation: 'odyBlink 4.6s infinite' }); right = mk('r', { width: '7px', height: '11px', animation: 'odyBlink 4.6s infinite' });
  }
  return h('div', { key: 'f-' + mood, style: { position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: gap + 'px', animation: anim || undefined } }, left, right, extra);
}
function odyFxProd(host, mood) {
  if (!host) return;
  var spawn = function (txt, color, x, size) {
    var el = document.createElement('div');
    if (txt) { el.textContent = txt; el.setAttribute('style', 'position:absolute;left:50%;top:0;transform:translateX(-50%);pointer-events:none;z-index:60;font-family:var(--font-sans),sans-serif;font-weight:800;font-size:' + size + 'px;color:' + color + ';'); }
    else { el.setAttribute('style', 'position:absolute;left:50%;top:2px;transform:translateX(-50%);pointer-events:none;z-index:60;width:' + size + 'px;height:' + (size + 2) + 'px;border-radius:50%;background:' + color + ';'); }
    host.appendChild(el);
    var ty = -(24 + Math.random() * 14);
    try { el.animate([{ transform: 'translateX(-50%) translate(0,0) scale(.5)', opacity: 1 }, { transform: 'translateX(-50%) translate(' + x + 'px,' + ty + 'px) scale(1.2)', opacity: 0 }], { duration: 850, easing: 'cubic-bezier(.25,.46,.45,.94)' }).onfinish = function () { el.remove(); }; }
    catch (e) { setTimeout(function () { el.remove(); }, 850); }
  };
  if (mood === 'mutlu' || mood === 'neseli' || mood === 'coskulu' || mood === 'heyecanli') spawn('✦', '#E0A92B', -10, 14);
  else if (mood === 'kizgin' || mood === 'mesgul') { spawn('', '#b9b2a6', -10, 8); setTimeout(function () { spawn('', '#b9b2a6', 10, 9); }, 220); }
  else if (mood === 'uykulu') { for (var i = 0; i < 3; i++) (function (i) { setTimeout(function () { spawn('z', '#9a93a0', -6 + i * 6, 12); }, i * 420); })(i); }
}

function ChatBot() {
  const [open, setOpen] = React.useState(false);
  const [mood, setMood] = React.useState('neseli');
  const blobRef = React.useRef(null);
  const [msgs, setMsgs] = React.useState([]);   // {role:'user'|'assistant', content}
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const endRef = React.useRef(null);
  // Sürüklenebilir konum — balon/panel başlığından tutup taşınır; localStorage'da kalıcıdır.
  const [pos, setPos] = React.useState(() => {
    try { const p = JSON.parse(localStorage.getItem("bns_ody_pos") || "null"); if (p && typeof p.x === "number" && typeof p.y === "number") return p; } catch (e) {}
    return { x: 20, y: (typeof window !== "undefined" ? window.innerHeight : 800) - 76 };
  });
  const dragRef = React.useRef(null);
  const startDrag = (e, force) => {
    // Panel başlığındaki butonlar (temizle/kapat) sürükleme başlatmasın; balonun kendisi
    // buton olduğu için force=true ile bu korumayı atlar — kapalı ikon da sürüklenebilir.
    if (!force && e.target.closest && e.target.closest("button, input")) return;
    const start = { mx: e.clientX, my: e.clientY, x: pos.x, y: pos.y, moved: false };
    dragRef.current = start;
    const move = (ev) => {
      const dx = ev.clientX - start.mx, dy = ev.clientY - start.my;
      if (Math.abs(dx) + Math.abs(dy) > 4) start.moved = true;
      setPos({ x: Math.min(Math.max(4, start.x + dx), window.innerWidth - 60),
               y: Math.min(Math.max(4, start.y + dy), window.innerHeight - 60) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setPos(p => { try { localStorage.setItem("bns_ody_pos", JSON.stringify(p)); } catch (e2) {} return p; });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  // Panel pos'tan açılır ama ekrana sığacak şekilde kıstırılır (alt/sağ taşma olmaz)
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const panelLeft = Math.min(Math.max(8, pos.x), Math.max(8, vw - 392));
  const panelTop  = Math.min(Math.max(8, pos.y - 468), Math.max(8, vh - 532));
  const API = window.BNS_API_BASE || "https://benseno-api-production.up.railway.app";
  const tok = () => (typeof localStorage !== "undefined" && localStorage.getItem("bns_token")) || "";
  const [unread, setUnread] = React.useState(false);   // balonda "Ody senin için özet hazırladı" işareti
  const [notifPeek, setNotifPeek] = React.useState(null); // kapalıyken gösterilen son bildirim (Ody'ye bağlı)
  const [notifCount, setNotifCount] = React.useState(0);  // okunmamış bildirim sayısı (blob rozeti)
  const [notifItems, setNotifItems] = React.useState([]); // tüm bildirimler (panelde liste — çan Ody'ye taşındı)
  React.useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  // Ody ruh hâli: değişince fx partikülü; kapalıyken periyodik bildirim ifadesi + okunmadı işareti
  React.useEffect(() => { odyFxProd(blobRef.current, mood); }, [mood]);
  React.useEffect(() => { setMood(odyRestingMood()); }, []);

  // Ekran boyutu değişince Ody'yi görünür alanda tut (mount'ta kayıtlı dış-konum da düzelir).
  React.useEffect(() => {
    const clamp = () => setPos(p => {
      const maxX = Math.max(4, window.innerWidth - 60);
      const maxY = Math.max(4, window.innerHeight - 60);
      const nx = Math.min(Math.max(4, p.x), maxX);
      const ny = Math.min(Math.max(4, p.y), maxY);
      if (nx === p.x && ny === p.y) return p;
      try { localStorage.setItem("bns_ody_pos", JSON.stringify({ x: nx, y: ny })); } catch (e) {}
      return { x: nx, y: ny };
    });
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, []);

  // Bildirimler artık Ody'ye bağlı: /api/notifications'ı yoklar; yeni (okunmamış, daha önce
  // görülmemiş) bildirim gelince Ody onun metninden çıkardığı ruh hâlini yansıtır ve kapalıyken
  // balonunda bildirimi gösterir — Ody/balon açılana (veya çandan okununca) kadar.
  // Bildirim durumu TAMAMEN sunucu read_at'ine bağlı (yerel id-gate yok). Okunmamış varsa
  // Ody en son okunmamışın duygusunu yansıtır + kapalıyken balonda gösterir; hepsi okununca normale döner.
  React.useEffect(() => {
    if (!tok()) return;
    let cancelled = false;
    const poll = () => {
      fetch(`${API}/api/notifications`, { headers: { Authorization: "Bearer " + tok() } })
        .then(r => r.ok ? r.json() : null)
        .then(j => {
          if (cancelled || !j) return;
          const items = j.notifications || [];
          setNotifItems(items);
          const unread = items.filter(n => !n.read_at);
          setNotifCount(unread.length);
          if (!unread.length) { setNotifPeek(null); if (!open) setMood(odyRestingMood()); return; }
          const latest = unread.reduce((a, b) => (b.id > a.id ? b : a));
          setNotifPeek(latest);
          if (!open) setMood(odyMoodFromText(latest.text));
        }).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [open]);

  // Tüm bildirimleri okundu işaretle (panel kapanınca): sunucu + optimistik → Ody normale döner.
  const markNotifRead = () => {
    setNotifPeek(null);
    setNotifCount(0);
    setNotifItems(items => items.map(n => n.read_at ? n : Object.assign({}, n, { read_at: new Date().toISOString() })));
    setMood(odyRestingMood());
    if (tok()) fetch(`${API}/api/notifications/read`, { method: "POST", headers: { Authorization: "Bearer " + tok() } }).catch(() => {});
  };
  const fmtNotifT = (iso) => { try { return new Date(iso).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };

  // Proaktif kişisel brief — kişi dashboard'ı açınca Ody onun durumunu BİR KEZ (günde) hazırlar.
  // Kişiye özeldir: /api/chat zaten giriş yapan kullanıcıya göre filtreler. Kullanıcı+tarih
  // anahtarlı localStorage cache → aynı gün tekrar yüklemede AI çağrısı yapılmaz (maliyet ~0).
  React.useEffect(() => {
    if (!tok()) return;
    const u = (typeof bnsGetStoredUser === "function" && bnsGetStoredUser()) || null;
    const uid = u && (u.id || u.slack_id);
    if (!uid) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `bns_ody_brief_${uid}_${today}`;
    let cached = null; try { cached = localStorage.getItem(key); } catch (e) {}
    if (cached) { setMsgs([{ role: "assistant", content: cached }]); setUnread(true); return; }
    const PROMPT = "Bugünkü kısa kişisel özetimi ver: kaç aktif işim var, hangileri riskli/gecikmiş " +
      "(varsa # numarasıyla), müşteride bekleyen işlerim, kapasite durumum. Selamla başla, en fazla " +
      "4 kısa madde. Acil bir şey yoksa kısaca olumlu söyle.";
    (async () => {
      try {
        const r = await fetch(`${API}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: "Bearer " + tok() },
          body: JSON.stringify({ messages: [{ role: "user", content: PROMPT }] }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.reply) {
          try { localStorage.setItem(key, j.reply); } catch (e) {}
          setMsgs([{ role: "assistant", content: j.reply }]);
          setUnread(true);
        }
      } catch (e) { /* sessiz — proaktif brief best-effort */ }
    })();
  }, []);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user", content: q }];
    setMsgs(next); setInput(""); setBusy(true); setMood("dusunuyor");
    try {
      const r = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: "Bearer " + tok() },
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const j = await r.json().catch(() => ({}));
      const okReply = r.ok && j.reply;
      setMsgs(m => [...m, { role: "assistant", content: okReply ? j.reply : ("⚠️ " + (j.error || "Yanıt alınamadı, tekrar dene.")) }]);
      setMood(okReply ? "mutlu" : "uzgun");
    } catch (e) {
      setMsgs(m => [...m, { role: "assistant", content: "⚠️ Bağlantı hatası: " + e.message }]);
      setMood("uzgun");
    } finally { setBusy(false); }
  };

  return (
    <>
      {/* Kapalıyken son bildirim balonu (soru ekranı dışında) — Ody'ye bağlı */}
      {!open && notifPeek && (
        <button onClick={() => { setNotifPeek(null); setUnread(false); setOpen(true); }}
          title="Bildirimi aç"
          style={{
            position: "fixed",
            left: Math.min(Math.max(8, pos.x), Math.max(8, vw - 256)),
            top: Math.max(8, pos.y - 72),
            zIndex: 89, width: 248, maxWidth: "calc(100vw - 24px)", textAlign: "left",
            border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)",
            boxShadow: "var(--shadow-2)", padding: "9px 12px", cursor: "pointer",
            animation: "odyPopIn .3s ease",
          }}>
          <div style={{ font: "700 9px/1 var(--font-sans)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ody)", marginBottom: 5 }}>Ody · yeni bildirim</div>
          <div style={{ font: "400 12px/1.45 var(--font-sans)", color: "var(--ink-2)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{notifPeek.text}</div>
        </button>
      )}
      {/* Açma balonu */}
      {!open && (
        <button onPointerDown={(e) => startDrag(e, true)}
          onClick={() => { if (dragRef.current && dragRef.current.moved) { dragRef.current = null; return; } setNotifPeek(null); setUnread(false); setOpen(true); }}
          title={notifPeek ? "Ody'de yeni bildirim var — aç" : (unread ? "Ody senin için bugünkü özetini hazırladı — aç" : "Ody — sistem asistanı (sürükleyerek taşıyabilirsin)")} style={{
          position: "fixed", left: pos.x, top: pos.y, zIndex: 90,
          width: 54, height: 54, borderRadius: "50%", border: 0, cursor: "grab", touchAction: "none",
          background: "transparent", padding: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div aria-hidden="true" style={{
            position: "absolute", left: "50%", bottom: -3, transform: "translateX(-50%)",
            width: 32, height: 8, borderRadius: "50%",
            background: "rgba(20,38,92,.22)", filter: "blur(3px)", zIndex: 0, pointerEvents: "none",
          }}/>
          <div ref={blobRef} style={{
            position: "relative", zIndex: 1, width: 54, height: 54,
            borderRadius: "64% 36% 60% 40% / 56% 44% 60% 40%",
            background: "radial-gradient(circle at 32% 26%, color-mix(in srgb, var(--ody) 55%, #fff) 0%, var(--ody) 52%, color-mix(in srgb, var(--ody) 72%, #000) 100%)",
            boxShadow: "0 16px 28px -8px rgba(20,38,92,.45), 0 6px 12px -4px rgba(0,0,0,.22), inset 0 2px 5px rgba(255,255,255,.40), inset 0 -7px 11px -5px rgba(0,0,0,.30)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "odyBob 4.5s ease-in-out infinite",
          }}>{odyFaceProd(mood)}</div>
          {notifCount > 0 && <span title={notifCount + " okunmamış bildirim"} style={{
            position: "absolute", top: -3, right: -3, minWidth: 20, height: 20, padding: "0 5px",
            borderRadius: 999, background: "var(--prio-red, #E5484D)", color: "#fff",
            font: "700 11px/20px var(--font-sans)", textAlign: "center",
            border: "2px solid var(--surface, #fff)", boxShadow: "0 2px 5px -1px rgba(0,0,0,.3)",
            animation: "odyPopIn .3s ease",
          }}>{notifCount > 99 ? "99+" : notifCount}</span>}
        </button>
      )}
      {open && (
        <div style={{
          position: "fixed", left: panelLeft, top: panelTop, zIndex: 90,
          width: 380, maxWidth: "calc(100vw - 32px)", height: 520, maxHeight: "calc(100vh - 80px)",
          background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14,
          boxShadow: "var(--shadow-2)", display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div onPointerDown={startDrag} title="Sürükleyerek taşı"
            style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8, cursor: "grab", touchAction: "none", userSelect: "none" }}>
            <span style={{ position: "relative", width: 30, height: 30, flex: "none", borderRadius: "64% 36% 60% 40% / 56% 44% 60% 40%", background: "radial-gradient(circle at 32% 26%, color-mix(in srgb, var(--ody) 55%, #fff) 0%, var(--ody) 52%, color-mix(in srgb, var(--ody) 72%, #000) 100%)", boxShadow: "inset 0 1px 3px rgba(255,255,255,.4), inset 0 -3px 6px -2px rgba(0,0,0,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ position: "absolute", inset: 0, transform: "scale(0.55)" }}>{odyFaceProd(mood)}</span>
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ font: "600 13px/1 var(--font-sans)", color: "var(--ink)" }}>Ody</div>
              <div style={{ font: "400 10px/1.3 var(--font-sans)", color: "var(--ink-4)", marginTop: 2 }}>kullanım · marka/iş/kişi soruları · öneri</div>
            </div>
            {msgs.length > 0 && <button onClick={() => setMsgs([])} title="Sohbeti temizle" style={{ border: 0, background: "transparent", color: "var(--ink-4)", cursor: "pointer", font: "400 11px var(--font-sans)" }}>temizle</button>}
            <button onClick={() => { setOpen(false); markNotifRead(); }} style={{ border: 0, background: "transparent", color: "var(--ink-3)", cursor: "pointer", padding: 4, display: "inline-flex" }}><I.X size={15}/></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {notifItems.length > 0 && (
              <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--paper-2)" }}>
                <div style={{ padding: "7px 10px", font: "600 10px/1 var(--font-sans)", letterSpacing: ".07em", textTransform: "uppercase", color: "var(--ink-4)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 6 }}>
                  <I.Bell size={11}/> Bildirimler
                </div>
                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  {notifItems.slice(0, 30).map(n => {
                    var unread = !n.read_at;
                    return (
                    <a key={n.id} href={n.link || "#"} target={n.link ? "_blank" : undefined} rel="noreferrer" style={{
                      display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", textDecoration: "none",
                      borderLeft: unread ? "3px solid var(--ody)" : "3px solid transparent",
                      background: unread ? "var(--ody-tint)" : "transparent",
                    }}>
                      <span aria-hidden="true" style={{ marginTop: 5, flex: "none", width: 7, height: 7, borderRadius: "50%", background: unread ? "var(--ody)" : "transparent" }}/>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", font: (unread ? "600" : "400") + " 12px/1.4 var(--font-sans)", color: unread ? "var(--ink)" : "var(--ink-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.text}</span>
                        <span style={{ display: "block", font: "400 10px/1 var(--font-sans)", color: unread ? "var(--ink-3)" : "var(--ink-5)", marginTop: 3 }}>{fmtNotifT(n.created_at)}</span>
                      </span>
                    </a>
                  );})}
                </div>
              </div>
            )}
            {msgs.length === 0 && (
              <div style={{ font: "400 12px/1.6 var(--font-sans)", color: "var(--ink-4)" }}>
                Merhaba, ben Ody! Bana sorabileceklerin:
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {["Brief'in durumunu Slack'ten nasıl güncellerim?", "Bauhaus markasında şu an neler var?", "Geciken iş var mı, ne önerirsin?"].map(s => (
                    <button key={s} onClick={() => setInput(s)} style={{
                      textAlign: "left", padding: "7px 10px", border: "1px solid var(--line)", borderRadius: 8,
                      background: "var(--paper-2)", color: "var(--ink-2)", cursor: "pointer", font: "400 12px/1.4 var(--font-sans)",
                    }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "stretch", maxWidth: m.role === "user" ? "85%" : "100%", width: m.role === "user" ? undefined : "100%",
                padding: "8px 11px", borderRadius: 10, boxSizing: "border-box",
                background: m.role === "user" ? "var(--ody)" : "var(--paper-2)",
                color: m.role === "user" ? "#fff" : "var(--ink)",
                font: "400 13px/1.55 var(--font-sans)", whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>{m.role === "assistant" ? <Linkify text={m.content}/> : m.content}</div>
            ))}
            {busy && <div style={{ alignSelf: "flex-start", padding: "8px 11px", borderRadius: 10, background: "var(--paper-2)", color: "var(--ink-4)", font: "400 13px/1 var(--font-sans)" }}>yazıyor…</div>}
            <div ref={endRef}/>
          </div>
          <div style={{ padding: 10, borderTop: "1px solid var(--line)", display: "flex", gap: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") send(); }}
              placeholder="Soru yaz…" disabled={busy}
              style={{ flex: 1, padding: "9px 11px", border: "1px solid var(--line)", borderRadius: 8,
                background: "var(--surface-sub)", color: "var(--ink)", font: "400 13px/1.3 var(--font-sans)", outline: "none" }}/>
            <button onClick={send} disabled={busy || !input.trim()} style={{
              padding: "0 14px", border: 0, borderRadius: 8, background: "var(--ody)", color: "#fff",
              font: "600 13px/1 var(--font-sans)", cursor: busy ? "default" : "pointer", opacity: busy || !input.trim() ? 0.5 : 1,
            }}>Gönder</button>
          </div>
        </div>
      )}
    </>
  );
}
try { window.BnsChatBot = ChatBot; } catch (e) {}


function Header({ user, viewMode, setViewMode, theme, setTheme, onOpenPalette, onNewBrief, defaultUsers, currentUser, onLogout }) {
  const isMobile = useIsMobile();
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const syncSecs = 22 + (tick % 60);
  const [userMenu, setUserMenu] = React.useState(false);

  return (
    <header style={{
      height: isMobile ? 52 : 56,
      display: "flex", alignItems: "center", gap: isMobile ? 8 : 12,
      padding: isMobile ? "0 12px" : "0 20px 0 20px",
      background: "var(--header-blur)",
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      borderBottom: "1px solid var(--line)",
      flexShrink: 0,
      position: "sticky", top: 0, zIndex: 30,
      boxShadow: "0 1px 0 var(--line-soft)",
    }}>
      {/* Logo — mobil VE desktop header'da */}
      <a href="./index.html" title="Ana sayfa" style={{display:"flex", alignItems:"center", flexShrink:0, textDecoration:"none"}}>
        <img src="app/logo.png" alt="Benseno" style={{
          height: isMobile ? 34 : 44, width: "auto", objectFit: "contain",
          mixBlendMode: "multiply", flexShrink: 0,
        }}/>
      </a>

      {/* Mobile: search icon (desktop'ta sidebar'da) */}
      {isMobile && (
        <button onClick={onOpenPalette} style={{
          width: 36, height: 36, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid var(--line)", borderRadius: 8,
          background: "var(--paper-2)", color: "var(--ink-4)", cursor: "pointer",
        }}>
          <I.Search size={15}/>
        </button>
      )}

      <div style={{marginLeft: "auto", display: "flex", alignItems: "center", gap: isMobile ? 6 : 8}}>
        {/* Sync pill */}
        <span title="Slack Canvas senkron" style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: isMobile ? "4px 7px 4px 6px" : "4px 9px 4px 7px", borderRadius: 999,
          background: "var(--ember-tint)", color: "var(--ember)",
          font: `500 ${isMobile ? 10 : 11}px/1 var(--font-sans)`, flexShrink: 0,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: 999, background: "var(--ember)",
            animation: "bn-pulse 2.4s ease-in-out infinite", flexShrink: 0,
          }}/>
          {isMobile ? "Canlı" : `Canlı · ${syncSecs}sn`}
        </span>

        {/* View mode — hidden on mobile (bottom nav handles navigation) */}
        {!isMobile && (
          <div style={{display: "inline-flex", padding: 2, background: "var(--paper-2)", borderRadius: 7, gap: 1}}>
            {[["mine", "Ben"], ["dept", "Dept"], ["all", "Tümü"]].map(([k, v]) => (
              <button key={k} onClick={() => setViewMode(k)} style={{
                font: "500 11px/1 var(--font-sans)", padding: "5px 9px",
                border: 0, background: viewMode === k ? "var(--surface)" : "transparent",
                color: viewMode === k ? "var(--ink)" : "var(--ink-3)",
                borderRadius: 5, cursor: "pointer",
                boxShadow: viewMode === k ? "0 1px 2px rgba(22,22,26,0.06)" : "none",
                transition: "background 120ms cubic-bezier(0.2,0,0,1), color 120ms cubic-bezier(0.2,0,0,1), box-shadow 120ms cubic-bezier(0.2,0,0,1), transform 120ms cubic-bezier(0.2,0,0,1)",
              }}>{v}</button>
            ))}
          </div>
        )}

        {/* Theme toggle */}
        <button title={theme === "dark" ? "Aydınlık mod" : "Karanlık mod"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          style={{
            border: "1px solid var(--line)", background: "transparent",
            padding: "5px 6px", borderRadius: 7, color: "var(--ink-3)", cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            transition: "color 150ms, background 150ms",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--paper-2)"; e.currentTarget.style.color = "var(--ink)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-3)"; }}
        >
          {theme === "dark" ? <I.Sun size={14}/> : <I.Moon size={14}/>}
        </button>

        {/* Bildirimler artık Ody'ye taşındı (sağ-alt maskot) — üst menüde çan yok. */}

        {/* New brief — icon+text on desktop, icon-only on mobile */}
        {isMobile ? (
          <button onClick={onNewBrief} style={{
            width: 36, height: 36, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1.5px solid var(--ember)", borderRadius: 8,
            background: "transparent", color: "var(--ember)", cursor: "pointer",
          }}>
            <I.Plus size={16}/>
          </button>
        ) : (
          <Button kind="secondary" size="sm" icon={<I.Plus size={12}/>} onClick={onNewBrief}
            style={{borderColor:"var(--ember)", color:"var(--ember)", fontWeight:600}}>Yeni brief</Button>
        )}

        {/* User avatar + menu */}
        <div style={{position: "relative"}}>
          <button onClick={() => setUserMenu(v => !v)} style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "3px 8px 3px 3px", border: "1px solid var(--line)",
            borderRadius: 999, background: "transparent", cursor: "pointer",
            transition: "background 120ms",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--paper-2)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <Avatar user={user} size={22}/>
            <span style={{font: "500 12px/1 var(--font-sans)", color: "var(--ink)"}}>{user.name.split(" ")[0]}</span>
            <I.ChevronDown size={10} style={{color: "var(--ink-4)"}}/>
          </button>
          {userMenu && (() => {
            const ROL_LABELS = { yonetici: "Yönetici", tasarim: "Tasarım", editor: "Editör", ai: "AI", freelance: "Freelance", diger: "Diğer" };
            const ROL_ORDER = ["yonetici", "tasarim", "editor", "ai", "freelance", "diger"];
            const grouped = {};
            for (const u of (defaultUsers || [])) {
              const rol = u.rol || "diger";
              (grouped[rol] = grouped[rol] || []).push(u);
              // Departman yöneticisi kendi departman grubunda da görünsün (Yönetici grubuna ek olarak)
              if (rol === "yonetici" && u.dept) (grouped[u.dept] = grouped[u.dept] || []).push(u);
            }
            // Her grubu alfabetik sırala
            Object.keys(grouped).forEach(k => {
              grouped[k].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
            });
            const onPick = defaultUsers && defaultUsers.onPick;
            return (
              <div onMouseLeave={() => setUserMenu(false)} style={{
                position: "absolute", top: 38, right: 0, zIndex: 50,
                minWidth: 240, maxHeight: 460, padding: 4,
                background: "var(--surface)", border: "1px solid var(--line)",
                borderRadius: 10, boxShadow: "var(--shadow-2)",
                overflowY: "auto",
              }}>
                {currentUser?.role === 'admin' && <div style={{padding: "7px 10px 5px", font: "600 10px/1 var(--font-sans)", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--ink-4)"}}>
                  Görünümü değiştir
                </div>}
                {currentUser?.role === 'admin' && ROL_ORDER.map(rol => {
                  const list = grouped[rol];
                  if (!list || list.length === 0) return null;
                  return (
                    <div key={rol}>
                      <div style={{padding: "6px 10px 2px", font: "600 10px/1 var(--font-sans)", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--ink-5)"}}>
                        {ROL_LABELS[rol]}
                      </div>
                      {list.map(u => {
                        const active = user && user.id === u.id;
                        return (
                          <button key={u.id} onClick={() => { onPick && onPick(u); setUserMenu(false); }} style={{
                            display: "flex", width: "100%", textAlign: "left", alignItems: "center", gap: 8,
                            padding: "6px 8px", border: 0,
                            background: active ? "var(--paper-2)" : "transparent",
                            cursor: "pointer", borderRadius: 6, transition: "background 100ms",
                          }}
                            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--paper-2)"; }}
                            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                          >
                            <Avatar user={u} size={20}/>
                            <span style={{font: "500 12px/1.2 var(--font-sans)", color: "var(--ink)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                              {u.name}
                            </span>
                            {u.title && <span style={{font: "400 10px/1 var(--font-sans)", color: "var(--ink-4)", whiteSpace: "nowrap"}}>{u.title}</span>}
                            {active && <I.Check size={11} style={{color:"var(--ember)", flexShrink:0}}/>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
                {onLogout && (
                  <>
                    <div style={{height: 1, background: "var(--line)", margin: "4px 4px"}}/>
                    {currentUser && (
                      <div style={{padding: "5px 10px 3px", font: "600 10px/1 var(--font-sans)", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--ink-4)"}}>
                        {currentUser.name}
                      </div>
                    )}
                    <button onClick={() => { setUserMenu(false); onLogout(); }}
                      style={{
                        display: "flex", width: "100%", textAlign: "left", alignItems: "center", gap: 8,
                        padding: "7px 8px", border: 0, background: "transparent", cursor: "pointer",
                        borderRadius: 6, color: "var(--ember)", font: "500 12px/1 var(--font-sans)",
                        transition: "background 100ms",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--paper-2)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <I.LogOut size={12}/>
                      Çıkış Yap
                    </button>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </div>
      <style>{`@keyframes bn-pulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }`}</style>
    </header>
  );
}

// ─── Mobile bottom navigation bar ────────────────────────────────────────
function MobileNav({ active, onChange, data }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const alertCount = (data && data.briefs) ? data.briefs.filter(b => b.prio && (b.prio.code === "red" || b.prio.code === "over")).length : 0;

  const PRIMARY = [
    { id: "overview",  label: "Özet",    icon: "Home" },
    { id: "jobs",      label: "İşler",   icon: "Briefcase" },
    { id: "kanban",    label: "Kanban",  icon: "Columns" },
    { id: "profile",   label: "Profil",  icon: "User" },
  ];

  // All nav items for drawer
  const ALL_ITEMS = NAV_SECTIONS.flatMap(s => s.items);

  return (
    <>
      {/* Drawer backdrop */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
          zIndex: 80, backdropFilter: "blur(2px)",
        }}/>
      )}

      {/* Slide-up drawer */}
      <div style={{
        position: "fixed", left: 0, right: 0, bottom: menuOpen ? 60 : "-100%",
        zIndex: 81, background: "var(--surface)",
        borderRadius: "16px 16px 0 0",
        border: "1px solid var(--line)", borderBottom: "none",
        padding: "12px 0 8px",
        transition: "bottom 250ms cubic-bezier(0.4,0,0.2,1)",
        maxHeight: "70vh", overflowY: "auto",
      }}>
        <div style={{
          width: 36, height: 4, borderRadius: 2, background: "var(--line)",
          margin: "0 auto 12px",
        }}/>
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.id}>
            <div style={{
              padding: "8px 20px 4px",
              font: "600 10px/1 var(--font-sans)", letterSpacing: "0.08em",
              textTransform: "uppercase", color: "var(--ink-5)",
            }}>{section.label}</div>
            {section.items.map(item => {
              const Icon = NAV_ICONS[item.icon] || (() => null);
              const isActive = active === item.id;
              const badge = item.alert && alertCount > 0 ? alertCount : null;
              return (
                <button key={item.id} onClick={() => { onChange(item.id); setMenuOpen(false); }}
                  style={{
                    display: "flex", width: "100%", alignItems: "center", gap: 12,
                    padding: "10px 20px", border: 0, cursor: "pointer",
                    background: isActive ? "var(--ember-tint)" : "transparent",
                    color: isActive ? "var(--ember)" : "var(--ink-2)",
                    font: `${isActive ? 600 : 500} 14px/1 var(--font-sans)`,
                    textAlign: "left",
                  }}
                >
                  <Icon/>
                  <span style={{flex:1}}>{item.label}</span>
                  {badge && <span style={{font:"600 10px/1 var(--font-mono)", padding:"2px 6px", borderRadius:4, color:"var(--prio-red)", background:"var(--prio-red-bg)"}}>{badge}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom tab bar */}
      <nav style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 82,
        height: 60,
        display: "flex", alignItems: "stretch",
        background: "var(--header-blur)",
        backdropFilter: "blur(14px) saturate(160%)",
        WebkitBackdropFilter: "blur(14px) saturate(160%)",
        borderTop: "1px solid var(--line)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        {PRIMARY.map(item => {
          const Icon = NAV_ICONS[item.icon] || (() => null);
          const isActive = active === item.id;
          const badge = item.alert && alertCount > 0 ? alertCount : null;
          return (
            <button key={item.id} onClick={() => onChange(item.id)} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 3,
              border: 0, background: "transparent", cursor: "pointer",
              color: isActive ? "var(--ember)" : "var(--ink-4)",
              position: "relative", minWidth: 0,
              transition: "color 150ms",
            }}>
              {isActive && <span style={{
                position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                width: 24, height: 2, borderRadius: 2, background: "var(--ember)",
              }}/>}
              <span style={{position:"relative"}}>
                <Icon/>
                {badge && <span style={{
                  position:"absolute", top:-4, right:-6,
                  width:14, height:14, borderRadius:999,
                  background:"var(--prio-red)", border:"2px solid var(--surface)",
                  font:"600 8px/14px var(--font-mono)", color:"#fff",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:8,
                }}>{badge > 9 ? "9+" : badge}</span>}
              </span>
              <span style={{
                font: `${isActive ? 600 : 400} 9.5px/1 var(--font-sans)`,
                letterSpacing: "0.01em", whiteSpace: "nowrap",
              }}>{item.label}</span>
            </button>
          );
        })}
        {/* Menü butonu */}
        <button onClick={() => setMenuOpen(v => !v)} style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 3,
          border: 0, background: "transparent", cursor: "pointer",
          color: menuOpen ? "var(--ember)" : "var(--ink-4)",
          transition: "color 150ms",
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            {menuOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
            }
          </svg>
          <span style={{font:"400 9.5px/1 var(--font-sans)"}}>Menü</span>
        </button>
      </nav>
    </>
  );
}

function SidebarSearch({ onOpenPalette, collapsed }) {
  if (collapsed) {
    return (
      <button onClick={onOpenPalette} style={{
        width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center",
        border:"1px solid var(--line)", borderRadius:7,
        background:"var(--paper-2)", color:"var(--ink-4)", cursor:"pointer", flexShrink:0
      }}>
        <I.Search size={13}/>
      </button>
    );
  }
  return (
    <button onClick={onOpenPalette} style={{
      flex:1, minWidth:0, display:"flex", alignItems:"center", gap:7,
      padding:"6px 9px", border:"1px solid var(--line)", borderRadius:7,
      background:"var(--paper-2)", color:"var(--ink-4)", cursor:"pointer",
      font:"400 12px/1 var(--font-sans)", textAlign:"left"
    }}
      onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--ink-4)";e.currentTarget.style.background="var(--paper)";}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--line)";e.currentTarget.style.background="var(--paper-2)";}}
    >
      <I.Search size={12} style={{flexShrink:0}}/>
      <span style={{flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>Ara…</span>
      <span style={{font:"500 9px/1 var(--font-mono)", color:"var(--ink-5)", padding:"2px 5px", border:"1px solid var(--line)", borderRadius:3, background:"var(--surface)", flexShrink:0}}>⌘K</span>
    </button>
  );
}

function Sidebar({ active, onChange, collapsed, expanded, pinned, onToggle, onHoverEnter, onHoverLeave, data, onOpenPalette, currentUser }) {
  const isMobile = useIsMobile();
  const alertCount = (data && data.briefs) ? data.briefs.filter(b => b.prio && (b.prio.code === "red" || b.prio.code === "over")).length : 0;

  // On mobile, sidebar is hidden (MobileNav handles navigation)
  if (isMobile) return null;

  // Rail varsayılan kapalı; hover'da overlay olarak açılır (içerik kaymaz).
  var isOpen = expanded === undefined ? !collapsed : expanded;

  return (
    <aside
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      style={{
      position: "absolute", top: 0, bottom: 0, left: 0,
      width: isOpen ? 212 : 52,
      flexShrink: 0,
      display: "flex", flexDirection: "column",
      background: "var(--sidebar-bg)",
      borderRight: "1px solid var(--line)",
      overflow: "hidden",
      boxShadow: (isOpen && !pinned) ? "var(--shadow-2)" : "none",
      transition: "width 180ms cubic-bezier(0.2,0,0,1), box-shadow 180ms",
      zIndex: 60,
    }}>
      {/* Logo area */}
      <div style={{
        height: 56, flexShrink: 0,
        display: "flex", alignItems: "center",
        padding: collapsed ? "0 14px" : "0 16px",
        borderBottom: "1px solid var(--line)",
        gap: 8,
        overflow: "hidden",
      }}>
        <SidebarSearch onOpenPalette={onOpenPalette} collapsed={collapsed}/>
      </div>

      {/* Nav sections */}
      <nav style={{flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 0 8px"}}>
        {NAV_SECTIONS.filter(s => !s.adminOnly || currentUser?.role === 'admin').map((section, si) => (
          <div key={section.id} style={{marginBottom: si < NAV_SECTIONS.length - 1 ? 4 : 0}}>
            {!collapsed && si > 0 && (
              <div style={{height:1, background:"var(--line-soft)", margin:"4px 14px 6px"}}/>
            )}
            {!collapsed && (
              <div style={{
                padding: si === 0 ? "4px 16px 4px" : "2px 16px 4px",
                font: "600 9px/1 var(--font-sans)",
                letterSpacing: "0.10em", textTransform: "uppercase",
                color: "var(--ink-5)",
              }}>{section.label}</div>
            )}
            {section.items.map(item => {
              const isActive = active === item.id;
              const Icon = NAV_ICONS[item.icon] || (() => <span style={{width:15,height:15,display:"inline-block"}}/>);
              const badge = item.alert && alertCount > 0 ? alertCount : null;
              return (
                <button
                  key={item.id}
                  onClick={() => onChange(item.id)}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: "flex", alignItems: "center",
                    gap: collapsed ? 0 : 8,
                    border: 0, cursor: "pointer",
                    padding: collapsed ? "8px 0" : "6px 10px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    borderRadius: 8,
                    margin: "1px 8px", width: "calc(100% - 16px)",
                    background: isActive ? "var(--ember-tint)" : "transparent",
                    color: isActive ? "var(--ember)" : "var(--ink-3)",
                    transition: "background 140ms, color 140ms",
                    position: "relative",
                    boxShadow: isActive && !collapsed ? "inset 0 0 0 1px var(--ember-muted)" : "none",
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "var(--paper-2)"; e.currentTarget.style.color = "var(--ink-2)"; }}}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-3)"; }}}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <span style={{
                      position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)",
                      width: 3, height: 20, borderRadius: 999,
                      background: "var(--ember)",
                      boxShadow: "0 0 6px var(--ember-muted)",
                    }}/>
                  )}
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    color: isActive ? "var(--ember)" : "inherit",
                    opacity: isActive ? 1 : 0.75,
                  }}>
                    <Icon/>
                  </span>
                  {!collapsed && (
                    <span style={{
                      font: `${isActive ? 600 : 500} 13px/1 var(--font-sans)`,
                      flex: 1, textAlign: "left", whiteSpace: "nowrap",
                      letterSpacing: isActive ? "-0.005em" : 0,
                    }}>{item.label}</span>
                  )}
                  {badge && !collapsed && (
                    <span style={{
                      font: "600 10px/1 var(--font-mono)",
                      padding: "2px 6px", borderRadius: 999,
                      color: "var(--prio-red)", background: "var(--prio-red-bg)",
                      border: "1px solid rgba(215,38,61,0.15)",
                      flexShrink: 0,
                    }}>{badge}</span>
                  )}
                  {badge && collapsed && (
                    <span style={{
                      position: "absolute", top: 4, right: 6,
                      width: 7, height: 7, borderRadius: 999,
                      background: "var(--prio-red)", border: "2px solid var(--surface)",
                    }}/>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Kılavuz linki */}
      {!collapsed && (
        <a href="docs/kullanim-klavuzu.html" target="_blank" rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 16px", borderTop: "1px solid var(--line-soft)",
            font: "500 12px/1 var(--font-sans)", color: "var(--ink-4)",
            textDecoration: "none", flexShrink: 0,
            transition: "color 150ms, background 150ms",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--ember)"; e.currentTarget.style.background = "var(--ember-tint)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--ink-4)"; e.currentTarget.style.background = "transparent"; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          Kullanım Kılavuzu
        </a>
      )}

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        title={collapsed ? "Sidebar'ı genişlet" : "Sidebar'ı daralt"}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "10px 0 14px",
          border: 0, background: "transparent",
          borderTop: "1px solid var(--line)",
          cursor: "pointer", color: "var(--ink-4)",
          transition: "color 120ms",
          flexShrink: 0,
        }}
        onMouseEnter={e => e.currentTarget.style.color = "var(--ink-2)"}
        onMouseLeave={e => e.currentTarget.style.color = "var(--ink-4)"}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
          style={{transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 200ms var(--ease-out-quart)"}}>
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
    </aside>
  );
}

// Backwards-compat exports (TabBar still referenced in old snapshots — no-op if unused)
function TabBar() { return null; }

window.Header = Header;
window.Sidebar = Sidebar;
window.MobileNav = MobileNav;
window.TabBar = TabBar;
window.NAV_SECTIONS = NAV_SECTIONS;
window.useIsMobile = useIsMobile;
