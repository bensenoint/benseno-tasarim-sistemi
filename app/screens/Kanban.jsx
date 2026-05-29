// app/screens/Kanban.jsx — full kanban with 5 columns (including tamamlandı).

function KanbanScreen({ data, onOpenBrief, onStatusChange }) {
  const [prioFilter, setPrioFilter] = React.useState("all");
  const [search, setSearch]         = React.useState("");

  const cols = [
    { id: "yeni",        label: "Yeni",        Ic: I.Inbox,  accent: "var(--ink-3)" },
    { id: "calisiliyor", label: "Çalışılıyor", Ic: I.Pencil, accent: "var(--info)" },
    { id: "incelemede",  label: "İncelemede",  Ic: I.User,   accent: "var(--warning)" },
    { id: "blokeli",     label: "Blokeli",     Ic: I.Warn,   accent: "var(--danger)" },
    { id: "tamamlandi",  label: "Tamamlandı",  Ic: I.Check,  accent: "var(--success)" }
  ];

  // for the Tamamlandı column we use completed[]; map to active brief shape (lightly)
  const allCompleted = data._allCompleted || data.completed || [];
  const completedAsBriefs = allCompleted.slice(0, 12).map(c => {
    // Gerçek gecikmeyi veya "zamanında" badge'ini göster
    const gh = c.gecikmeH || 0;
    return {
      id: c.id, no: c.no, marka: c.marka, brand: c.brand, baslik: c.baslik,
      lead: c.lead, contributors: c.contributors || [], reviewer: null,
      durum: "tamamlandi",
      deadline: c.bitis, acilma: c.baslangic,
      deltaH: gh > 0 ? -gh : null,   // null → "zamanında" badge
      priority: gh > 0
        ? { code:"red", label:"GEÇ", color:"var(--prio-red)" }
        : { code:"grn", label:"ZAMANINDA", color:"var(--prio-green)" },
      revision: c.revision
    };
  });

  // Filtrele — viewMode'dan bağımsız tüm brief'ler
  let allBriefs = data._allBriefs || data.briefs;
  if (prioFilter !== "all") allBriefs = allBriefs.filter(b => b.priority.code === prioFilter);
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    allBriefs = allBriefs.filter(b =>
      (b.baslik||"").toLowerCase().includes(q) ||
      (b.marka||"").toLowerCase().includes(q) ||
      (b.lead?.name||"").toLowerCase().includes(q)
    );
  }

  return (
    <div className="bn-tab-in">
      <PageHead
        title="Kanban"
        subtitle="durum bazlı kolonlar · drag yerine status menüsü"
        actions={<>
          <PrioFilter value={prioFilter} onChange={setPrioFilter}/>
        </>}
      />

      {/* Arama */}
      <div style={{marginBottom:12}}>
        <div style={{display:"inline-flex", alignItems:"center", gap:6, background:"var(--surface-sub)", border:"1px solid var(--line)", borderRadius:8, padding:"6px 10px", width:240}}>
          <I.Search size={13} style={{color:"var(--ink-4)", flexShrink:0}}/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Brief, marka, kişi…"
            style={{border:0, background:"transparent", font:"500 13px/1 var(--font-sans)", color:"var(--ink)", outline:"none", width:"100%"}}/>
        </div>
      </div>

      <div className="bns-kanban-grid" style={{
        display:"grid", gridTemplateColumns:"repeat(5, 220px)", gap: 12,
        minHeight: 540, overflowX:"auto", WebkitOverflowScrolling:"touch"
      }}>
        {cols.map(col => {
          const items = col.id === "tamamlandi" ? completedAsBriefs : allBriefs.filter(b => b.durum === col.id);
          return (
            <div key={col.id} style={{
              background:"var(--surface-sub)", border:"1px solid var(--line)",
              borderRadius: 10, padding: 10,
              display:"flex", flexDirection:"column", gap: 8,
              minWidth: 0, overflow:"hidden"
            }}>
              <div style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"4px 6px 10px", borderBottom:"1px solid var(--line)", marginBottom: 4
              }}>
                <span style={{display:"inline-flex", alignItems:"center", gap:8, font:"600 13px/1 var(--font-sans)", color:"var(--ink-2)"}}>
                  <span style={{width:8, height:8, borderRadius:999, background: col.accent}}/>
                  <col.Ic size={13}/> {col.label}
                </span>
                <span style={{
                  font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)",
                  padding:"3px 6px", background:"var(--surface)", borderRadius: 4, border:"1px solid var(--line)"
                }}>{items.length}</span>
              </div>
              <div style={{display:"flex", flexDirection:"column", gap: 8, flex:1, overflowY:"auto", overflowX:"hidden", maxHeight: "60vh", minWidth:0}}>
                {items.map(b => <KanbanCard key={b.id} brief={b} onClick={() => onOpenBrief(b)}/>)}
                {items.length === 0 && (
                  <div style={{padding: 20, textAlign:"center", color:"var(--ink-4)", font:"400 12px/1.4 var(--font-sans)"}}>
                    boş.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ brief, onClick }) {
  return (
    <button onClick={onClick} style={{
      display:"flex", flexDirection:"column", gap: 8, padding: 10,
      background:"var(--surface)", border:"1px solid var(--line)", borderRadius: 8,
      cursor:"pointer", textAlign:"left", color:"var(--ink)",
      width:"100%", maxWidth:"100%", minWidth:0,
      boxSizing:"border-box", alignSelf:"stretch"
    }}>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap: 6, width:"100%", overflow:"hidden"}}>
        <div style={{flex:1, minWidth:0, overflow:"hidden"}}>
          <BrandChip brand={brief.brand} size="sm"/>
        </div>
        <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)", flexShrink:0}}>#{brief.no}</span>
      </div>
      <div style={{
        font:"500 13px/1.35 var(--font-sans)", color:"var(--ink)",
        wordBreak:"break-word", overflowWrap:"anywhere", whiteSpace:"normal",
        width:"100%"
      }}>{brief.baslik || brief.marka || "—"}</div>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap: 6, width:"100%"}}>
        {brief.priority && <PriorityBadge p={brief.priority} deltaH={brief.deltaH || 0} compact/>}
        <span style={{display:"inline-flex", marginLeft:"auto"}}>
          <Avatar user={brief.lead} size={20}/>
          {brief.contributors && brief.contributors.length > 0 && (
            <span style={{marginLeft: -6}}><AvatarStack users={brief.contributors} max={2} size={18}/></span>
          )}
        </span>
      </div>
    </button>
  );
}

window.KanbanScreen = KanbanScreen;
window.KanbanCard = KanbanCard;
