// app/Chrome.jsx — Header + TabBar (with tab-style modes, theme toggle, search-as-command).

const TABS = [
  { id: "overview",  label: "Genel bakış" },
  { id: "manager",   label: "Yönetici",     counter: 3,   alert: true },
  { id: "jobs",      label: "Aktif işler",  counter: 60 },
  { id: "gantt",     label: "Plan" },
  { id: "kanban",    label: "Kanban" },
  { id: "completed", label: "Tamamlananlar" },
  { id: "dept-comp", label: "Karşılaştırma" },
  { id: "design",    label: "Tasarım" },
  { id: "editor",    label: "Editör" },
  { id: "ai",        label: "AI" }
];
const MORE_TABS = [
  { id: "timeline",  label: "Deadlines" },
  { id: "gallery",   label: "Galeri" },
  { id: "multi",     label: "Multi-atama" },
  { id: "brand",     label: "Marka" },
  { id: "team",      label: "Ekip matrisi" },
  { id: "profile",   label: "Profil" },
  { id: "history",   label: "Geçmiş" }
];

function Header({ user, viewMode, setViewMode, theme, setTheme, onOpenPalette, onNewBrief, defaultUsers }) {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const syncSecs = 22 + (tick % 60);
  const [userMenu, setUserMenu] = React.useState(false);

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 30,
      height: 56, display: "flex", alignItems: "center", gap: 14,
      padding: "0 20px",
      background: theme === "dark" ? "rgba(15,15,18,0.88)" : "rgba(251,250,247,0.92)",
      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      borderBottom: "1px solid var(--line)"
    }}>
      <div style={{display:"flex", alignItems:"center", gap:8}}>

        <img src="app/logo.png" alt="Benseno" style={{height: 44, width: "auto", objectFit: "contain", display: "block", mixBlendMode: "multiply"}}/>
        <span style={{
          font:"500 10px/1 var(--font-mono)", color:"var(--ink-4)",
          marginLeft: 4, padding: "3px 6px", borderRadius: 4, background: "var(--paper-2)"
        }}>v7.13</span>
      </div>

      {/* Search — opens command palette */}
      <button onClick={onOpenPalette} style={{
        marginLeft: 8,
        display: "flex", alignItems: "center", gap: 8,
        padding: "7px 10px", border: "1px solid var(--line)",
        borderRadius: 8, background: "var(--surface)",
        minWidth: 280, maxWidth: 320, color: "var(--ink-3)",
        cursor: "pointer", font:"400 13px/1 var(--font-sans)"
      }}>
        <I.Search size={14}/>
        <span>Brief, marka, kişi ara…</span>
        <span style={{marginLeft:"auto", font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)",
          padding:"3px 6px", border:"1px solid var(--line)", borderRadius:4, background:"var(--paper-2)"}}>⌘K</span>
      </button>

      <div style={{marginLeft: "auto", display:"flex", alignItems:"center", gap: 10}}>
        {/* Sync indicator */}
        <span title="Slack Canvas senkron" style={{
          display:"inline-flex", alignItems:"center", gap:6,
          padding:"4px 10px 4px 8px", borderRadius:999,
          background:"var(--ember-tint)", color:"var(--ember)",
          font:"500 12px/1 var(--font-sans)"
        }}>
          <span style={{
            width:6, height:6, borderRadius:999, background:"var(--ember)",
            animation: "bn-pulse 2.4s ease-in-out infinite"
          }}/>
          Canlı · {syncSecs}sn
        </span>

        {/* View mode segment */}
        <div style={{display:"inline-flex", padding:3, background:"var(--paper-2)", borderRadius:8}}>
          {[["mine","Bana"],["dept","Departman"],["all","Tümü"]].map(([k,v]) => (
            <button key={k} onClick={() => setViewMode(k)} style={{
              font:"500 12px/1 var(--font-sans)", padding:"6px 10px",
              border:0, background: viewMode===k ? "var(--surface)" : "transparent",
              color: viewMode===k ? "var(--ink)" : "var(--ink-3)",
              borderRadius:6, cursor:"pointer",
              boxShadow: viewMode===k ? "0 1px 2px rgba(22,22,26,0.06)" : "none"
            }}>{v}</button>
          ))}
        </div>

        {/* Theme toggle */}
        <button title={theme === "dark" ? "Aydınlık mod" : "Karanlık mod"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          style={{
            border:"1px solid var(--line)", background:"var(--surface)",
            padding:6, borderRadius:8, color:"var(--ink-2)", cursor:"pointer",
            display:"inline-flex"
          }}>
          {theme === "dark" ? <I.Sun size={16}/> : <I.Moon size={16}/>}
        </button>

        {/* New brief */}
        <Button kind="primary" size="sm" icon={<I.Plus size={13}/>} onClick={onNewBrief}>Yeni brief</Button>

        {/* User menu */}
        <div style={{position:"relative"}}>
          <button onClick={() => setUserMenu(v => !v)} style={{
            display:"inline-flex", alignItems:"center", gap:8,
            padding:"3px 9px 3px 3px", border:"1px solid var(--line)",
            borderRadius:999, background:"var(--surface)", cursor:"pointer"
          }}>
            <Avatar user={user} size={24}/>
            <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink)"}}>{user.name.split(" ")[0]}</span>
            <I.ChevronDown size={11}/>
          </button>
          {userMenu && (() => {
            const ROL_LABELS = {
              yonetici: "Yönetici",
              tasarim:  "Tasarım",
              editor:   "Editör",
              ai:       "AI",
              diger:    "Diğer",
            };
            const ROL_ORDER = ["yonetici", "tasarim", "editor", "ai", "diger"];
            const grouped = {};
            for (const u of (defaultUsers || [])) {
              const rol = u.rol || "diger";
              (grouped[rol] = grouped[rol] || []).push(u);
            }
            const onPick = defaultUsers && defaultUsers.onPick;
            return (
              <div onMouseLeave={() => setUserMenu(false)} style={{
                position:"absolute", top: 38, right: 0, zIndex: 50,
                minWidth: 260, maxHeight: 480, padding: 4,
                background:"var(--surface)", border:"1px solid var(--line)",
                borderRadius: 10, boxShadow:"var(--shadow-1)",
                overflowY: "auto", overflowX: "hidden",
              }}>
                <div style={{padding:"8px 10px 4px", font:"600 11px/1 var(--font-sans)", letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--ink-3)"}}>
                  Görünümü değiştir · {(defaultUsers||[]).length} kişi
                </div>
                {ROL_ORDER.map(rol => {
                  const list = grouped[rol];
                  if (!list || list.length === 0) return null;
                  return (
                    <div key={rol} style={{marginTop: 4}}>
                      <div style={{padding:"6px 10px 2px", font:"600 10px/1 var(--font-sans)", letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--ink-4)"}}>
                        {ROL_LABELS[rol]} · {list.length}
                      </div>
                      {list.map(u => {
                        const active = user && user.id === u.id;
                        return (
                          <button key={u.id} onClick={() => { onPick && onPick(u); setUserMenu(false); }} style={{
                            display:"flex", width:"100%", textAlign:"left", alignItems:"center", gap:8,
                            padding:"7px 8px", border:0,
                            background: active ? "var(--paper-2)" : "transparent",
                            cursor:"pointer", borderRadius: 6
                          }}>
                            <Avatar user={u} size={22}/>
                            <span style={{font:"500 13px/1.2 var(--font-sans)", color:"var(--ink)", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                              {u.name}
                            </span>
                            {u.title ? (
                              <span style={{font:"400 10px/1 var(--font-sans)", color:"var(--ink-4)", whiteSpace:"nowrap"}}>{u.title}</span>
                            ) : null}
                            {active && <I.Check size={12}/>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
      <style>{`@keyframes bn-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </header>
  );
}

function TabBar({ active, onChange, style = "underline" }) {
  // style: "underline" | "pill" | "hairline"
  const inMore = MORE_TABS.some(t => t.id === active);
  const [more, setMore] = React.useState(false);

  return (
    <nav style={{
      position: "sticky", top: 56, zIndex: 29,
      height: 44, padding: "0 16px",
      display: "flex", alignItems: "stretch", gap: style === "pill" ? 4 : 0,
      background: "color-mix(in oklab, var(--paper) 92%, transparent)",
      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      borderBottom: style === "hairline" ? "1px solid var(--line)" : (style === "underline" ? "1px solid var(--line)" : "none")
    }}>
      {TABS.map(t => (
        <TabButton key={t.id} tab={t} active={active===t.id} style={style} onClick={() => onChange(t.id)}/>
      ))}
      <div style={{position:"relative", display:"flex"}}>
        <button onClick={() => setMore(v => !v)} style={tabStyleFor({ active: inMore, style })}>
          Daha fazla <I.ChevronDown size={12} style={{marginLeft: 2}}/>
        </button>
        {more && (
          <div onMouseLeave={() => setMore(false)} style={{
            position:"absolute", top: 42, right: 0,
            background:"var(--surface)", border:"1px solid var(--line)",
            borderRadius: 10, padding: 4, minWidth: 210,
            boxShadow:"var(--shadow-1)", zIndex: 40
          }}>
            {MORE_TABS.map(t => (
              <button key={t.id} onClick={() => { onChange(t.id); setMore(false); }}
                style={{
                  display:"block", width:"100%", textAlign:"left",
                  padding:"7px 10px", border:0,
                  background: active===t.id ? "var(--paper-2)" : "transparent",
                  font: `${active===t.id ? 600 : 500} 13px/1 var(--font-sans)`,
                  color: active===t.id ? "var(--ink)" : "var(--ink-2)",
                  borderRadius: 6, cursor:"pointer"
                }}>{t.label}</button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

function TabButton({ tab, active, style, onClick }) {
  const base = tabStyleFor({ active, style });
  return (
    <button onClick={onClick} style={base}>
      {tab.label}
      {tab.counter !== undefined && (
        <span style={{
          font: "500 11px/1 var(--font-mono)",
          padding: "2px 5px", borderRadius: 4,
          color: tab.alert ? "var(--prio-red)" : "var(--ink-4)",
          background: tab.alert ? "var(--prio-red-bg)" : "var(--paper-2)"
        }}>{tab.counter}</span>
      )}
    </button>
  );
}

function tabStyleFor({ active, style }) {
  const common = {
    font: `${active ? 600 : 500} 13px/1 var(--font-sans)`,
    color: active ? "var(--ink)" : "var(--ink-3)",
    padding: "0 13px", margin: 0,
    display: "inline-flex", alignItems: "center", gap: 6,
    border: 0, cursor: "pointer", whiteSpace: "nowrap",
    background: "transparent"
  };
  if (style === "pill") {
    return {
      ...common,
      padding: "7px 12px",
      margin: "8px 0",
      borderRadius: 999,
      background: active ? "var(--ink)" : "transparent",
      color: active ? "var(--paper)" : "var(--ink-3)"
    };
  }
  if (style === "hairline") {
    return {
      ...common,
      borderBottom: `1px solid ${active ? "var(--ember)" : "transparent"}`
    };
  }
  // underline (default)
  return {
    ...common,
    borderBottom: `2px solid ${active ? "var(--ember)" : "transparent"}`
  };
}

window.Header = Header;
window.TabBar = TabBar;
window.TABS = TABS;
window.MORE_TABS = MORE_TABS;
