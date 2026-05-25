// app/BriefTable.jsx — Aktif İşler table.
// 11 cols · density-aware · sortable headers · inline status change.

function BriefTable({ rows, onRowClick, onStatusChange, sortable = true, view = "table" }) {
  const [sort, setSort] = React.useState({ col: "deltaH", dir: "asc" });
  const sorted = React.useMemo(() => {
    if (!sortable) return rows;
    const copy = [...rows];
    const { col, dir } = sort;
    copy.sort((a, b) => {
      let av = a[col], bv = b[col];
      if (col === "marka")  av = a.marka, bv = b.marka;
      if (col === "atanan") av = a.lead?.name ?? "", bv = b.lead?.name ?? "";
      if (col === "no")     av = a.no, bv = b.no;
      if (col === "durum")  av = a.durum, bv = b.durum;
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (dir === "asc" ? 1 : -1);
    });
    return copy;
  }, [rows, sort, sortable]);

  function toggle(col) {
    setSort(s => s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" });
  }

  const cols = [
    { id: "no",     label: "#",      sort: true,  align: "right" },
    { id: "stale",  label: "🔔",     sort: false },
    { id: "deltaH", label: "Öncelik",sort: true },
    { id: "marka",  label: "Marka",  sort: true },
    { id: "baslik", label: "İş",     sort: true },
    { id: "atanan", label: "Atanan", sort: false },
    { id: "deadline",label:"Teslim", sort: true,  align: "right" },
    { id: "durum",  label: "Durum",  sort: true },
    { id: "rev",    label: "Rev",    sort: false, align: "right" },
    { id: "acilma", label: "Güncel", sort: true,  align: "right" },
    { id: "link",   label: "🔗",     sort: false }
  ];

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10,
      overflow: "auto"
    }}>
      <table style={{width:"100%", borderCollapse: "collapse", font:"400 13px/1.3 var(--font-sans)", color:"var(--ink)"}}>
        <thead>
          <tr style={{background:"var(--surface-sub)"}}>
            {cols.map(c => (
              <th key={c.id} onClick={() => c.sort && sortable && toggle(c.id)} style={{
                font:"600 11px/1 var(--font-sans)", color:"var(--ink-3)",
                letterSpacing:"0.04em", textTransform:"uppercase",
                textAlign: c.align === "right" ? "right" : "left",
                padding:"10px 10px",
                borderBottom:"1px solid var(--line-strong)",
                whiteSpace:"nowrap", cursor: c.sort && sortable ? "pointer" : "default",
                userSelect:"none", position:"sticky", top: 0, zIndex: 5,
                background:"var(--surface-sub)"
              }}>
                <span style={{display:"inline-flex", alignItems:"center", gap:4}}>
                  {c.label}
                  {sortable && c.sort && sort.col === c.id && (
                    <span style={{color:"var(--ink-2)"}}>{sort.dir === "asc" ? "↑" : "↓"}</span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr><td colSpan={11} style={{padding:"40px 16px", textAlign:"center"}}>
              <EmptyRow/>
            </td></tr>
          )}
          {sorted.map((b, idx) => (
            <BriefRow key={b.id} brief={b}
              onClick={() => onRowClick && onRowClick(b)}
              onStatusChange={onStatusChange}
              stripe={idx % 2 === 1}/>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BriefRow({ brief, onClick, onStatusChange, stripe }) {
  const [hover, setHover] = React.useState(false);
  const [menu, setMenu] = React.useState(false);
  return (
    <tr onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        cursor:"pointer",
        background: hover ? "var(--paper-2)" : (stripe ? "var(--surface-sub)" : "var(--surface)"),
        height: "var(--row-h)"
      }}>
      <td style={cellStyle(true, "right")}>{brief.no}</td>
      <td style={cellStyle()}>
        {brief.stale && <span title="3+ gün hareketsiz" style={{color:"var(--warning)"}}>●</span>}
        {!brief.stale && brief.deltaH <= 0 && <span title="Geçmiş" style={{color:"var(--prio-red)"}}>!</span>}
      </td>
      <td style={cellStyle()}><PriorityBadge p={brief.priority} deltaH={brief.deltaH} compact/></td>
      <td style={cellStyle()}><BrandChip brand={brief.brand} size="sm"/></td>
      <td style={{...cellStyle(), maxWidth: 320, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"var(--ink)"}}>
        {brief.baslik}
      </td>
      <td style={cellStyle()}>
        <span style={{display:"inline-flex", alignItems:"center", gap:6}}>
          <Avatar user={brief.lead} size={20}/>
          {brief.contributors.length > 0 && <AvatarStack users={brief.contributors} max={2} size={18}/>}
        </span>
      </td>
      <td style={cellStyle(true, "right")}>{formatDate(brief.deadline)}</td>
      <td style={{...cellStyle(), position:"relative"}}>
        <span onClick={(e) => { e.stopPropagation(); if (onStatusChange) setMenu(v => !v); }}
          style={{display:"inline-flex", padding:"4px 6px", borderRadius: 6,
            background: menu ? "var(--paper-2)" : "transparent"}}>
          <StatusPill status={brief.durum}/>
        </span>
        {menu && onStatusChange && (
          <StatusMenu current={brief.durum} onPick={(s) => { setMenu(false); onStatusChange(brief, s); }}
            onClose={() => setMenu(false)}/>
        )}
      </td>
      <td style={cellStyle(true, "right")}>{String(brief.revision).padStart(2, "0")}</td>
      <td style={cellStyle(true, "right")}>{relTime(brief.acilma)}</td>
      <td style={cellStyle()}>
        <a href={brief.slack_url} onClick={e => e.stopPropagation()} style={{color:"var(--ink-4)", display:"inline-flex"}}>
          <I.Link size={14}/>
        </a>
      </td>
    </tr>
  );
}

function StatusMenu({ current, onPick, onClose }) {
  const opts = [
    ["yeni",        "Yeni"],
    ["calisiliyor", "Çalışılıyor"],
    ["incelemede",  "İncelemede"],
    ["blokeli",     "Blokeli"],
    ["tamamlandi",  "Tamamlandı"]
  ];
  return (
    <div onClick={(e) => e.stopPropagation()} onMouseLeave={onClose} style={{
      position:"absolute", top: "100%", left: 0, marginTop: 4, zIndex: 60,
      background:"var(--surface)", border:"1px solid var(--line)",
      borderRadius: 8, padding: 4, boxShadow:"var(--shadow-1)", minWidth: 160
    }}>
      {opts.map(([k, v]) => (
        <button key={k} onClick={() => onPick(k)} style={{
          display:"flex", alignItems:"center", gap:8, width:"100%", textAlign:"left",
          padding:"6px 8px", border:0, background: current === k ? "var(--paper-2)" : "transparent",
          font: `${current === k ? 600 : 500} 12px/1 var(--font-sans)`, color:"var(--ink)",
          borderRadius: 6, cursor:"pointer"
        }}>
          <StatusPill status={k}/>
          {current === k && <span style={{marginLeft:"auto", color:"var(--ember)"}}>✓</span>}
        </button>
      ))}
    </div>
  );
}

function EmptyRow() {
  return (
    <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:10, color:"var(--ink-3)"}}>
      <I.Inbox size={28}/>
      <div style={{font:"500 14px/1.4 var(--font-sans)", color:"var(--ink-2)"}}>
        Bu filtreyle eşleşen brief yok.
      </div>
      <div style={{font:"400 12px/1.4 var(--font-sans)", color:"var(--ink-4)"}}>
        Kapsamı genişlet ya da filtreleri sıfırla.
      </div>
    </div>
  );
}

function cellStyle(mono, align) {
  return {
    padding: "var(--row-pad) 10px",
    borderBottom: "1px solid var(--line)",
    verticalAlign: "middle",
    textAlign: align || "left",
    fontVariantNumeric: "tabular-nums",
    fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
    fontSize: mono ? 12 : 13,
    color: mono ? "var(--ink-3)" : "var(--ink)",
    whiteSpace: "nowrap"
  };
}

function formatDate(ts) {
  if (!ts || isNaN(ts)) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  return `${d.getDate()} ${months[d.getMonth()]} · ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function relTime(ts) {
  if (!ts || isNaN(ts)) return "—";
  const now = (window.BNS_DATA && window.BNS_DATA.NOW) || Date.now();
  const dh = (now - ts) / (3600 * 1000);
  if (dh < 0) return "az önce";
  if (dh < 1) return Math.round(dh*60) + " dk önce";
  if (dh < 24) return Math.round(dh) + " sa önce";
  return Math.round(dh/24) + " gün önce";
}

window.BriefTable = BriefTable;
window.BriefRow = BriefRow;
window.formatDate = formatDate;
window.relTime = relTime;
window.EmptyRow = EmptyRow;
