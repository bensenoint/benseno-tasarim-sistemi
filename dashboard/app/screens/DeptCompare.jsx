// app/screens/DeptCompare.jsx — bar charts comparing Tasarım / Editör / AI.

function DeptCompareScreen({ data }) {
  const raw = data.deptStats || {};
  const DEPT_DEF = {
    tasarim: { name: "Tasarım", people: 7, active: 0, overdue: 0, capacity: 42, completed30: 0, avgComplete: 0, revRate: 0 },
    editor:  { name: "Editör",  people: 8, active: 0, overdue: 0, capacity: 48, completed30: 0, avgComplete: 0, revRate: 0 },
    ai:      { name: "AI",      people: 1, active: 0, overdue: 0, capacity:  6, completed30: 0, avgComplete: 0, revRate: 0 },
  };

  // active ve overdue'yu Department screen ile aynı mantıkla live hesapla
  const allBriefs    = data._allBriefs    || data.briefs    || [];
  const allCompleted = data._allCompleted || data.completed || [];
  const cutoff30 = Date.now() - 30 * 24 * 3600000;

  function deptRows(role) {
    return allBriefs.filter(b =>
      (b.lead && (b.lead.rol || b.lead.dept) === role) ||
      b.dept === role ||
      (Array.isArray(b.contributors) && b.contributors.some(c => c && (c.rol || c.dept) === role))
    );
  }
  function deptCompleted(role) {
    return allCompleted.filter(c =>
      (c.lead && (c.lead.rol || c.lead.dept) === role) ||
      (Array.isArray(c.contributors) && c.contributors.some(cc => cc && (cc.rol || cc.dept) === role))
    );
  }

  const computed = {};
  for (const role of ["tasarim","editor","ai"]) {
    const rows   = deptRows(role);
    const doneAll = deptCompleted(role);
    const done30  = doneAll.filter(c => (c.bitis || 0) >= cutoff30);
    const sures   = doneAll.filter(c => c.sureH > 0).map(c => c.sureH);
    const avgH    = sures.length ? Math.round(sures.reduce((a,v)=>a+v,0)/sures.length) : 0;
    const revs    = doneAll.map(c => c.revision || 0);
    const avgRev  = revs.length ? parseFloat((revs.reduce((a,v)=>a+v,0)/revs.length).toFixed(2)) : 0;
    computed[role] = {
      active:      rows.length,
      overdue:     rows.filter(b => b.deltaH <= 0 && b.durum !== "tamamlandi").length,
      completed30: done30.length,
      avgComplete: avgH,
      revRate:     avgRev,
    };
  }

  const d = {
    tasarim: { ...DEPT_DEF.tasarim, ...(raw.tasarim || {}), ...computed.tasarim },
    editor:  { ...DEPT_DEF.editor,  ...(raw.editor  || {}), ...computed.editor  },
    ai:      { ...DEPT_DEF.ai,      ...(raw.ai      || {}), ...computed.ai      },
  };
  // capacity_pct'yi live active ile yeniden hesapla
  for (const role of ["tasarim","editor","ai"]) {
    d[role].capacity_pct = d[role].capacity > 0 ? Math.min(100, Math.round((d[role].active / d[role].capacity) * 100)) : 0;
  }
  const metrics = [
    { key: "completed30", label: "Tamamlanan iş (30 gün)", unit: "" },
    { key: "avgComplete", label: "Ort. tamamlama süresi",   unit: "sa" },
    { key: "overdue",     label: "Geciken iş",               unit: "" },
    { key: "active",      label: "Aktif yük",                unit: "" },
    { key: "revRate",     label: "Revize oranı",             unit: "%" }
  ];
  const palette = { tasarim: "var(--bw-1)", editor: "var(--bw-4)", ai: "var(--bw-14)" };

  return (
    <div className="bn-tab-in">
      <PageHead
        title="Departmanlar · karşılaştırma"
        subtitle="tasarım · editör · AI · son 30 gün performansı"/>

      <div className="bn-grid-3" style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap: 12, marginBottom: "var(--section-gap)"}}>
        {["tasarim", "editor", "ai"].map(k => {
          const s = d[k];
          return (
            <Card key={k} accent={palette[k]}>
              <Eyebrow>{s.name} · {s.people} kişi</Eyebrow>
              <div style={{display:"flex", alignItems:"baseline", gap: 10, marginTop: 8}}>
                <span style={{font:"600 36px/1.15 var(--font-sans)", color:"var(--ink)", letterSpacing:"-0.01em", fontVariantNumeric:"tabular-nums"}}>{s.active}</span>
                <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink-3)"}}>aktif iş</span>
              </div>
              <div style={{font:"500 12px/1.4 var(--font-sans)", color:"var(--ink-3)", marginTop: 6}}>
                <span style={{color:"var(--prio-red)", fontWeight: 600}}>{s.overdue}</span> geciken ·{" "}
                <span style={{color: (s.capacity_pct||bnsCapPct(s)) > 85 ? "var(--warning)" : "var(--ink)", fontWeight: 600}}>%{s.capacity_pct != null ? s.capacity_pct : bnsCapPct(s)}</span> kapasite
              </div>
              <div style={{marginTop: 12, height: 6, background:"var(--line-soft)", borderRadius:999, overflow:"hidden"}}>
                <div style={{width: (s.capacity_pct != null ? s.capacity_pct : bnsCapPct(s)) + "%", height:"100%", background: palette[k]}}/>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHead title="Metrik karşılaştırma" sub="bar chart · son 30 gün"/>
        <div style={{display:"flex", flexDirection:"column", gap: 18, paddingTop: 4}}>
          {metrics.map(m => {
            const max = Math.max(...["tasarim","editor","ai"].map(k => d[k][m.key]));
            return (
              <div key={m.key}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom: 8}}>
                  <span style={{font:"600 13px/1 var(--font-sans)", color:"var(--ink-2)"}}>{m.label}</span>
                  <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)"}}>en yüksek: {fmtN(max, m.unit)}</span>
                </div>
                <div style={{display:"grid", gridTemplateColumns: "100px 1fr", rowGap: 6, columnGap: 12, alignItems:"center"}}>
                  {["tasarim","editor","ai"].map(k => {
                    const s = d[k];
                    const w = max === 0 ? 0 : (s[m.key] / max) * 100;
                    return (
                      <React.Fragment key={k}>
                        <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink-2)"}}>{s.name}</span>
                        <div style={{display:"flex", alignItems:"center", gap: 10}}>
                          <div style={{flex:1, height: 18, background:"var(--paper-2)", borderRadius: 4, overflow:"hidden"}}>
                            <div style={{
                              width:"100%", height:"100%", background: palette[k],
                              transform:`scaleX(${w/100})`, transformOrigin:"left",
                              transition:"transform 240ms cubic-bezier(0.2,0,0,1)"
                            }}/>
                          </div>
                          <span style={{font:"600 12px/1 var(--font-mono)", color:"var(--ink)", minWidth: 56, textAlign:"right", fontVariantNumeric:"tabular-nums"}}>
                            {fmtN(s[m.key], m.unit)}
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function fmtN(v, unit) {
  if (v == null || isNaN(v)) return "—";
  if (unit === "%") return "%" + (Number.isInteger(v) ? v : v.toFixed(2));
  if (unit === "sa") return (Number.isInteger(v) ? v : v.toFixed(1)).toString().replace(".", ",") + " sa";
  return String(v);
}

window.DeptCompareScreen = DeptCompareScreen;
