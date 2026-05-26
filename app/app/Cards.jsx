// app/Cards.jsx — Card / Kpi / PageHead (density-aware via CSS vars).

function Card({ children, style, padding, accent }) {
  return (
    <section style={{
      background: "var(--surface)",
      border: "1px solid var(--line)",
      borderRadius: 12,
      padding: padding === 0 ? 0 : (padding || "var(--card-pad)"),
      boxShadow: "var(--shadow-card)",
      transition: "box-shadow 200ms",
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
          font: "600 15px/1.2 var(--font-sans)", color: "var(--ink)",
          margin: 0, letterSpacing: "-0.005em"
        }}>{title}</h2>
        {sub && <div style={{font: "400 12px/1.3 var(--font-sans)", color: "var(--ink-3)", marginTop: 4}}>{sub}</div>}
      </div>
      {action}
    </header>
  );
}

// Kpi has three variants: "plain" | "trendchart" | "hero"
function Kpi({ label, value, color, trend, sub, variant = "plain", spark, accent }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--line)",
      borderRadius: 12,
      padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 8, minWidth: 0,
      position: "relative", overflow: "hidden",
      boxShadow: "var(--shadow-card)",
      ...(accent ? { borderTop: `2px solid ${accent}` } : {})
    }}>
      <div style={{
        font: "600 10px/1 var(--font-sans)", color: "var(--ink-3)",
        letterSpacing: "0.07em", textTransform: "uppercase",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
      }}>{label}</div>
      <div style={{
        font: `600 ${variant === "hero" ? 56 : "var(--kpi-fs)"} /1 var(--font-sans)`,
        color: color || "var(--ink)",
        letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums"
      }}>{value}</div>

      {variant === "trendchart" && spark && (
        <Sparkline points={spark} color={color || "var(--ink-2)"}/>
      )}

      {(trend || sub) && (
        <div style={{
          display:"flex", alignItems:"center", gap:6,
          font:"500 12px/1.2 var(--font-sans)", whiteSpace:"nowrap",
          overflow:"hidden", textOverflow:"ellipsis"
        }}>
          {trend && (
            <span style={{
              color: trend.dir === "up" ? (trend.bad ? "var(--danger)" : "var(--success)")
                   : trend.dir === "down" ? (trend.good ? "var(--success)" : "var(--danger)")
                   : "var(--ink-3)",
              flexShrink: 0
            }}>
              {trend.dir === "up" ? "▲" : trend.dir === "down" ? "▼" : "▬"} {trend.value}
            </span>
          )}
          {sub && <span style={{color:"var(--ink-4)", overflow:"hidden", textOverflow:"ellipsis"}}>{sub}</span>}
        </div>
      )}
    </div>
  );
}

function Sparkline({ points, color = "var(--ink-2)", w = 100, h = 28 }) {
  if (!points || points.length === 0) return null;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const dx = w / (points.length - 1 || 1);
  const path = points.map((p, i) => {
    const x = i * dx, y = h - ((p - min) / span) * h;
    return (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  const area = path + ` L${w},${h} L0,${h} Z`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{display:"block"}}>
      <path d={area} fill={color} opacity="0.10"/>
      <path d={path} stroke={color} strokeWidth="1.4" fill="none" strokeLinejoin="round"/>
    </svg>
  );
}

function PageHead({ title, subtitle, actions, eyebrow }) {
  return (
    <header style={{
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      gap: 16, padding: "20px 0 14px", flexWrap: "wrap"
    }}>
      <div style={{minWidth: 0, flex: "0 1 auto"}}>
        {eyebrow && <div style={{
          font: "600 11px/1 var(--font-sans)", color:"var(--ink-3)",
          letterSpacing:"0.08em", textTransform:"uppercase", marginBottom: 6
        }}>{eyebrow}</div>}
        <h1 style={{
          fontFamily: "var(--font-display)", fontStyle: "italic",
          fontWeight: 400, fontSize: 28, lineHeight: 1.15, color: "var(--ink)",
          margin: 0, letterSpacing: "-0.01em"
        }}>{title}</h1>
        {subtitle && (
          <div style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13, lineHeight: 1.45, color: "var(--ink-3)", marginTop: 5,
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
