// app/screens/Team.jsx — 17 kişi × 39 marka heatmap matrix.

// Yerel zaman aralığı toggle'ı (Profil global tarih filtresine geçince buradan kaldırılmıştı;
// Ekip matrisi hâlâ kullandığı için burada tutuluyor — tek tüketici burası).
const TIME_RANGES = [
  { key: "7",   label: "7 gün",  days: 7   },
  { key: "30",  label: "30 gün", days: 30  },
  { key: "90",  label: "90 gün", days: 90  },
  { key: "all", label: "Tümü",   days: null },
];

function TimeRangeToggle({ value, onChange }) {
  return (
    <div style={{display:"inline-flex", padding:3, background:"var(--paper-2)", borderRadius:8, gap:1}}>
      {TIME_RANGES.map(r => (
        <button key={r.key} onClick={() => onChange(r.key)} style={{
          font:"500 11px/1 var(--font-sans)", padding:"5px 10px", border:0,
          background: value === r.key ? "var(--surface)" : "transparent",
          color: value === r.key ? "var(--ink)" : "var(--ink-3)",
          borderRadius:5, cursor:"pointer",
          boxShadow: value === r.key ? "0 1px 2px rgba(22,22,26,0.06)" : "none"
        }}>{r.label}</button>
      ))}
    </div>
  );
}

function TeamScreen({ data }) {
  const [timeRange, setTimeRange] = React.useState("all");
  const allUsers  = data.USERS  || [];
  const allBrands = data.BRANDS || [];
  const allBriefs    = data._allBriefs    || data.briefs    || [];
  const allCompleted = data.completed || data._allCompleted || [];   // üst takvim filtresine süzülü tamamlananlar

  // Zaman filtresiyle matrix hesapla
  const rangeDays = TIME_RANGES.find(r => r.key === timeRange)?.days;
  const cutoff = rangeDays ? Date.now() - rangeDays * 86400000 : 0;

  const mx = {};
  allUsers.forEach(u => {
    mx[u.id] = {};
    allBrands.forEach(b => { mx[u.id][b.name] = 0; });
  });
  function addMx(uid, mn) {
    if (uid && mn && mx[uid] && mx[uid][mn] !== undefined) mx[uid][mn]++;
  }
  // Tamamlananlar (filtreli)
  allCompleted.forEach(c => {
    const ts = (c.bitis || c.deadline || 0) * (c.bitis < 1e10 ? 1000 : 1);
    if (cutoff && ts < cutoff) return;
    const mn = c.marka || c.brand?.name;
    addMx(c.lead?.id, mn);
    (c.contributors || []).forEach(cu => addMx(cu?.id, mn));
  });
  // Aktif briefler (filtre yok — aktifler her zaman dahil)
  if (!cutoff) {
    allBriefs.forEach(b => {
      const mn = b.marka || b.brand?.name;
      addMx(b.lead?.id, mn);
      (b.contributors || []).forEach(cu => addMx(cu?.id, mn));
    });
  }

  const m = mx;
  const users = allUsers;
  const brands = allBrands;

  // Find max value for color scale
  let max = 1;
  users.forEach(u => brands.forEach(b => { const v = (m[u.id] || {})[b.name] || 0; if (v > max) max = v; }));

  function cell(v) {
    if (v === 0) return { bg: "transparent", color: "var(--ink-4)" };
    const t = v / max;
    return {
      bg: `color-mix(in oklab, var(--ember) ${Math.round(t * 75 + 8)}%, var(--surface))`,
      color: t > 0.6 ? "#fff" : "var(--ink)"
    };
  }

  return (
    <div className="bn-tab-in">
      <PageHead
        title="Ekip matrisi"
        subtitle={`${users.length} kişi × ${brands.length} marka · yoğunluk haritası`}
        actions={<TimeRangeToggle value={timeRange} onChange={setTimeRange}/>}
      />

      <div style={{display:"flex", alignItems:"center", gap: 16, marginBottom: 14, font:"500 12px/1 var(--font-sans)", color:"var(--ink-3)"}}>
        <span>Renk skalası:</span>
        <div style={{display:"flex", alignItems:"center", gap: 4}}>
          <span style={{font:"500 11px/1 var(--font-mono)"}}>0</span>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <span key={i} style={{
              width: 18, height: 14,
              background: `color-mix(in oklab, var(--ember) ${i * 10 + 8}%, var(--surface))`,
              border:"1px solid var(--line)"
            }}/>
          ))}
          <span style={{font:"500 11px/1 var(--font-mono)"}}>{max}+</span>
        </div>
      </div>

      <Card padding={0} style={{overflowX:"auto", WebkitOverflowScrolling:"touch", maxHeight:"72vh"}}>
        <table style={{borderCollapse:"collapse", minWidth:480, font:"400 11px/1 var(--font-mono)", color:"var(--ink-2)"}}>
          <thead>
            <tr>
              <th className="bns-mtx-h" style={{
                position:"sticky", left: 0, top: 0, zIndex: 3,
                background:"var(--paper)", padding:"10px 12px",
                borderRight:"1px solid var(--line-strong)",
                borderBottom:"1px solid var(--line-strong)",
                font:"600 11px/1 var(--font-sans)", color:"var(--ink-3)",
                letterSpacing:"0.04em", textTransform:"uppercase", textAlign:"left",
                minWidth: 200
              }}>Kişi / Marka</th>
              {brands.map(b => (
                <th key={b.name} title={b.name} style={{
                  position:"sticky", top: 0, zIndex: 2, background:"var(--paper)",
                  padding:"8px 6px", borderBottom:"1px solid var(--line-strong)",
                  font:"500 10px/1 var(--font-sans)", color:"var(--ink-3)",
                  height: 120, verticalAlign:"bottom", minWidth: 32
                }}>
                  <div style={{
                    transform:"rotate(-65deg)", transformOrigin:"left bottom",
                    width: 110, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                    marginLeft: 24, position:"relative"
                  }}>
                    <span style={{display:"inline-block", width: 6, height: 6, borderRadius: 999,
                      background: b.color, marginRight: 6, verticalAlign: "middle"}}/>
                    {b.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td className="bns-mtx-h" style={{
                  position:"sticky", left: 0, zIndex: 1, background:"var(--paper)",
                  padding:"6px 12px", borderRight:"1px solid var(--line-strong)",
                  borderBottom:"1px solid var(--line-soft)",
                  font:"500 12px/1 var(--font-sans)", color:"var(--ink)",
                  display:"flex", alignItems:"center", gap:8, minWidth: 200
                }}>
                  <Avatar user={u} size={20}/>
                  <span className="bns-mtx-name" onClick={() => window.bnsOpenUser && window.bnsOpenUser(u.id)} title={`${u.name} · profili aç`} style={{whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", cursor:"pointer", minWidth:0}}>{u.name}</span>
                  <span className="bns-mtx-role" style={{marginLeft:"auto", font:"500 10px/1 var(--font-mono)", color:"var(--ink-4)"}}>{u.rol}</span>
                </td>
                {brands.map(b => {
                  const v = (m[u.id] || {})[b.name] || 0;
                  const c = cell(v);
                  return (
                    <td key={b.name} title={`${u.name} × ${b.name}: ${v} iş`} style={{
                      padding: 0, borderBottom:"1px solid var(--line-soft)",
                      borderRight:"1px solid var(--line-soft)",
                      background: c.bg, color: c.color,
                      textAlign:"center", minWidth: 32, height: 26,
                      font:"500 11px/1 var(--font-mono)",
                      fontVariantNumeric:"tabular-nums"
                    }}>{v || ""}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

window.TeamScreen = TeamScreen;
