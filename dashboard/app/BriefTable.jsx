// app/BriefTable.jsx — Aktif İşler table.
// 11 cols · density-aware · sortable headers · inline status change.

// ₺ formatı: null/boş/NaN → "—" ; sayı → "₺1.500"
function fmtTRY(n) {
  if (n == null || n === "" || isNaN(Number(n))) return "—";
  return "₺" + Number(n).toLocaleString("tr-TR");
}
// fatura/ödeme durum rozeti: true → yeşil ✓ ; false → gri —
function FlagCell({ on, label }) {
  return on
    ? <span title={label + " ✓"} style={{ color: "var(--ok,#1a8f5a)", fontWeight: 700 }}>✓</span>
    : <span style={{ color: "var(--ink-5)" }}>—</span>;
}

function BriefTable({ rows, onRowClick, onStatusChange, sortable = true, view = "table", financeCols = false }) {
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
      if (col === "oncelik") { const O = { red: 0, org: 1, ylw: 2, grn: 3 }; av = O[a.oncelik?.code] ?? 2; bv = O[b.oncelik?.code] ?? 2; }
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
    { id: "no",      label: "#",        sort: true,  align: "right" },
    { id: "oncelik", label: "Öncelik",  sort: true },
    { id: "deltaH",  label: "Kalan",    sort: true },
    { id: "marka",   label: "Marka",    sort: true },
    { id: "baslik",  label: "İş",       sort: true },
    { id: "atanan",  label: "Atanan",   sort: false, mobileHide: true },
    { id: "deadline",label: "Teslim",   sort: true,  align: "right" },
    { id: "durum",   label: "Durum",    sort: true,  mobileHide: true },
    { id: "rev",     label: "Rev#",     sort: false, align: "right", mobileHide: true },
    { id: "acilma",  label: "Açıldı",   sort: true,  align: "right", mobileHide: true },
    { id: "gecikme", label: "Gecikme",  sort: false, align: "right", mobileHide: true },
    { id: "link",    label: "🔗",       sort: false }
  ];
  if (financeCols) {
    cols.push(
      { id: "maliyet", label: "Maliyet", sort: true, align: "right", mobileHide: true },
      { id: "satis",   label: "Satış",   sort: true, align: "right", mobileHide: true },
      { id: "fatura",  label: "Fatura",  sort: false, align: "center", mobileHide: true },
      { id: "odeme",   label: "Ödeme",   sort: false, align: "center", mobileHide: true }
    );
  }

  // Toplam satırı (sadece financeCols) — görüntülenen satırlar üzerinden
  const totals = React.useMemo(() => {
    let m = 0, s = 0, fa = 0, od = 0;
    for (const b of sorted) {
      m += Number(b.maliyet) || 0;
      s += Number(b.satis) || 0;
      if (b.fatura) fa += Number(b.satis) || 0;   // faturalanan tutar
      if (b.odeme)  od += Number(b.satis) || 0;   // tahsil edilen tutar
    }
    return { m, s, fa, od };
  }, [sorted]);

  return (
    <div className="bns-table-wrap" style={{
      background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10,
      overflowX: "auto", WebkitOverflowScrolling: "touch"
    }}>
      <table style={{width:"100%", minWidth: 0, borderCollapse: "collapse", font:"400 13px/1.3 var(--font-sans)", color:"var(--ink)"}}>
        <thead>
          <tr style={{background:"var(--surface-sub)"}}>
            {cols.map(c => (
              <th key={c.id} onClick={() => c.sort && sortable && toggle(c.id)}
                className={c.mobileHide ? "bns-col-mobile-hide" : ""}
                style={{
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
            <tr><td colSpan={cols.length} style={{padding:"40px 16px", textAlign:"center"}}>
              <EmptyRow/>
            </td></tr>
          )}
          {sorted.map((b, idx) => (
            <BriefRow key={b.id} brief={b}
              onClick={() => onRowClick && onRowClick(b)}
              onStatusChange={onStatusChange}
              financeCols={financeCols}
              stripe={idx % 2 === 1}/>
          ))}
        </tbody>
        {financeCols && sorted.length > 0 && (
          <tfoot>
            <tr style={{ background: "var(--surface-sub)", borderTop: "2px solid var(--line-strong)" }}>
              <td colSpan={cols.length - 4} style={{ ...cellStyle(), textAlign: "right", font: "700 11px/1 var(--font-sans)", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-2)" }}>Toplam</td>
              <td className="bns-col-mobile-hide" style={{ ...cellStyle(true, "right"), fontWeight: 700, color: "var(--ink)" }}>{fmtTRY(totals.m)}</td>
              <td className="bns-col-mobile-hide" style={{ ...cellStyle(true, "right"), fontWeight: 700, color: "var(--ink)" }}>{fmtTRY(totals.s)}</td>
              <td className="bns-col-mobile-hide" style={{ ...cellStyle(true, "right"), fontWeight: 700, color: "var(--ink-2)" }} title="Faturalanan tutar (Σ satış · fatura kesilmiş)">{fmtTRY(totals.fa)}</td>
              <td className="bns-col-mobile-hide" style={{ ...cellStyle(true, "right"), fontWeight: 700, color: "var(--ok,#1a8f5a)" }} title="Tahsil edilen tutar (Σ satış · ödeme yapılmış)">{fmtTRY(totals.od)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function BriefRow({ brief, onClick, onStatusChange, stripe, financeCols }) {
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
      <td style={cellStyle()}><PriorityBadge p={brief.oncelik || { code: "ylw", label: "NORMAL" }}/></td>
      <td style={cellStyle()}><PriorityBadge p={brief.priority} deltaH={brief.deltaH} compact/></td>
      <td style={cellStyle()}><BrandChip brand={brief.brand} size="sm"/></td>
      <td style={{...cellStyle(), maxWidth: 160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"var(--ink)"}}>
        {brief.baslik}
      </td>
      <td className="bns-col-mobile-hide" style={cellStyle()}>
        <span style={{display:"inline-flex", alignItems:"center", gap:6}}>
          <Avatar user={brief.lead} size={20}/>
          {brief.contributors.length > 0 && <AvatarStack users={brief.contributors} max={2} size={18}/>}
        </span>
      </td>
      <td style={cellStyle(true, "right")}>
        {typeof bnsIsRisk === "function" && bnsIsRisk(brief.durum, brief.deltaH) && (
          <span title="Termin riski: teslime az kaldı, iş hâlâ aktif"
            style={{marginRight:5, cursor:"default"}}>⚠️</span>
        )}
        {formatDate(brief.deadline)}
        {brief.uzatildi && (
          <span title={`Deadline ${brief.uzatma_sayisi}× uzatıldı`}
            style={{marginLeft:5, font:"600 9px/1 var(--font-sans)", color:"var(--prio-yellow)",
              background:"rgba(224,169,43,.14)", padding:"2px 5px", borderRadius:4, whiteSpace:"nowrap"}}>
            uzatıldı{brief.uzatma_sayisi > 1 ? ` ×${brief.uzatma_sayisi}` : ""}
          </span>
        )}
      </td>
      <td className="bns-col-mobile-hide" style={{...cellStyle(), position:"relative"}}>
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
      <td className="bns-col-mobile-hide" style={cellStyle(true, "right")}>{(brief.rev_ic > 0 || brief.rev_musteri > 0)
        ? <span title={`${brief.rev_ic||0} iç · ${brief.rev_musteri||0} müşteri revizyonu`}>{brief.rev_ic||0}<span style={{color:"var(--ink-5)"}}>/</span><span style={{color:"#7c5cff"}}>{brief.rev_musteri||0}</span></span>
        : brief.revision > 0 ? brief.revision : <span style={{color:"var(--ink-5)"}}>—</span>}</td>
      <td className="bns-col-mobile-hide" style={cellStyle(true, "right")} title="İşin açıldığı tarih ve saat">
        {brief.acilma ? new Date(brief.acilma).toLocaleString("tr-TR", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }) : "—"}
      </td>
      <td className="bns-col-mobile-hide" style={cellStyle(true, "right")} title={brief.acilma ? "açılışından beri geçen süre" : ""}>{relTime(brief.acilma)}</td>
      <td style={cellStyle()}>
        <a href={brief.slack_url && brief.slack_url !== "#" ? brief.slack_url : undefined}
           target="_blank" rel="noopener noreferrer"
           onClick={e => e.stopPropagation()}
           title={brief.slack_url && brief.slack_url !== "#" ? "Slack'te aç" : "Link yok"}
           style={{color: brief.slack_url && brief.slack_url !== "#" ? "var(--ink-3)" : "var(--ink-5)", display:"inline-flex"}}>
          <I.Link size={14}/>
        </a>
      </td>
      {financeCols && <td className="bns-col-mobile-hide" style={cellStyle(true, "right")}>{fmtTRY(brief.maliyet)}</td>}
      {financeCols && <td className="bns-col-mobile-hide" style={cellStyle(true, "right")}>{fmtTRY(brief.satis)}</td>}
      {financeCols && <td className="bns-col-mobile-hide" style={cellStyle(false, "center")}><FlagCell on={brief.fatura} label="Fatura kesildi"/></td>}
      {financeCols && <td className="bns-col-mobile-hide" style={cellStyle(false, "center")}><FlagCell on={brief.odeme} label="Ödeme yapıldı"/></td>}
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
  if (dh < 1) return Math.round(dh*60) + "dk";
  if (dh < 24) return Math.round(dh) + "sa";
  return Math.round(dh/24) + "g";
}

window.BriefTable = BriefTable;
window.BriefRow = BriefRow;
window.fmtTRY = fmtTRY;
window.formatDate = formatDate;
window.relTime = relTime;
window.EmptyRow = EmptyRow;
