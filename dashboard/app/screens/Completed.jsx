// app/screens/Completed.jsx — Tamamlananlar (12-col table).

function CompletedScreen({ data }) {
  const [range, setRange] = React.useState("30");
  const now = data.NOW || Date.now();

  // Range filtresi
  const cutoff = now - parseInt(range) * 24 * 3600 * 1000;
  const rows = data.completed.filter(c => {
    const ts = c.bitis || c.deadline || 0;
    return ts >= cutoff;
  });

  // KPI hesaplamaları gerçek veriden
  const avgSure   = rows.length ? (rows.reduce((s,c) => s + (c.sure || 0), 0) / rows.length) : 0;
  const avgGecikme = rows.length ? (rows.filter(c => c.gecikme > 0).reduce((s,c) => s + c.gecikme, 0) / Math.max(1, rows.filter(c => c.gecikme > 0).length)) : 0;
  const avgRev    = rows.length ? (rows.reduce((s,c) => s + (c.revision || 0), 0) / rows.length) : 0;
  const avgRating = rows.length ? (rows.filter(c => c.rating > 0).reduce((s,c) => s + c.rating, 0) / Math.max(1, rows.filter(c => c.rating > 0).length)) : 0;

  const fmtNum = (n) => n.toFixed(1).replace(".", ",");

  const cols = ["#","Marka","İş","Atanan","Deadline","Başla","Bitiş","Süre","Rev","Gecikme","⭐","🔗"];

  return (
    <div className="bn-tab-in">
      <PageHead
        title="Tamamlananlar"
        subtitle="12 sütun · post-completion rating ile"
        actions={
          <div style={{display:"inline-flex", padding:3, background:"var(--paper-2)", borderRadius:8}}>
            {[["7","Son 7 gün"],["30","30 gün"],["90","90 gün"]].map(([k,v]) => (
              <button key={k} onClick={() => setRange(k)} style={{
                font:"500 12px/1 var(--font-sans)", padding:"6px 10px",
                border:0, background: range===k ? "var(--surface)" : "transparent",
                color: range===k ? "var(--ink)" : "var(--ink-3)",
                borderRadius:6, cursor:"pointer",
                boxShadow: range===k ? "0 1px 2px rgba(22,22,26,0.06)" : "none"
              }}>{v}</button>
            ))}
          </div>
        }/>

      <div style={{display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap: 12, marginBottom: 16}}>
        <Kpi label="Tamamlanan" value={rows.length} sub={`son ${range} gün`}/>
        <Kpi label="Ort. süre"    value={rows.length ? fmtNum(avgSure) + " sa"  : "—"}/>
        <Kpi label="Ort. gecikme" value={rows.length ? fmtNum(avgGecikme) + " sa" : "—"}/>
        <Kpi label="Ort. revize"  value={rows.length ? fmtNum(avgRev)    : "—"}/>
        <Kpi label="Ort. puan"    value={rows.length && avgRating > 0 ? fmtNum(avgRating) + " / 5" : "—"}/>
      </div>

      <div style={{
        background:"var(--surface)", border:"1px solid var(--line)", borderRadius:10, overflow:"auto"
      }}>
        <table style={{width:"100%", borderCollapse:"collapse", font:"400 13px/1.3 var(--font-sans)", color:"var(--ink)"}}>
          <thead>
            <tr style={{background:"var(--surface-sub)"}}>
              {cols.map((h, i) => (
                <th key={i} style={{
                  font:"600 11px/1 var(--font-sans)", color:"var(--ink-3)",
                  letterSpacing:"0.04em", textTransform:"uppercase",
                  textAlign: ["Süre","Gecikme","#","Rev"].includes(h) ? "right" : "left",
                  padding:"10px 10px", borderBottom:"1px solid var(--line-strong)", whiteSpace:"nowrap"
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={12} style={{padding:"32px 16px", textAlign:"center", color:"var(--ink-4)", font:"400 13px/1.4 var(--font-sans)"}}>
                Son {range} günde tamamlanan brief bulunamadı.
              </td></tr>
            )}
            {rows.map((c, idx) => (
              <tr key={c.id} style={{background: idx % 2 === 1 ? "var(--surface-sub)" : "var(--surface)"}}>
                <td style={cs(true, "right")}>{c.no}</td>
                <td style={cs()}><BrandChip brand={c.brand} size="sm"/></td>
                <td style={{...cs(), maxWidth: 240, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{c.baslik}</td>
                <td style={cs()}><Avatar user={c.lead} size={20}/></td>
                <td style={cs(true)}>{fmt(c.deadline)}</td>
                <td style={cs(true)}>{fmt(c.basla)}</td>
                <td style={cs(true)}>{fmt(c.bitis)}</td>
                <td style={cs(true, "right")}>{c.sure} sa</td>
                <td style={cs(true, "right")}>{String(c.revision).padStart(2,"0")}</td>
                <td style={{...cs(true, "right"), color: c.gecikme > 0 ? "var(--prio-red)" : "var(--ink-4)"}}>
                  {c.gecikme > 0 ? c.gecikme + " sa" : "—"}
                </td>
                <td style={cs()}><Stars n={c.rating}/></td>
                <td style={cs()}><a href="#" style={{color:"var(--ink-4)", display:"inline-flex"}}><I.Link size={14}/></a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stars({ n }) {
  return (
    <span style={{display:"inline-flex", gap: 1}}>
      {[1,2,3,4,5].map(i => (
        <I.StarFill key={i} size={11} color={i <= n ? "var(--prio-yellow)" : "var(--line-strong)"}/>
      ))}
    </span>
  );
}

function cs(mono, align) {
  return {
    padding:"var(--row-pad) 10px",
    borderBottom:"1px solid var(--line)",
    fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
    fontSize: mono ? 12 : 13,
    color: mono ? "var(--ink-3)" : "var(--ink)",
    textAlign: align || "left",
    fontVariantNumeric:"tabular-nums",
    whiteSpace:"nowrap"
  };
}
function fmt(ts) {
  const d = new Date(ts);
  const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  return `${d.getDate()} ${months[d.getMonth()]} · ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

window.CompletedScreen = CompletedScreen;
