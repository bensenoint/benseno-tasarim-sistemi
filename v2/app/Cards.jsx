// app/Cards.jsx — Card / Kpi / PageHead (density-aware via CSS vars).

function Card({ children, style, padding, accent, hover }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <section
      onMouseEnter={() => hover && setHovered(true)}
      onMouseLeave={() => hover && setHovered(false)}
      style={{
        // Tam editoryal: KPI şeridiyle aynı malzeme — şeffaf zemin, köşesiz, hairline çerçeve, gölge yok
        background: "transparent",
        border: hovered ? "1px solid var(--line-strong)" : "1px solid var(--line)",
        borderRadius: 0,
        padding: padding === 0 ? 0 : (padding || "var(--card-pad)"),
        boxShadow: "none",
        transition: "border-color 200ms var(--ease-out-quart)",
        ...(accent ? { borderTop: `2px solid ${accent}` } : {}),
        ...style
      }}>
      {children}
    </section>
  );
}

function CardHead({ title, sub, action, style }) {
  return (
    <header style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12,
      marginBottom: 12, ...style
    }}>
      <div style={{minWidth: 0}}>
        <h2 style={{
          font: "italic 500 18px/1.15 var(--font-display)", color: "var(--ink)",
          margin: 0, letterSpacing: "0"
        }}>{title}</h2>
        {sub && <div style={{font: "400 12px/1.3 var(--font-sans)", color: "var(--ink-3)", marginTop: 4}}>{sub}</div>}
      </div>
      {action}
    </header>
  );
}

// Sayıyı 0'dan değerine bir kez sayar (mount'ta). reduced-motion'da veya sayısal değilse anında.
// Animasyon bitince null'a döner → canlı veri (poll güncellemeleri) doğrudan akar.
function CountUp({ value }) {
  const [disp, setDisp] = React.useState(null);
  const startedRef = React.useRef(false);
  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const m = String(value).match(/^([^\d-]*)(-?\d+)([^\d]*)$/);
    const rm = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!m || rm) return;                       // sayısal değil ya da reduced-motion → canlı değeri göster
    const pre = m[1], target = parseInt(m[2], 10), suf = m[3];
    let raf, t0;
    const tick = (now) => {
      if (!t0) t0 = now;
      const p = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - p, 3);
      if (p < 1) { setDisp(pre + Math.round(target * e) + suf); raf = requestAnimationFrame(tick); }
      else setDisp(null);                       // bitti → canlı değer akar
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, []);
  return disp == null ? value : disp;
}

// KPI kartları için merkezi açıklama sözlüğü — fareyle üzerine gelince "neyi gösteriyor" tooltip'i.
// Açık `title` prop'u verilirse o öncelikli; yoksa label'a göre (gerekirse " · " ekinden arındırılmış) eşleşir.
const KPI_HINTS = {
  // Durum / sayım kartları
  "Aktif brief": "Şu an aktif olan brief sayısı (anlık; müşteride ve tamamlanmış hariç).",
  "Aktif iş": "Seçili dönemde aktif olmuş benzersiz iş.",
  "Aktif işler": "Seçili tarih aralığında bir an aktif olmuş benzersiz iş (dönemsel; müşteride + tamamlanmış hariç).",
  "Aktif": "Aktif (devam eden) iş sayısı.",
  "Müşteride": "Müşteri onayında bekleyen işler.",
  "Müşteriye Yollandı": "Müşteriye gönderilip onay bekleyen işler.",
  "Onay bekleyen": "Müşteri onayı bekleyen işler.",
  "Geciken": "Teslim tarihi geçmiş (geciken) işler.",
  "Gecikmiş": "Teslim tarihi geçmiş işler.",
  "Bugün teslim": "Teslim tarihi bugün olan işler.",
  "Bugün": "Bugüne ait / bugün teslimi olan işler.",
  "Bu hafta": "Bu hafta teslimi olan işler.",
  "İncelemede": "İnceleme aşamasındaki işler.",
  "İş Kabulü / İş planında": "İş planına alınmış, henüz başlanmamış işler.",
  "İş planında": "İş planına alınmış, henüz başlanmamış işler.",
  "Beklemede": "Beklemeye alınmış işler.",
  "Bekliyor": "Beklemeye alınmış işler.",
  "Müşteri onayı": "Müşteri onayında bekleyen işler.",
  "Blokeli": "Engellenmiş (blokeli) işler.",
  "Revizyon": "Revizyon aşamasındaki işler.",
  "Yeni": "Yeni açılmış, henüz işlenmemiş işler.",
  "İşe başlandı": "Üzerinde çalışılmaya başlanan işler.",
  "Yeniden açıldı": "Tamamlandıktan sonra yeniden açılan işler.",
  "Tamamlandı": "Seçili dönemde tamamlanan işler.",
  "Tamamlanan": "Seçili dönemde tamamlanan işler.",
  "Hareketsiz": "Uzun süredir hareket görmeyen (atıl) işler.",
  "Hareketsiz brief": "Uzun süredir hareket görmeyen (atıl) brief'ler.",
  "Acil": "Önceliği ACİL olan işler.",
  "Acil / geçmiş": "Acil veya teslim tarihi geçmiş işler.",
  "Yüksek": "Önceliği YÜKSEK olan işler.",
  "Normal": "Önceliği NORMAL olan işler.",
  "Düşük": "Önceliği DÜŞÜK olan işler.",
  "Termin riski": "Teslime az kalmış, gecikme riski taşıyan işler.",
  "Müşteri dönüşü": "Müşteri dönüşü bekleyen işler.",
  // Kişi / kapasite
  "Kapasite": "Doluluk oranı (%) — aktif yük / kapasite.",
  "En yoğun": "En çok aktif işi olan kişi/departman.",
  "Kişi": "Bu gruptaki farklı kişi sayısı.",
  "Contributor": "Katkı veren (contributor) olarak yer alınan işler.",
  "Lead olarak": "Lead (sorumlu) olarak yürütülen işler.",
  // Marka
  "Marka": "Bu gruptaki farklı marka sayısı.",
  "Toplam marka": "Toplam marka sayısı.",
  "Sorunlu marka": "En çok geciken / sorunlu marka.",
  "Ort. brief/marka": "Marka başına ortalama brief sayısı.",
  // Süre / ortalama
  "Ort. süre": "İş başına ortalama çalışma süresi.",
  "Ort. tamamlama": "Ortalama tamamlanma süresi.",
  "Ortalama tamamlama": "Ortalama tamamlanma süresi.",
  "Ort. gecikme": "Geciken işlerde ortalama gecikme.",
  "Ort. bekleme": "Ortalama bekleme (müşteride/duraklatma) süresi.",
  "Ort. puan": "Tamamlanan işlerin ortalama puanı (1–5).",
  "Ort. revize": "İş başına ortalama revize sayısı.",
  "Ort. revize/iş": "İş başına ortalama revize sayısı.",
  "Ort. açık yaş": "İşlerin açılışından bu yana geçen ortalama süre.",
  "Ort. süredir": "İşlerin mevcut durumda kalma süresi (ortalama).",
  "Ort. müşteride": "Müşteride ortalama bekleme süresi.",
  "Ort. kalan": "Teslime ortalama kalan süre.",
  "En çok geciken": "En fazla geciken işin gecikme süresi.",
  "En uzun bekleyen": "Müşteride en uzun süredir bekleyen iş.",
  "Çıktı hızı": "Birim zamanda tamamlanan iş (üretim hızı).",
  // Revize / gönderim / toplam
  "Toplam revize": "Toplam revize sayısı.",
  "Tamamlanan rev.": "Tamamlanan işlerdeki toplam revize.",
  "Aktif iş rev.": "Aktif işlerdeki toplam revize.",
  "İç revize": "Müşteriye gitmeden yapılan revizeler.",
  "Müşteri revize": "Müşteri dönüşüyle yapılan revizeler.",
  "Revize oranı": "Revize alan işlerin oranı.",
  "Toplam gönderim": "Müşteriye toplam gönderim sayısı.",
  "Toplam saat": "Toplam çalışma saati.",
  "Toplam": "Toplam (saat).",
  "Adet": "Bu gruptaki iş sayısı.",
  "Uzatılmış": "Termini uzatılmış işler.",
  "Uzatılarak": "Termini uzatılarak teslim edilen işlerin oranı.",
  "Zamanında": "Zamanında teslim edilen işlerin oranı.",
  // Finans / teslim
  "Fatura kesildi": "Faturası kesilen işler.",
  "Ödeme yapıldı": "Ödemesi yapılan işler.",
  "Final teslim (galeri)": "Galeriye final teslim edilen işler.",
  "Sıralı iş": "Sıralı (zincir) akışlı işler.",
  "Benseno (tüm firma)": "Tüm firma geneli özet.",
};
try { window.BNS_KPI_HINTS = KPI_HINTS; } catch (e) {}
function kpiHint(label) {
  if (!label) return undefined;
  return KPI_HINTS[label] || KPI_HINTS[String(label).split(" · ")[0].trim()] || undefined;
}

// Kpi has three variants: "plain" | "trendchart" | "hero"
function Kpi({ label, value, color, trend, sub, variant = "trendchart", spark, accent, onClick, active, emphasis, tint, title }) {
  const [hov, setHov] = React.useState(false);
  // Determine left-border accent color from color prop or trend
  const borderAccent = accent || color || null;
  const tip = title || kpiHint(label);
  return (
    <div
      title={tip || undefined}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      style={{
        // Editoryal stat-ızgara hücresi: kart değil; hairline çizgiler KpiGrid + hücre kenarından.
        // Semantik renk/accent taşıyan hücreler çok hafif ton yıkaması alır (monotonluğu kırar, nötr hücreler temiz kalır).
        background: emphasis && tint ? tint
          : hov ? "var(--paper-2)"
          : borderAccent ? `color-mix(in srgb, ${borderAccent} 8%, var(--paper))`
          : "transparent",
        borderRight: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
        outline: active ? "2px solid var(--ember)" : "none",
        outlineOffset: -2,
        padding: "18px 18px 16px",
        display: "flex", flexDirection: "column", gap: 8, minWidth: 0,
        position: "relative",
        cursor: onClick ? "pointer" : "default",
        transition: "background 160ms var(--ease-out-quart)",
      }}>
      <div style={{
        font: "600 10px/1 var(--font-sans)", color: "var(--ink-3)",
        letterSpacing: "0.08em", textTransform: "uppercase",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        position: "relative",
      }}>{label}</div>
      <div style={{
        font: `500 ${variant === "hero" ? 56 : "var(--kpi-fs)"}/1 var(--font-display)`,
        color: color || "var(--ink)",
        letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums",
        position: "relative",
      }}><CountUp value={value}/></div>

      {variant === "trendchart" && spark && (
        <Sparkline points={spark} color={color || "var(--ember)"}/>
      )}

      {(trend || sub) && (
        <div style={{
          display:"flex", alignItems:"center", gap:5,
          font:"500 11px/1.2 var(--font-sans)", whiteSpace:"nowrap",
          overflow:"hidden", textOverflow:"ellipsis",
          position:"relative", marginTop: 2,
        }}>
          {trend && (
            <span style={{
              display:"inline-flex", alignItems:"center", gap:3,
              color: trend.dir === "up" ? (trend.bad ? "var(--danger)" : "var(--success)")
                   : trend.dir === "down" ? (trend.good ? "var(--success)" : "var(--danger)")
                   : "var(--ink-4)",
              fontWeight: 600, fontSize: 11,
              flexShrink: 0,
            }}>
              {trend.dir === "up" ? "↑" : trend.dir === "down" ? "↓" : "→"} {trend.value}
            </span>
          )}
          {sub && !trend && <span style={{color:"var(--ink-4)", overflow:"hidden", textOverflow:"ellipsis", fontSize:11}}>{sub}</span>}
        </div>
      )}
    </div>
  );
}

function Sparkline({ points, color = "var(--ember)", w = 100, h = 32 }) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const pad = 2;
  const dx = (w - pad * 2) / (points.length - 1 || 1);
  // Smooth bezier curve
  const coords = points.map((p, i) => ({
    x: pad + i * dx,
    y: pad + (h - pad * 2) - ((p - min) / span) * (h - pad * 2)
  }));
  let path = `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  for (let i = 1; i < coords.length; i++) {
    const cx = (coords[i-1].x + coords[i].x) / 2;
    path += ` C${cx.toFixed(1)},${coords[i-1].y.toFixed(1)} ${cx.toFixed(1)},${coords[i].y.toFixed(1)} ${coords[i].x.toFixed(1)},${coords[i].y.toFixed(1)}`;
  }
  const last = coords[coords.length - 1];
  const area = path + ` L${last.x.toFixed(1)},${(h).toFixed(1)} L${pad},${(h).toFixed(1)} Z`;
  const gradId = `sg-${Math.round(Math.random()*99999)}`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{display:"block", marginTop:2}}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.09"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`}/>
      <path d={path} stroke={color} strokeWidth="1.25" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
      {/* Last point dot */}
      <circle cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="2" fill={color}/>
    </svg>
  );
}

function PageHead({ title, subtitle, actions, eyebrow, lead }) {
  return (
    <header className="bns-pagehead" style={{
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      gap: 16, padding: "24px 0 18px", flexWrap: "wrap",
      borderBottom: "1px solid var(--line-strong)", marginBottom: 4,
    }}>
      <div style={{minWidth: 0, flex: "0 1 auto"}}>
        {lead}
        {eyebrow && <div className="bns-ph-eyebrow" style={{
          font: "italic 400 15px/1 var(--font-display)", color:"var(--ink-3)",
          marginBottom: 12,
        }}>{eyebrow}</div>}
        <h1 style={{
          fontFamily: "var(--font-display)", fontStyle: "italic",
          fontWeight: 400, fontSize: "clamp(34px, 4.5vw, 50px)", lineHeight: 1.04, color: "var(--ink)",
          margin: 0, letterSpacing: "-0.02em", textWrap: "balance",
        }}>{title}</h1>
        {subtitle && (
          <div className="bns-ph-sub" style={{
            fontFamily: "var(--font-sans)",
            fontSize: 14, lineHeight: 1.6, color: "var(--ink-3)", marginTop: 12, maxWidth: "52ch",
            fontStyle: "normal", fontWeight: 400,
          }}>{subtitle}</div>
        )}
      </div>
      {actions && <div style={{display:"flex", gap:8, alignItems:"center", flexShrink:0, flexWrap:"wrap"}}>{actions}</div>}
    </header>
  );
}

// MobileAccordion — mobilde uzun değerlendirme yazılarını katlar; desktop'ta içerik aynen (web değişmez).
function MobileAccordion({ title, children, defaultOpen }) {
  const isMobile = typeof useIsMobile === "function" ? useIsMobile() : false;
  const [open, setOpen] = React.useState(!!defaultOpen);
  if (!isMobile) return children;
  return (
    <div style={{ border: "1px solid var(--line)", marginBottom: 12, background: "var(--surface)", flex: "1 1 100%", width: "100%", minWidth: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8, padding: "11px 14px", background: "transparent", border: 0, cursor: "pointer", textAlign: "left",
      }}>
        <span style={{ font: "600 12px/1 var(--font-sans)", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-3)" }}>{title}</span>
        <span style={{ display: "inline-flex", transform: open ? "rotate(180deg)" : "none", transition: "transform 180ms", color: "var(--ink-4)" }}><I.ChevronDown size={15}/></span>
      </button>
      {open && <div style={{ padding: "0 14px 14px" }}>{children}</div>}
    </div>
  );
}

// SectionTitle — small headers used inside screens
function SectionTitle({ children, action, sub }) {
  return (
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", margin:"0 0 12px"}}>
      <div>
        <h3 style={{font:"600 13px/1 var(--font-sans)", color:"var(--ink-3)", letterSpacing:"0.06em", textTransform:"uppercase", margin:0}}>{children}</h3>
        {sub && <div style={{font:"400 12px/1 var(--font-sans)", color:"var(--ink-4)", marginTop: 5}}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}

window.Card = Card;
window.CardHead = CardHead;
window.Kpi = Kpi;
window.PageHead = PageHead;
window.Sparkline = Sparkline;
window.SectionTitle = SectionTitle;
window.MobileAccordion = MobileAccordion;

// BriefActions — permission-gated action buttons for a brief (başla / ilerlet / termin / hatırlat)
function BriefActions({ brief, currentUser, onStatusChange, onRemind, compact }) {
  const p = (typeof bnsBriefActionPerms === "function")
    ? bnsBriefActionPerms(brief, currentUser || {}) : { basla:false, ilerlet:false, termin:false, hatirlat:false };
  const [busy, setBusy] = React.useState(false);
  if (!p.basla && !p.ilerlet && !p.termin && !p.hatirlat) return null;
  const apiBase = (typeof window.BNS_API_BASE === "string" && window.BNS_API_BASE) ? window.BNS_API_BASE.replace(/\/+$/, "") : "https://benseno-api-production.up.railway.app";
  const tok = (typeof localStorage !== "undefined" && localStorage.getItem("bns_token")) || "";
  const Btn = ({ on, label, ic }) => (
    <button disabled={busy} onClick={(e) => { e.stopPropagation(); on(); }}
      style={{ display:"inline-flex", alignItems:"center", gap:4, font:"600 11px/1 var(--font-sans)",
        padding: compact ? "4px 7px" : "6px 10px", border:"1px solid var(--line)", borderRadius:6,
        background:"var(--paper-2)", color:"var(--ink-2)", cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1 }}>
      {ic} {label}
    </button>
  );
  const advance = (s) => { if (typeof onStatusChange === "function") onStatusChange(brief, s); };
  const termin = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/api/briefs/${brief.id}/termin-oneri-uzat`, { method:"POST",
        headers:{ "content-type":"application/json", ...(tok?{Authorization:"Bearer "+tok}:{}) },
        body: JSON.stringify({ by: currentUser && currentUser.slack_id }) });
      // res.ok kontrolü — hata dönerse sahte başarı toast'ı basma (BriefDrawer terminOneri deseni)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        window.bnsToast && window.bnsToast("⚠ Termin uzatılamadı: " + (j.error || res.status));
      } else {
        window.bnsToast && window.bnsToast("⏱️ Termin uzatıldı"); window.bnsRefresh && window.bnsRefresh();
      }
    } catch (e) { window.bnsToast && window.bnsToast("⚠ Termin uygulanamadı"); }
    setBusy(false);
  };
  const remind = async () => {
    setBusy(true);
    try { if (typeof onRemind === "function") await onRemind(brief); } finally { setBusy(false); }
  };
  // İlerlet: hangi statüye gideceğini etikette göster.
  const NEXT_TR = { calisiliyor:"İş planı", basladi:"Başladı", incelemede:"İnceleme", tamamlandi:"Tamamlandı" };
  const nextS = BNS_NEXT_STATUS[brief.durum];
  const ilerletLabel = nextS ? `İlerlet → ${NEXT_TR[nextS] || nextS}` : "İlerlet";
  // Termini uzat: eklenecek süreyi (termin_oneri_ms) etikette göster.
  const fmtUz = (ms) => {
    if (!ms) return "";
    const g = ms / 86400000; if (g >= 1) return ` +${Math.round(g)}g`;
    const s = ms / 3600000;  if (s >= 1) return ` +${Math.round(s)}sa`;
    return ` +${Math.round(ms / 60000)}dk`;
  };
  const uzatLabel = `Termini uzat${fmtUz(brief.termin_oneri_ms)}`;
  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
      {p.basla    && <Btn on={() => advance("basladi")} label="Başladım" ic="🚀"/>}
      {p.ilerlet  && <Btn on={() => advance(nextS)} label={ilerletLabel} ic="⏭️"/>}
      {p.termin   && <Btn on={termin} label={uzatLabel} ic="⏱️"/>}
      {p.hatirlat && <Btn on={remind} label="Hatırlat" ic="🔔"/>}
    </div>
  );
}
window.BriefActions = BriefActions;

// ─── Kapasite v2 arşiv trendi (ortak) — saatlik kapasite_snapshot → gün ortalaması ───
// scope: 'firma' | 'dept:tasarim' | 'kisi:U...'. Veri geldikçe kendiliğinden dolar;
// <3 gün veri varken "birikiyor" durumu gösterir. Firma/dept/kişi ekranları aynı bileşeni kullanır.
function V2ArsivTrend({ scope, baslik }) {
  const [rows, setRows] = React.useState(null); // null=yükleniyor, []=yok/erişilemedi
  React.useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const j = (typeof window.bnsApiGet === "function")
          ? await window.bnsApiGet(`/api/kapasite-arsiv?scope=${encodeURIComponent(scope)}&days=30`) : null;
        if (!iptal) setRows((j && j.rows) || []);
      } catch (e) { if (!iptal) setRows([]); }
    })();
    return () => { iptal = true; };
  }, [scope]);
  if (rows == null) return null;
  const gunler = {};
  rows.forEach(r => {
    const g = (typeof bnsGunKey === "function") ? bnsGunKey(Date.parse(r.ts)) : String(r.ts).slice(0, 10);
    (gunler[g] = gunler[g] || []).push(r.pct);
  });
  const seri = Object.keys(gunler).sort().map(g => ({
    gun: g, pct: Math.round(gunler[g].reduce((a, x) => a + x, 0) / gunler[g].length) })).slice(-30);
  const az = seri.length < 3;
  const son = seri.length ? seri[seri.length - 1].pct : null;
  const min = seri.length ? Math.min(...seri.map(x => x.pct)) : 0;
  const max = seri.length ? Math.max(...seri.map(x => x.pct)) : 0;
  const renk = (p) => p >= 120 ? "var(--prio-red)" : p >= 100 ? "var(--prio-orange)" : "var(--ok, #2E8F66)";
  // Kompakt tek satır: başlık · sparkline · güncel değer. (Eski çubuk grafik çok yer kaplıyordu.)
  const W = 200, Hh = 38, tavan = Math.max(130, max + 10);
  const pt = (x, i) => `${(i / Math.max(1, seri.length - 1)) * W},${Hh - (x.pct / tavan) * Hh}`;
  const cizgi = seri.map(pt).join(" ");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 14px", marginBottom: "var(--grid-gap)",
      border: "1px solid var(--line)", borderRadius: 10, background: "var(--paper)", flexWrap: "wrap" }}>
      <span style={{ font: "600 11px/1 var(--font-sans)", color: "var(--ink-3)", flexShrink: 0 }}>{baslik || "Doluluk trendi"}</span>
      {az ? (
        <span style={{ font: "400 11px/1.4 var(--font-sans)", color: "var(--ink-4)" }}>
          veri birikiyor{seri.length ? ` (${seri.length} gün)` : ""}</span>
      ) : (
        <React.Fragment>
          <div style={{ flex: 1, minWidth: 120, position: "relative", height: Hh + 12, padding: "6px 0" }}>
          <svg viewBox={`0 0 ${W} ${Hh}`} preserveAspectRatio="none"
            style={{ width: "100%", height: Hh, display: "block", opacity: .95 }}>
            {/* %100 eşik çizgisi */}
            <line x1="0" x2={W} y1={Hh - (100 / tavan) * Hh} y2={Hh - (100 / tavan) * Hh}
              stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke"/>
            <polyline points={`0,${Hh} ${cizgi} ${W},${Hh}`} fill={renk(son)} opacity="0.10" stroke="none"/>
            <polyline points={cizgi} fill="none" stroke={renk(son)} strokeWidth="1.8"
              strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
            <circle cx={W} cy={Hh - (son / tavan) * Hh} r="2.6" fill={renk(son)}/>
          </svg>
          {(() => {
            // Değer etiketleri HTML katmanında (SVG preserveAspectRatio=none metni yatay eziyordu).
            const yPct = (v) => (1 - v / tavan) * 100;
            const iMin = seri.findIndex(x => x.pct === min), iMax = seri.findIndex(x => x.pct === max);
            const xPct = (i) => (i / Math.max(1, seri.length - 1)) * 100;
            const ilk = seri[0].pct;
            const ler = [
              { x: 0, v: ilk, ust: yPct(ilk) > 40 },
              { x: 100, v: son, ust: yPct(son) > 40 },
              ...(min !== ilk && min !== son ? [{ x: xPct(iMin), v: min, ust: false }] : []),
              ...(max !== ilk && max !== son && max !== min ? [{ x: xPct(iMax), v: max, ust: true }] : []),
            ];
            const seen = new Set();
            return ler.filter(e => { const k = e.v + ":" + Math.round(e.x / 14); if (seen.has(k)) return false; seen.add(k); return true; })
              .map((e, i) => (
                <span key={i} style={{ position: "absolute", left: e.x + "%", top: e.ust ? 0 : "auto", bottom: e.ust ? "auto" : 0,
                  transform: "translateX(" + (e.x < 8 ? "0" : e.x > 92 ? "-100%" : "-50%") + ")",
                  font: "600 8.5px/1 var(--font-mono)", color: "var(--ink-4)", pointerEvents: "none", whiteSpace: "nowrap" }}>%{e.v}</span>
              ));
          })()}
          </div>
          <span title={`son 30 gün · en düşük %${min} · en yüksek %${max}`}
            style={{ font: "600 12px/1 var(--font-mono)", color: renk(son), flexShrink: 0 }}>%{son}</span>
          <span style={{ font: "400 10px/1 var(--font-sans)", color: "var(--ink-4)", flexShrink: 0 }}>%{min}–%{max} · 30g</span>
        </React.Fragment>
      )}
    </div>
  );
}
window.V2ArsivTrend = V2ArsivTrend;
