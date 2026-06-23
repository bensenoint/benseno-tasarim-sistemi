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
  if (/(tamamlan|bitti|onaylandı|teslim|tebrik|👏)/.test(s)) return 'coskulu';   // iş tamamlandı → coşkulu
  if (/(revizyon|düzelt|tekrar|geri gönder)/.test(s)) return 'mesgul';
  if (/(yeni brief|atandı|atanmış|eklendi|başladı|yeni iş|açıldı)/.test(s)) return 'dusunuyor'; // yeni iş → düşünüyor
  if (/(onay|müşteride)/.test(s)) return 'neseli';
  return 'heyecanli';
}
// Bugün tamamlanan iş sayısı (kişi+tarih anahtarlı, bildirimlerden sayılır).
function odyDoneToday(uid) {
  try { return parseInt(localStorage.getItem('bns_ody_done_' + (uid || 'x') + '_' + new Date().toISOString().slice(0, 10)) || '0', 10) || 0; } catch (e) { return 0; }
}
function odyBumpDone(uid) {
  try { var k = 'bns_ody_done_' + (uid || 'x') + '_' + new Date().toISOString().slice(0, 10); localStorage.setItem(k, String((parseInt(localStorage.getItem(k) || '0', 10) || 0) + 1)); } catch (e) {}
}
// Giriş yapan kullanıcının işleri (lead/katkı/gözlemci/reviewer). uid yoksa tüm işler (fallback).
function odyMyBriefs(uid) {
  var b = (window.BNS_DATA && window.BNS_DATA.briefs) || [];
  if (!uid) return b;
  var inArr = function (a) { return Array.isArray(a) && a.some(function (u) { return u && u.id === uid; }); };
  var mine = b.filter(function (x) {
    if (x.lead && x.lead.id === uid) return true;
    if (x.reviewer && x.reviewer.id === uid) return true;
    return inArr(x.contributors) || inArr(x.workers) || inArr(x.leads) || inArr(x.observers);
  });
  return mine;
}
// Ekip duygusu — KİŞİYE ÖZEL: kişinin kendi işlerinin AI thread özetlerinden (thread_ozet)
// olumlu/olumsuz sinyal sayar. Ekstra tarama YOK; saatlik üretilen özetleri okur. -1/0/+1.
function odyThreadSentiment(uid) {
  try {
    var b = odyMyBriefs(uid);
    var NEG = /(sorun|gecik|revize|revizyon|beklemede|cevap yok|cevap alınama|yanıt yok|sıkıntı|memnun değil|memnuniyetsiz|itiraz|hata|eksik|onaylanmad|olumsuz|şikayet|düzelt|tekrar|geri gönder|stres|takıld|aciliyet|baskı)/i;
    var POS = /(onayland|beğen|teşekkür|harika|memnun|olumlu|sorunsuz|teslim edildi|pürüzsüz|güzel oldu|akıcı|net ilerl|tebrik)/i;
    var pos = 0, neg = 0;
    b.forEach(function (x) { var s = x && x.thread_ozet; if (!s) return; if (NEG.test(s)) neg++; if (POS.test(s)) pos++; });
    if (neg > pos) return -1;
    if (pos > neg) return 1;
    return 0;
  } catch (e) { return 0; }
}
// İş yükü seviyesi — KİŞİYE ÖZEL: çok iş → 'busy' (kızgın serbest), orta → 'some', sakin → 'calm'.
function odyBusyLevel(uid) {
  try {
    var b = odyMyBriefs(uid);
    var overdue = b.filter(function (x) { return x.durum !== 'tamamlandi' && x.durum !== 'musteride' && x.deltaH != null && x.deltaH <= 0; }).length;
    var active = b.filter(function (x) { return x.durum !== 'tamamlandi' && x.durum !== 'musteride'; }).length;
    var risk = b.filter(function (x) { return window.bnsIsRisk && window.bnsIsRisk(x.durum, x.deltaH); }).length;
    if (overdue >= 2 || active >= 6) return 'busy';   // birey için çok iş eşiği
    if (overdue > 0 || risk > 0) return 'some';
    return 'calm';
  } catch (e) { return 'calm'; }
}
// Anlık "yerine otur" mood'u: 2'den fazla geciken → kızgın, genel çok iş → meşgul,
// orta → endişeli, sakin → neşeli.
function odyRestingMood(uid) {
  var overdue = 0;
  try {
    var b = odyMyBriefs(uid);
    overdue = b.filter(function (x) { return x.durum !== 'tamamlandi' && x.durum !== 'musteride' && x.deltaH != null && x.deltaH <= 0; }).length;
  } catch (e) {}
  if (overdue > 2) return 'kizgin';          // 2'den fazla geciken iş → kızgın
  var lvl = odyBusyLevel(uid);
  if (lvl === 'busy') return 'mesgul';        // genel çok iş → meşgul
  var sent = odyThreadSentiment(uid);         // kişinin işlerindeki thread duygusu
  if (lvl === 'some') return sent < 0 ? 'uzgun' : 'endiseli'; // riskli + olumsuz thread → üzgün
  if (sent < 0) return 'endiseli';            // sakin ama thread'lerde olumsuzluk → endişeli
  var done = odyDoneToday(uid);               // sakin: bugün tamamlanan işe göre
  if (done >= 2) return 'neseli';             // 2+ iş tamamlandı → neşeli
  if (done >= 1) return 'mutlu';              // 1 iş tamamlandı → mutlu
  return 'neseli';
}
// Ruh halinin Türkçe etiketi (hover'da göstermek için).
function odyMoodLabel(mood) {
  return ({ mutlu: 'mutlu', neseli: 'neşeli', coskulu: 'coşkulu', heyecanli: 'heyecanlı', endiseli: 'endişeli', kizgin: 'kızgın', mesgul: 'meşgul', dusunuyor: 'düşünüyor', uykulu: 'uykulu', uzgun: 'üzgün', sikilmis: 'sıkılmış' })[mood] || 'sakin';
}
// Ody neden bu ruh halinde? Veriye dayalı kısa açıklama.
function odyMoodReason(mood, uid) {
  var overdue = 0, active = 0, done = odyDoneToday(uid), sent = odyThreadSentiment(uid);
  try {
    var b = odyMyBriefs(uid);
    overdue = b.filter(function (x) { return x.durum !== 'tamamlandi' && x.durum !== 'musteride' && x.deltaH != null && x.deltaH <= 0; }).length;
    active = b.filter(function (x) { return x.durum !== 'tamamlandi' && x.durum !== 'musteride'; }).length;
  } catch (e) {}
  var map = {
    kizgin: overdue > 0 ? ('senin ' + overdue + ' işin gecikti, iş yükün çok') : ('iş yükün çok (' + active + ' aktif işin var)'),
    endiseli: sent < 0 ? "işlerinin thread'lerinde takılan/olumsuz noktalar var" : (overdue > 0 ? ('senin ' + overdue + ' işin gecikti, tedbirliyim') : 'bazı işlerin risk altında'),
    mesgul: 'iş yükün yoğun (' + active + ' aktif işin var)',
    neseli: done >= 2 ? ('bugün ' + done + ' iş tamamladın, harika gidiyorsun') : (active > 0 ? ('işlerin kontrol altında (' + active + ' aktif iş), her şey yolunda') : 'gündeminde acil iş yok, her şey yolunda'),
    mutlu: done >= 1 ? 'bugün 1 işini tamamladın 🎉' : 'iyi bir haber aldım',
    coskulu: 'bir iş tamamlandı!',
    uzgun: sent < 0 ? "işlerinin thread'lerinde olumsuz sinyaller var" : 'olumsuz bir haber aldım',
    heyecanli: 'yeni bir hareket oldu',
    dusunuyor: 'yeni bir iş açıldı, ona bakıyorum',
    uykulu: '1 saattir yeni bildirim yok',
    sikilmis: 'bir süredir hiç hareket yok, biraz sıkıldım',
  };
  return map[mood] || 'sistemini takip ediyorum';
}
function odyFaceProd(mood) {
  var h = React.createElement, W = '#fff', PUP = '#16265c';
  var mk = function (k, st) { return h('div', { key: k, style: Object.assign({ background: W, borderRadius: '50%' }, st) }); };
  // Canlı göz: bebek (pupil) + ufak ışık parıltısı — herhangi bir boyutta merkezlenir
  var liveEye = function (k, w, hpx, st) {
    var ps = Math.max(3.8, w * 0.48), gs = 2.6;
    return h('div', { key: k, style: Object.assign({ position: 'relative', width: w + 'px', height: hpx + 'px', borderRadius: '50%', overflow: 'hidden',
      background: 'radial-gradient(circle at 50% 26%, #fff 0%, #f4f5f9 42%, #CFD2DE 100%)',
      boxShadow: 'inset 0 -2.2px 3px rgba(20,38,92,.30), inset 0 1.6px 1.6px rgba(255,255,255,1), 0 1px 1.6px rgba(13,25,66,.30)' }, st || {}) },
      h('div', { key: 'sheen', style: { position: 'absolute', left: '12%', top: '5%', width: '76%', height: '34%', background: 'rgba(255,255,255,.85)', borderRadius: '50%' } }),
      h('div', { key: 'p', style: { position: 'absolute', width: ps + 'px', height: ps + 'px', borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 26%, #4a66a0 0%, ' + PUP + ' 55%, #0b1640 100%)',
        boxShadow: '0 0.6px 1.4px rgba(0,0,0,.42)',
        left: (w / 2 - ps / 2) + 'px', top: (hpx / 2 - ps / 2 + 0.6) + 'px' } },
        h('div', { key: 'rim', style: { position: 'absolute', width: (ps * 0.3) + 'px', height: (ps * 0.3) + 'px', background: 'rgba(185,205,255,.5)', borderRadius: '50%', right: '0.5px', bottom: '0.5px' } })),
      h('div', { key: 'g', style: { position: 'absolute', width: gs + 'px', height: gs + 'px', background: '#fff', borderRadius: '50%', boxShadow: '0 0 1.6px rgba(255,255,255,.9)', left: (w / 2 - ps / 2 + 0.3) + 'px', top: (hpx / 2 - ps / 2 + 0.3) + 'px', zIndex: 2 } }));
  };
  // Boyutlu beyaz yüz objeleri (yay/yıldız/kapak/çizgi/kaş) — gözlerle aynı ton: gradyan + ince gölge
  var WGRAD = 'linear-gradient(180deg, #fff 0%, #E4E6EE 100%)';
  var faceShine = '0 1px 1.5px rgba(13,25,66,.32)';
  var faceDrop = 'drop-shadow(0 1px 1px rgba(13,25,66,.35))';
  var left, right, anim = 'odyPop .42s ease', extra = null, gap = 8;
  if (mood === 'mutlu' || mood === 'neseli') {
    var arc = function (k) { return h('div', { key: k, style: { width: '12px', height: '6px', borderTop: '3px solid #fff', borderRadius: '12px 12px 0 0', filter: faceDrop } }); };
    left = arc('l'); right = arc('r'); if (mood === 'neseli') anim = 'odyBounce .8s ease-in-out infinite';
  } else if (mood === 'coskulu') {
    var star = function (k) { return h('div', { key: k, style: { width: '13px', height: '13px', background: WGRAD, filter: faceDrop, clipPath: 'polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%)' } }); };
    left = star('l'); right = star('r'); anim = 'odyBounce .62s ease-in-out infinite';
  } else if (mood === 'heyecanli') {
    left = liveEye('l', 12, 12); right = liveEye('r', 12, 12); anim = 'odyBounce .72s ease-in-out infinite';
  } else if (mood === 'endiseli') {
    left = liveEye('l', 8, 11, { transform: 'rotate(15deg)' }); right = liveEye('r', 8, 11, { transform: 'rotate(-15deg)' }); gap = 9;
  } else if (mood === 'kizgin') {
    left = liveEye('l', 8, 8); right = liveEye('r', 8, 8); anim = 'odyShake .24s linear infinite';
    extra = h('div', { key: 'x', style: { position: 'absolute', inset: 0, pointerEvents: 'none' } }, h('div', { key: 'bl', style: { position: 'absolute', top: '13px', left: '13px', width: '11px', height: '3px', background: WGRAD, borderRadius: '2px', boxShadow: faceShine, transform: 'rotate(20deg)' } }), h('div', { key: 'br', style: { position: 'absolute', top: '13px', left: '26px', width: '11px', height: '3px', background: WGRAD, borderRadius: '2px', boxShadow: faceShine, transform: 'rotate(-20deg)' } }));
  } else if (mood === 'mesgul') {
    left = liveEye('l', 8, 9); right = liveEye('r', 8, 9);
  } else if (mood === 'dusunuyor') {
    left = liveEye('l', 8, 8, { transform: 'translateY(-2px)' }); right = liveEye('r', 8, 8, { transform: 'translateY(-2px)' });
  } else if (mood === 'uykulu') {
    var lid = function (k) { return h('div', { key: k, style: { width: '10px', height: '4px', background: WGRAD, borderRadius: '0 0 10px 10px', boxShadow: faceShine } }); };
    left = lid('l'); right = lid('r');
  } else if (mood === 'uzgun') {
    left = liveEye('l', 8, 9, { transform: 'translateY(2px)' }); right = liveEye('r', 8, 9, { transform: 'translateY(2px)' });
  } else if (mood === 'sikilmis') {
    // Sıkılmış: yarı kapalı düz gözler (meh / canı sıkkın)
    left = mk('l', { width: '10px', height: '3px', background: WGRAD, boxShadow: faceShine }); right = mk('r', { width: '10px', height: '3px', background: WGRAD, boxShadow: faceShine }); gap = 7;
  } else {
    // Varsayılan: canlı bakan göz + hafif gülümseme — küçük ama karakterli
    left = liveEye('l', 10, 12, { animation: 'odyBlink 4.6s infinite' });
    right = liveEye('r', 10, 12, { animation: 'odyBlink 4.6s infinite' });
    gap = 7;
    extra = h('div', { key: 'm', style: { position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', width: '11px', height: '5px', borderBottom: '2.5px solid ' + W, borderRadius: '0 0 11px 11px' } });
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

// Bildirim için katmanlı danışman bağlamı (öncelik sırası):
//  1) o işe yazılanlar (thread özeti / iş insight / puan sebebi)
//  2) o marka için geçmiş (kanal özeti / son insight / marka değerlendirmesi)
//  3) diğer markalardaki benzer işler (insight'lı tamamlananlar)
//  4) ilgili kişinin değerlendirmesi + yıldız puanı (karşılaştırma için)
function bnsAdviceContext(n) {
  const D = window.BNS_DATA || {};
  const E = window.EMBEDDED_DATA || {};
  const text = (n && n.text) || "";
  const clip = (s, k) => s ? String(s).replace(/\s+/g, " ").trim().slice(0, k) : "";
  const noM = text.match(/#(\d+)/);
  const no = noM ? parseInt(noM[1], 10) : null;
  const briefs = D._allBriefs || D.briefs || [];
  const completed = D._allCompleted || D.completed || [];
  const job = no != null ? [...briefs, ...completed].find(b => b.no === no) : null;
  const marka = (job && job.marka) || (text.split("—")[0] || "").replace(/#\d+/, "").trim();

  // 1) İş
  let jobCtx = "(bu işe dair kayıt yok)";
  if (job) {
    const p = [`#${job.no} ${clip(job.baslik, 80)} · durum: ${job.durum || job.delivery_status || "—"}` + (job.lead ? ` · atanan: ${job.lead.name}` : "")];
    if (job.thread_ozet) p.push("thread özeti: " + clip(job.thread_ozet, 650));
    if (job.insight) p.push("iş insight: " + clip(job.insight, 500));
    if (job.rating_sebep) p.push("puan sebebi: " + clip(job.rating_sebep, 300));
    if (job.rating) p.push("iş puanı: " + job.rating + "/5");
    jobCtx = p.join("\n");
  }

  // 2) Marka
  let brandCtx = "(marka geçmişi yok)";
  const bObj = ((E.bns_brands) || []).find(b => b.name === marka) || ((D.BRANDS) || []).find(b => b.name === marka);
  const bSebep = (typeof window.bnsSebep === "function") ? window.bnsSebep("marka", marka) : null;
  {
    const p = [];
    if (bObj && bObj.son_insight) p.push("marka son insight: " + clip(bObj.son_insight, 420));
    if (bObj && bObj.kanal_ozet) p.push("kanal özeti: " + clip(bObj.kanal_ozet, 380));
    if (bSebep && bSebep.sebep) p.push(`marka değerlendirmesi (${bSebep.rating_avg || "?"}/5): ` + clip(bSebep.sebep, 380));
    if (p.length) brandCtx = p.join("\n");
  }

  // 3) Diğer markalardaki benzer işler — iş tipi (başlıktan çıkarılır, kayıtlı alan yok) + kelime eşleşmesi.
  //    Aynı iş tipindekiler öncelikli (skor 2), kelime eşleşenler (skor 1). Profil'deki tip mantığıyla aynı.
  let simCtx = "(benzer iş bulunamadı)";
  if (job && job.baslik) {
    // İş tipi başlıktan çıkarılır (kayıtlı alan yok). Spesifik tipler önce gelir (ilk eşleşen kazanır).
    const TYPES = [
      ["3d/animasyon", ["3d", " render", "modelleme", "animasyon", "motion"]],
      ["mailing", ["mailing", "e-posta", "eposta", "newsletter", "edm", "mail "]],
      ["video kurgu", ["video", "reel", "kurgu", "montaj", "film", "klip", "youtube"]],
      ["sosyal medya", ["sosyal", "sm ", "sm-", "instagram", "story", "post", "içerik plan", "icerik plan"]],
      ["web/dijital", ["banner", "dijital", "display", "web", "website", "site", "landing", "ux", "ui", "arayüz"]],
      ["bröşür/baskı", ["bröşür", "broşür", "katalog", "baskı", "davetiye", "afiş", "föy", "foy", "el ilanı"]],
      ["ambalaj", ["ambalaj", "paket", "kutu", "etiket", "pouch", "label"]],
      ["sunum/deck", ["sunum", "deck", "ppt", "slide", "rapor", "pitch"]],
      ["logo/kimlik", ["logo", "kimlik", "identity", "kurumsal kimlik"]],
      ["banner/görsel", ["görsel", "key visual", "kv", "poster", "billboard"]],
    ];
    const typeOf = (t) => { t = " " + (t || "").toLowerCase() + " "; for (const pair of TYPES) { if (pair[1].some(w => t.includes(w))) return pair[0]; } return null; };
    const tType = typeOf(job.baslik + " " + (job.marka || ""));
    const words = job.baslik.toLowerCase().split(/[^a-zçğıöşü0-9]+/).filter(w => w.length > 4);
    const scored = completed.filter(c => c.no !== job.no && c.marka !== marka && c.insight && c.baslik)
      .map(c => {
        const sameType = tType && typeOf(c.baslik + " " + (c.marka || "")) === tType;
        const kw = words.some(w => c.baslik.toLowerCase().includes(w));
        return { c, score: (sameType ? 2 : 0) + (kw ? 1 : 0) };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => (b.score - a.score) || ((b.c.rating || 0) - (a.c.rating || 0)))
      .slice(0, 5);
    if (scored.length) {
      simCtx = (tType ? `bu işin tipi: ${tType}\n` : "") +
        scored.map(x => `• ${x.c.marka} #${x.c.no} ${clip(x.c.baslik, 40)} (puan ${x.c.rating || "?"}): ` + clip(x.c.insight, 200)).join("\n");
    }
  }

  // 4) İlgili kişi — değerlendirme + yıldız
  let personCtx = "(kişi değerlendirmesi yok)";
  if (job && job.lead && job.lead.id) {
    const r = D.ratings && D.ratings.users && D.ratings.users[job.lead.id];
    const ps = (typeof window.bnsSebep === "function") ? window.bnsSebep("kisi", job.lead.id) : null;
    const p = [job.lead.name + (r ? ` — yıldız: ${r.avg}/5 (${r.cnt} iş)` : "")];
    if (ps && ps.sebep) p.push("değerlendirme: " + clip(ps.sebep, 360));
    personCtx = p.join("\n");
  }

  // Bağlam tamamen boşsa (dört katman da varsayılan) → öneri üretme (API'ye gitme).
  const weak = jobCtx === "(bu işe dair kayıt yok)" &&
               brandCtx === "(marka geçmişi yok)" &&
               simCtx === "(benzer iş bulunamadı)" &&
               personCtx === "(kişi değerlendirmesi yok)";
  return { marka, jobCtx, brandCtx, simCtx, personCtx, weak };
}

function ChatBot({ currentUser, dateRange }) {
  // Dashboard'da seçili tarih aralığını /api/chat'e iletmek için (Ody o aralıktaki veriyi görür).
  const _range = () => (dateRange && typeof dateRange.from === "number") ? { from: dateRange.from, to: dateRange.to } : undefined;
  const uid = (currentUser && (currentUser.slack_id || currentUser.id)) || null;
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState("notif");   // panel sekmesi: "notif" (bildirim+öneri) | "chat" (sohbet)
  const [selId, setSelId] = React.useState(null);   // master-detail: seçili bildirim (mobilde liste→detay)
  const [notifFilter, setNotifFilter] = React.useState("all");   // liste filtresi: "all" | "unread"
  const [fb, setFb] = React.useState({});   // öneri geri bildirimi: { [notifId]: {vote, reasonOpen, reason, busy, note} }
  const [mood, setMood] = React.useState('neseli');
  const blobRef = React.useRef(null);
  const [msgs, setMsgs] = React.useState([]);   // {role:'user'|'assistant', content}
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const endRef = React.useRef(null);
  // Sürüklenebilir konum — balon/panel başlığından tutup taşınır; localStorage'da kalıcıdır.
  const [pos, setPos] = React.useState(() => {
    const W = typeof window !== "undefined" ? window.innerWidth : 1200;
    const H = typeof window !== "undefined" ? window.innerHeight : 800;
    // Mobilde kaydedilmiş (masaüstü) konumu yok say — içeriği/menüyü kapatmasın; sol-altta, nav üstünde sabitle
    if (W < 768) return { x: 14, y: H - 150 };
    try { const p = JSON.parse(localStorage.getItem("bns_ody_pos") || "null"); if (p && typeof p.x === "number" && typeof p.y === "number") return p; } catch (e) {}
    return { x: 20, y: H - 76 };
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
      if (start.moved) reactMove();   // taşındıysa kısa süre farklı ruh hali
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
  const [advice, setAdvice] = React.useState({});         // {notifId: {state:"loading"|"done"|"err", text}} — Ody'nin danışman önerisi
  const [openAdvice, setOpenAdvice] = React.useState(null); // hangi bildirimin önerisi açık
  const [advicePeek, setAdvicePeek] = React.useState(null); // boştayken dönüşümlü gösterilen öneri-balonu bildirimi
  const [brief, setBrief] = React.useState(null);         // günlük iş özeti (msgs'ten ayrı kart; görülünce kaybolur)
  React.useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  // Ody ruh hâli: değişince fx partikülü; kapalıyken periyodik bildirim ifadesi + okunmadı işareti
  React.useEffect(() => { odyFxProd(blobRef.current, mood); }, [mood]);
  React.useEffect(() => { setMood(odyRestingMood(uid)); }, [uid]);

  // Idle ruh-hali: bildirim yokken normal (neşeli); uzun süre boşta → sıkılmış; çok iş → kızgın.
  // Taşınınca kısa süre farklı ifade (heyecanlı), sonra normale döner.
  var openRef = React.useRef(open); openRef.current = open;
  var countRef = React.useRef(notifCount); countRef.current = notifCount;
  var idleStartRef = React.useRef(Date.now());   // boşta kalma başlangıcı
  var reactUntilRef = React.useRef(0);            // taşıma tepki ifadesinin bitiş zamanı
  var lastNotifRef = React.useRef(Date.now());    // en son bildirimin geldiği an (uyku sayacı)
  var newestIdRef = React.useRef(0);              // görülen en yeni bildirim id'si
  const ODY_BORED_MS = 75000;                     // bu süreden uzun boşta → sıkılmış
  const ODY_SLEEP_MS = 3600000;                   // 1 saat+ bildirim gelmezse → uyuyor
  const reactMove = () => { reactUntilRef.current = Date.now() + 3500; idleStartRef.current = Date.now(); setMood('heyecanli'); };
  React.useEffect(() => {
    const t = setInterval(() => {
      if (openRef.current || countRef.current > 0) { idleStartRef.current = Date.now(); return; } // aktif/bildirim varken karışma
      if (Date.now() < reactUntilRef.current) return;                 // taşıma/yeni iş tepkisi sürüyor
      const rest = odyRestingMood(uid);
      if (rest !== 'neseli' && rest !== 'mutlu') { setMood(rest); return; } // kızgın/meşgul/endişeli → doğrudan
      const now = Date.now();
      if (now - lastNotifRef.current > ODY_SLEEP_MS) { setMood('uykulu'); return; } // 1 saat+ bildirim yok → uyuyor
      if (now - idleStartRef.current > ODY_BORED_MS) { setMood('sikilmis'); return; } // uzun boşta → sıkılmış
      setMood(rest);                                                  // sakin baz: mutlu/neşeli
    }, 4000);
    return () => clearInterval(t);
  }, []);

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
          // Uyku sayacı: oturum içinde yeni bildirim geldiyse "son bildirim" anını güncelle.
          const maxId = items.reduce((m, n) => (n.id > m ? n.id : m), 0);
          if (newestIdRef.current === 0) newestIdRef.current = maxId;          // ilk yükleme — baz al
          else if (maxId > newestIdRef.current) { lastNotifRef.current = Date.now(); newestIdRef.current = maxId; }
          // Günlük tamamlanan iş sayısı: created_at bugünse, id-dedupe ile (yeni iş → düşünüyor mood'u zaten metinden).
          try {
            const todayStr = new Date().toISOString().slice(0, 10);
            const dk = 'bns_ody_donemax_' + (uid || 'x');
            let counted = parseInt(localStorage.getItem(dk) || '0', 10) || 0;
            let newMax = counted;
            items.forEach(n => {
              if (n.id > counted) {
                if (/(tamamlan|bitti|teslim|onaylandı)/i.test(n.text || '') && (n.created_at || '').slice(0, 10) === todayStr) odyBumpDone(uid);
                if (n.id > newMax) newMax = n.id;
              }
            });
            if (newMax > counted) localStorage.setItem(dk, String(newMax));
          } catch (e) {}
          const unread = items.filter(n => !n.read_at);
          setNotifCount(unread.length);
          if (!unread.length) { setNotifPeek(null); return; }
          const latest = unread.reduce((a, b) => (b.id > a.id ? b : a));
          if (latest.id !== peekDismissedRef.current) setNotifPeek(latest);
          if (!open) setMood(odyMoodFromText(latest.text));
        }).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [open]);

  // Bildirim balonu (notifPeek) 6 sn sonra otomatik kapanır — üst kontrolleri kalıcı kapatmasın.
  // Okunmamış rozeti (notifCount) Ody'de kalır; tıklayınca yine açılır.
  const peekDismissedRef = React.useRef(0);
  React.useEffect(() => {
    if (!notifPeek) return;
    const t = setTimeout(() => { peekDismissedRef.current = notifPeek.id; setNotifPeek(null); }, 6000);
    return () => clearTimeout(t);
  }, [notifPeek]);

  // Öneri-balonu döngüsü: öneriyi okumayan kullanıcı için, panel kapalı ve yeni-bildirim balonu
  // yokken Ody boş anlarda önerilerin ÖZETİNİ dönüşümlü gösterir; kullanıcı tıklayıp okuyana kadar
  // farklı bildirimleri sırayla sergiler. Tıklayınca detay açılır ve döngü durur.
  var notifPeekRef = React.useRef(notifPeek); notifPeekRef.current = notifPeek;
  var adviceRef = React.useRef(advice); adviceRef.current = advice;
  var notifItemsRef = React.useRef(notifItems); notifItemsRef.current = notifItems;
  var adviceCycleIdxRef = React.useRef(0);   // hangi öneriye sıra geldi
  var adviceEngagedRef = React.useRef(false); // kullanıcı bir öneriye tıkladı mı → döngü dur
  // Öneri metninden kısa balon özeti: madde işaretlerini/boş satırları temizle, ilk anlamlı cümle.
  const adviceSummary = (t) => {
    if (!t) return "";
    const first = String(t).split(/\n+/).map(s => s.replace(/^[•\-\*\d\.\)\s]+/, "").trim()).filter(Boolean)[0] || "";
    return first.length > 130 ? first.slice(0, 127) + "…" : first;
  };
  React.useEffect(() => {
    const ADVICE_CYCLE_MS = 11000;
    const tick = () => {
      if (openRef.current || adviceEngagedRef.current) { setAdvicePeek(null); return; }
      if (notifPeekRef.current) { setAdvicePeek(null); return; }   // yeni-bildirim balonuyla çakışma
      const items = (notifItemsRef.current || []).slice(0, 6);
      const ready = items.filter(n => { const a = adviceRef.current[n.id]; return a && a.state === "done" && adviceSummary(a.text); });
      if (!ready.length) { setAdvicePeek(null); return; }
      const idx = adviceCycleIdxRef.current % ready.length;
      adviceCycleIdxRef.current = idx + 1;
      setAdvicePeek(ready[idx]);
    };
    const t0 = setTimeout(tick, 4000);       // ilk balon için kısa gecikme
    const id = setInterval(tick, ADVICE_CYCLE_MS);
    return () => { clearTimeout(t0); clearInterval(id); };
  }, []);

  // Tüm bildirimleri okundu işaretle (panel kapanınca): sunucu + optimistik → Ody normale döner.
  const markNotifRead = () => {
    setNotifPeek(null);
    setNotifCount(0);
    setNotifItems(items => items.map(n => n.read_at ? n : Object.assign({}, n, { read_at: new Date().toISOString() })));
    setMood(odyRestingMood(uid));
    if (tok()) fetch(`${API}/api/notifications/read`, { method: "POST", headers: { Authorization: "Bearer " + tok() } }).catch(() => {});
  };
  // dismissBrief tanımı brief efektinin hemen altında.
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
    // Bir kez görüldüyse (panel açıldıysa) o gün tekrar gösterme.
    try { if (localStorage.getItem(key + "_seen")) return; } catch (e) {}
    let cached = null; try { cached = localStorage.getItem(key); } catch (e) {}
    if (cached) { setBrief(cached); return; }
    const PROMPT = "Bugünkü kısa kişisel özetimi ver: kaç aktif işim var, hangileri riskli/gecikmiş " +
      "(varsa # numarasıyla), müşteride bekleyen işlerim, kapasite durumum. Selamla başla, en fazla " +
      "4 kısa madde. Acil bir şey yoksa kısaca olumlu söyle.";
    (async () => {
      try {
        const r = await fetch(`${API}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: "Bearer " + tok() },
          body: JSON.stringify({ messages: [{ role: "user", content: PROMPT }], range: _range() }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.reply) {
          try { localStorage.setItem(key, j.reply); } catch (e) {}
          setBrief(j.reply);
        }
      } catch (e) { /* sessiz — proaktif brief best-effort */ }
    })();
  }, []);
  // Günlük özet "görüldü" işaretle + temizle (panel açılınca veya × ile).
  const dismissBrief = () => {
    setBrief(null);
    try {
      const u = (typeof bnsGetStoredUser === "function" && bnsGetStoredUser()) || null;
      const uid = u && (u.id || u.slack_id);
      if (uid) localStorage.setItem(`bns_ody_brief_${uid}_${new Date().toISOString().slice(0, 10)}_seen`, "1");
    } catch (e) {}
  };

  // Bildirim için Ody'nin danışman önerisi — geçmiş thread/insight'lara göre ne yapılmalı/uyarı/yönlendirme.
  // /api/chat zaten sistem verisine (kişiye özel) erişiyor; bildirim metnini verip danışman gibi yorum istiyoruz.
  const adviceReqRef = React.useRef({});   // tekrar istek/loop önleme (id bazlı)
  const fetchAdvice = (n) => {
    if (!n || adviceReqRef.current[n.id]) return;
    if (advice[n.id] && (advice[n.id].state === "done" || advice[n.id].state === "none")) return;
    const ck = "bns_ody_advice2_" + n.id;   // v2: yetersiz bağlamda "YOK" döner → öneri gizlenir
    try {
      const c = localStorage.getItem(ck);
      if (c != null) { setAdvice(a => ({ ...a, [n.id]: c === "YOK" ? { state: "none", text: "" } : { state: "done", text: c } })); return; }
    } catch (e) {}
    const c = bnsAdviceContext(n);
    // Hiç bağlam yoksa öneri üretme — boş/dolgu mesaj yazma.
    if (c.weak) { try { localStorage.setItem(ck, "YOK"); } catch (e) {} setAdvice(a => ({ ...a, [n.id]: { state: "none", text: "" } })); return; }
    adviceReqRef.current[n.id] = true;
    setAdvice(a => ({ ...a, [n.id]: { state: "loading", text: "" } }));
    const PROMPT =
      "Şu bildirim geldi: \"" + (n.text || "") + "\".\n\n" +
      "Aşağıdaki bağlamı ÖNCELİK SIRASIYLA kullanarak değerlendir (1 en öncelikli):\n\n" +
      "1) BU İŞE YAZILANLAR:\n" + c.jobCtx + "\n\n" +
      "2) BU MARKA İÇİN GEÇMİŞ:\n" + c.brandCtx + "\n\n" +
      "3) DİĞER MARKALARDAKİ BENZER İŞLER (aynı iş tipi öncelikli):\n" + c.simCtx + "\n\n" +
      "4) İLGİLİ KİŞİNİN DEĞERLENDİRMESİ VE YILDIZ PUANI (bununla karşılaştır):\n" + c.personCtx + "\n\n" +
      "Bu katmanları sentezle; işin/markanın geçmişini kişinin yıldız puanı ve değerlendirmesiyle KARŞILAŞTIR. " +
      "TON: net, doğrudan, uyarıcı bir proje danışmanı — riski açıkça söyle, temenni/gevşek cümle kurma. " +
      "Risk varsa neyin yanlış gidebileceğini ve sonucunu belirt (örn. 'X yapılmazsa termin kayar'). " +
      "EN FAZLA 3 madde (•), her madde TEK kısa cümle, gereksiz kelime yok. " +
      "Mümkünse # numarası/markaya referans ver. Selam/giriş yazma, doğrudan maddelere geç. " +
      "ÖNEMLİ: Bu bildirim için VERİYE DAYALI, SPESİFİK bir öneri/uyarı veremiyorsan (yalnızca genel/temenni " +
      "cümle ya da 'teyit et / netleştir / elimde bağlam yok' türü dolgu yazabiliyorsan), yanıt olarak SADECE " +
      "tek kelime yaz: YOK — başka hiçbir şey ekleme. Gerçek, spesifik bir içgörün varsa maddeleri yaz.";
    (async () => {
      try {
        const r = await fetch(`${API}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: "Bearer " + tok() },
          body: JSON.stringify({ messages: [{ role: "user", content: PROMPT }], range: _range() }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.reply) {
          const rep = String(j.reply).trim();
          // Yetersiz bağlam → "YOK" (veya boş): öneri gösterme, dolgu mesaj yazma.
          if (!rep || /^yok\.?$/i.test(rep)) {
            try { localStorage.setItem(ck, "YOK"); } catch (e) {}
            setAdvice(a => ({ ...a, [n.id]: { state: "none", text: "" } }));
          } else {
            try { localStorage.setItem(ck, rep); } catch (e) {}
            setAdvice(a => ({ ...a, [n.id]: { state: "done", text: rep } }));
          }
        } else {
          adviceReqRef.current[n.id] = false;   // hata → tekrar denenebilir
          setAdvice(a => ({ ...a, [n.id]: { state: "err", text: "Öneri alınamadı, tekrar dene." } }));
        }
      } catch (e) {
        adviceReqRef.current[n.id] = false;
        setAdvice(a => ({ ...a, [n.id]: { state: "err", text: "Bağlantı hatası." } }));
      }
    })();
  };
  // Manuel aç/kapa (okunmuş bildirimler için)
  const toggleAdvice = (n) => {
    if (openAdvice === n.id) { setOpenAdvice(null); return; }
    setOpenAdvice(n.id);
    fetchAdvice(n);
  };
  // En yeni bildirimlerin önerisini BİLDİRİMLE BİRLİKTE otomatik getir (ilk 6, cache'li) — toggle arkasında kaybolmasın.
  // (Panel açılınca okundu işaretlendiği için read/unread değil, sıraya göre.)
  React.useEffect(() => {
    (notifItems || []).slice(0, 6).forEach(fetchAdvice);
  }, [notifItems]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user", content: q }];
    setMsgs(next); setInput(""); setBusy(true); setMood("dusunuyor");
    try {
      const r = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: "Bearer " + tok() },
        body: JSON.stringify({ messages: next.slice(-12), range: _range() }),
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

  // Bildirimden detay-meta türet: metindeki #no eşleşen iş varsa marka/kişi/puan/durum döner; yoksa sade.
  const notifMeta = (n) => {
    const D = window.BNS_DATA || {};
    const text = (n && n.text) || "";
    const noM = text.match(/#(\d+)/); const no = noM ? parseInt(noM[1], 10) : null;
    const briefs = D._allBriefs || D.briefs || [];
    const completed = D._allCompleted || D.completed || [];
    const job = no != null ? [...briefs, ...completed].find(b => b.no === no) : null;
    const marka = (job && job.marka) || ((text.split("—")[0] || "").replace(/#\d+/, "").trim());
    return { no, marka, lead: job && job.lead, rating: (job && job.rating) || 0,
             durum: job && (job.durum || job.delivery_status), link: n && n.link };
  };
  // Marka adından kararlı renk (detayda marka noktası için).
  const brandColor = (s) => { let h = 0; for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return `hsl(${h} 52% 46%)`; };

  // ── Öneri geri bildirimi (beğen/beğenme + sebep + yeniden değerlendirme) ──
  const setFbFor = (id, patch) => setFb(f => ({ ...f, [id]: { ...(f[id] || {}), ...patch } }));
  const postFeedback = (notifId, vote, reason, adviceText, outcome) => {
    if (!tok()) return;
    fetch(`${API}/api/ody/advice-feedback`, {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + tok() },
      body: JSON.stringify({ notifId: Number.isInteger(notifId) ? notifId : null, vote, reason: reason || null, adviceText: adviceText || null, outcome: outcome || null }),
    }).catch(() => {});
  };
  const likeAdvice = (n) => { setFbFor(n.id, { vote: "up", reasonOpen: false, note: "Teşekkürler — kaydedildi." }); postFeedback(n.id, "up", null, (advice[n.id] || {}).text); };
  const dislikeAdvice = (n) => setFbFor(n.id, { vote: "down", reasonOpen: true, note: "" });
  // Beğenilmedi → sebebi kaydet + Ody öneriyi eleştirel yeniden değerlendirsin (hâlâ doğruysa korusun, değilse revize etsin).
  const submitDislike = async (n) => {
    const reason = ((fb[n.id] || {}).reason || "").trim();
    const prev = (advice[n.id] || {}).text || "";
    setFbFor(n.id, { reasonOpen: false, busy: true, note: "" });
    postFeedback(n.id, "down", reason, prev);
    const c = bnsAdviceContext(n);
    const PROMPT =
      "Bir önceki ÖNERİN kullanıcı tarafından BEĞENİLMEDİ. Önerini eleştirel gözle yeniden değerlendir.\n\n" +
      "Bildirim: \"" + (n.text || "") + "\"\n\nÖnceki önerin:\n" + prev + "\n\n" +
      (reason ? "Kullanıcının beğenmeme nedeni: \"" + reason + "\"\n\n" : "") +
      "BAĞLAM (öncelik sırasıyla):\n1) BU İŞE YAZILANLAR:\n" + c.jobCtx + "\n2) MARKA GEÇMİŞİ:\n" + c.brandCtx +
      "\n3) BENZER İŞLER:\n" + c.simCtx + "\n4) KİŞİ DEĞERLENDİRMESİ:\n" + c.personCtx + "\n\n" +
      "Önerin hâlâ DOĞRU, spesifik ve veriye dayalıysa SADECE tek kelime yaz: DOĞRU. " +
      "Yanlış/eksik/genel ise DÜZELTİLMİŞ öneriyi yaz: EN FAZLA 3 madde (•), her madde tek kısa cümle, # numarası/markaya referans ver, giriş/selam yazma.";
    try {
      const r = await fetch(`${API}/api/chat`, { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + tok() }, body: JSON.stringify({ messages: [{ role: "user", content: PROMPT }], range: _range() }) });
      const j = await r.json().catch(() => ({}));
      const rep = (r.ok && j.reply) ? String(j.reply).trim() : "";
      if (!rep) { setFbFor(n.id, { busy: false, note: "Yeniden değerlendirme alınamadı, tekrar dene." }); return; }
      if (/^doğru\.?$/i.test(rep)) {
        setFbFor(n.id, { busy: false, note: "Ody önerisini gözden geçirdi ve hâlâ doğru buluyor — değiştirmedi." });
        postFeedback(n.id, "down", reason, prev, "kept");
      } else {
        try { localStorage.setItem("bns_ody_advice2_" + n.id, rep); } catch (e) {}
        setAdvice(a => ({ ...a, [n.id]: { state: "done", text: rep } }));
        setFbFor(n.id, { busy: false, vote: null, note: "Ody önerisini güncelledi 👇" });
        postFeedback(n.id, "down", reason, prev, "revised");
      }
    } catch (e) { setFbFor(n.id, { busy: false, note: "Bağlantı hatası, tekrar dene." }); }
  };
  // Gün etiketi (Bugün / Dün / tarih) — bildirim listesini gruplamak için.
  const dayLabel = (iso) => {
    try { const d = new Date(iso); const t = new Date(); const y = new Date(Date.now() - 86400000);
      if (d.toDateString() === t.toDateString()) return "Bugün";
      if (d.toDateString() === y.toDateString()) return "Dün";
      return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" }); } catch (e) { return ""; }
  };
  // Panel açılınca / sekme değişince masaüstünde ilk bildirimi otomatik seç (detay boş kalmasın).
  React.useEffect(() => {
    if (!open || tab !== "notif") return;
    if (vw >= 768 && (!selId || !notifItems.some(n => n.id === selId)) && notifItems.length) setSelId(notifItems[0].id);
  }, [open, tab, notifItems]);

  return (
    <>
      {/* Kapalıyken son bildirim balonu (soru ekranı dışında) — Ody'ye bağlı */}
      {!open && notifPeek && (
        <button onClick={() => { setUnread(false); setOpen(true); markNotifRead(); }}
          title="Bildirimi aç"
          style={{
            position: "fixed", zIndex: 89, textAlign: "left",
            // Mobilde: üst banner (Ody konumundan bağımsız, içeriğe binmez). Desktop: Ody'ye bağlı.
            ...(vw < 768 ? {
              left: 8, right: 80, bottom: "calc(60px + env(safe-area-inset-bottom, 0px) + 14px)", maxWidth: "none",
            } : {
              left: Math.min(Math.max(8, pos.x), Math.max(8, vw - 256)),
              top: Math.max(8, pos.y - 72), width: 248, maxWidth: "calc(100vw - 24px)",
            }),
            border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)",
            boxShadow: "var(--shadow-2)", padding: "9px 12px", cursor: "pointer",
            animation: "odyPopIn .3s ease",
          }}>
          <div style={{ font: "700 9px/1 var(--font-sans)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ody)", marginBottom: 5 }}>Ody · yeni bildirim</div>
          <div style={{ font: "400 12px/1.45 var(--font-sans)", color: "var(--ink-2)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{notifPeek.text}</div>
        </button>
      )}
      {/* Boştayken dönüşümlü ÖNERİ balonu — öneriyi okumayan kullanıcı için. Tıkla → detay açılır, döngü durur. */}
      {!open && !notifPeek && advicePeek && (
        <button onClick={() => {
            adviceEngagedRef.current = true; setAdvicePeek(null);
            setUnread(false); setOpen(true); setTab("notif"); setSelId(advicePeek.id); setOpenAdvice(advicePeek.id); fetchAdvice(advicePeek);
          }}
          title="Ody'nin önerisini aç"
          style={{
            position: "fixed", zIndex: 89, textAlign: "left",
            ...(vw < 768 ? {
              left: 8, right: 80, bottom: "calc(60px + env(safe-area-inset-bottom, 0px) + 14px)", maxWidth: "none",
            } : {
              left: Math.min(Math.max(8, pos.x), Math.max(8, vw - 256)),
              top: Math.max(8, pos.y - 72), width: 248, maxWidth: "calc(100vw - 24px)",
            }),
            border: "1px solid var(--ody)", borderRadius: 12, background: "var(--surface)",
            boxShadow: "var(--shadow-2)", padding: "9px 12px", cursor: "pointer",
            animation: "odyPopIn .3s ease",
          }}>
          <div style={{ font: "700 9px/1 var(--font-sans)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ody)", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>💡 Ody'nin önerisi</div>
          <div style={{ font: "400 12px/1.45 var(--font-sans)", color: "var(--ink-2)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{adviceSummary(advice[advicePeek.id] && advice[advicePeek.id].text)}</div>
          <div style={{ font: "600 10px/1 var(--font-sans)", color: "var(--ody)", marginTop: 6 }}>Detay için dokun →</div>
        </button>
      )}
      {/* Açma balonu */}
      {!open && (
        <button onPointerDown={(e) => startDrag(e, true)}
          onClick={() => { if (dragRef.current && dragRef.current.moved) { dragRef.current = null; return; } setUnread(false); setOpen(true); markNotifRead(); }}
          title={"Ody şu an " + odyMoodLabel(mood) + " — " + odyMoodReason(mood, uid) + ". " + (notifPeek ? "Yeni bildirim var, açmak için tıkla." : (unread ? "Bugünkü özetin hazır, açmak için tıkla." : "Sürükleyerek taşıyabilirsin."))} style={{
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
            background: "linear-gradient(180deg, color-mix(in srgb, var(--ody) 86%, #fff) 0%, var(--ody) 64%)",
            boxShadow: "0 10px 20px -8px rgba(20,38,92,.28)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "odyBob 4.5s ease-in-out infinite",
          }}>{odyFaceProd(mood)}</div>
          {notifCount > 0 && <span title={notifCount + " okunmamış bildirim"} style={{
            position: "absolute", bottom: -3, right: -3, zIndex: 3, width: 18, height: 18, padding: 0,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            borderRadius: "50%", background: "#24479E", color: "#fff",
            font: "700 9px/1 var(--font-sans)", textAlign: "center",
            border: "2px solid var(--paper)", boxShadow: "0 1px 3px -1px rgba(0,0,0,.3)",
            animation: "odyPopIn .3s ease",
          }}>{notifCount > 9 ? "9+" : notifCount}</span>}
        </button>
      )}
      {open && (() => {
        const isM = vw < 768;
        const panelW = tab === "notif" ? 720 : 400;
        const panelH = 560;
        const left = Math.min(Math.max(8, pos.x), Math.max(8, vw - (panelW + 12)));
        const top  = Math.min(Math.max(8, pos.y - (panelH - 52)), Math.max(8, vh - (panelH + 12)));
        const shell = isM
          ? { position: "fixed", inset: 0, width: "100vw", height: "100dvh", borderRadius: 0, border: "none" }
          : { position: "fixed", left, top, width: panelW, height: panelH, maxWidth: "calc(100vw - 16px)", maxHeight: "calc(100vh - 16px)", borderRadius: 14, border: "1px solid var(--line-strong)" };
        const sel = notifItems.find(n => n.id === selId) || null;
        const showList = isM ? !sel : true;
        const showDetail = isM ? !!sel : true;
        const selectNotif = (n) => { setSelId(n.id); fetchAdvice(n); };
        // SegBtn — Bildirimler/Sohbet segment kontrolü (v2: kenar, r6, aktifte mavi alt çizgi)
        const segBtn = (key, label, badge) => (
          <button onClick={() => setTab(key)} style={{
            border: 0, borderRight: key === "notif" ? "1px solid var(--line)" : 0, background: tab === key ? "var(--paper-2)" : "transparent",
            color: tab === key ? "var(--ink)" : "var(--ink-4)", padding: "8px 14px", cursor: "pointer",
            font: "600 12px/1 var(--font-sans)", position: "relative", display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            {label}{badge > 0 && <span style={{ color: "var(--ody)", font: "700 10px/1 var(--font-mono)" }}>{badge}</span>}
            {tab === key && <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: "var(--blue, #24479E)" }}/>}
          </button>
        );
        return (
        <div style={Object.assign({ zIndex: 90, background: "var(--surface)", boxShadow: "var(--shadow-2)", display: "flex", flexDirection: "column", overflow: "hidden" }, shell)}>
          {/* Başlık — Ody + segment + kapat (sürüklenebilir; mobilde sabit) */}
          <div onPointerDown={isM ? undefined : startDrag} title={isM ? undefined : "Sürükleyerek taşı"}
            style={{ padding: "12px 14px", borderBottom: "1px solid var(--line-strong)", display: "flex", alignItems: "center", gap: 10, cursor: isM ? "default" : "grab", touchAction: "none", userSelect: "none", background: "var(--paper)", flex: "none" }}>
            <span style={{ position: "relative", width: 32, height: 32, flex: "none", borderRadius: "64% 36% 60% 40% / 56% 44% 60% 40%", background: "linear-gradient(180deg, color-mix(in srgb, var(--ody) 86%, #fff) 0%, var(--ody) 64%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ position: "absolute", inset: 0, transform: "scale(0.55)" }}>{odyFaceProd(mood)}</span>
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "600 14px/1 var(--font-sans)", color: "var(--ink)", display: "flex", alignItems: "center", gap: 7 }}>Ody <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ok, #2E8F66)" }}/></div>
              <div style={{ font: "400 11px/1.3 var(--font-sans)", color: "var(--ink-4)", marginTop: 2 }}>bildirim · öneri · sohbet</div>
            </div>
            <div style={{ display: "flex", border: "1px solid var(--line-strong)", borderRadius: 6, overflow: "hidden", flex: "none" }}>
              {segBtn("notif", "Bildirimler", notifCount)}
              {segBtn("chat", "Sohbet", 0)}
            </div>
            <button onClick={() => { setOpen(false); markNotifRead(); dismissBrief(); }} title="Kapat" style={{ border: 0, background: "transparent", color: "var(--ink-4)", cursor: "pointer", padding: 5, display: "inline-flex" }}><I.X size={16}/></button>
          </div>

          {/* GÖVDE */}
          {tab === "notif" ? (
            <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
              {/* SOL — bildirim listesi */}
              {showList && (
                <div style={{ width: isM ? "100%" : 312, flex: isM ? 1 : "none", borderRight: isM ? "none" : "1px solid var(--line-strong)", display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper)" }}>
                  <div style={{ display: "flex", gap: 6, padding: 12, borderBottom: "1px solid var(--line)", flex: "none" }}>
                    {[["all", "Tümü"], ["unread", "Okunmamış"]].map(([k, lbl]) => (
                      <button key={k} onClick={() => setNotifFilter(k)} style={{
                        border: "1px solid " + (notifFilter === k ? "var(--ody)" : "var(--line)"), background: "transparent",
                        color: notifFilter === k ? "var(--ody)" : "var(--ink-3)", borderRadius: 999, padding: "6px 13px",
                        font: "600 11px/1 var(--font-sans)", cursor: "pointer",
                      }}>{lbl}</button>
                    ))}
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                    {(() => {
                      const list = notifItems.slice(0, 40).filter(n => notifFilter === "all" ? true : !n.read_at);
                      if (!list.length) return <div style={{ padding: 24, textAlign: "center", font: "400 12px var(--font-sans)", color: "var(--ink-4)" }}>{notifFilter === "unread" ? "Okunmamış bildirim yok." : "Bildirim yok."}</div>;
                      let lastDay = null;
                      return list.map((n) => {
                        const unread = !n.read_at;
                        const active = n.id === selId;
                        const dl = dayLabel(n.created_at);
                        const head = dl !== lastDay ? (lastDay = dl, dl) : null;
                        return (
                          <React.Fragment key={n.id}>
                            {head && <div style={{ padding: "10px 15px 6px", font: "600 10px/1 var(--font-sans)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-4)", display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 14, height: 2, background: "var(--blue, #24479E)" }}/>{head}</div>}
                            <div onClick={() => selectNotif(n)} style={{
                              display: "flex", gap: 11, padding: "12px 15px", cursor: "pointer",
                              borderBottom: "1px solid var(--line-soft)",
                              borderLeft: "3px solid " + (active ? "var(--ody)" : unread ? "var(--blue, #24479E)" : "transparent"),
                              background: active ? "var(--ody-tint)" : "transparent",
                            }}>
                              <span style={{ width: 24, height: 24, flex: "none", borderRadius: 4, border: "1px solid var(--line-strong)", display: "flex", alignItems: "center", justifyContent: "center", color: unread ? "var(--ody)" : "var(--ink-4)" }}><I.Bell size={12}/></span>
                              <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", font: (unread ? "600" : "400") + " 12.5px/1.4 var(--font-sans)", color: unread ? "var(--ink)" : "var(--ink-2)" }}>{n.text}</span>
                                <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, font: "500 10px/1 var(--font-mono)", color: "var(--ink-4)" }}>
                                  {fmtNotifT(n.created_at)}{n.link && <><span>·</span><span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><I.Link size={10}/> Slack</span></>}
                                </span>
                              </span>
                              {unread && <span style={{ width: 7, height: 7, flex: "none", marginTop: 7, borderRadius: "50%", background: "var(--blue, #24479E)" }}/>}
                            </div>
                          </React.Fragment>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
              {/* SAĞ — detay */}
              {showDetail && (
                <div style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "var(--surface)" }}>
                  {!sel ? (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, font: "400 13px var(--font-sans)", color: "var(--ink-4)", textAlign: "center" }}>Soldan bir bildirim seç.</div>
                  ) : (() => {
                    const m = notifMeta(sel);
                    const adv = advice[sel.id];
                    const advDone = adv && adv.state === "done" && (adv.text || "").trim();
                    const advLoading = adv && adv.state === "loading";
                    const advNone = adv && adv.state === "none";
                    const bc = brandColor(m.marka);
                    const initials = (m.lead && m.lead.name || "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
                    // Başlıktan "#no marka —" önekini çıkar → yalnız olay kalsın (üst satırda zaten var, tekrar olmasın)
                    const titleText = (sel.text || "").replace(/^#\d+\s+[^—–-]*[—–-]\s*/, "").trim() || sel.text;
                    return (
                      <div style={{ padding: "18px 20px 22px", display: "flex", flexDirection: "column", gap: 13 }}>
                        {isM && <button onClick={() => setSelId(null)} style={{ alignSelf: "flex-start", border: 0, background: "transparent", color: "var(--blue, #24479E)", cursor: "pointer", font: "600 13px/1 var(--font-sans)", padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>‹ bildirimler</button>}
                        {/* Tek kompakt üst satır: #no · marka · zaman + atanan avatar (tekrar yok) */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", font: "600 11px/1.3 var(--font-mono)", color: "var(--ink-4)" }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: bc, flex: "none" }}/>
                          {m.no && <span style={{ color: "var(--blue, #24479E)", fontWeight: 700 }}>#{m.no}</span>}
                          {m.marka && <span style={{ color: "var(--ink-2)" }}>{m.marka}</span>}
                          <span>· {fmtNotifT(sel.created_at)}</span>
                          {initials && <span title={m.lead.name} style={{ marginLeft: "auto", width: 22, height: 22, borderRadius: "50%", background: bc, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", font: "700 9px var(--font-sans)" }}>{initials}</span>}
                        </div>
                        <div style={{ font: "600 16px/1.35 var(--font-sans)", color: "var(--ink)", wordBreak: "break-word" }}>{titleText}</div>
                        {/* Marka/iş bağlam şeridi — kare, mavi sol şerit (yalnız iş eşleştiyse) */}
                        {(m.durum || m.rating > 0) && (
                          <div style={{ display: "flex", gap: "8px 18px", flexWrap: "wrap", padding: "11px 13px", border: "1px solid var(--line)", borderLeft: "3px solid var(--blue, #24479E)", background: "var(--paper-2)", font: "600 11px/1.4 var(--font-mono)", color: "var(--ink-3)" }}>
                            {m.durum && <span>durum <b style={{ color: "var(--ink)" }}>{m.durum}</b></span>}
                            {m.rating > 0 && <span>puan <span style={{ color: "var(--gold, #E2A100)", letterSpacing: 1 }}>{"★".repeat(Math.round(m.rating))}<span style={{ color: "var(--line-strong)" }}>{"★".repeat(Math.max(0, 5 - Math.round(m.rating)))}</span></span></span>}
                          </div>
                        )}
                        {/* Ody önerisi — kare, ember sol şerit */}
                        {advLoading ? (
                          <div style={{ padding: "13px 15px", border: "1px solid var(--line)", borderLeft: "3px solid var(--ody)", background: "var(--paper-2)", font: "400 12.5px var(--font-sans)", color: "var(--ink-4)", fontStyle: "italic" }}>Ody düşünüyor…</div>
                        ) : advDone ? (
                          <div style={{ padding: "15px 16px", border: "1px solid var(--line)", borderLeft: "3px solid var(--ody)", background: "var(--paper-2)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, font: "600 10px/1 var(--font-sans)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ody)", marginBottom: 11 }}>
                              <span style={{ width: 16, height: 16, borderRadius: "55% 45% 58% 42% / 52% 48% 56% 44%", background: "var(--ody)", flex: "none" }}/> Ody'nin önerisi
                            </div>
                            <div style={{ font: "400 13px/1.6 var(--font-sans)", color: "var(--ink-2)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}><Linkify text={adv.text}/></div>
                            {(() => {
                              const s = fb[sel.id] || {};
                              const fbBtn = { border: "1px solid var(--line-strong)", background: "var(--surface)", borderRadius: 6, padding: "4px 9px", cursor: "pointer", font: "400 13px/1 var(--font-sans)" };
                              return (
                                <div style={{ marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
                                  {!s.vote && !s.busy && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ font: "500 11px/1 var(--font-sans)", color: "var(--ink-4)" }}>Bu öneri yardımcı oldu mu?</span>
                                      <button onClick={() => likeAdvice(sel)} title="Beğen" style={fbBtn}>👍</button>
                                      <button onClick={() => dislikeAdvice(sel)} title="Beğenme" style={fbBtn}>👎</button>
                                    </div>
                                  )}
                                  {s.reasonOpen && (
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                      <input value={s.reason || ""} onChange={e => setFbFor(sel.id, { reason: e.target.value })}
                                        onKeyDown={e => { if (e.key === "Enter") submitDislike(sel); }}
                                        placeholder="Neden beğenmedin? (opsiyonel)" autoFocus
                                        style={{ flex: 1, minWidth: 160, padding: "7px 10px", border: "1px solid var(--line-strong)", borderRadius: 6, background: "var(--surface)", color: "var(--ink)", font: "400 12px var(--font-sans)", outline: "none" }}/>
                                      <button onClick={() => submitDislike(sel)} style={{ border: 0, background: "var(--ody)", color: "#fff", borderRadius: 6, padding: "7px 13px", font: "600 12px var(--font-sans)", cursor: "pointer" }}>Gönder</button>
                                    </div>
                                  )}
                                  {s.busy && <span style={{ font: "400 11px var(--font-sans)", color: "var(--ink-4)", fontStyle: "italic" }}>Ody yeniden değerlendiriyor…</span>}
                                  {s.note && !s.busy && <span style={{ font: "500 11px/1.4 var(--font-sans)", color: "var(--ody)" }}>{s.note}</span>}
                                </div>
                              );
                            })()}
                          </div>
                        ) : advNone ? (
                          <div style={{ padding: "13px 15px", border: "1px dashed var(--line-strong)", background: "var(--paper-2)", font: "400 12.5px/1.6 var(--font-sans)", color: "var(--ink-4)", fontStyle: "italic" }}>Bu bildirim için yeterli bağlam yok.</div>
                        ) : null}
                        {/* Aksiyonlar — v2 Button yapısı (r6, hairline, 600/13) */}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                          {sel.link && <a href={sel.link} target="_blank" rel="noreferrer" style={{ textDecoration: "none", border: "1px solid var(--ody)", background: "var(--ody)", color: "#fff", borderRadius: 6, padding: "9px 14px", font: "600 13px/1 var(--font-sans)", display: "inline-flex", alignItems: "center", gap: 6 }}><I.Link size={14}/> Slack thread'inde aç</a>}
                          <button onClick={() => setTab("chat")} style={{ border: "1px solid var(--line-strong)", background: "var(--surface)", color: "var(--ink)", borderRadius: 6, padding: "9px 14px", font: "600 13px/1 var(--font-sans)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><I.Bell size={14}/> Ody'ye sor</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            /* SOHBET sekmesi */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
                {brief && (
                  <div style={{ border: "1px solid var(--line)", borderLeft: "3px solid var(--ody)", background: "var(--paper-2)", padding: "11px 13px", flex: "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{ flex: 1, font: "700 10px/1 var(--font-sans)", letterSpacing: ".07em", textTransform: "uppercase", color: "var(--ody)" }}>Günlük özet</span>
                      <button onClick={dismissBrief} title="Kapat" style={{ border: 0, background: "transparent", color: "var(--ink-4)", cursor: "pointer", padding: 0, display: "inline-flex" }}><I.X size={13}/></button>
                    </div>
                    <div style={{ font: "400 12.5px/1.55 var(--font-sans)", color: "var(--ink)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}><Linkify text={brief}/></div>
                  </div>
                )}
                {!msgs.length && !busy && !brief && <div style={{ margin: "auto", textAlign: "center", font: "400 13px/1.6 var(--font-sans)", color: "var(--ink-4)", maxWidth: 280 }}>Marka, iş veya kişi hakkında soru sor — Ody sistem verisiyle yanıtlar.</div>}
                {msgs.map((mm, i) => (
                  <div key={i} style={{
                    alignSelf: mm.role === "user" ? "flex-end" : "stretch", maxWidth: mm.role === "user" ? "85%" : "100%", width: mm.role === "user" ? undefined : "100%",
                    padding: "10px 13px", borderRadius: 10, boxSizing: "border-box",
                    background: mm.role === "user" ? "var(--blue, #24479E)" : "var(--paper-2)",
                    color: mm.role === "user" ? "#fff" : "var(--ink-2)",
                    border: mm.role === "user" ? 0 : "1px solid var(--line)",
                    font: "400 13px/1.55 var(--font-sans)", whiteSpace: "pre-wrap", wordBreak: "break-word",
                  }}>{mm.role === "assistant" ? <Linkify text={mm.content}/> : mm.content}</div>
                ))}
                {busy && <div style={{ alignSelf: "flex-start", padding: "10px 13px", borderRadius: 10, background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--ink-4)", font: "400 13px/1 var(--font-sans)" }}>yazıyor…</div>}
                <div ref={endRef}/>
              </div>
              {msgs.length > 0 && <div style={{ padding: "0 16px 10px", flex: "none" }}><button onClick={() => setMsgs([])} style={{ border: 0, background: "transparent", color: "var(--ink-4)", cursor: "pointer", font: "400 11px var(--font-sans)" }}>sohbeti temizle</button></div>}
              <div style={{ padding: 12, borderTop: "1px solid var(--line-strong)", display: "flex", gap: 9, background: "var(--paper)", flex: "none" }}>
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") send(); }}
                  placeholder="Soru yaz…" disabled={busy}
                  style={{ flex: 1, padding: "11px 14px", border: "1px solid var(--line-strong)", borderRadius: 6,
                    background: "var(--surface)", color: "var(--ink)", font: "400 13px/1.3 var(--font-sans)", outline: "none" }}/>
                <button onClick={send} disabled={busy || !input.trim()} style={{
                  padding: "0 18px", border: 0, borderRadius: 6, background: "var(--ody)", color: "#fff",
                  font: "600 13px/1 var(--font-sans)", cursor: busy ? "default" : "pointer", opacity: busy || !input.trim() ? 0.5 : 1,
                }}>Gönder</button>
              </div>
            </div>
          )}
        </div>
        );
      })()}
    </>
  );
}
try { window.BnsChatBot = ChatBot; } catch (e) {}


// Global tarih aralığı filtresi — preset'ler + özel aralık. Açılış default'u son 30 gün.
function DateRangeControl({ range, onChange, now, compact }) {
  const [open, setOpen] = React.useState(false);
  const DAY = 86400000;
  const PRESETS = [["today","Bugün",null],["yesterday","Dün",null],["7d","Son 7 gün",7],["30d","Son 30 gün",30],["90d","Son 90 gün",90],["year","Bu yıl",null],["all","Tümü",null]];
  function apply(code, days) {
    if (code === "all")  { onChange({ from: 0, to: 8.64e15, preset: "all" }); setOpen(false); return; }
    if (code === "year") { const f = new Date(new Date(now).getFullYear(), 0, 1).getTime(); onChange({ from: f, to: now, preset: "year" }); setOpen(false); return; }
    if (code === "today")     { const d = new Date(now); const s = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); onChange({ from: s, to: now, preset: "today" }); setOpen(false); return; }
    if (code === "yesterday") { const d = new Date(now); const s = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); onChange({ from: s - DAY, to: s - 1, preset: "yesterday" }); setOpen(false); return; }
    onChange({ from: now - days * DAY, to: now, preset: code }); setOpen(false);
  }
  const label = (PRESETS.find(p => p[0] === range.preset) || [null, "Özel aralık"])[1];
  const toYMD = (ms) => { const d = new Date(ms); return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const parseYMD = (s, end) => { const p = (s||"").split("-").map(Number); if (!p[0]) return null; return new Date(p[0], p[1]-1, p[2], end?23:0, end?59:0, end?59:0).getTime(); };
  // Özel aralık inputları: her açılışta başlangıç ve bitiş bugüne sıfırlanır.
  const [cFrom, setCFrom] = React.useState("");
  const [cTo, setCTo] = React.useState("");
  React.useEffect(() => { if (open) { const t = toYMD(now); setCFrom(t); setCTo(t); } }, [open]);
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} title="Tarih aralığı"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: compact ? "5px 7px" : "5px 9px",
          border: "1px solid var(--line)", borderRadius: 6, background: range.preset === "30d" ? "var(--paper-2)" : "var(--ember-tint)",
          color: range.preset === "30d" ? "var(--ink-3)" : "var(--ember)", font: "500 11px/1 var(--font-sans)", cursor: "pointer" }}>
        <span>📅</span>{!compact && <span>{label}</span>}<span style={{ color: "var(--ink-4)" }}>▾</span>
      </button>
      {open && (
        <div onMouseLeave={() => setOpen(false)} style={{ position: "absolute", top: "100%", right: 0, marginTop: 6, zIndex: 80,
          background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 6, boxShadow: "var(--shadow-1)", minWidth: 184 }}>
          {PRESETS.map(([code, lbl, days]) => (
            <button key={code} onClick={() => apply(code, days)} style={{ display: "flex", width: "100%", textAlign: "left",
              padding: "7px 9px", border: 0, borderRadius: 6, cursor: "pointer",
              background: range.preset === code ? "var(--paper-2)" : "transparent",
              font: `${range.preset === code ? 600 : 500} 12px/1 var(--font-sans)`, color: "var(--ink)" }}>{lbl}</button>
          ))}
          <div style={{ borderTop: "1px solid var(--line)", margin: "5px 4px", paddingTop: 6 }}>
            <div style={{ font: "600 10px/1 var(--font-sans)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.04em", padding: "0 5px 6px" }}>Özel aralık</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: "0 4px 2px" }}>
              <input type="date" value={cFrom} onChange={e => { setCFrom(e.target.value); const v = parseYMD(e.target.value, false); if (v != null) onChange({ ...range, from: v, preset: "custom" }); }}
                style={{ font: "500 12px/1 var(--font-sans)", padding: "5px 7px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--paper-2)", color: "var(--ink)" }}/>
              <input type="date" value={cTo} onChange={e => { setCTo(e.target.value); const v = parseYMD(e.target.value, true); if (v != null) onChange({ ...range, to: v, preset: "custom" }); }}
                style={{ font: "500 12px/1 var(--font-sans)", padding: "5px 7px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--paper-2)", color: "var(--ink)" }}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Header({ user, tab, onNav, viewMode, setViewMode, dateRange, setDateRange, theme, setTheme, onOpenPalette, onNewBrief, defaultUsers, currentUser, onLogout }) {
  const isMobile = useIsMobile();
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const syncSecs = 22 + (tick % 60);
  const [userMenu, setUserMenu] = React.useState(false);

  // Mobil alt-sayfa başlığı: ana sekmeler (Özet/İşler/Profil/Markalar) logo gösterir;
  // diğer sayfalar (Tamamlanan/Ekip/Geçmiş…) logo yerine başlık + geri butonu (referans).
  const PRIMARY_TABS = ["overview", "jobs", "profile", "brand"];
  const SUB_TITLES = {};
  (NAV_SECTIONS || []).forEach(s => (s.items || []).forEach(it => { SUB_TITLES[it.id] = it.label; }));
  Object.assign(SUB_TITLES, { completed:"Tamamlanan", musteride:"Müşteride", "dept-comp":"Karşılaştırma", team:"Ekip", multi:"Sıralı işler" });
  const isSubPage = isMobile && tab && !PRIMARY_TABS.includes(tab);
  const pageTitle = SUB_TITLES[tab] || "";

  return (
    <header style={{
      height: isMobile ? 52 : 56,
      display: "flex", alignItems: "center", gap: isMobile ? 8 : 12,
      padding: isMobile ? "0 12px" : "0 20px 0 20px",
      background: "var(--paper)",
      borderBottom: "1px solid var(--line-strong)",
      flexShrink: 0,
      position: "sticky", top: 0, zIndex: 30,
    }}>
      {/* Mobil alt-sayfa: logo yerine geri butonu + sayfa başlığı (referans) */}
      {isSubPage ? (
        <div style={{display:"flex", alignItems:"center", gap:8, minWidth:0}}>
          <button onClick={() => onNav && onNav("overview")} aria-label="Geri" style={{
            width:34, height:34, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
            border:0, borderRadius:8, background:"transparent", color:"var(--ink-2)", cursor:"pointer",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span style={{font:"600 19px/1.1 var(--font-sans)", color:"var(--ink)", letterSpacing:"-0.01em", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{pageTitle}</span>
        </div>
      ) : (
        <a href="./index.html" title="Ana sayfa" style={{display:"flex", alignItems:"center", flexShrink:0, textDecoration:"none"}}>
          <img src="app/logo.png?v=2" alt="Benseno" style={{
            height: isMobile ? 34 : 44, width: "auto", objectFit: "contain",
            mixBlendMode: "multiply", flexShrink: 0,
          }}/>
        </a>
      )}

      <div style={{marginLeft: "auto", display: "flex", alignItems: "center", gap: isMobile ? 8 : 8}}>
        {/* Mobile: arama (hairline kutu) — referans header'da sağda */}
        {isMobile && (
          <button onClick={onOpenPalette} aria-label="Ara" style={{
            width: 38, height: 38, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid var(--line)", borderRadius: 10,
            background: "var(--surface)", color: "var(--ink-3)", cursor: "pointer",
          }}>
            <I.Search size={16}/>
          </button>
        )}

        {/* Sync pill — yalnız desktop (referans mobil header'da yok) */}
        {!isMobile && (
          <span title="Slack Canvas senkron" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            color: "var(--ink-4)",
            font: `500 11px/1 var(--font-sans)`, flexShrink: 0,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 999, background: "var(--ember)",
              animation: "bn-pulse 2.4s ease-in-out infinite", flexShrink: 0,
            }}/>
            {`Canlı · ${syncSecs}sn`}
          </span>
        )}

        {/* Tarih aralığı filtresi — global, açılışta son 30 gün (mobilde de korunur, ▾ kompakt) */}
        {dateRange && setDateRange && (
          <DateRangeControl range={dateRange} onChange={setDateRange}
            now={(window.BNS_DATA && window.BNS_DATA.NOW) || Date.now()} compact={isMobile}/>
        )}

        {/* View mode — hidden on mobile (bottom nav handles navigation) */}
        {!isMobile && (
          <div style={{display: "inline-flex", padding: 2, border: "1px solid var(--line)", borderRadius: 6, gap: 1}}>
            {[["mine", "Ben"], ["dept", "Dept"], ["all", "Tümü"]].map(([k, v]) => (
              <button key={k} onClick={() => setViewMode(k)} style={{
                font: `${viewMode === k ? 600 : 500} 11px/1 var(--font-sans)`, padding: "5px 10px",
                border: 0, background: viewMode === k ? "var(--paper-2)" : "transparent",
                color: viewMode === k ? "var(--ink)" : "var(--ink-4)",
                borderRadius: 4, cursor: "pointer",
                transition: "background 120ms cubic-bezier(0.2,0,0,1), color 120ms cubic-bezier(0.2,0,0,1)",
              }}>{v}</button>
            ))}
          </div>
        )}

        {/* Theme toggle — yalnız desktop (referans mobil header'da yok; mobilde Daha menüsünde) */}
        {!isMobile && (
          <button title={theme === "dark" ? "Aydınlık mod" : "Karanlık mod"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            style={{
              border: "1px solid var(--line)", background: "transparent",
              padding: "5px 6px", borderRadius: 6, color: "var(--ink-3)", cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              transition: "color 150ms, background 150ms",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--paper-2)"; e.currentTarget.style.color = "var(--ink)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-3)"; }}
          >
            {theme === "dark" ? <I.Sun size={14}/> : <I.Moon size={14}/>}
          </button>
        )}

        {/* Bildirimler artık Ody'ye taşındı (sağ-alt maskot) — üst menüde çan yok. */}

        {/* New brief — mobil: accent dolgulu + butonu (referans); desktop: etiketli buton */}
        {isMobile ? (
          <button onClick={onNewBrief} aria-label="Yeni brief" style={{
            width: 38, height: 38, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: 0, borderRadius: 10, background: "var(--ember)", color: "#fff",
            cursor: "pointer", boxShadow: "0 2px 6px -2px rgba(20,38,92,.35)",
          }}>
            <I.Plus size={18}/>
          </button>
        ) : (
          <Button kind="primary" size="sm" icon={<I.Plus size={12}/>} onClick={onNewBrief}>Yeni brief</Button>
        )}

        {/* User avatar + menu */}
        <div style={{position: "relative"}}>
          <button onClick={() => setUserMenu(v => !v)} style={{
            display: "inline-flex", alignItems: "center", gap: isMobile ? 0 : 7,
            padding: isMobile ? 0 : "3px 8px 3px 3px",
            border: isMobile ? 0 : "1px solid var(--line)",
            borderRadius: 999, background: "transparent", cursor: "pointer",
            transition: "background 120ms",
          }}
            onMouseEnter={e => { if (!isMobile) e.currentTarget.style.background = "var(--paper-2)"; }}
            onMouseLeave={e => { if (!isMobile) e.currentTarget.style.background = "transparent"; }}
          >
            <Avatar user={user} size={isMobile ? 34 : 22}/>
            {!isMobile && <span style={{font: "500 12px/1 var(--font-sans)", color: "var(--ink)"}}>{user.name.split(" ")[0]}</span>}
            {!isMobile && <I.ChevronDown size={10} style={{color: "var(--ink-4)"}}/>}
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
function MobileNav({ active, onChange, data, menuOpen: menuOpenProp, setMenuOpen: setMenuOpenProp }) {
  const [menuOpenInner, setMenuOpenInner] = React.useState(false);
  // menuOpen App'ten kontrol edilebilir (Ody'yi menü açıkken gizlemek için); yoksa iç state
  const menuOpen = menuOpenProp !== undefined ? menuOpenProp : menuOpenInner;
  const setMenuOpen = setMenuOpenProp || setMenuOpenInner;
  const alertCount = (data && data.briefs) ? data.briefs.filter(b => b.prio && (b.prio.code === "red" || b.prio.code === "over")).length : 0;

  const PRIMARY = [
    { id: "overview",  label: "Özet",     icon: "Home" },
    { id: "jobs",      label: "İşler",    icon: "Briefcase" },
    { id: "profile",   label: "Profil",   icon: "User" },
    { id: "brand",     label: "Markalar", icon: "Tag" },
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
        position: "fixed", left: 0, right: 0, bottom: menuOpen ? "calc(60px + env(safe-area-inset-bottom, 0px))" : "-100%",
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

      {/* FAB — Yeni brief (mobil-only native aksiyon butonu) */}
      <button onClick={() => window.openNewBriefModal && window.openNewBriefModal()}
        aria-label="Yeni brief" className="bns-fab" style={{
          position: "fixed", right: 16, zIndex: 79,
          bottom: "calc(60px + env(safe-area-inset-bottom, 0px) + 16px)",
          width: 56, height: 56, borderRadius: "50%", border: "none",
          background: "var(--ember)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 6px 16px -4px rgba(20,38,92,.45), 0 2px 6px rgba(0,0,0,.18)",
          cursor: "pointer",
        }}>
        <I.Plus size={24}/>
      </button>

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
              : <><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></>
            }
          </svg>
          <span style={{font:`${menuOpen ? 600 : 400} 9.5px/1 var(--font-sans)`}}>Daha</span>
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
        <a href="/benseno-tasarim-sistemi/docs/kullanim-klavuzu.html" target="_blank" rel="noopener noreferrer"
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

// A2HS — "Ana ekrana ekle" banner'ı (mobil). Android: beforeinstallprompt. iOS Safari: ipucu.
function InstallBanner() {
  const isMobile = typeof useIsMobile === "function" ? useIsMobile() : false;
  const [evt, setEvt] = React.useState(null);
  const [show, setShow] = React.useState(false);
  const [ios, setIos] = React.useState(false);
  React.useEffect(() => {
    try { if (localStorage.getItem("bns_a2hs") === "dismissed") return; } catch (e) {}
    const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone;
    if (standalone) return;
    const onBIP = (e) => { e.preventDefault(); setEvt(e); setShow(true); };
    window.addEventListener("beforeinstallprompt", onBIP);
    const ua = navigator.userAgent || "";
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|android/i.test(ua);
    if (isIOS && isSafari) { setIos(true); setShow(true); }
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);
  if (!isMobile || !show) return null;
  const dismiss = () => { setShow(false); try { localStorage.setItem("bns_a2hs", "dismissed"); } catch (e) {} };
  const install = async () => {
    if (!evt) return;
    evt.prompt();
    try { const r = await evt.userChoice; if (r && r.outcome === "accepted") localStorage.setItem("bns_a2hs", "dismissed"); } catch (e) {}
    setShow(false); setEvt(null);
  };
  return (
    <div style={{
      position: "fixed", left: 12, right: 12, zIndex: 78,
      bottom: "calc(60px + env(safe-area-inset-bottom, 0px) + 84px)",
      background: "var(--surface)", border: "1px solid var(--line-strong)",
      borderRadius: 14, boxShadow: "var(--shadow-lg)",
      padding: "12px 14px", display: "flex", alignItems: "center", gap: 12,
      animation: "bn-slide-up 260ms var(--ease-out-quart)",
    }}>
      <img src="app/icon-192.png" alt="" width="40" height="40" style={{ borderRadius: 9, flexShrink: 0 }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "600 13px/1.2 var(--font-sans)", color: "var(--ink)" }}>Benseno'yu ana ekrana ekle</div>
        <div style={{ font: "400 11px/1.35 var(--font-sans)", color: "var(--ink-3)", marginTop: 2 }}>
          {ios ? "Paylaş ⎙ → “Ana Ekrana Ekle”" : "Uygulama gibi tam ekran aç"}
        </div>
      </div>
      {!ios && (
        <button onClick={install} style={{
          flexShrink: 0, font: "600 12px/1 var(--font-sans)", color: "#fff",
          background: "var(--ember)", border: "none", borderRadius: 8, padding: "9px 14px", cursor: "pointer",
        }}>Ekle</button>
      )}
      <button onClick={dismiss} aria-label="Kapat" style={{
        flexShrink: 0, border: "none", background: "transparent", color: "var(--ink-4)",
        cursor: "pointer", padding: 6, display: "flex",
      }}><I.X size={16}/></button>
    </div>
  );
}

// Pull-to-refresh — sayfa tepesindeyken aşağı çek → window.bnsRefresh() (mobil)
function PullToRefresh() {
  const isMobile = typeof useIsMobile === "function" ? useIsMobile() : false;
  const startY = React.useRef(null);
  const pulling = React.useRef(false);
  const distRef = React.useRef(0);
  const refreshingRef = React.useRef(false);
  const [dist, setDist] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  React.useEffect(() => {
    if (!isMobile) return;
    const TH = 70, MAX = 100;
    const scroller = () => document.querySelector("main");
    const main = () => document.querySelector(".bns-main-content");
    const sTop = () => { const s = scroller(); return s ? s.scrollTop : 0; };
    const onStart = (e) => {
      if (refreshingRef.current || sTop() > 0) { startY.current = null; return; }
      startY.current = e.touches[0].clientY; pulling.current = false;
    };
    const onMove = (e) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 4 && sTop() <= 0) {
        pulling.current = true;
        const d = Math.min(MAX, dy * 0.5);
        distRef.current = d; setDist(d);
        const m = main(); if (m) m.style.transform = `translateY(${d}px)`;
        if (e.cancelable) e.preventDefault();
      }
    };
    const reset = (anim) => {
      const m = main();
      if (m) { if (anim) { m.style.transition = "transform 220ms var(--ease-out-quart)"; setTimeout(() => { m.style.transition = ""; }, 240); } m.style.transform = ""; }
      distRef.current = 0; setDist(0);
    };
    const onEnd = () => {
      if (!pulling.current) { startY.current = null; return; }
      if (distRef.current >= TH) {
        refreshingRef.current = true; setRefreshing(true);
        const m = main(); if (m) { m.style.transition = "transform 220ms var(--ease-out-quart)"; m.style.transform = "translateY(42px)"; }
        try { if (window.bnsRefresh) window.bnsRefresh(); } catch (e) {}
        setTimeout(() => { refreshingRef.current = false; setRefreshing(false); reset(true); }, 750);
      } else { reset(true); }
      startY.current = null; pulling.current = false;
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [isMobile]);
  if (!isMobile) return null;
  const show = dist > 2 || refreshing;
  return (
    <div style={{
      position: "fixed", top: "calc(50px + env(safe-area-inset-top, 0px))", left: 0, right: 0,
      display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 25,
      opacity: show ? 1 : 0, transition: "opacity 140ms",
      transform: `translateY(${Math.min(dist, 56)}px)`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", background: "var(--surface)",
        border: "1px solid var(--line)", boxShadow: "var(--shadow-1)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: "50%",
          border: "2px solid var(--line-strong)", borderTopColor: "var(--ember)",
          animation: refreshing ? "spin 0.6s linear infinite" : "none",
          transform: refreshing ? "none" : `rotate(${dist * 4}deg)`,
        }}/>
      </div>
    </div>
  );
}

window.PullToRefresh = PullToRefresh;
window.InstallBanner = InstallBanner;
window.Header = Header;
window.Sidebar = Sidebar;
window.MobileNav = MobileNav;
window.TabBar = TabBar;
window.NAV_SECTIONS = NAV_SECTIONS;
window.useIsMobile = useIsMobile;
