// app/screens/Completed.jsx — Tamamlananlar (12-col table).

function CompletedScreen({ data, onOpenBrief, currentUser }) {
  const [range, setRange] = React.useState("30");
  const now = (window.BNS_DATA && window.BNS_DATA.NOW) || data.NOW || Date.now();
  const allCompleted = data._allCompleted || data.completed || [];

  // Range filtresi
  const cutoff = now - parseInt(range) * 24 * 3600 * 1000;
  const rows = allCompleted.filter(c => {
    const ts = c.bitis || c.deadline || 0;
    return ts >= cutoff;
  });

  // KPI hesaplamaları gerçek veriden (sureH, gecikmeH alanları kullan)
  const withSure   = rows.filter(c => c.sureH > 0);
  const withGecikme = rows.filter(c => c.gecikmeH > 0);
  const withRating  = rows.filter(c => c.rating > 0);
  const avgSure    = withSure.length   ? withSure.reduce((s,c) => s + c.sureH, 0) / withSure.length : 0;
  const avgGecikme = withGecikme.length ? withGecikme.reduce((s,c) => s + c.gecikmeH, 0) / withGecikme.length : 0;
  const avgRev     = rows.length ? rows.reduce((s,c) => s + (c.revision || 0), 0) / rows.length : 0;
  const avgRating  = withRating.length  ? withRating.reduce((s,c) => s + c.rating, 0) / withRating.length : 0;

  const fmtNum = (n) => n.toFixed(1).replace(".", ",");

  const cols = [
    { h: "#",        mobile: true  },
    { h: "Marka",    mobile: true  },
    { h: "İş",       mobile: true  },
    { h: "Atanan",   mobile: false },
    { h: "Deadline", mobile: true  },
    { h: "Başla",    mobile: false },
    { h: "Bitiş",    mobile: false },
    { h: "Süre",     mobile: true  },
    { h: "Rev",      mobile: false },
    { h: "Gecikme",  mobile: true  },
    { h: "⭐",       mobile: true  },
    { h: "🔗",       mobile: false },
  ];

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

      <div className="bns-kpi-5" style={{display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap: 12, marginBottom: 16}}>
        <Kpi label="Tamamlanan" value={rows.length} sub={`son ${range} gün`}/>
        <Kpi label="Ort. süre"    value={rows.length ? fmtNum(avgSure) + " sa"  : "—"}/>
        <Kpi label="Ort. gecikme" value={rows.length ? fmtNum(avgGecikme) + " sa" : "—"}/>
        <Kpi label="Ort. revize"  value={rows.length ? fmtNum(avgRev)    : "—"}/>
        <Kpi label="Ort. puan"    value={rows.length && avgRating > 0 ? fmtNum(avgRating) + " / 5" : "—"}/>
      </div>

      <div className="bns-table-wrap" style={{
        background:"var(--surface)", border:"1px solid var(--line)", borderRadius:10,
        overflowX:"auto", WebkitOverflowScrolling:"touch", minWidth:0
      }}>
        <table style={{width:"100%", minWidth:440, borderCollapse:"collapse", font:"400 13px/1.3 var(--font-sans)", color:"var(--ink)"}}>
          <thead>
            <tr style={{background:"var(--surface-sub)"}}>
              {cols.map((c, i) => (
                <th key={i} className={c.mobile ? "" : "bns-col-mobile-hide"} style={{
                  font:"600 11px/1 var(--font-sans)", color:"var(--ink-3)",
                  letterSpacing:"0.04em", textTransform:"uppercase",
                  textAlign: ["Süre","Gecikme","#","Rev"].includes(c.h) ? "right" : "left",
                  padding:"10px 10px", borderBottom:"1px solid var(--line-strong)", whiteSpace:"nowrap"
                }}>{c.h}</th>
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
              <tr key={c.id} onClick={() => onOpenBrief && onOpenBrief(c)} title="İşin akışını görüntüle"
                style={{background: idx % 2 === 1 ? "var(--surface-sub)" : "var(--surface)", cursor: onOpenBrief ? "pointer" : "default"}}>
                <td style={cs(true, "right")}>{c.no}</td>
                <td style={cs()}><BrandChip brand={c.brand} size="sm"/></td>
                <td style={{...cs(), maxWidth: 240, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{c.baslik}</td>
                <td className="bns-col-mobile-hide" style={cs()}><Avatar user={c.lead} size={20}/></td>
                <td style={cs(true)}>{fmt(c.deadline)}</td>
                <td className="bns-col-mobile-hide" style={cs(true)}>{c.baslangic ? fmt(c.baslangic) : "—"}</td>
                <td className="bns-col-mobile-hide" style={cs(true)}>{c.bitis ? fmt(c.bitis) : "—"}</td>
                <td style={cs(true, "right")}>{c.sureH != null && c.sureH > 0 ? c.sureH.toFixed(1) + " sa" : "—"}</td>
                <td className="bns-col-mobile-hide" style={cs(true, "right")}>{String(c.revision || 0).padStart(2,"0")}</td>
                <td style={{...cs(true, "right"), color: c.gecikmeH > 0 ? "var(--prio-red)" : "var(--ink-4)"}}>
                  {c.gecikmeH > 0 ? c.gecikmeH.toFixed(1) + " sa" : "—"}
                </td>
                <td style={cs()} onClick={e => e.stopPropagation()}>
                  <Stars n={c.rating} ai={c.rating_by === 'ai'}
                    sebep={c.rating_sebep || (c.insight ? c.insight.split(/(?<=[.!?])\s/).slice(0, 2).join(' ').slice(0, 200) : null)}
                    onRate={currentUser?.role === 'admin' ? (n) => rateBrief(c.id, n) : null}/>
                </td>
                <td className="bns-col-mobile-hide" style={cs()}>
                  <a href={c.slack_url && c.slack_url !== "#" ? c.slack_url : undefined}
                     target="_blank" rel="noopener noreferrer"
                     title={c.slack_url && c.slack_url !== "#" ? "Slack'te aç" : "Link yok"}
                     style={{color: c.slack_url && c.slack_url !== "#" ? "var(--ink-3)" : "var(--ink-5)", display:"inline-flex"}}>
                    <I.Link size={14}/>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Yönetici puanı değiştirmek için yıldıza tıklar (PATCH /api/briefs/:id/rating).
function rateBrief(id, n) {
  const tok = (typeof localStorage !== "undefined" && localStorage.getItem("bns_token")) || "";
  const API = window.BNS_API_BASE || "https://benseno-api-production.up.railway.app";
  fetch(`${API}/api/briefs/${id}/rating`, {
    method: "PATCH",
    headers: { "content-type": "application/json", Authorization: "Bearer " + tok },
    body: JSON.stringify({ rating: n }),
  }).then(r => { if (r.ok && window.bnsRefresh) window.bnsRefresh(); })
    .catch(() => {});
}

function Stars({ n, onRate, ai, sebep }) {
  const tip = [n > 0 && sebep ? sebep : null, onRate ? "Puanı değiştirmek için yıldıza tıkla" : null].filter(Boolean).join("\n");
  return (
    <span style={{display:"inline-flex", gap: 1, alignItems:"center"}} title={tip || undefined}>
      {[1,2,3,4,5].map(i => (
        <span key={i} onClick={onRate ? () => onRate(i) : undefined}
          style={{display:"inline-flex", cursor: onRate ? "pointer" : "default", padding: onRate ? 1 : 0}}>
          <I.StarFill size={11} color={i <= n ? "var(--prio-yellow)" : "var(--line-strong)"}/>
        </span>
      ))}
      {ai && n > 0 && <span style={{font:"600 8px/1 var(--font-sans)", color:"var(--ink-4)", marginLeft:3, letterSpacing:"0.05em"}}>AI</span>}
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
