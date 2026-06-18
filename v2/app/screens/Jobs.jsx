// app/screens/Jobs.jsx — Aktif İşler tab. Supports table / kanban / cards view.

function JobsScreen({ data, user, viewMode, tableMode, initialScope, onOpenBrief, onStatusChange }) {
  const [scope, setScope] = React.useState(initialScope || "all");
  // Overview KPI'dan deep-link ile gelindiğinde filtreyi güncelle
  React.useEffect(() => { if (initialScope) setScope(initialScope); }, [initialScope]);
  const [search, setSearch] = React.useState("");
  const [prioFilter, setPrioFilter] = React.useState("all");

  // viewMode (mine/dept/all) filtresi App.jsx'te merkezi uygulanır — data.briefs zaten filtered.
  // Müşteri onayında bekleyenler aktif listeden çıkar — kendi sayfaları var (revize dönünce otomatik geri gelir)
  let rows = data.briefs.filter(b => b.durum !== "musteride");
  if (scope === "overdue") rows = rows.filter(b => b.deltaH <= 0 && b.durum !== "tamamlandi");
  if (scope === "open")    rows = rows.filter(b => b.durum === "yeni" || b.durum === "calisiliyor");
  if (scope === "review")  rows = rows.filter(b => b.durum === "incelemede");
  if (prioFilter !== "all") rows = rows.filter(b => b.priority.code === prioFilter);
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    rows = rows.filter(b =>
      (b.baslik || "").toLowerCase().includes(q) ||
      (b.marka  || "").toLowerCase().includes(q) ||
      (b.lead?.name || "").toLowerCase().includes(q) ||
      (b.contributors || []).some(u => (u?.name || "").toLowerCase().includes(q))
    );
  }

  return (
    <div className="bn-tab-in">
      <PageHead
        title="Aktif işler"
        subtitle="11 sütun · sırala · filtrele · drawer'da düzenle"
        actions={<>
          <Button kind="ghost" size="sm" icon={<I.Refresh size={13}/>}>Yenile</Button>
        </>}
      />

      {/* Filter row */}
      <div style={{
        display:"flex", alignItems:"center", gap: 12, marginBottom: 14, flexWrap:"wrap"
      }}>
        <Segment
          value={scope} onChange={setScope}
          options={[
            ["all",     `Tümü · ${data.briefs.length}`],
            ["open",    `Açık · ${data.briefs.filter(b => b.durum==="yeni"||b.durum==="calisiliyor").length}`],
            ["review",  `İncelemede · ${data.briefs.filter(b => b.durum==="incelemede").length}`],
            ["overdue", `Geciken · ${data.briefs.filter(b => b.deltaH<=0 && b.durum!=="tamamlandi" && b.durum!=="musteride").length}`]
          ]}/>

        <div style={{display:"inline-flex", gap: 6, alignItems:"center"}}>
          <span style={{font:"500 11px/1 var(--font-sans)", color:"var(--ink-4)", letterSpacing:"0.06em", textTransform:"uppercase"}}>Öncelik</span>
          <PrioFilter value={prioFilter} onChange={setPrioFilter}/>
        </div>

        <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink-3)"}}>
          Kapsam: <span style={{color:"var(--ink)"}}>{viewMode==="mine" ? "bana atanmış" : viewMode==="dept" ? "departmanım" : "tüm ekip"}</span>
        </span>

        <div style={{marginLeft:"auto", display:"flex", gap: 8, alignItems:"center"}}>
          <SearchBox value={search} onChange={setSearch}/>
        </div>
      </div>

      {tableMode === "kanban" ? <KanbanView rows={rows} onOpenBrief={onOpenBrief}/> :
       tableMode === "cards"  ? <CardsView  rows={rows} onOpenBrief={onOpenBrief}/> :
       <BriefTable rows={rows} onRowClick={onOpenBrief} onStatusChange={onStatusChange}/>}

      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop: 14, font:"400 12px/1 var(--font-sans)", color:"var(--ink-3)", flexWrap:"wrap", gap:8}}>
        <span>{rows.length} satır · son senkron {(() => { const d = new Date(data.NOW); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); })()}</span>
        <span>Slack Canvas <span style={{fontFamily:"var(--font-mono)", color:"var(--ink-4)"}}>F0B1B6XUD44</span></span>
      </div>
    </div>
  );
}

function Segment({ value, onChange, options }) {
  return (
    <div style={{display:"inline-flex", padding:2, border:"1px solid var(--line)", borderRadius:6, flexWrap:"wrap"}}>
      {options.map(([k,v]) => (
        <button key={k} onClick={() => onChange(k)} style={{
          font:`${value===k?600:500} 12px/1 var(--font-sans)`,
          padding:"6px 11px", border:0, cursor:"pointer", borderRadius:4,
          background: value===k ? "var(--paper-2)" : "transparent",
          color: value===k ? "var(--ink)" : "var(--ink-4)",
          transition:"background 120ms cubic-bezier(0.2,0,0,1), color 120ms cubic-bezier(0.2,0,0,1)"
        }}>{v}</button>
      ))}
    </div>
  );
}

function PrioFilter({ value, onChange }) {
  const opts = [
    ["all", null, "tümü"],
    ["over", "var(--prio-red)", "geçmiş"],
    ["red", "var(--prio-red)", "acil"],
    ["org", "var(--prio-orange)", "yüksek"],
    ["ylw", "var(--prio-yellow)", "normal"],
    ["grn", "var(--prio-green)", "düşük"]
  ];
  return (
    <div style={{display:"inline-flex", gap: 4}}>
      {opts.map(([k, c, label]) => (
        <button key={k} onClick={() => onChange(k)} title={label} style={{
          width: 22, height: 22, border:"1px solid " + (value === k ? "var(--ink)" : "var(--line)"),
          borderRadius: 999, background: c || "var(--surface)",
          padding: 0, cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center",
          opacity: value === "all" || value === k ? 1 : 0.4
        }}>
          {k === "all" && <span style={{font:"500 9px/1 var(--font-mono)", color:"var(--ink-3)"}}>×</span>}
        </button>
      ))}
    </div>
  );
}

function SearchBox({ value, onChange }) {
  return (
    <div style={{
      display:"inline-flex", alignItems:"center", gap:6,
      padding:"5px 10px", border:"1px solid var(--line)", borderRadius:6,
      background:"var(--surface)", color:"var(--ink-3)"
    }}>
      <I.Search size={13}/>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Brief, marka, kişi…"
        style={{border:0, outline:"none", background:"transparent", color:"var(--ink)",
          font:"400 12px/1.2 var(--font-sans)", minWidth: 160}}/>
    </div>
  );
}

// ─── KANBAN VIEW ─────────────────────────────────────────────────────────────
function KanbanView({ rows, onOpenBrief }) {
  const cols = [
    { id: "yeni",        label: "Yeni",        Ic: I.Inbox },
    { id: "calisiliyor", label: "Çalışılıyor", Ic: I.Pencil },
    { id: "incelemede",  label: "İncelemede",  Ic: I.User },
    { id: "blokeli",     label: "Blokeli",     Ic: I.Warn }
  ];
  return (
    <div className="bns-kanban-grid" style={{display:"grid", gridTemplateColumns: "repeat(4, 220px)", gap: 12, minHeight: 480, overflowX:"auto", WebkitOverflowScrolling:"touch"}}>
      {cols.map(col => {
        const items = rows.filter(b => b.durum === col.id);
        return (
          <div key={col.id} style={{
            background:"var(--surface-sub)", border:"1px solid var(--line)",
            borderRadius: 10, padding: 10, display:"flex", flexDirection:"column", gap: 8,
            minWidth: 0, overflow:"hidden"
          }}>
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"4px 6px 8px"}}>
              <span style={{display:"inline-flex", alignItems:"center", gap:8, font:"600 13px/1 var(--font-sans)", color:"var(--ink-2)"}}>
                <col.Ic size={14}/> {col.label}
              </span>
              <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)", padding:"3px 6px", background:"var(--surface)", borderRadius: 4, border:"1px solid var(--line)"}}>{items.length}</span>
            </div>
            {items.map(b => (
              <button key={b.id} onClick={() => onOpenBrief(b)} style={{
                display:"block", padding: 10,
                background:"var(--surface)", border:"1px solid var(--line)", borderRadius: 8,
                cursor:"pointer", textAlign:"left", color:"var(--ink)",
                width:"100%", boxSizing:"border-box", overflow:"hidden"
              }}>
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap: 6, marginBottom: 8}}>
                  <BrandChip brand={b.brand} size="sm"/>
                  <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)", flexShrink:0}}>#{b.no}</span>
                </div>
                <div style={{
                  font:"500 13px/1.35 var(--font-sans)", color:"var(--ink)",
                  marginBottom: 8, wordBreak:"break-word", overflowWrap:"anywhere", whiteSpace:"normal"
                }}>{b.baslik}</div>
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap: 6, marginTop: 2}}>
                  <span style={{display:"flex", alignItems:"center", gap:6, minWidth:0}}>
                    <PriorityBadge p={b.oncelik || { code: "ylw", label: "NORMAL" }}/>
                    {b.deltaH != null && <span style={{font:"500 11px/1 var(--font-mono)", color:(b.deltaH<=8?"var(--prio-red)":"var(--ink-4)")}}>{formatDelta(b.deltaH)}</span>}
                  </span>
                  <Avatar user={b.lead} size={20}/>
                </div>
              </button>
            ))}
            {items.length === 0 && (
              <div style={{padding: 20, textAlign:"center", color:"var(--ink-4)", font:"400 12px/1.4 var(--font-sans)"}}>
                bu kolonda brief yok.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── CARDS VIEW ─────────────────────────────────────────────────────────────
function CardsView({ rows, onOpenBrief }) {
  return (
    <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap: 12}}>
      {rows.map(b => (
        <button key={b.id} onClick={() => onOpenBrief(b)} style={{
          display:"flex", flexDirection:"column", gap: 10, padding: 14,
          background:"var(--surface)", border:"1px solid var(--line)", borderRadius: 10,
          cursor:"pointer", textAlign:"left", color:"var(--ink)"
        }}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
            <BrandChip brand={b.brand} size="sm"/>
            <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)"}}>#{b.no}</span>
          </div>
          <div style={{font:"600 14px/1.3 var(--font-sans)", color:"var(--ink)"}}>{b.baslik}</div>
          <div style={{display:"flex", alignItems:"center", gap: 8}}>
            <PriorityBadge p={b.oncelik || { code: "ylw", label: "NORMAL" }}/>
            {b.deltaH != null && <span style={{font:"500 11px/1 var(--font-mono)", color:(b.deltaH<=8?"var(--prio-red)":"var(--ink-4)")}}>{formatDelta(b.deltaH)}</span>}
            <StatusPill status={b.durum}/>
          </div>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginTop: 2, paddingTop: 8, borderTop:"1px solid var(--line-soft)"}}>
            <span style={{display:"inline-flex", alignItems:"center", gap:6}}>
              <Avatar user={b.lead} size={18}/>
              {b.contributors.length > 0 && <AvatarStack users={b.contributors} max={2} size={16}/>}
            </span>
            <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)"}}>{formatDate(b.deadline)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

window.JobsScreen = JobsScreen;
window.KanbanView = KanbanView;
