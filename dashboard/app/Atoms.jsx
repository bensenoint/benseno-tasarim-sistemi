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

// Bildirim rozeti — okunmamış bildirim sayısını gösteren küçük nokta.
// n: { count, last_at } (window.BNS_NOTIF.briefs[id] / .markalar[ad]); yoksa/0 ise render etmez.
function NotifDot({ n, briefId }) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState(null);
  const [pos, setPos] = React.useState(null);   // fixed konum (rozetin ekran koordinatından)
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    if (briefId && typeof window.bnsApiGet === "function")
      window.bnsApiGet(`/api/briefs/${briefId}/notifications`).then(r => {
        setItems((r && r.notifications) || []);
        // GET (unread bayrakları eski seen_at'e göre) çözülDÜKTEN SONRA okundu işaretle → bu görünümde
        // okunmamışlar doğru ayrışır; sonraki açılışta hepsi okunmuş sayılır + rozet sayacı tazelenir.
        if (typeof window.bnsApiPost === "function")
          window.bnsApiPost(`/api/briefs/${briefId}/notif-seen`, {}).then(() => { if (typeof window.bnsRefresh === "function") window.bnsRefresh(); }).catch(() => {});
      }).catch(() => setItems([]));
    // YALNIZ dışarı tıklama + Escape kapatır (kaydırma/resize kapatmaz — kullanıcı boşluğa basana dek açık kalır).
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open, briefId]);
  if (!n || !n.count) return null;
  const icon = { termin:"⏰", atama:"📌", bloke:"⛔", musteri:"↩️", statu:"🔄", genel:"🔔" };
  // Rozetin ekran konumundan popover yerini hesapla; position:fixed → overflow/scroll konteyneri KIRPMAZ.
  const toggle = (e) => {
    e.stopPropagation();
    if (!open) {
      const r = e.currentTarget.getBoundingClientRect();
      const below = (window.innerHeight - r.bottom) > 340;   // altta yer yoksa yukarı aç
      setPos({
        top: below ? Math.round(r.bottom + 4) : undefined,
        bottom: below ? undefined : Math.round(window.innerHeight - r.top + 4),
        right: Math.max(8, Math.round(window.innerWidth - r.right)),
      });
    }
    setOpen(o => !o);
  };
  return (
    <span ref={ref} style={{ display:"inline-flex" }}>
      <span onClick={toggle} title={`${n.count} yeni bildirim — detay için tıkla`}
        style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", minWidth:16, height:16, padding:"0 4px", borderRadius:8, background:"var(--info)", color:"#fff", font:"600 10px/1 var(--font-mono)", marginLeft:6, verticalAlign:"middle", cursor:"pointer" }}>
        {n.count}
      </span>
      {open && pos && (
        <div onClick={(e) => e.stopPropagation()} style={{ position:"fixed", top:pos.top, bottom:pos.bottom, right:pos.right, zIndex:1000, width:360, maxWidth:"92vw", maxHeight:400, overflowY:"auto", background:"var(--paper)", border:"1px solid var(--line)", borderRadius:14, boxShadow:"0 12px 32px rgba(0,0,0,0.16)", padding:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px 10px", borderBottom:"1px solid var(--line-soft)", position:"sticky", top:0, background:"var(--paper)" }}>
            <span style={{ font:"600 12px/1 var(--font-sans)", color:"var(--ink)", letterSpacing:".02em" }}>Bildirimler</span>
            {items && items.length > 0 && <span style={{ font:"600 10px/1 var(--font-mono)", color:"var(--ink-4)", background:"var(--paper-2)", border:"1px solid var(--line-soft)", borderRadius:20, padding:"3px 8px" }}>{items.length}</span>}
          </div>
          <div style={{ padding:"4px 8px 8px" }}>
            {items === null && <div style={{ font:"400 12px var(--font-sans)", color:"var(--ink-4)", padding:"10px 8px" }}>Yükleniyor…</div>}
            {items && items.length === 0 && <div style={{ font:"400 12px var(--font-sans)", color:"var(--ink-4)", padding:"10px 8px" }}>Bildirim yok.</div>}
            {items && items.length > 0 && (() => {
              const unread = items.filter(x => x.unread);
              const read = items.filter(x => !x.unread);
              const goDetail = () => { if (typeof window.bnsOpenBriefById === "function") window.bnsOpenBriefById(briefId); setOpen(false); };
              const label = { font:"600 10px/1 var(--font-sans)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".08em", padding:"8px 8px 5px" };
              const Row = (it, i, uk) => (
                <div key={uk + i} onClick={goDetail} title="Detayı aç"
                  style={{ display:"flex", gap:11, alignItems:"flex-start", padding:"10px 8px", borderRadius:8, cursor:"pointer",
                    background: uk === "u" ? "color-mix(in srgb, var(--info) 7%, transparent)" : "transparent" }}>
                  <span style={{ flexShrink:0, display:"inline-flex", alignItems:"center", justifyContent:"center", width:26, height:26, borderRadius:8, background:"var(--paper-2)", border:`1px solid ${uk === "u" ? "var(--info)" : "var(--line-soft)"}`, fontSize:13 }}>{icon[it.tip] || "🔔"}</span>
                  <span style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:3 }}>
                    <span style={{ font:`${uk === "u" ? 600 : 500} 13px/1.4 var(--font-sans)`, color:"var(--ink)", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{it.text}</span>
                    <span style={{ font:"400 10px/1 var(--font-mono)", color:"var(--ink-4)" }}>{new Date(it.created_at).toLocaleDateString("tr-TR", { day:"numeric", month:"short" })} · {new Date(it.created_at).toLocaleTimeString("tr-TR", { hour:"2-digit", minute:"2-digit" })}</span>
                  </span>
                  {uk === "u" && <span style={{ flexShrink:0, width:7, height:7, borderRadius:99, background:"var(--info)", marginTop:7 }}/>}
                </div>
              );
              return (<>
                {unread.length > 0 && <><div style={label}>Okunmamış · {unread.length}</div>{unread.map((it, i) => Row(it, i, "u"))}</>}
                {read.length > 0 && <>{unread.length > 0 && <div style={{ height:6 }}/>}<div style={label}>Öncekiler</div>{read.map((it, i) => Row(it, i, "r"))}</>}
              </>);
            })()}
          </div>
        </div>
      )}
    </span>
  );
}

window.NotifDot = NotifDot;
window.PriorityBadge = PriorityBadge;
window.BrandChip = BrandChip;
window.Avatar = Avatar;
window.AvatarStack = AvatarStack;
window.StatusPill = StatusPill;
window.Button = Button;
window.Eyebrow = Eyebrow;
window.formatDelta = formatDelta;
