// app/CommandPalette.jsx — ⌘K palette.
// Searches briefs by title/brand/lead, and shows quick actions.

function CommandPalette({ open, onClose, onOpenBrief, onNavigate, onTheme, onNewBrief, data, currentTheme }) {
  // All hooks must come before any early return (Rules of Hooks)
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState(0);
  const ql = q.toLowerCase().trim();

  React.useEffect(() => { if (open) setQ(""); }, [open]);
  React.useEffect(() => { setSel(0); }, [ql]);

  if (!open) return null;

  // Quick actions
  const actions = [
    { kind: "action", id: "act-new",    label: "Yeni brief oluştur",            hint: "N", icon: <I.Plus size={14}/>,  run: onNewBrief },
    { kind: "action", id: "act-theme",  label: `Tema: ${currentTheme === "dark" ? "Aydınlık'a geç" : "Karanlık'a geç"}`, hint: "T", icon: currentTheme === "dark" ? <I.Sun size={14}/> : <I.Moon size={14}/>, run: () => onTheme(currentTheme === "dark" ? "light" : "dark") },
    { kind: "action", id: "act-jobs",   label: "Aktif işler tablosuna git",     hint: "A", icon: <I.Grid size={14}/>, run: () => onNavigate("jobs") },
    { kind: "action", id: "act-mgr",    label: "Yönetici komuta merkezi",       hint: "Y", icon: <I.Warn size={14}/>, run: () => onNavigate("manager") },
    { kind: "action", id: "act-plan",   label: "Plan görünümü (gantt)",         hint: "P", icon: <I.Calendar size={14}/>, run: () => onNavigate("gantt") },
    { kind: "action", id: "act-kanban", label: "Kanban'a geç",                  hint: "K", icon: <I.Layers size={14}/>, run: () => onNavigate("kanban") },
    { kind: "action", id: "act-team",   label: "Ekip matrisi · 16 × 39",        hint: "E", icon: <I.Users size={14}/>, run: () => onNavigate("team") }
  ];

  const briefs = ql ? data.briefs.filter(b =>
    b.baslik.toLowerCase().includes(ql) ||
    b.marka.toLowerCase().includes(ql) ||
    b.lead?.name?.toLowerCase()?.includes(ql) ||
    String(b.no).includes(ql)
  ).slice(0, 6) : [];

  const brands = ql ? data.BRANDS.filter(b => b.name.toLowerCase().includes(ql)).slice(0, 5) : [];
  const people = ql ? data.USERS.filter(u => u.name.toLowerCase().includes(ql)).slice(0, 5) : [];
  const filteredActions = ql ? actions.filter(a => a.label.toLowerCase().includes(ql)) : actions;

  const sections = [
    { title: "Eylemler", items: filteredActions },
    ...(briefs.length ? [{ title: "Brief", items: briefs.map(b => ({ kind:"brief", id: b.id, label: b.baslik, brand: b.brand, no: b.no, run: () => onOpenBrief(b) })) }] : []),
    ...(brands.length ? [{ title: "Marka", items: brands.map(b => ({ kind:"brand", id: b.name, label: b.name, color: b.color, run: () => onNavigate("brand") })) }] : []),
    ...(people.length ? [{ title: "Kişi",  items: people.map(u => ({ kind:"person", id: u.id, label: u.name, user: u, run: () => onNavigate("profile") })) }] : [])
  ];

  const flat = sections.flatMap(s => s.items);

  function onKey(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(flat.length - 1, s + 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    if (e.key === "Enter")     { e.preventDefault(); if (flat[sel]) { flat[sel].run(); onClose(); } }
    if (e.key === "Escape")    { e.preventDefault(); onClose(); }
  }

  let i = -1;
  return (
    <>
      <div onClick={onClose} style={{
        position:"fixed", inset:0, background:"var(--overlay)", zIndex: 90,
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        animation: "bn-fade 160ms var(--ease-out-quart)"
      }}/>
      <div style={{
        position:"fixed", top: "12vh", left: "50%", transform: "translateX(-50%)",
        width: "min(640px, 92vw)", zIndex: 91,
        background:"var(--surface)", border:"1px solid var(--line)",
        borderRadius: 14, boxShadow:"var(--shadow-2)",
        animation: "bn-slide-up 180ms var(--ease-out-quart)",
        overflow: "hidden"
      }}>
        <div style={{padding: "10px 14px", borderBottom:"1px solid var(--line)", display:"flex", alignItems:"center", gap: 10}}>
          <I.Command size={16} style={{color:"var(--ink-3)"}}/>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Brief, marka, kişi veya eylem ara…"
            style={{
              flex:1, border:0, outline:"none", background:"transparent",
              font:"500 16px/1.3 var(--font-sans)", color:"var(--ink)"
            }}/>
          <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)",
            padding:"3px 6px", border:"1px solid var(--line)", borderRadius:4}}>esc</span>
        </div>
        <div style={{maxHeight: 380, overflowY:"auto", padding: 4}}>
          {sections.length === 0 || flat.length === 0 ? (
            <div style={{padding:"28px 16px", textAlign:"center", color:"var(--ink-3)"}}>
              <div style={{font:"500 14px/1.4 var(--font-sans)"}}>Eşleşen bir şey yok.</div>
              <div style={{font:"400 12px/1.4 var(--font-sans)", marginTop:4}}>Farklı bir kelime dene.</div>
            </div>
          ) : sections.map(sec => (
            <div key={sec.title}>
              <div style={{
                font:"600 10px/1 var(--font-sans)", letterSpacing:"0.08em",
                textTransform:"uppercase", color:"var(--ink-4)",
                padding:"10px 12px 4px"
              }}>{sec.title}</div>
              {sec.items.map(it => {
                i++; const isSel = i === sel; const idx = i;
                return (
                  <button key={it.id} onMouseEnter={() => setSel(idx)} onClick={() => { it.run(); onClose(); }}
                    onMouseDown={e => e.currentTarget.style.transform="scale(0.98)"}
                    onMouseUp={e => e.currentTarget.style.transform=""}
                    onMouseLeave={e => e.currentTarget.style.transform=""}
                    style={{
                      display:"flex", alignItems:"center", gap: 10, width:"100%", textAlign:"left",
                      padding:"9px 10px", border:0, borderRadius: 8,
                      background: isSel ? "var(--paper-2)" : "transparent",
                      cursor:"pointer", color:"var(--ink)",
                      transition:"background 100ms cubic-bezier(0.2,0,0,1), transform 100ms cubic-bezier(0.2,0,0,1)"
                    }}>
                    {it.kind === "action" && <span style={{color:"var(--ink-3)"}}>{it.icon}</span>}
                    {it.kind === "brief" && <BrandChip brand={it.brand} size="sm"/>}
                    {it.kind === "brand" && <span style={{width:8, height:8, borderRadius:999, background: it.color}}/>}
                    {it.kind === "person" && <Avatar user={it.user} size={20}/>}
                    <span style={{font:"500 14px/1.3 var(--font-sans)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{it.label}</span>
                    {it.kind === "brief" && <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)"}}>#{it.no}</span>}
                    {it.kind === "action" && it.hint && (
                      <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)",
                        padding:"3px 6px", border:"1px solid var(--line)", borderRadius:4}}>{it.hint}</span>
                    )}
                    {isSel && <span style={{color:"var(--ember)"}}>↵</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{
          padding:"8px 12px", borderTop:"1px solid var(--line)", background:"var(--surface-sub)",
          display:"flex", gap: 14, font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)"
        }}>
          <span>↑↓ gezin</span><span>↵ seç</span><span>esc kapat</span>
          <span style={{marginLeft:"auto"}}>Benseno · ⌘K</span>
        </div>
      </div>
    </>
  );
}

window.CommandPalette = CommandPalette;
