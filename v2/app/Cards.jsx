// app/Cards.jsx — Card / Kpi / PageHead (density-aware via CSS vars).

function Card({ children, style, padding, accent, hover }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <section
      onMouseEnter={() => hover && setHovered(true)}
      onMouseLeave={() => hover && setHovered(false)}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: padding === 0 ? 0 : (padding || "var(--card-pad)"),
        boxShadow: hovered ? "var(--shadow-2)" : "var(--shadow-card)",
        transform: hovered ? "translateY(-1px)" : "none",
        transition: "box-shadow 200ms var(--ease-out-quart), transform 200ms var(--ease-out-quart)",
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
          font: "500 17px/1.2 var(--font-display)", color: "var(--ink)",
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

// Kpi has three variants: "plain" | "trendchart" | "hero"
function Kpi({ label, value, color, trend, sub, variant = "trendchart", spark, accent, onClick, active, emphasis, tint }) {
  const [hov, setHov] = React.useState(false);
  // Determine left-border accent color from color prop or trend
  const borderAccent = accent || color || null;
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      style={{
        background: emphasis && tint ? tint : "var(--surface)",
        border: emphasis && borderAccent ? `1px solid ${borderAccent}` : "1px solid var(--line)",
        outline: active ? "2px solid var(--ember)" : "none",
        outlineOffset: -2,
        borderRadius: 12,
        padding: "14px 16px 12px",
        display: "flex", flexDirection: "column", gap: 6, minWidth: 0,
        position: "relative", overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        boxShadow: hov ? "var(--shadow-2)" : "var(--shadow-card)",
        transform: hov ? "translateY(-1px)" : "none",
        transition: "box-shadow 180ms var(--ease-out-quart), transform 180ms var(--ease-out-quart)",
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
              padding:"2px 6px", borderRadius:4,
              background: trend.dir === "up" ? (trend.bad ? "var(--prio-red-bg)" : "var(--prio-green-bg)")
                        : trend.dir === "down" ? (trend.good ? "var(--prio-green-bg)" : "var(--prio-red-bg)")
                        : "var(--paper-2)",
              color: trend.dir === "up" ? (trend.bad ? "var(--danger)" : "var(--success)")
                   : trend.dir === "down" ? (trend.good ? "var(--success)" : "var(--danger)")
                   : "var(--ink-4)",
              fontWeight: 600, fontSize: 10,
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
          <stop offset="0%" stopColor={color} stopOpacity="0.18"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`}/>
      <path d={path} stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
      {/* Last point dot */}
      <circle cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="2.5" fill={color} opacity="0.9"/>
    </svg>
  );
}

function PageHead({ title, subtitle, actions, eyebrow }) {
  return (
    <header style={{
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      gap: 16, padding: "24px 0 18px", flexWrap: "wrap",
      borderBottom: "1px solid var(--line-soft)", marginBottom: 4,
    }}>
      <div style={{minWidth: 0, flex: "0 1 auto"}}>
        {eyebrow && <div style={{
          display:"inline-flex", alignItems:"center", gap:6,
          font: "600 10px/1 var(--font-sans)", color:"var(--ink-4)",
          letterSpacing:"0.10em", textTransform:"uppercase", marginBottom: 8,
          padding:"3px 8px", borderRadius:4,
          background:"var(--paper-2)", border:"1px solid var(--line)",
        }}>{eyebrow}</div>}
        <h1 style={{
          fontFamily: "var(--font-display)", fontStyle: "italic",
          fontWeight: 400, fontSize: 34, lineHeight: 1.1, color: "var(--ink)",
          margin: 0, letterSpacing: "-0.015em"
        }}>{title}</h1>
        {subtitle && (
          <div style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13, lineHeight: 1.5, color: "var(--ink-3)", marginTop: 6,
            fontStyle: "normal", fontWeight: 400,
          }}>{subtitle}</div>
        )}
      </div>
      {actions && <div style={{display:"flex", gap:8, alignItems:"center", flexShrink:0, flexWrap:"wrap"}}>{actions}</div>}
    </header>
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
