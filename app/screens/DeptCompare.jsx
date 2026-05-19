// app/screens/DeptCompare.jsx — bar charts comparing Tasarım / Editör / AI.

function DeptCompareScreen({ data }) {
  const d = data.deptStats;
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

      <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap: 12, marginBottom: "var(--section-gap)"}}>
        {["tasarim", "editor", "ai"].map(k => {
          const s = d[k];
          return (
            <Card key={k} accent={palette[k]}>
              <Eyebrow>{s.name} · {s.people} kişi</Eyebrow>
              <div style={{display:"flex", alignItems:"baseline", gap: 10, marginTop: 8}}>
                <span style={{font:"600 36px/1 var(--font-sans)", color:"var(--ink)", letterSpacing:"-0.01em", fontVariantNumeric:"tabular-nums"}}>{s.active}</span>
                <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink-3)"}}>aktif iş</span>
              </div>
              <div style={{font:"500 12px/1.4 var(--font-sans)", color:"var(--ink-3)", marginTop: 6}}>
                <span style={{color:"var(--prio-red)", fontWeight: 600}}>{s.overdue}</span> geciken ·{" "}
                <span style={{color:"var(--ink)", fontWeight: 600}}>%{s.capacity}</span> kapasite
              </div>
              <div style={{marginTop: 12, height: 6, background:"var(--line-soft)", borderRadius:999, overflow:"hidden"}}>
                <div style={{width: s.capacity + "%", height:"100%", background: palette[k]}}/>
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
                              width: w + "%", height:"100%", background: palette[k],
                              transition: "width 240ms var(--ease-out-quart)"
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
  if (unit === "%") return "%" + v;
  if (unit === "sa") return v.toString().replace(".", ",") + " sa";
  return String(v);
}

window.DeptCompareScreen = DeptCompareScreen;
