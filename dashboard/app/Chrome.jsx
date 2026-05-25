// app/Chrome.jsx — Sidebar navigation + slim header (v2).
// Replaces horizontal tab bar with a left sidebar for better scalability.

const NAV_SECTIONS = [
  {
    id: "main",
    label: "Ana",
    items: [
      { id: "overview",  label: "Genel bakış",   icon: "Home" },
      { id: "manager",   label: "Yönetici",       icon: "Target",  alert: true },
      { id: "jobs",      label: "Aktif işler",    icon: "Briefcase" },
    ]
  },
  {
    id: "planlama",
    label: "Planlama",
    items: [
      { id: "gantt",   label: "Plan / Gantt",  icon: "Calendar" },
      { id: "kanban",  label: "Kanban",         icon: "Columns" },
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
    ]
  },
  {
    id: "diger",
    label: "Diğer",
    items: [
      { id: "gallery", label: "Galeri",       icon: "Image" },
      { id: "multi",   label: "Multi-atama",  icon: "Users" },
      { id: "brand",   label: "Marka",         icon: "Tag" },
      { id: "team",    label: "Ekip matrisi",  icon: "Grid" },
      { id: "profile", label: "Profil",        icon: "User" },
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
};

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
      height: 52,
      display: "flex", alignItems: "center", gap: 12,
      padding: "0 20px 0 16px",
      background: "var(--header-blur)",
      backdropFilter: "blur(14px) saturate(160%)",
      WebkitBackdropFilter: "blur(14px) saturate(160%)",
      borderBottom: "1px solid var(--line)",
      flexShrink: 0,
      position: "sticky", top: 0, zIndex: 30,
    }}>
      {/* Search */}
      <button onClick={onOpenPalette} style={{
        flex: 1, maxWidth: 360,
        display: "flex", alignItems: "center", gap: 8,
        padding: "7px 10px", border: "1px solid var(--line)",
        borderRadius: 8, background: "var(--paper-2)",
        color: "var(--ink-4)",
        cursor: "pointer", font: "400 13px/1 var(--font-sans)",
        textAlign: "left", transition: "border-color 150ms, background 150ms",
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ink-4)"; e.currentTarget.style.background = "var(--paper)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.background = "var(--paper-2)"; }}
      >
        <I.Search size={13} style={{flexShrink:0}}/>
        <span style={{flex:1}}>Brief, marka, kişi ara…</span>
        <span style={{
          font: "500 10px/1 var(--font-mono)", color: "var(--ink-4)",
          padding: "3px 6px", border: "1px solid var(--line)",
          borderRadius: 4, background: "var(--surface)"
        }}>⌘K</span>
      </button>

      <div style={{marginLeft: "auto", display: "flex", alignItems: "center", gap: 8}}>
        {/* Sync pill */}
        <span title="Slack Canvas senkron" style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 9px 4px 7px", borderRadius: 999,
          background: "var(--ember-tint)", color: "var(--ember)",
          font: "500 11px/1 var(--font-sans)", flexShrink: 0,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: 999, background: "var(--ember)",
            animation: "bn-pulse 2.4s ease-in-out infinite", flexShrink: 0,
          }}/>
          Canlı · {syncSecs}sn
        </span>

        {/* View mode */}
        <div style={{display: "inline-flex", padding: 2, background: "var(--paper-2)", borderRadius: 7, gap: 1}}>
          {[["mine", "Ben"], ["dept", "Dept"], ["all", "Tümü"]].map(([k, v]) => (
            <button key={k} onClick={() => setViewMode(k)} style={{
              font: "500 11px/1 var(--font-sans)", padding: "5px 9px",
              border: 0, background: viewMode === k ? "var(--surface)" : "transparent",
              color: viewMode === k ? "var(--ink)" : "var(--ink-3)",
              borderRadius: 5, cursor: "pointer",
              boxShadow: viewMode === k ? "0 1px 2px rgba(22,22,26,0.06)" : "none",
              transition: "all 120ms",
            }}>{v}</button>
          ))}
        </div>

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

        {/* New brief */}
        <Button kind="secondary" size="sm" icon={<I.Plus size={12}/>} onClick={onNewBrief}
          style={{borderColor:"var(--ember)", color:"var(--ember)", fontWeight:600}}>Yeni brief</Button>

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
            const ROL_LABELS = { yonetici: "Yönetici", tasarim: "Tasarım", editor: "Editör", ai: "AI", diger: "Diğer" };
            const ROL_ORDER = ["yonetici", "tasarim", "editor", "ai", "diger"];
            const grouped = {};
            for (const u of (defaultUsers || [])) {
              const rol = u.rol || "diger";
              (grouped[rol] = grouped[rol] || []).push(u);
            }
            const onPick = defaultUsers && defaultUsers.onPick;
            return (
              <div onMouseLeave={() => setUserMenu(false)} style={{
                position: "absolute", top: 38, right: 0, zIndex: 50,
                minWidth: 240, maxHeight: 460, padding: 4,
                background: "var(--surface)", border: "1px solid var(--line)",
                borderRadius: 10, boxShadow: "var(--shadow-2)",
                overflowY: "auto",
              }}>
                <div style={{padding: "7px 10px 5px", font: "600 10px/1 var(--font-sans)", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--ink-4)"}}>
                  Görünümü değiştir
                </div>
                {ROL_ORDER.map(rol => {
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
              </div>
            );
          })()}
        </div>
      </div>
      <style>{`@keyframes bn-pulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }`}</style>
    </header>
  );
}

function Sidebar({ active, onChange, collapsed, onToggle, data }) {
  const alertCount = (data && data.briefs) ? data.briefs.filter(b => b.prio && (b.prio.code === "red" || b.prio.code === "over")).length : 0;

  return (
    <aside style={{
      width: collapsed ? 52 : 212,
      flexShrink: 0,
      display: "flex", flexDirection: "column",
      background: "var(--sidebar-bg)",
      borderRight: "1px solid var(--line)",
      transition: "width 200ms var(--ease-out-quart)",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Logo area */}
      <div style={{
        height: 52, flexShrink: 0,
        display: "flex", alignItems: "center",
        padding: collapsed ? "0 14px" : "0 14px",
        borderBottom: "1px solid var(--line)",
        gap: 8,
        overflow: "hidden",
      }}>
        <img src="app/logo.png" alt="Benseno" style={{
          height: 28, width: "auto", objectFit: "contain",
          flexShrink: 0, mixBlendMode: "multiply",
        }}/>
        {!collapsed && (
          <span style={{
            font: "500 9px/1 var(--font-mono)", color: "var(--ink-5)",
            padding: "2px 4px", borderRadius: 3,
            background: "var(--line)",
            letterSpacing: "0.04em",
            flexShrink: 0,
          }}>v7.13</span>
        )}
      </div>

      {/* Nav sections */}
      <nav style={{flex: 1, overflowY: "auto", overflowX: "hidden", padding: "6px 0 8px"}}>
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.id} style={{marginBottom: si < NAV_SECTIONS.length - 1 ? 2 : 0}}>
            {!collapsed && (
              <div style={{
                padding: si === 0 ? "6px 16px 2px" : "10px 16px 2px",
                font: "600 9.5px/1 var(--font-sans)",
                letterSpacing: "0.08em", textTransform: "uppercase",
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
                    transition: "background 150ms, color 150ms",
                    position: "relative",
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "var(--paper-2)"; e.currentTarget.style.color = "var(--ink)"; }}}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-3)"; }}}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <span style={{
                      position: "absolute", left: -6, top: "50%", transform: "translateY(-50%)",
                      width: 3, height: 18, borderRadius: 999,
                      background: "var(--ember)",
                    }}/>
                  )}
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    color: isActive ? "var(--ember)" : "inherit",
                  }}>
                    <Icon/>
                  </span>
                  {!collapsed && (
                    <span style={{
                      font: `${isActive ? 600 : 500} 13px/1 var(--font-sans)`,
                      flex: 1, textAlign: "left", whiteSpace: "nowrap",
                    }}>{item.label}</span>
                  )}
                  {badge && !collapsed && (
                    <span style={{
                      font: "600 10px/1 var(--font-mono)",
                      padding: "2px 5px", borderRadius: 4,
                      color: "var(--prio-red)", background: "var(--prio-red-bg)",
                      flexShrink: 0,
                    }}>{badge}</span>
                  )}
                  {badge && collapsed && (
                    <span style={{
                      position: "absolute", top: 4, right: 4,
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
window.TabBar = TabBar;
window.NAV_SECTIONS = NAV_SECTIONS;
