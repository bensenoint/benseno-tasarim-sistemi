// app/screens/Overview.jsx — landing tab · 3 layout variants.
// Variants: "editorial" (default) | "dense" | "story"

function OverviewScreen({ data, user, viewMode, setViewMode, onOpenBrief, onSwitchTab, onRefresh, layout = "editorial", kpiVariant = "plain" }) {
  // viewMode filtresi App.jsx'te merkezi olarak uygulanıyor — data.briefs zaten filtered.
  const active = data.briefs;
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [deptFilter, setDeptFilter] = React.useState("all");
  const [prioFilter, setPrioFilter] = React.useState("all");

  // Local filtreler (dept + prio) — viewMode üstüne ek
  const filtered = active.filter(b => {
    if (deptFilter !== "all" && b.dept !== deptFilter) return false;
    if (prioFilter !== "all" && b.priority?.code !== prioFilter) return false;
    return true;
  });

  const overdue = filtered.filter(b => b.deltaH <= 0 && b.durum !== "tamamlandi");
  const today = filtered.filter(b => b.deltaH > 0 && b.deltaH <= 24);
  const week = filtered.filter(b => b.deltaH > 0 && b.deltaH <= 168);
  const stale = filtered.filter(b => b.stale);
  const review = filtered.filter(b => b.durum === "incelemede");
  const blocked = filtered.filter(b => b.durum === "blokeli");

  const filterActive = deptFilter !== "all" || prioFilter !== "all";
  const shared = {data,user,viewMode,setViewMode,active:filtered,overdue,today,week,stale,review,blocked,onOpenBrief,onSwitchTab,onRefresh,filterOpen,setFilterOpen,deptFilter,setDeptFilter,prioFilter,setPrioFilter,filterActive,kpiVariant};

  if (layout === "dense") return <DenseLayout {...shared}/>;
  if (layout === "story") return <StoryLayout {...shared}/>;
  return <EditorialLayout {...shared}/>;
}

// ─── FILTER PANEL ──────────────────────────────────────────────────────────
function FilterPanel({ open, onClose, deptFilter, setDeptFilter, prioFilter, setPrioFilter, filterActive }) {
  if (!open) return null;
  const deptOpts = [["all","Tüm departmanlar"],["tasarim","🎨 Tasarım"],["editor","✍️ Editör"],["ai","🤖 AI"]];
  const prioOpts = [["all","Tüm öncelikler"],["over","🔴 Geçmiş"],["red","🔴 Acil"],["org","🟠 Yüksek"],["ylw","🟡 Normal"],["grn","🟢 Düşük"]];
  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:88}}/>
      <div style={{
        position:"absolute", top:"100%", right:0, marginTop:6, zIndex:89,
        background:"var(--surface)", border:"1px solid var(--line)",
        borderRadius:12, boxShadow:"var(--shadow-2)", padding:16, minWidth:220,
        display:"flex", flexDirection:"column", gap:14
      }}>
        <div style={{font:"600 11px/1 var(--font-sans)", letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--ink-3)"}}>Filtrele</div>
        <div>
          <div style={{font:"500 11px/1 var(--font-sans)", color:"var(--ink-3)", marginBottom:6}}>Departman</div>
          {deptOpts.map(([v,l]) => (
            <label key={v} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",cursor:"pointer"}}>
              <input type="radio" name="dept" value={v} checked={deptFilter===v} onChange={() => setDeptFilter(v)} style={{accentColor:"var(--ember)"}}/>
              <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink-2)"}}>{l}</span>
            </label>
          ))}
        </div>
        <div>
          <div style={{font:"500 11px/1 var(--font-sans)", color:"var(--ink-3)", marginBottom:6}}>Öncelik</div>
          {prioOpts.map(([v,l]) => (
            <label key={v} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",cursor:"pointer"}}>
              <input type="radio" name="prio" value={v} checked={prioFilter===v} onChange={() => setPrioFilter(v)} style={{accentColor:"var(--ember)"}}/>
              <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink-2)"}}>{l}</span>
            </label>
          ))}
        </div>
        {filterActive && (
          <button onClick={() => { setDeptFilter("all"); setPrioFilter("all"); }} style={{
            font:"500 12px/1 var(--font-sans)", color:"var(--ember)",
            background:"transparent", border:"none", cursor:"pointer", textAlign:"left", padding:0
          }}>✕ Filtreyi temizle</button>
        )}
      </div>
    </>
  );
}

// ─── EDITORIAL ──────────────────────────────────────────────────────────────
function calcAvgCapPct(data) {
  const ds = data.deptStats || {};
  const vals = Object.values(ds).map(s => s.capacity_pct != null ? s.capacity_pct : bnsCapPct(s)).filter(v => v > 0);
  return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null;
}

// history dizisinden spark array üretir: son 6 kayıt + bugünkü değer = 7 nokta
function histSpark(history, field, currentVal) {
  if (!Array.isArray(history) || history.length === 0) return null;
  const pts = history.slice(-6).map(h => h[field] ?? 0);
  while (pts.length < 6) pts.unshift(0);
  pts.push(currentVal);
  return pts;
}
// Geçen haftaya göre trend hesaplar
function histTrend(history, field, currentVal) {
  if (!Array.isArray(history) || history.length < 2) return null;
  const prev = history[history.length - 1]?.[field] ?? currentVal;
  const diff = currentVal - prev;
  if (diff === 0) return { dir: "flat", value: "=" };
  return { dir: diff > 0 ? "up" : "down", value: (diff > 0 ? "+" : "") + diff };
}

function EditorialLayout({ data, user, active, overdue, today, week, stale, review, blocked, onOpenBrief, onSwitchTab, onRefresh, filterOpen, setFilterOpen, deptFilter, setDeptFilter, prioFilter, setPrioFilter, filterActive, kpiVariant }) {
  const firstName = user.name.split(" ")[0];
  const greeting = greetingFor();
  const avgCapPct = calcAvgCapPct(data);
  const hist = data.history || [];

  // Gerçek history'den spark dizileri
  const sparkActive  = histSpark(hist, "active",  active.length)  || [42,45,49,52,55,58,active.length];
  const sparkOverdue = histSpark(hist, "overdue", overdue.length) || [3,4,5,4,6,7,overdue.length];

  // Trend: son kayıtla karşılaştır
  const trendActive  = histTrend(hist, "active",  active.length)  || { dir:"up",   value:"+8",  bad:true };
  const trendOverdue = histTrend(hist, "overdue", overdue.length) || { dir:"up",   value:"+2",  bad:true };

  return (
    <div className="bn-tab-in">
      <PageHead
        eyebrow={data.fmtTr ? data.fmtTr(Date.now()) : `${greetingTimezone()}`}
        title={`${greeting}, ${firstName}.`}
        subtitle={`bugün ${overdue.length} geciken, ${today.length} bugün teslim. önce bunlar.`}
        actions={<div style={{position:"relative",display:"flex",gap:6}}>
          <Button kind={filterActive ? "primary" : "secondary"} icon={<I.Filter size={14}/>} onClick={() => setFilterOpen(o=>!o)}>
            {filterActive ? "Filtre aktif" : "Filtrele"}
          </Button>
          <FilterPanel open={filterOpen} onClose={() => setFilterOpen(false)} deptFilter={deptFilter} setDeptFilter={setDeptFilter} prioFilter={prioFilter} setPrioFilter={setPrioFilter} filterActive={filterActive}/>
          <Button kind="ghost" icon={<I.Refresh size={14}/>} onClick={onRefresh}>Yenile</Button>
        </div>}
      />

      {/* KPI grid */}
      <KpiGrid>
        <Kpi label="Aktif brief"   value={active.length}  variant={kpiVariant} spark={sparkActive}  trend={{...trendActive,  bad: trendActive.dir==="up"}}  sub={hist.length > 1 ? "son sync'e göre" : "geçen haftaya göre"}/>
        <Kpi label="Geciken"       value={overdue.length} color="var(--prio-red)" variant={kpiVariant} spark={sparkOverdue} trend={{...trendOverdue, bad: trendOverdue.dir==="up"}} sub={hist.length > 1 ? "son sync'e göre" : "dün gece"}/>
        <Kpi label="Bugün teslim"  value={today.length}   variant={kpiVariant} spark={[8,7,9,10,11,11,today.length]} trend={{dir:"flat", value:"="}} sub="stabil"/>
        <Kpi label="Onay bekleyen" value={review.length}  color="var(--warning)" variant={kpiVariant} spark={[6,7,7,9,10,11,review.length]} trend={{dir:"up", value:"+3"}} sub="dün 09:00'dan beri"/>
        <Kpi label="Hareketsiz"    value={stale.length}   variant={kpiVariant} spark={[1,2,2,3,3,4,stale.length]} sub="3+ gün güncelleme yok"/>
        <Kpi label="Kapasite"      value={avgCapPct!=null?"%"+avgCapPct:"—"} variant={kpiVariant} trend={{dir:"up", value:"+%5", bad:avgCapPct>85}} sub="ekip ortalaması"/>
      </KpiGrid>

      <div style={{display:"grid", gridTemplateColumns:"1.7fr 1fr", gap:"var(--grid-gap)", marginTop: "var(--section-gap)"}} className="bn-grid-2">
        <Card padding={0}>
          <div style={{padding:"14px 16px", borderBottom:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"baseline"}}>
            <div>
              <h2 style={{font:"600 15px/1.2 var(--font-sans)", color:"var(--ink)", margin:0}}>Bugün ve yarın</h2>
              <div style={{font:"400 12px/1.3 var(--font-sans)", color:"var(--ink-3)", marginTop:4}}>
                {today.length + overdue.length} brief
                {overdue.length > 0 && <span style={{color:"var(--prio-red)", fontWeight:600, marginLeft:6}}>· {overdue.length} gecikmiş</span>}
                {" · öncelik sırasına göre"}
              </div>
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
          <Card>
            <CardHead title="Bu hafta · parlayan" sub="tamamlanan brief'lerden"/>
            <StarOfTheWeek data={data}/>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── DENSE ──────────────────────────────────────────────────────────────────
function DenseLayout({ data, active, overdue, today, week, stale, review, blocked, onOpenBrief, onSwitchTab, onRefresh, filterOpen, setFilterOpen, deptFilter, setDeptFilter, prioFilter, setPrioFilter, filterActive, kpiVariant }) {
  const avgCapPct = calcAvgCapPct(data);
  // Bu hafta özet — canlı veriden
  const nowTs2 = data.NOW || Date.now();
  const allComp2 = data._allCompleted || data.completed || [];
  const wk2 = allComp2.filter(c => (c.bitis||0) >= nowTs2 - 7*24*3600*1000);
  const wkCount2 = wk2.length;
  const prevWk2 = allComp2.filter(c => { const t=c.bitis||0; return t>=nowTs2-14*24*3600*1000 && t<nowTs2-7*24*3600*1000; });
  const wkDelta2 = wkCount2 - prevWk2.length;
  const sArr2 = wk2.filter(c=>c.sureH>0).map(c=>c.sureH);
  const avgS2 = sArr2.length ? sArr2.reduce((a,v)=>a+v,0)/sArr2.length : 0;
  const prevSArr2 = prevWk2.filter(c=>c.sureH>0).map(c=>c.sureH);
  const prevS2 = prevSArr2.length ? prevSArr2.reduce((a,v)=>a+v,0)/prevSArr2.length : 0;
  const sDelta2 = avgS2 - prevS2;
  const revPct2 = wk2.length ? Math.round(wk2.reduce((a,c)=>a+(c.revision||0),0)/wk2.length*10) : 0;
  return (
    <div className="bn-tab-in">
      <PageHead
        title="Genel bakış"
        subtitle={`${active.length} aktif brief · sıkı görünüm`}
        actions={<div style={{position:"relative",display:"flex",gap:6}}>
          <Button kind={filterActive ? "primary" : "secondary"} size="sm" icon={<I.Filter size={13}/>} onClick={() => setFilterOpen(o=>!o)}>
            {filterActive ? "Filtre aktif" : "Filtrele"}
          </Button>
          <FilterPanel open={filterOpen} onClose={() => setFilterOpen(false)} deptFilter={deptFilter} setDeptFilter={setDeptFilter} prioFilter={prioFilter} setPrioFilter={setPrioFilter} filterActive={filterActive}/>
          <Button kind="ghost" size="sm" icon={<I.Refresh size={13}/>} onClick={onRefresh}>Yenile</Button>
        </div>}
      />

      <div className="bns-kpi-8" style={{display:"grid", gridTemplateColumns:"repeat(8, 1fr)", gap: 10, marginBottom: 16}}>
        <Kpi label="Aktif"        value={active.length} variant={kpiVariant} spark={[42,45,49,52,55,58,active.length]}/>
        <Kpi label="Geciken"      value={overdue.length} color="var(--prio-red)" variant={kpiVariant} spark={[3,4,5,4,6,7,overdue.length]}/>
        <Kpi label="Bugün"        value={today.length} variant={kpiVariant} spark={[8,7,9,10,11,11,today.length]}/>
        <Kpi label="Bu hafta"     value={week.length}  variant={kpiVariant} spark={[18,20,22,24,26,28,week.length]}/>
        <Kpi label="İncelemede"   value={review.length} color="var(--warning)" variant={kpiVariant} spark={[6,7,7,9,10,11,review.length]}/>
        <Kpi label="Blokeli"      value={blocked.length} color="var(--danger)" variant={kpiVariant}/>
        <Kpi label="Hareketsiz"        value={stale.length} variant={kpiVariant}/>
        <Kpi label="Kapasite"     value={avgCapPct!=null?"%"+avgCapPct:"—"} variant={kpiVariant}/>
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
            <WeekStat label="Tamamlanan" value={String(wkCount2)}
              trend={{dir:wkDelta2>0?"up":wkDelta2<0?"down":"flat", value:(wkDelta2>0?"+":"")+wkDelta2}}/>
            <WeekStat label="Ort. tamamlama" value={avgS2>0?avgS2.toFixed(1).replace(".",",")+' sa':"—"}
              trend={{dir:sDelta2<0?"down":sDelta2>0?"up":"flat", value:(sDelta2>0?"+":"")+sDelta2.toFixed(1).replace(".",",")+' sa'}} good/>
            <WeekStat label="Revize oranı" value={revPct2>0?"%"+revPct2:"—"} trend={{dir:"flat", value:"="}}/>
            <WeekStat label="Hareketsiz" value={stale.length} trend={{dir:stale.length>0?"up":"flat", value:stale.length>0?"+"+stale.length:"="}} bad last/>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── STORY (vertical narrative) ─────────────────────────────────────────────
function StoryLayout({ data, active, overdue, today, week, stale, review, blocked, onOpenBrief, onSwitchTab, kpiVariant }) {
  const avgCapPct = calcAvgCapPct(data);
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
        <Kpi label="Kapasite"      value={avgCapPct!=null?"%"+avgCapPct:"—"} variant={kpiVariant} trend={{dir:"up", value:"+%5", bad:avgCapPct>85}}/>
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
    <div className={`bn-kpi-grid bns-kpi-${cols}`} style={{
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
  if (!s) return null;
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
          <div style={{width: s.capacity_pct+"%", height:"100%", background: s.capacity_pct > 85 ? "var(--warning)" : "var(--ink-2)", borderRadius:999}}/>
        </div>
        <span style={{font:"500 12px/1 var(--font-mono)", color:"var(--ink-2)", minWidth: 32, textAlign:"right"}}>%{s.capacity_pct}</span>
      </div>
    </div>
  );
}

// ─── ProblemBrands — live brief'lerden hesaplanan sorun skoru ────────────────
function ProblemBrands({ data }) {
  // Her marka için live brief'lerden istatistik hesapla
  const byBrand = {};
  (data._allBriefs || data.briefs || []).forEach(b => {
    const m = b.marka;
    if (!m) return;
    if (!byBrand[m]) byBrand[m] = { name: m, brand: b.brand, active: 0, overdue: 0, stale: 0, blokeli: 0, highRev: 0, score: 0 };
    const s = byBrand[m];
    s.active++;
    if (b.deltaH <= 0)          s.overdue++;
    if (b.stale)                s.stale++;
    if (b.durum === "blokeli")  s.blokeli++;
    if ((b.revision || 0) >= 3) s.highRev++;
  });

  // Sorun skoru: ağırlıklı
  // geciken ×4 + stale ×2 + blokeli ×3 + revize≥3 ×1 + aktif yük (5'ten fazra her iş için ×1)
  Object.values(byBrand).forEach(s => {
    s.score = s.overdue * 4 + s.blokeli * 3 + s.stale * 2 + s.highRev * 1 + Math.max(0, s.active - 4);
  });

  const list = Object.values(byBrand)
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (list.length === 0) {
    return (
      <div style={{padding:"12px 4px", font:"400 12px/1.4 var(--font-sans)", color:"var(--ink-4)"}}>
        Sorunlu marka yok — tüm markalar normal akışta ✓
      </div>
    );
  }

  return (
    <>
      {list.map((s, i) => {
        // En baskın sorunu etiketle
        const tags = [];
        if (s.overdue)  tags.push(`${s.overdue} geciken`);
        if (s.blokeli)  tags.push(`${s.blokeli} blokeli`);
        if (s.stale)    tags.push(`${s.stale} stale`);
        if (s.highRev)  tags.push(`${s.highRev} yüksek rev`);
        if (!tags.length) tags.push(`${s.active} aktif`);
        return (
          <BrandRow
            key={s.name}
            name={s.name}
            note={tags.join(" · ")}
            color={s.brand?.color}
            v={s.active}
            last={i === list.length - 1}
          />
        );
      })}
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

// ─── StarOfTheWeek — son 7 günde en çok iş tamamlayan ───────────────────────
function StarOfTheWeek({ data }) {
  const nowTs = (window.BNS_DATA && window.BNS_DATA.NOW) || data.NOW || Date.now();
  const cutoff = nowTs - 7 * 24 * 3600 * 1000;
  const allCompleted = data._allCompleted || data.completed || [];
  const thisWeek = allCompleted.filter(c => (c.bitis || 0) >= cutoff);

  if (thisWeek.length === 0) {
    return <div style={{padding:"12px 4px", font:"400 12px/1.4 var(--font-sans)", color:"var(--ink-4)"}}>Bu hafta henüz tamamlanan brief yok.</div>;
  }

  // Kişi başına istatistik hesapla
  const byUser = {};
  thisWeek.forEach(c => {
    const u = c.lead;
    if (!u || !u.id) return;
    if (!byUser[u.id]) byUser[u.id] = { user: u, count: 0, totalSure: 0, sureCount: 0, minSure: Infinity };
    const s = byUser[u.id];
    s.count++;
    if (c.sureH > 0) { s.totalSure += c.sureH; s.sureCount++; s.minSure = Math.min(s.minSure, c.sureH); }
  });

  // En çok iş tamamlayan — eşit puanda en hızlı ortalama kazanır
  const ranked = Object.values(byUser).sort((a, b) =>
    b.count !== a.count ? b.count - a.count :
    (a.totalSure / (a.sureCount || 1)) - (b.totalSure / (b.sureCount || 1))
  );

  // 0 gecikme olan kişi
  const zeroLate = Object.values(byUser).filter(s => {
    return thisWeek.filter(c => c.lead?.id === s.user.id && (c.gecikmeH || 0) > 0).length === 0;
  }).map(s => s.user);

  // En hızlı teslim
  const fastest = Object.values(byUser).filter(s => s.sureCount > 0)
    .sort((a, b) => (a.totalSure / a.sureCount) - (b.totalSure / b.sureCount))[0];

  const stars = [
    ranked[0] && {
      emoji: "🏆",
      label: "En çok tamamlayan",
      user: ranked[0].user,
      detail: `${ranked[0].count} brief`
    },
    fastest && ranked[0]?.user.id !== fastest.user.id && {
      emoji: "⚡",
      label: "En hızlı teslim",
      user: fastest.user,
      detail: (fastest.totalSure / fastest.sureCount).toFixed(1).replace(".", ",") + " sa ort."
    },
    zeroLate.length > 0 && zeroLate[0].id !== ranked[0]?.user.id && {
      emoji: "✅",
      label: "0 gecikme",
      user: zeroLate[0],
      detail: "hepsi zamanında"
    }
  ].filter(Boolean).slice(0, 3);

  if (stars.length === 0) return (
    <div style={{padding:"12px 4px", font:"400 12px/1.4 var(--font-sans)", color:"var(--ink-4)"}}>Yeterli veri yok.</div>
  );

  return (
    <>
      {stars.map((s, i) => (
        <div key={s.emoji} style={{
          display:"flex", alignItems:"center", gap: 10,
          padding:"10px 0", borderBottom: i < stars.length - 1 ? "1px solid var(--line)" : 0
        }}>
          <span style={{fontSize: 16, flexShrink: 0}}>{s.emoji}</span>
          <Avatar user={s.user} size={26}/>
          <div style={{flex: 1, minWidth: 0}}>
            <div style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{s.user.name}</div>
            <div style={{font:"400 11px/1.3 var(--font-sans)", color:"var(--ink-3)", marginTop: 3}}>{s.label}</div>
          </div>
          <span style={{font:"600 12px/1 var(--font-mono)", color:"var(--success)", whiteSpace:"nowrap"}}>{s.detail}</span>
        </div>
      ))}
    </>
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
  const h = new Date((window.BNS_DATA && window.BNS_DATA.NOW) || Date.now()).getHours();
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}
function greetingTimezone() { return "İstanbul"; }

window.OverviewScreen = OverviewScreen;
window.DeptRow_OV = DeptRow;
window.ApprovalRow = ApprovalRow;
window.WeekStat = WeekStat;
window.StarOfTheWeek = StarOfTheWeek;
