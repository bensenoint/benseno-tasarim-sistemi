// ui_kits/dashboard/Atoms.jsx — chip/badge/avatar primitives.
// Depends on Icons.jsx (window.I).

const PRIO_GLYPH = {
  red:  <I.Triangle/>,
  over: <I.Triangle/>,
  org:  <I.Square/>,
  ylw:  <I.Circle/>,
  grn:  <I.CheckMini/>
};
const PRIO_BG = {
  over: "var(--prio-red)", red: "var(--prio-red-bg)",
  org:  "var(--prio-orange-bg)", ylw: "var(--prio-yellow-bg)", grn: "var(--prio-green-bg)"
};
const PRIO_FG = {
  over: "#fff", red: "var(--prio-red)",
  org:  "var(--prio-orange)", ylw: "var(--prio-yellow)", grn: "var(--prio-green)"
};

function formatDelta(h) {
  if (h <= 0) return Math.round(-h) + " sa gecikti";
  if (h <= 8) return Math.round(h) + " sa";
  if (h <= 48) return Math.round(h) + " sa";
  return Math.round(h / 24) + " gün";
}

function PriorityBadge({ p, deltaH, compact }) {
  const label = deltaH === null
    ? (compact ? "zamanında" : `${p.label}`)
    : (compact ? formatDelta(deltaH) : `${p.label} · ${formatDelta(deltaH)}`);
  return (
    <span className="bn-prio" style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 8px 3px 6px", borderRadius: 999,
      fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
      letterSpacing: "0.04em", textTransform: "uppercase",
      background: PRIO_BG[p.code], color: PRIO_FG[p.code], whiteSpace: "nowrap"
    }}>
      <span style={{display:"inline-flex", alignItems:"center", color: PRIO_FG[p.code]}}>
        {PRIO_GLYPH[p.code]}
      </span>
      {label}
    </span>
  );
}

function BrandChip({ brand, size = "md" }) {
  if (!brand) return null;
  const small = size === "sm";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: small ? "2px 7px 2px 4px" : "3px 9px 3px 5px",
      borderRadius: 999, background: "var(--surface)",
      border: "1px solid var(--line)",
      fontFamily: "var(--font-sans)", fontSize: small ? 11 : 12, fontWeight: 500,
      color: "var(--ink)", whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis"
    }}>
      <span style={{width:8, height:8, borderRadius:999, background: brand.color, flexShrink:0}}/>
      {brand.name}
    </span>
  );
}

function Avatar({ user, size = 22, borderColor }) {
  if (!user) return null;
  const wheel = ["#4E79A7","#F28E2B","#59A14F","#B07AA1","#76B7B2","#E15759","#EDC948","#9C755F","#BAB0AC","#2C7FB8","#D9881F","#6A8E3D","#8E5BA1","#00786F","#C44545","#B79100"];
  // Pick from user id hash
  let h = 0; for (let i = 0; i < user.id.length; i++) { h = ((h<<5)-h) + user.id.charCodeAt(i); h |= 0; }
  const c = wheel[Math.abs(h) % wheel.length];
  return (
    <span title={user.name} style={{
      width: size, height: size, borderRadius: 999,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: Math.round(size * 0.42),
      color: "#fff", background: c,
      border: borderColor ? `2px solid ${borderColor}` : "none",
      flexShrink: 0
    }}>{user.mono}</span>
  );
}

function AvatarStack({ users, max = 3, size = 22 }) {
  const shown = users.slice(0, max);
  const overflow = users.length - shown.length;
  return (
    <span style={{display: "inline-flex"}}>
      {shown.map((u, i) => (
        <span key={u.id} style={{marginLeft: i ? -8 : 0}}>
          <Avatar user={u} size={size} borderColor="var(--surface)"/>
        </span>
      ))}
      {overflow > 0 && (
        <span style={{
          marginLeft: -8, width: size, height: size, borderRadius: 999,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: Math.round(size * 0.42),
          color: "var(--ink-3)", background: "var(--paper-2)",
          border: "2px solid var(--surface)"
        }}>+{overflow}</span>
      )}
    </span>
  );
}

function StatusPill({ status }) {
  const map = {
    yeni:        { color: "var(--ink-4)",    label: "Yeni" },
    calisiliyor: { color: "var(--info)",     label: "Çalışılıyor" },
    incelemede:  { color: "var(--warning)",  label: "İncelemede" },
    blokeli:     { color: "var(--danger)",   label: "Blokeli" },
    tamamlandi:  { color: "var(--success)",  label: "Tamamlandı" }
  };
  const s = map[status] || map.yeni;
  return (
    <span style={{display:"inline-flex", alignItems:"center", gap:6}}>
      <I.Dot size={7} color={s.color}/>
      <span style={{font:"500 12px/1 var(--font-sans)", color: "var(--ink-2)"}}>{s.label}</span>
    </span>
  );
}

function Button({ children, kind = "secondary", icon, size = "md", onClick, style }) {
  const map = {
    primary:   { bg: "var(--ember)",   fg: "#fff",         bd: "var(--ember)" },
    secondary: { bg: "var(--surface)", fg: "var(--ink)",   bd: "var(--line-strong)" },
    ghost:     { bg: "transparent",    fg: "var(--ink-2)", bd: "transparent" },
    danger:    { bg: "var(--surface)", fg: "var(--danger)",bd: "var(--line-strong)" },
    ink:       { bg: "var(--ink)",     fg: "#fff",         bd: "var(--ink)" }
  };
  const c = map[kind];
  const pad = size === "sm" ? "6px 10px" : "9px 14px";
  const fs = size === "sm" ? 12 : 13;
  return (
    <button onClick={onClick}
      onMouseDown={e => e.currentTarget.style.transform="scale(0.97)"}
      onMouseUp={e => e.currentTarget.style.transform=""}
      onMouseLeave={e => e.currentTarget.style.transform=""}
      style={{
        font: `600 ${fs}px/1 var(--font-sans)`,
        padding: pad, borderRadius: 6, border: `1px solid ${c.bd}`,
        background: c.bg, color: c.fg, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 6,
        transition: "background 120ms cubic-bezier(0.2,0,0,1), transform 120ms cubic-bezier(0.2,0,0,1)", ...style
      }}>
      {icon}{children}
    </button>
  );
}

function Eyebrow({ children, style }) {
  return <div style={{
    font: "600 11px/1 var(--font-sans)",
    letterSpacing: "0.06em", textTransform: "uppercase",
    color: "var(--ink-3)", ...style
  }}>{children}</div>;
}

window.PriorityBadge = PriorityBadge;
window.BrandChip = BrandChip;
window.Avatar = Avatar;
window.AvatarStack = AvatarStack;
window.StatusPill = StatusPill;
window.Button = Button;
window.Eyebrow = Eyebrow;
window.formatDelta = formatDelta;
