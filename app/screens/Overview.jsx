// app/screens/Overview.jsx — landing tab · 3 layout variants.
// Variants: "editorial" (default) | "dense" | "story"

function OverviewScreen({ data, user, viewMode, onOpenBrief, onSwitchTab, layout = "editorial", kpiVariant = "plain" }) {
  const briefs = data.briefs;
  const active = briefs;
  const overdue = active.filter(b => b.deltaH <= 0);
  const today = active.filter(b => b.deltaH > 0 && b.deltaH <= 24);
  const week = active.filter(b => b.deltaH > 0 && b.deltaH <= 168);
  const stale = active.filter(b => b.stale);
  const review = active.filter(b => b.durum === "incelemede");
  const blocked = active.filter(b => b.durum === "blokeli");

  if (layout === "dense") return <DenseLayout {...{data,user,active,overdue,today,week,stale,review,blocked,onOpenBrief,onSwitchTab,kpiVariant}}/>;
  if (layout === "story") return <StoryLayout {...{data,user,active,overdue,today,week,stale,review,blocked,onOpenBrief,onSwitchTab,kpiVariant}}/>;
  return <EditorialLayout {...{data,user,active,overdue,today,week,stale,review,blocked,onOpenBrief,onSwitchTab,kpiVariant}}/>;
}

// ─── EDITORIAL ──────────────────────────────────────────────────────────────
function EditorialLayout({ data, user, active, overdue, today, week, stale, review, blocked, onOpenBrief, onSwitchTab, kpiVariant }) {
  const firstName = user.name.split(" ")[0];
  const greeting = greetingFor();
  return (
    <div className="bn-tab-in">
      <PageHead
        eyebrow={data.fmtTr ? data.fmtTr(data.NOW) : `18 Mayıs · Cuma · 14:30 ${greetingTimezone()}`}
        title={`${greeting}, ${firstName}.`}
        subtitle={`bugün ${overdue.length} geciken, ${today.length} bugün teslim. önce bunlar.`}
        actions={<>
          <Button kind="secondary" icon={<I.Filter size={14}/>}>Filtrele</Button>
          <Button kind="ghost" icon={<I.Refresh size={14}/>}>Yenile</Button>
        </>}
      />

      {/* KPI grid */}
      <KpiGrid>
        <Kpi label="Aktif brief"  value={active.length} variant={kpiVariant} spark={[42,45,49,52,55,58,active.length]} trend={{dir:"up", value:"+8", bad:true}} sub="geçen haftaya göre"/>
        <Kpi label="Geciken"      value={overdue.length} color="var(--prio-red)" variant={kpiVariant} spark={[3,4,5,4,6,7,overdue.length]} trend={{dir:"up", value:"+2", bad:true}} sub="dün gece"/>
        <Kpi label="Bugün teslim" value={today.length} variant={kpiVariant} spark={[8,7,9,10,11,11,today.length]} trend={{dir:"flat", value:"="}} sub="stabil"/>
        <Kpi label="Onay bekleyen" value={review.length} color="var(--warning)" variant={kpiVariant} spark={[6,7,7,9,10,11,review.length]} trend={{dir:"up", value:"+3"}} sub="dün 09:00'dan beri"/>
        <Kpi label="Stale" value={stale.length} variant={kpiVariant} spark={[1,2,2,3,3,4,stale.length]} sub="3+ gün hareketsiz"/>
        <Kpi label="Kapasite" value="%87" variant={kpiVariant} spark={[72,75,78,80,82,85,87]} trend={{dir:"up", value:"+%5", bad:true}} sub="ekip ortalaması"/>
      </KpiGrid>

      <div style={{display:"grid", gridTemplateColumns:"1.7fr 1fr", gap:"var(--grid-gap)", marginTop: "var(--section-gap)"}} className="bn-grid-2">
        <Card padding={0}>
          <div style={{padding:"14px 16px", borderBottom:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"baseline"}}>
            <div>
              <h2 style={{font:"600 15px/1.2 var(--font-sans)", color:"var(--ink)", margin:0}}>Bugün ve yarın</h2>
              <div style={{font:"400 12px/1.3 var(--font-sans)", color:"var(--ink-3)", marginTop:4}}>{today.length} brief · öncelik sırasına göre</div>
            </div>
            <button onClick={() => onSwitchTab("jobs")} style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink-3)", background:"transparent", border:0, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:4}}>
              Tümünü gör <I.ChevronRight size={12}/>
            </button>
          </div>
          <BriefTable rows={today.concat(overdue).slice(0, 9)} onRowClick={onOpenBrief}/>
        </Card>

        <div style={{display:"flex", flexDirection:"column", gap: "var(--grid-gap)"}}>
          <Card>
            <CardHead title="Departman özeti" sub="aktif · geciken · kapasite"/>
            <DeptRow s={data.deptStats.tasarim} color="var(--bw-1)"/>
            <DeptRow s={data.deptStats.editor}  color="var(--bw-4)"/>
            <DeptRow s={data.deptStats.ai}      color="var(--bw-14)" last/>
          </Card>
          <Card>
            <CardHead title="Sorunlu markalar" sub="canlı brief'lerden"/>
            <ProblemBrands data={data}/>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── DENSE ──────────────────────────────────────────────────────────────────
function DenseLayout({ data, active, overdue, today, week, stale, review, blocked, onOpenBrief, onSwitchTab, kpiVariant }) {
  return (
    <div className="bn-tab-in">
      <PageHead
        title="Genel bakış"
        subtitle="60 aktif brief · sıkı görünüm"
        actions={<>
          <Button kind="secondary" size="sm" icon={<I.Filter size={13}/>}>Filtrele</Button>
          <Button kind="ghost" size="sm" icon={<I.Refresh size={13}/>}>Yenile</Button>
        </>}
      />

      <div style={{display:"grid", gridTemplateColumns:"repeat(8, 1fr)", gap: 10, marginBottom: 16}}>
        <Kpi label="Aktif"        value={active.length} variant={kpiVariant} spark={[42,45,49,52,55,58,active.length]}/>
        <Kpi label="Geciken"      value={overdue.length} color="var(--prio-red)" variant={kpiVariant} spark={[3,4,5,4,6,7,overdue.length]}/>
        <Kpi label="Bugün"        value={today.length} variant={kpiVariant} spark={[8,7,9,10,11,11,today.length]}/>
        <Kpi label="Bu hafta"     value={week.length}  variant={kpiVariant} spark={[18,20,22,24,26,28,week.length]}/>
        <Kpi label="İncelemede"   value={review.length} color="var(--warning)" variant={kpiVariant} spark={[6,7,7,9,10,11,review.length]}/>
        <Kpi label="Blokeli"      value={blocked.length} color="var(--danger)" variant={kpiVariant}/>
        <Kpi label="Stale"        value={stale.length} variant={kpiVariant}/>
        <Kpi label="Kapasite"     value="%87" variant={kpiVariant} spark={[72,75,78,80,82,85,87]}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap: 12}} className="bn-grid-2">
        <Card padding={0}>
          <div style={{padding:"12px 14px", borderBottom:"1px solid var(--line)"}}>
            <strong style={{font:"600 13px/1 var(--font-sans)"}}>Geciken + bugün teslim · {overdue.length + today.length}</strong>
          </div>
          <BriefTable rows={overdue.concat(today)} onRowClick={onOpenBrief}/>
        </Card>
        <div style={{display:"flex", flexDirection:"column", gap: 12}}>
          <Card>
            <CardHead title="Departmanlar"/>
            <DeptRow s={data.deptStats.tasarim} color="var(--bw-1)" compact/>
            <DeptRow s={data.deptStats.editor}  color="var(--bw-4)" compact/>
            <DeptRow s={data.deptStats.ai}      color="var(--bw-14)" compact last/>
          </Card>
          <Card>
            <CardHead title="Onay bekleyen" sub={`${review.length} brief`}/>
            {review.slice(0, 5).map((b, i) => (
              <ApprovalRow key={b.id} brief={b} onClick={() => onOpenBrief(b)} last={i === Math.min(4, review.length - 1)}/>
            ))}
          </Card>
          <Card>
            <CardHead title="Bu hafta · özet"/>
            <WeekStat label="Tamamlanan" value="42" trend={{dir:"up", value:"+8"}}/>
            <WeekStat label="Ort. tamamlama" value="28,4 sa" trend={{dir:"down", value:"-1,9 sa"}} good/>
            <WeekStat label="Revize oranı" value="%19" trend={{dir:"flat", value:"="}}/>
            <WeekStat label="Stale" value={stale.length} trend={{dir:"up", value:"+2"}} bad last/>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── STORY (vertical narrative) ─────────────────────────────────────────────
function StoryLayout({ data, active, overdue, today, week, stale, review, blocked, onOpenBrief, onSwitchTab, kpiVariant }) {
  return (
    <div className="bn-tab-in">
      <PageHead
        eyebrow={data.fmtTr ? data.fmtTr(data.NOW, {style:"dense"}) : "18 Mayıs 2026 · Cuma 14:30"}
        title="Cuma sabahı, dashboard'a bunlar düşüyor."
        subtitle="öncelik sırasına göre okumak için."
      />

      {/* HERO: overdue */}
      <Card style={{
        background:"linear-gradient(180deg, color-mix(in oklab, var(--prio-red) 6%, var(--surface)) 0%, var(--surface) 60%)",
        borderTop:"2px solid var(--prio-red)", padding: 24, marginBottom: 16
      }}>
        <div style={{display:"flex", alignItems:"flex-start", gap: 24}}>
          <div style={{minWidth: 220}}>
            <Eyebrow style={{color:"var(--prio-red)"}}>Şimdi · acil</Eyebrow>
            <div style={{font:"600 56px/1 var(--font-sans)", color:"var(--prio-red)", letterSpacing:"-0.02em", margin:"8px 0 6px", fontVariantNumeric:"tabular-nums"}}>
              {overdue.length}
            </div>
            <div style={{fontFamily:"var(--font-display)", fontStyle:"italic", fontSize:18, color:"var(--ink-2)"}}>
              iş geciken durumda.
            </div>
          </div>
          <div style={{flex:1, borderLeft:"1px solid var(--line)", paddingLeft: 20}}>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 4}}>
              {overdue.slice(0, 6).map(b => (
                <button key={b.id} onClick={() => onOpenBrief(b)} style={{
                  display:"flex", alignItems:"center", gap: 8, padding:"7px 8px",
                  background:"transparent", border:0, borderRadius: 6,
                  textAlign:"left", cursor:"pointer", overflow:"hidden"
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--paper-2)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <BrandChip brand={b.brand} size="sm"/>
                  <span style={{font:"500 13px/1.3 var(--font-sans)", color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1}}>{b.baslik}</span>
                  <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--prio-red)", whiteSpace:"nowrap"}}>{formatDelta(b.deltaH)}</span>
                </button>
              ))}
            </div>
            <Button kind="ink" size="sm" style={{marginTop: 12}} onClick={() => onSwitchTab("jobs")}>Tüm geciken işleri aç →</Button>
          </div>
        </div>
      </Card>

      <KpiGrid cols={4}>
        <Kpi label="Bugün teslim"  value={today.length} variant={kpiVariant} spark={[8,7,9,10,11,11,today.length]} trend={{dir:"flat", value:"="}}/>
        <Kpi label="Onay bekleyen" value={review.length} color="var(--warning)" variant={kpiVariant} trend={{dir:"up", value:"+3"}}/>
        <Kpi label="Bu hafta"      value={week.length} variant={kpiVariant} trend={{dir:"up", value:"+12"}}/>
        <Kpi label="Kapasite"      value="%87" variant={kpiVariant} trend={{dir:"up", value:"+%5", bad:true}}/>
      </KpiGrid>

      <div style={{marginTop: "var(--section-gap)", display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:"var(--grid-gap)"}} className="bn-grid-2">
        <Card padding={0}>
          <div style={{padding:"14px 16px", borderBottom:"1px solid var(--line)"}}>
            <h2 style={{font:"600 15px/1.2 var(--font-sans)", color:"var(--ink)", margin:0}}>Önümüzdeki 24 saat</h2>
            <div style={{font:"400 12px/1.3 var(--font-sans)", color:"var(--ink-3)", marginTop:4}}>{today.length} brief · öncelik sırasına göre</div>
          </div>
          <BriefTable rows={today.slice(0, 10)} onRowClick={onOpenBrief}/>
        </Card>

        <div style={{display:"flex", flexDirection:"column", gap: "var(--grid-gap)"}}>
          <Card>
            <CardHead title="Departman"/>
            <DeptRow s={data.deptStats.tasarim} color="var(--bw-1)"/>
            <DeptRow s={data.deptStats.editor}  color="var(--bw-4)"/>
            <DeptRow s={data.deptStats.ai}      color="var(--bw-14)" last/>
          </Card>
          <Card>
            <CardHead title="Onay bekleyenler" sub="manager review · 12"/>
            {review.slice(0, 4).map((b, i) => (
              <ApprovalRow key={b.id} brief={b} onClick={() => onOpenBrief(b)} last={i === 3}/>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── shared ─────────────────────────────────────────────────────────────────
function KpiGrid({ children, cols = 6 }) {
  return (
    <div className="bn-kpi-grid" style={{
      display:"grid",
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: "var(--grid-gap)",
      marginTop: "var(--section-gap)"
    }}>
      {children}
    </div>
  );
}

function DeptRow({ s, color, last, compact }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: compact ? "8px 0" : "11px 0",
      borderBottom: last ? "0" : "1px solid var(--line)"
    }}>
      <div style={{display:"flex", alignItems:"center", gap: 8, minWidth: 96}}>
        <span style={{width:8, height:8, background:color, borderRadius:2}}/>
        <span style={{font:"600 13px/1 var(--font-sans)"}}>{s.name}</span>
      </div>
      <div style={{font:"400 12px/1 var(--font-sans)", color:"var(--ink-3)", whiteSpace:"nowrap"}}>
        <span style={{color:"var(--ink)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{s.active}</span> aktif ·{" "}
        <span style={{color:"var(--prio-red)", fontWeight:600}}>{s.overdue}</span> geciken
      </div>
      <div style={{display:"flex", alignItems:"center", gap: 8, flex: 1, marginLeft:"auto"}}>
        <div style={{flex:1, height: 6, background:"var(--line-soft)", borderRadius:999, overflow:"hidden"}}>
          <div style={{width: s.capacity+"%", height:"100%", background: s.capacity > 85 ? "var(--warning)" : "var(--ink-2)", borderRadius:999}}/>
        </div>
        <span style={{font:"500 12px/1 var(--font-mono)", color:"var(--ink-2)", minWidth: 32, textAlign:"right"}}>%{s.capacity}</span>
      </div>
    </div>
  );
}

// ─── ProblemBrands — canlı brand_stats'tan ilk 3 sorunlu marka ─────────────
function ProblemBrands({ data }) {
  const list = (data.brandStats || [])
    .filter(b => b.problem_label || b.overdue > 0 || b.stale || (b.active || 0) >= 3)
    .sort((a, b) =>
      ((b.overdue || 0) - (a.overdue || 0)) ||
      ((b.stale ? 1 : 0) - (a.stale ? 1 : 0)) ||
      ((b.active || 0) - (a.active || 0))
    )
    .slice(0, 3);
  if (list.length === 0) {
    return (
      <div style={{padding:"12px 4px", font:"400 12px/1.4 var(--font-sans)", color:"var(--ink-4)"}}>
        Sorunlu marka yok — tüm markalar normal akışta ✓
      </div>
    );
  }
  return (
    <>
      {list.map((b, i) => (
        <BrandRow
          key={b.name}
          name={b.name}
          note={b.problem_label || (b.active + ' aktif')}
          color={b.color}
          v={b.active || 0}
          last={i === list.length - 1}
        />
      ))}
    </>
  );
}

function BrandRow({ name, note, color, v, last }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding: "11px 0",
      borderBottom: last ? "0" : "1px solid var(--line)"
    }}>
      <div style={{display:"flex", alignItems:"center", gap: 8, minWidth: 0}}>
        <span style={{width:8, height:8, borderRadius:999, background:color, flexShrink:0}}/>
        <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink)", whiteSpace:"nowrap"}}>{name}</span>
      </div>
      <div style={{display:"flex", alignItems:"center", gap: 10}}>
        <span style={{font:"400 12px/1 var(--font-sans)", color:"var(--ink-3)", whiteSpace:"nowrap"}}>{note}</span>
        <span style={{font:"500 12px/1 var(--font-mono)", color:"var(--ink-4)"}}>{v}</span>
      </div>
    </div>
  );
}

function ApprovalRow({ brief, onClick, last }) {
  return (
    <button onClick={onClick} style={{
      display:"flex", alignItems:"center", gap: 10, padding:"10px 0",
      width:"100%", textAlign:"left",
      background:"transparent", border:0, cursor:"pointer",
      borderBottom: last ? "0" : "1px solid var(--line)"
    }}>
      <BrandChip brand={brief.brand} size="sm"/>
      <div style={{flex:1, font:"500 13px/1.3 var(--font-sans)", color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
        {brief.baslik}
      </div>
      <Avatar user={brief.lead} size={20}/>
      <span style={{
        font:"500 12px/1 var(--font-sans)", color:"var(--ember)",
        display:"inline-flex", alignItems:"center", gap:3
      }}>Aç <I.ChevronRight size={11}/></span>
    </button>
  );
}

function WeekStat({ label, value, trend, good, bad, last }) {
  const color = trend.dir === "flat" ? "var(--ink-3)" :
                (good ? "var(--success)" : bad ? "var(--danger)" :
                  (trend.dir === "up" ? "var(--success)" : "var(--danger)"));
  return (
    <div style={{
      display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 0",
      borderBottom: last ? "0" : "1px solid var(--line)", gap: 12
    }}>
      <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink-2)", whiteSpace:"nowrap"}}>{label}</span>
      <span style={{display:"flex", alignItems:"baseline", gap:8, whiteSpace:"nowrap"}}>
        <span style={{font:"600 15px/1 var(--font-sans)", color:"var(--ink)", fontVariantNumeric:"tabular-nums"}}>{value}</span>
        <span style={{font:"500 12px/1 var(--font-sans)", color}}>{trend.dir==="up"?"▲":trend.dir==="down"?"▼":"▬"} {trend.value}</span>
      </span>
    </div>
  );
}

function greetingFor() {
  const h = new Date(window.BNS_DATA.NOW).getHours();
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}
function greetingTimezone() { return "İstanbul"; }

window.OverviewScreen = OverviewScreen;
window.DeptRow_OV = DeptRow;
window.ApprovalRow = ApprovalRow;
window.WeekStat = WeekStat;
