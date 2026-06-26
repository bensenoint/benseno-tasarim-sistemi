// app/screens/DeptCompare.jsx — Departmanlar özet: yıldız karnesi + 4 departman karşılaştırması (tarih filtresine bağlı).

var BNS_DEPTS = ["tasarim", "editor", "ai", "freelance"];
var BNS_DEPT_TR = { tasarim: "Tasarım", editor: "Editör", ai: "AI", freelance: "Freelance" };
var BNS_DEPT_PALETTE = { tasarim: "var(--bw-1)", editor: "var(--bw-4)", ai: "var(--bw-14)", freelance: "var(--bw-8)" };

// Bir tamamlanan işin departmana ait olup olmadığı (lead / brief.dept / contributor).
function bnsCompletedInDept(c, role) {
  return (c.lead && (c.lead.dept || c.lead.rol) === role) ||
    c.dept === role ||
    (Array.isArray(c.contributors) && c.contributors.some(x => x && (x.dept || x.rol) === role));
}

// ⭐ Yıldız Karnesi — ORTAK bileşen. Puan ortalamaları SEÇİLİ TARİH ARALIĞINDAKİ tamamlanan işlerin
// rating'lerinden hesaplanır (tarihe duyarlı). Sebep açıklamaları (AI) günlük anlık snapshot'tan gelir.
function StarReport({ data, depts }) {
  const list = depts || BNS_DEPTS;
  const comp = data.completed || [];           // üst global tarih aralığına süzülü
  const rated = comp.filter(c => c.rating > 0);
  const avgOf = (arr) => arr.length ? arr.reduce((s, c) => s + c.rating, 0) / arr.length : 0;
  const sebep = (t, k) => (typeof window.bnsSebep === "function" && window.bnsSebep(t, k)) || null;
  const firmaAvg = +avgOf(rated).toFixed(1), firmaCnt = rated.length;

  const Row = ({ label, avg, cnt, why, big }) => (
    <div style={{display:"flex", flexWrap:"wrap", alignItems:"flex-start", gap:12, rowGap:6, padding:"9px 0", borderBottom:"1px solid var(--line-soft)"}}>
      <span style={{font:`${big?600:500} 13px/1.3 var(--font-sans)`, color:"var(--ink)", minWidth:150, flexShrink:0}}>{label}</span>
      <span style={{display:"inline-flex", gap:1, flexShrink:0, paddingTop:1}}>
        {[1,2,3,4,5].map(i => <I.StarFill key={i} size={12} color={i <= Math.round(avg) ? "var(--prio-yellow)" : "var(--line-strong)"}/>)}
      </span>
      <span style={{font:"600 13px/1.3 var(--font-mono)", color:"var(--ink)", flexShrink:0}}>{cnt ? avg : "—"}</span>
      <span style={{font:"400 11px/1.4 var(--font-sans)", color:"var(--ink-4)", flexShrink:0}}>({cnt} iş)</span>
      {why && <MobileAccordion title="Değerlendirme"><span style={{font:"400 12px/1.5 var(--font-sans)", color:"var(--ink-3)", flex:"1 1 220px", minWidth:0, overflowWrap:"anywhere"}}><Linkify text={why.sebep}/></span></MobileAccordion>}
    </div>
  );

  return (
    <Card style={{marginBottom:"var(--section-gap)"}}>
      <Eyebrow>⭐ Yıldız Karnesi</Eyebrow>
      <div style={{marginTop:6}}>
        {list.length > 1 && <Row label="Benseno (tüm firma)" avg={firmaAvg} cnt={firmaCnt} why={sebep("firma","benseno")} big/>}
        {list.map(role => {
          const dr = rated.filter(c => bnsCompletedInDept(c, role));
          return <Row key={role} label={BNS_DEPT_TR[role] || role} avg={+avgOf(dr).toFixed(1)} cnt={dr.length} why={sebep("dept", role)} big={list.length === 1}/>;
        })}
      </div>
      <div style={{marginTop:8, font:"400 10px/1 var(--font-sans)", color:"var(--ink-4)"}}>
        Puan ortalamaları seçili tarih aralığındaki tamamlanan işlerden · AI sebep açıklamaları her gün 18:45'te güncellenir
      </div>
    </Card>
  );
}
window.StarReport = StarReport;

function DeptCompareScreen({ data }) {
  const raw = data.deptStats || {};
  const DEPT_DEF = {
    tasarim:   { name: "Tasarım",   people: 7, capacity: 42 },
    editor:    { name: "Editör",    people: 8, capacity: 48 },
    ai:        { name: "AI",        people: 1, capacity:  6 },
    freelance: { name: "Freelance", people: 3, capacity: 36 },
  };
  const allBriefs    = data._allBriefs    || data.briefs    || [];
  const allCompleted = data.completed || data._allCompleted || [];   // seçili tarih aralığına süzülü
  const RANGE_LABELS = { today:"Bugün", yesterday:"Dün", "7d":"Son 7 gün", "30d":"Son 30 gün", "90d":"Son 90 gün", year:"Bu yıl", all:"Tüm zamanlar", custom:"Seçili aralık" };
  const rangeLabel = RANGE_LABELS[(data.dateRange || {}).preset] || "Seçili aralık";

  function deptCompleted(role) { return allCompleted.filter(c => bnsCompletedInDept(c, role)); }

  const d = {};
  for (const role of BNS_DEPTS) {
    const active = bnsDeptActive(allBriefs, role);
    const doneR = deptCompleted(role);                              // aralıkta tamamlanan
    const sures = doneR.filter(c => c.sureH > 0).map(c => c.sureH);
    const avgH  = sures.length ? Math.round(sures.reduce((a,v)=>a+v,0)/sures.length) : 0;
    const revs  = doneR.map(c => c.revision || 0);
    const avgRev = revs.length ? parseFloat((revs.reduce((a,v)=>a+v,0)/revs.length).toFixed(2)) : 0;
    const stat = { ...DEPT_DEF[role], ...(raw[role] || {}) };
    d[role] = {
      name: stat.name || (BNS_DEPT_TR[role]),
      people: stat.people || 0,
      capacity: stat.capacity || 0,
      active: active.length,
      overdue: active.filter(b => b.deltaH <= 0 && b.durum !== "tamamlandi").length,
      completed: doneR.length,                                     // aralıkta tamamlanan
      avgComplete: avgH,
      revRate: avgRev,
      capacity_pct: (stat.capacity > 0) ? bnsDeptCapPct(allBriefs, stat, role) : 0,
    };
  }

  const metrics = [
    { key: "completed",   label: "Tamamlanan iş",          unit: "" },
    { key: "avgComplete", label: "Ort. tamamlama süresi",  unit: "sa" },
    { key: "overdue",     label: "Geciken iş",             unit: "" },
    { key: "active",      label: "Aktif yük",              unit: "" },
    { key: "revRate",     label: "Revize oranı",           unit: "%" }
  ];

  return (
    <div className="bn-tab-in">
      <PageHead
        title="Departmanlar özet"
        subtitle={`tasarım · editör · AI · freelance · ${rangeLabel}`}/>

      {/* ⭐ Yıldız Karnesi — tüm departmanlar (tarihe duyarlı) */}
      <StarReport data={data} depts={BNS_DEPTS}/>

      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: "var(--section-gap)"}}>
        {BNS_DEPTS.map(k => {
          const s = d[k];
          return (
            <Card key={k} accent={BNS_DEPT_PALETTE[k]}>
              <Eyebrow>{s.name} · {s.people} kişi</Eyebrow>
              <div style={{display:"flex", alignItems:"baseline", gap: 10, marginTop: 8}}>
                <span style={{font:"600 36px/1.15 var(--font-sans)", color:"var(--ink)", letterSpacing:"-0.01em", fontVariantNumeric:"tabular-nums"}}>{s.active}</span>
                <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink-3)"}}>aktif iş</span>
              </div>
              <div style={{font:"500 12px/1.4 var(--font-sans)", color:"var(--ink-3)", marginTop: 6}}>
                <span style={{color:"var(--prio-red)", fontWeight: 600}}>{s.overdue}</span> geciken ·{" "}
                <span style={{color: s.capacity_pct > 85 ? "var(--warning)" : "var(--ink)", fontWeight: 600}}>%{s.capacity_pct}</span> kapasite
              </div>
              <div style={{marginTop: 12, height: 6, background:"var(--line-soft)", borderRadius:999, overflow:"hidden"}}>
                <div style={{width: s.capacity_pct + "%", height:"100%", background: BNS_DEPT_PALETTE[k]}}/>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHead title="Metrik karşılaştırma" sub={`bar chart · ${rangeLabel}`}/>
        <div style={{display:"flex", flexDirection:"column", gap: 18, paddingTop: 4}}>
          {metrics.map(m => {
            const max = Math.max(...BNS_DEPTS.map(k => d[k][m.key]));
            return (
              <div key={m.key}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom: 8}}>
                  <span style={{font:"600 13px/1 var(--font-sans)", color:"var(--ink-2)"}}>{m.label}</span>
                  <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)"}}>en yüksek: {fmtN(max, m.unit)}</span>
                </div>
                <div style={{display:"grid", gridTemplateColumns: "100px 1fr", rowGap: 6, columnGap: 12, alignItems:"center"}}>
                  {BNS_DEPTS.map(k => {
                    const s = d[k];
                    const w = max === 0 ? 0 : (s[m.key] / max) * 100;
                    return (
                      <React.Fragment key={k}>
                        <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink-2)"}}>{s.name}</span>
                        <div style={{display:"flex", alignItems:"center", gap: 10}}>
                          <div style={{flex:1, height: 18, background:"var(--paper-2)", borderRadius: 4, overflow:"hidden"}}>
                            <div style={{
                              width:"100%", height:"100%", background: BNS_DEPT_PALETTE[k],
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
