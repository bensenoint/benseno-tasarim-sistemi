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
  const label = deltaH === undefined
    ? p.label   // manuel öncelik pili: yalnız etiket (ACİL/YÜKSEK/NORMAL/DÜŞÜK)
    : deltaH === null
    ? (compact ? "zamanında" : `${p.label}`)
    : (compact ? formatDelta(deltaH) : `${p.label} · ${formatDelta(deltaH)}`);
  return (
    <span className="bn-prio" style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
      letterSpacing: "0.04em", textTransform: "uppercase",
      color: "var(--ink-2)", whiteSpace: "nowrap"
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
  // Her yerde tıklanabilir: marka detay sayfasına götürür (App.jsx bnsOpenBrand'i tanımlar).
  const go = (e) => { if (window.bnsOpenBrand) { e.stopPropagation(); window.bnsOpenBrand(brand.name); } };
  return (
    <span onClick={go} title={`${brand.name} marka detayını aç`} style={{
      cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 6,
      fontFamily: "var(--font-sans)", fontSize: small ? 11 : 12, fontWeight: 500,
      color: "var(--ink)", whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis"
    }}>
      <span style={{width:7, height:7, borderRadius:999, background: brand.color, flexShrink:0}}/>
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
  // Her yerde tıklanabilir: kişinin profil sayfasına götürür (App.jsx bnsOpenUser'ı tanımlar).
  const go = (e) => { if (window.bnsOpenUser) { e.stopPropagation(); window.bnsOpenUser(user.id); } };
  return (
    <span onClick={go} title={`${user.name} · profili aç`} style={{
      width: size, height: size, borderRadius: 999,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: Math.round(size * 0.42),
      color: "#fff", background: c, cursor: "pointer",
      border: borderColor ? `2px solid ${borderColor}` : "none",
      flexShrink: 0, position: "relative", overflow: "hidden"
    }}>
      {user.mono}
      {/* Slack profil fotoğrafı — yüklenemezse gizlenir, alttaki renkli baş harf görünür kalır */}
      {user.avatar_url && (
        <img src={user.avatar_url} alt="" loading="lazy"
          onError={(e) => { e.target.style.display = "none"; }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: 999 }}/>
      )}
    </span>
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
    yeni:        { color: "var(--ink-4)",    label: "Yeni",     full: "Yeni" },
    calisiliyor: { color: "var(--info)",     label: "İş planında", full: "İş planında" },
    basladi:     { color: "var(--ok, #2E8F66)", label: "Başladı", full: "İşe başlandı · şu an çalışılıyor" },
    incelemede:  { color: "var(--warning)",  label: "İnceleme",  full: "İncelemede" },
    beklemede:   { color: "var(--ink-3)",       label: "Bekliyor",  full: "Beklemede" },
    revizyon:    { color: "var(--prio-orange)", label: "Revizyon",  full: "Revizyon" },
    musteride:   { color: "var(--musteride)",            label: "Müşteride", full: "Müşteri onayında · dönüş bekleniyor" },
    blokeli:     { color: "var(--danger)",   label: "Blokeli",   full: "Blokeli" },
    tamamlandi:  { color: "var(--success)",  label: "Tamam",     full: "Tamamlandı" }
  };
  const s = map[status] || map.yeni;
  return (
    <span title={s.full} style={{display:"inline-flex", alignItems:"center", gap:5}}>
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
      style={{
        font: `600 ${fs}px/1 var(--font-sans)`,
        padding: pad, borderRadius: 6, border: `1px solid ${c.bd}`,
        background: c.bg, color: c.fg, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 6,
        transition: "background 120ms cubic-bezier(0.2,0,0,1), border-color 120ms cubic-bezier(0.2,0,0,1)", ...style
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
