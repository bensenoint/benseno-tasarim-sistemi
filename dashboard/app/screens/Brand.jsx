// app/screens/Brand.jsx — 39 markanın stats listesi.

function BrandScreen({ data, onOpenBrief }) {
  const [sort, setSort] = React.useState("active");
  const [search, setSearch] = React.useState("");
  let rows = data.brandStats;
  if (search.trim()) {
    const q = search.toLowerCase();
    rows = rows.filter(b => b.name.toLowerCase().includes(q));
  }
  rows = [...rows].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "tr");
    if (sort === "medianH") return a.medianH - b.medianH;
    return b[sort] - a[sort];
  });

  // Marka istatistikleri tüm sistem briefler'inden hesaplanır — viewMode etkilemez.
  const allBriefs = data._allBriefs || data.briefs;
  const totalActive = allBriefs.length;
  const busiest = [...data.brandStats].sort((a,b) => b.active - a.active)[0];
  const avg = (totalActive / Math.max(1, data.brandStats.length)).toFixed(1);

  return (
    <div className="bn-tab-in">
      <PageHead
        title="Marka"
        subtitle={`${data.brandStats.length} marka · marka başına ortalama ${avg} aktif brief`}
        actions={<>
          <div style={{
            display:"inline-flex", alignItems:"center", gap:6,
            padding:"5px 10px", border:"1px solid var(--line)", borderRadius:6,
            background:"var(--surface)", color:"var(--ink-3)"
          }}>
            <I.Search size={13}/>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Marka ara…"
              style={{border:0, outline:"none", background:"transparent", color:"var(--ink)",
                font:"400 12px/1.2 var(--font-sans)", minWidth: 140}}/>
          </div>
        </>}
      />

      <div className="bns-kpi-4" style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"var(--grid-gap)", marginBottom:"var(--section-gap)"}}>
        <Kpi label="Toplam marka" value={data.brandStats.length}/>
        <Kpi label="En yoğun" value={busiest.active} sub={busiest.name} color={busiest.color}/>
        <Kpi label="Ort. brief/marka" value={avg}/>
        <Kpi label="Sorunlu marka" value={data.brandStats.filter(b => b.stale).length} color="var(--warning)"/>
      </div>

      <Card padding={0}>
        <div style={{overflowX:"auto", WebkitOverflowScrolling:"touch"}}>
          <table style={{width:"100%", minWidth:540, borderCollapse:"collapse", font:"400 13px/1.3 var(--font-sans)"}}>
            <thead>
              <tr style={{background:"var(--surface-sub)"}}>
                {[
                  ["name","Marka"],
                  ["active","Aktif"],
                  ["done30","Son 30g"],
                  ["medianH","Medyan deadline"],
                  ["madH","MAD"],
                  ["avgRev","Ort. revize"],
                  ["rating","Puan"],
                  ["risk","Risk"]
                ].map(([k, v]) => (
                  <th key={k} onClick={() => k !== "risk" && setSort(k)} style={{
                    font:"600 11px/1 var(--font-sans)", color:"var(--ink-3)",
                    letterSpacing:"0.04em", textTransform:"uppercase",
                    padding:"10px 12px", borderBottom:"1px solid var(--line-strong)",
                    cursor: k === "risk" ? "default" : "pointer",
                    textAlign: ["active","done30","medianH","madH","avgRev","rating"].includes(k) ? "right" : "left",
                    whiteSpace:"nowrap",
                    userSelect:"none"
                  }}>
                    {v} {sort === k && <span style={{color:"var(--ink-2)"}}>↓</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b, idx) => (
                <tr key={b.name} style={{
                  background: idx % 2 === 1 ? "var(--surface-sub)" : "var(--surface)",
                  cursor:"pointer"
                }}>
                  <td style={bCs()}>
                    <span style={{display:"inline-flex", alignItems:"center", gap: 8}}>
                      <span style={{width:10, height:10, borderRadius:999, background: b.color, flexShrink:0}}/>
                      <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink)"}}>{b.name}</span>
                    </span>
                  </td>
                  <td style={bCs(true, "right", b.active > 2 ? "var(--ink)" : "var(--ink-3)")}>{b.active}</td>
                  <td style={bCs(true, "right")}>{b.done30 != null ? b.done30 : "—"}</td>
                  <td style={bCs(true, "right")}>{b.medianH != null ? b.medianH + " sa" : "—"}</td>
                  <td style={bCs(true, "right")}>{b.madH != null ? "± " + b.madH + " sa" : "—"}</td>
                  <td style={bCs(true, "right")}>{b.avgRev != null ? b.avgRev : "—"}</td>
                  <td style={bCs(true, "right")}>{b.rating != null ? <span style={{color:"var(--prio-yellow)"}}>{b.rating}</span> : "—"}</td>
                  <td style={bCs()}>
                    {b.stale ? <span style={{
                      font:"600 10px/1 var(--font-sans)", letterSpacing:"0.04em", textTransform:"uppercase",
                      color:"var(--prio-orange)", background:"var(--prio-orange-bg)",
                      padding:"3px 7px", borderRadius:999
                    }}>İzle</span> : (
                      <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)"}}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function bCs(mono, align, color) {
  return {
    padding:"var(--row-pad) 12px",
    borderBottom:"1px solid var(--line)",
    fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
    fontSize: mono ? 12 : 13,
    color: color || (mono ? "var(--ink-3)" : "var(--ink)"),
    textAlign: align || "left",
    fontVariantNumeric:"tabular-nums",
    whiteSpace:"nowrap"
  };
}

window.BrandScreen = BrandScreen;
