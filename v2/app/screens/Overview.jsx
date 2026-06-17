// app/screens/Overview.jsx — landing tab · 3 layout variants.
// Variants: "editorial" (default) | "dense" | "story"

function OverviewScreen({ data, user, viewMode, setViewMode, onOpenBrief, onSwitchTab, onJumpJobs, onRefresh, onStatusChange, layout = "editorial", kpiVariant = "plain" }) {
  // viewMode filtresi App.jsx'te merkezi olarak uygulanıyor — data.briefs zaten filtered.
  const musteride = data.briefs.filter(b => b.durum === "musteride");   // müşteri onayında bekleyenler
  const active = data.briefs.filter(b => b.durum !== "musteride");      // aktif yük = müşteridekiler hariç
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [deptFilter, setDeptFilter] = React.useState("all");
  const [prioFilter, setPrioFilter] = React.useState("all");

  // Local filtreler (dept + prio) — viewMode üstüne ek
  const filtered = active.filter(b => {
    if (deptFilter !== "all" && b.dept !== deptFilter) return false;
    if (prioFilter !== "all" && b.priority?.code !== prioFilter) return false;
    return true;
  });

  const overdue = filtered.filter(b => b.deltaH <= 0 && b.durum !== "tamamlandi" && b.durum !== "musteride");
  const today = filtered.filter(b => b.deltaH > 0 && b.deltaH <= 24);   // 24s pencere — "Bugün ve yarın" tablosu için
  // "Bugün teslim" KPI'sı: takvim olarak BUGÜN (İstanbul) deadline'ı olan aktif işler.
  const _istToday = (function(){ try { return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }); } catch (e) { return ""; } })();
  const todayDue = filtered.filter(b => {
    if (b.durum === "tamamlandi" || !b.deadline) return false;
    try { return new Date(b.deadline).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }) === _istToday; } catch (e) { return false; }
  });
  const week = filtered.filter(b => b.deltaH > 0 && b.deltaH <= 168);
  const stale = filtered.filter(b => b.stale);
  const review = filtered.filter(b => b.durum === "incelemede");
  const blocked = filtered.filter(b => b.durum === "blokeli");

  const filterActive = deptFilter !== "all" || prioFilter !== "all";
  const shared = {data,user,viewMode,setViewMode,active:filtered,musteride,overdue,today,todayDue,week,stale,review,blocked,onOpenBrief,onSwitchTab,onJumpJobs,onRefresh,onStatusChange,filterOpen,setFilterOpen,deptFilter,setDeptFilter,prioFilter,setPrioFilter,filterActive,kpiVariant};

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

// ─── MANAGER SECTION (embedded in Editorial) ─────────────────────────────────
function ManagerSection({ data, user, overdue, review, onOpenBrief, onSwitchTab, onStatusChange }) {
  const briefs = data._allBriefs || data.briefs;
  const allOverdue  = briefs.filter(b => b.deltaH <= 0 && b.durum !== "tamamlandi" && b.durum !== "musteride");
  const allReview   = briefs.filter(b => b.durum === "incelemede");

  // Senkron zamanı
  const nowTs = data.NOW || Date.now();
  const syncAgo = Math.round((Date.now() - nowTs) / 1000);
  const syncLabel = syncAgo < 60 ? `${syncAgo} sn önce` : syncAgo < 3600 ? `${Math.round(syncAgo/60)} dk önce` : `${Math.round(syncAgo/3600)} sa önce`;

  // Bu hafta özet
  const allCompleted = data._allCompleted || data.completed || [];
  const weekCutoff = nowTs - 7 * 24 * 3600 * 1000;
  const prevWeekCutoff = nowTs - 14 * 24 * 3600 * 1000;
  const thisWeek = allCompleted.filter(c => (c.bitis||0) >= weekCutoff);
  const prevWeek = allCompleted.filter(c => (c.bitis||0) >= prevWeekCutoff && (c.bitis||0) < weekCutoff);
  const weekCount = thisWeek.length;
  const weekCountDelta = weekCount - prevWeek.length;
  const sureArr  = thisWeek.filter(c => c.sureH > 0).map(c => c.sureH);
  const avgSure  = sureArr.length ? sureArr.reduce((s,v)=>s+v,0)/sureArr.length : 0;
  const prevSureArr = prevWeek.filter(c => c.sureH > 0).map(c => c.sureH);
  const prevAvgSure = prevSureArr.length ? prevSureArr.reduce((s,v)=>s+v,0)/prevSureArr.length : 0;
  const sureDelta = avgSure - prevAvgSure;
  const revArr   = thisWeek.map(c => c.revision || 0);
  const avgRevPct = revArr.length ? Math.round(revArr.reduce((s,v)=>s+v,0)/revArr.length * 10) : 0;
  const staleCount = briefs.filter(b => b.stale).length;

  // Kapasite
  const ds = data.deptStats || {};
  const tasarimCap = ds.tasarim ? (ds.tasarim.capacity_pct != null ? ds.tasarim.capacity_pct : bnsCapPct(ds.tasarim)) : null;
  const capTone = tasarimCap != null && tasarimCap > 85 ? "warn" : "info";
  const capLabel = tasarimCap != null ? `Tasarım kapasitesi %${tasarimCap}` : "Tasarım kapasitesi";
  const capMetric = tasarimCap != null ? `%${tasarimCap}` : "—";

  // Eşik kuralları
  const H = 3600 * 1000;
  const capHits    = (tasarimCap != null && tasarimCap > 85) ? 1 : 0;
  const overdueHits = allOverdue.length > 5 ? 1 : 0;
  const staleHits   = briefs.filter(b => b.stale || ((nowTs - (b.acilma||0)) > 3 * 24 * H && b.durum === "yeni")).length;
  const revHits     = avgRevPct > 30 ? 1 : 0;

  return (
    <div style={{marginTop:"var(--section-gap)"}}>
      {/* Bölüm başlığı */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom: "var(--grid-gap)", paddingBottom: 10,
        borderBottom: "1px solid var(--line)"
      }}>
        <div>
          <span style={{font:"600 13px/1 var(--font-sans)", color:"var(--ink)", letterSpacing:"-0.01em"}}>Komuta merkezi</span>
          <span style={{font:"400 12px/1 var(--font-sans)", color:"var(--ink-4)", marginLeft:8}}>sadece yöneticiler · senkron {syncLabel}</span>
        </div>
      </div>

      {/* Alert grid */}
      <div className="bn-grid-3" style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"var(--grid-gap)", marginBottom:"var(--section-gap)"}}>
        <Alert tone="danger" Icon={I.Warn}
          title={`${allOverdue.length} iş gecikti`}
          body="Şu an deadline'ı geçmiş aktif brief'ler. İlk eylem: yeniden ata veya Slack thread'ini aç."
          action={<Button kind="ink" size="sm" onClick={() => onSwitchTab("jobs")}>Listeyi aç</Button>}
          metric={allOverdue.length}/>
        <Alert tone={capTone} Icon={I.Info}
          title={capLabel}
          body={tasarimCap > 85 ? "Eşik %85 aşıldı. Yeni atama önerilmez." : tasarimCap != null ? `Eşik %85. Kapasite müsait (%${tasarimCap}).` : "Kapasite verisi bekleniyor."}
          action={<Button kind="secondary" size="sm" onClick={() => onSwitchTab("design")}>Tasarım sekmesi</Button>}
          metric={capMetric}/>
        <Alert tone="info" Icon={I.Check}
          title={`${allReview.length} brief onay bekliyor`}
          body="rev tamamlandı · yöneticiler gözden geçirmeli. Tıkla, drawer'da hızlıca onayla."
          action={<Button kind="secondary" size="sm" onClick={() => onSwitchTab("jobs")}>Onay kuyruğu</Button>}
          metric={allReview.length}/>
      </div>

      {/* Geciken işler — tam genişlik */}
      <Card padding={0}>
        <div style={{padding:"14px 16px", borderBottom:"1px solid var(--line)"}}>
          <h2 style={{font:"600 15px/1.2 var(--font-sans)", color:"var(--ink)", margin:0}}>Geciken işler</h2>
          <div style={{font:"400 12px/1.3 var(--font-sans)", color:"var(--ink-3)", marginTop:4}}>deadline geçmiş · acil müdahale</div>
        </div>
        <BriefTable rows={allOverdue} onRowClick={onOpenBrief} onStatusChange={onStatusChange}/>
      </Card>

      {/* Stat kartları — 3 kolon */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"var(--grid-gap)", marginTop:"var(--grid-gap)"}}>
        <Card>
          <CardHead title="Onay bekleyenler" sub={`${allReview.length} brief · rev tamamlandı`}/>
          {allReview.slice(0, 5).map((b, i) => (
            <ApprovalRow key={b.id} brief={b} onClick={() => onOpenBrief(b)} last={i === Math.min(4, allReview.length - 1)}/>
          ))}
          {allReview.length > 5 && (
            <button onClick={() => onSwitchTab("jobs")} style={{
              marginTop: 8, font:"500 12px/1 var(--font-sans)", color:"var(--ink-3)",
              background:"transparent", border:0, cursor:"pointer", padding: 4
            }}>+{allReview.length - 5} daha →</button>
          )}
        </Card>

        <Card>
          <CardHead title="Bu hafta · özet"/>
          <WeekStat label="Tamamlanan" value={String(weekCount)}
            trend={{dir: weekCountDelta > 0 ? "up" : weekCountDelta < 0 ? "down" : "flat",
                    value: (weekCountDelta > 0 ? "+" : "") + weekCountDelta}}/>
          <WeekStat label="Ort. tamamlama"
            value={avgSure > 0 ? avgSure.toFixed(1).replace(".",",") + " sa" : "—"}
            trend={{dir: sureDelta < 0 ? "down" : sureDelta > 0 ? "up" : "flat",
                    value: (sureDelta > 0 ? "+" : "") + sureDelta.toFixed(1).replace(".",",") + " sa"}} good/>
          <WeekStat label="Revize oranı"
            value={avgRevPct > 0 ? "%" + avgRevPct : "—"}
            trend={{dir:"flat", value:"="}}/>
          <WeekStat label="Hareketsiz" value={String(staleCount)}
            trend={{dir: staleCount > 0 ? "up" : "flat", value: staleCount > 0 ? "+"+staleCount : "="}} bad last/>
        </Card>

        <Card>
          <CardHead title="Eşik kuralları" sub="otomatik tetiklenen uyarılar"/>
          <Rule name="Kapasite > %85"     status="ON"  hits={capHits}/>
          <Rule name="Geciken > 5"        status="ON"  hits={overdueHits}/>
          <Rule name="Hareketsiz > 3 gün" status="ON"  hits={staleHits}/>
          <Rule name="Revize > %30"       status={avgRevPct > 30 ? "ON" : "OFF"} hits={revHits} last/>
        </Card>
      </div>
    </div>
  );
}

function Alert({ tone, Icon, title, body, action, metric }) {
  const map = {
    danger:  { bd:"rgba(215,38,61,0.30)",  bg:"rgba(215,38,61,0.05)",  fg:"var(--danger)" },
    warn:    { bd:"rgba(224,122,31,0.30)", bg:"rgba(224,122,31,0.06)", fg:"var(--warning)" },
    info:    { bd:"rgba(51,96,164,0.30)",  bg:"rgba(51,96,164,0.05)",  fg:"var(--info)" },
    success: { bd:"rgba(46,143,102,0.30)", bg:"rgba(46,143,102,0.05)", fg:"var(--success)" }
  };
  const c = map[tone];
  return (
    <div style={{
      display:"flex", flexDirection:"column", gap: 12,
      padding: 18, borderRadius: 10,
      border: `1px solid ${c.bd}`, background: c.bg, position:"relative"
    }}>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap: 8}}>
        <div style={{display:"flex", alignItems:"center", gap: 8, color: c.fg}}>
          <Icon size={16}/>
          <span style={{font:"600 13px/1 var(--font-sans)"}}>{title}</span>
        </div>
        {metric !== undefined && (
          <span style={{font:"600 28px/1.15 var(--font-sans)", color: c.fg, letterSpacing:"-0.01em", fontVariantNumeric:"tabular-nums"}}>{metric}</span>
        )}
      </div>
      <div style={{font:"400 13px/1.45 var(--font-sans)", color:"var(--ink-2)"}}>{body}</div>
      <div style={{marginTop:2}}>{action}</div>
    </div>
  );
}

function Rule({ name, status, hits, last }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", justifyContent:"space-between", gap: 10,
      padding:"10px 0", borderBottom: last ? "0" : "1px solid var(--line)"
    }}>
      <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink)"}}>{name}</span>
      <div style={{display:"flex", alignItems:"center", gap: 8}}>
        <span style={{
          font:"600 10px/1 var(--font-sans)", letterSpacing:"0.06em",
          padding:"3px 7px", borderRadius:999,
          background: status === "ON" ? "var(--prio-green-bg)" : "var(--paper-2)",
          color:      status === "ON" ? "var(--prio-green)"    : "var(--ink-4)"
        }}>{status}</span>
        <span style={{font:"500 12px/1 var(--font-mono)", color: hits > 0 ? "var(--prio-red)" : "var(--ink-4)", minWidth: 30, textAlign:"right"}}>
          {hits} hit
        </span>
      </div>
    </div>
  );
}

function EditorialLayout({ data, musteride, user, active, overdue, today, todayDue, week, stale, review, blocked, onOpenBrief, onSwitchTab, onJumpJobs, onRefresh, onStatusChange, filterOpen, setFilterOpen, deptFilter, setDeptFilter, prioFilter, setPrioFilter, filterActive, kpiVariant }) {
  const firstName = user.name.split(" ")[0];
  const greeting = greetingFor();
  const avgCapPct = calcAvgCapPct(data);
  const hist = data.history || [];

  // Gerçek history'den spark dizileri (kpi_history dolana kadar mock fallback)
  const sparkActive  = histSpark(hist, "active",  active.length)  || [42,45,49,52,55,58,active.length];
  const sparkOverdue = histSpark(hist, "overdue", overdue.length) || [3,4,5,4,6,7,overdue.length];
  const sparkToday   = histSpark(hist, "today",   today.length)   || [8,7,9,10,11,11,today.length];
  const sparkReview  = histSpark(hist, "review",  review.length)  || [6,7,7,9,10,11,review.length];
  const sparkStale   = histSpark(hist, "stale",   stale.length)   || [1,2,2,3,3,4,stale.length];

  // Trend: son kayıtla karşılaştır
  const trendActive  = histTrend(hist, "active",  active.length)  || { dir:"up",   value:"+8",  bad:true };
  const trendOverdue = histTrend(hist, "overdue", overdue.length) || { dir:"up",   value:"+2",  bad:true };
  const trendToday   = histTrend(hist, "today",   today.length)   || { dir:"flat", value:"=" };
  const trendReview  = histTrend(hist, "review",  review.length)  || { dir:"up",   value:"+3" };

  return (
    <div className="bn-tab-in">
      <PageHead
        eyebrow={data.fmtTr ? data.fmtTr(Date.now()) : `${greetingTimezone()}`}
        title={`${greeting}, ${firstName}.`}
        subtitle={<>bugün <strong style={{fontWeight:600, color: overdue.length ? "var(--prio-red)" : "var(--ink-2)"}}>{overdue.length} geciken</strong>, <strong style={{fontWeight:600, color:"var(--ink-2)"}}>{todayDue.length} bugün teslim</strong>. önce bunlar.</>}
        actions={<div style={{position:"relative",display:"flex",gap:6}}>
          <Button kind={filterActive ? "primary" : "secondary"} icon={<I.Filter size={14}/>} onClick={() => setFilterOpen(o=>!o)}>
            {filterActive ? "Filtre aktif" : "Filtrele"}
          </Button>
          <FilterPanel open={filterOpen} onClose={() => setFilterOpen(false)} deptFilter={deptFilter} setDeptFilter={setDeptFilter} prioFilter={prioFilter} setPrioFilter={setPrioFilter} filterActive={filterActive}/>
          <Button kind="ghost" icon={<I.Refresh size={14}/>} onClick={onRefresh}>Yenile</Button>
        </div>}
      />

      {/* ⭐ Firma yıldızı — tıklayınca Karşılaştırma'daki Yıldız Karnesi'ne gider */}
      {(() => {
        const R = window.BNS_DATA && window.BNS_DATA.ratings;
        if (!R || !R.firma || !R.firma.cnt) return null;
        return (
          <div onClick={onSwitchTab ? () => onSwitchTab("dept-comp") : undefined}
            title="Yıldız Karnesi'ni aç"
            style={{
              display:"inline-flex", alignItems:"center", gap:8, marginTop:12,
              padding:"7px 12px", background:"var(--surface)", border:"1px solid var(--line)",
              borderRadius:999, cursor: onSwitchTab ? "pointer" : "default",
            }}>
            <span style={{font:"600 11px/1 var(--font-sans)", letterSpacing:"0.05em", textTransform:"uppercase", color:"var(--ink-3)"}}>Benseno</span>
            <span style={{display:"inline-flex", gap:1}}>
              {[1,2,3,4,5].map(i => <I.StarFill key={i} size={12} color={i <= Math.round(R.firma.avg) ? "var(--prio-yellow)" : "var(--line-strong)"}/>)}
            </span>
            <span style={{font:"600 13px/1 var(--font-mono)", color:"var(--ink)"}}>{R.firma.avg}</span>
            <span style={{font:"400 11px/1 var(--font-sans)", color:"var(--ink-4)"}}>({R.firma.cnt} iş)</span>
          </div>
        );
      })()}

      {/* KPI grid */}
      <KpiGrid cols={7}>
        <Kpi label="Aktif brief"   value={active.length}  variant={kpiVariant} spark={sparkActive}  trend={{...trendActive,  bad: trendActive.dir==="up"}}  sub={hist.length > 1 ? "son sync'e göre" : "geçen haftaya göre"} onClick={onJumpJobs ? () => onJumpJobs("all") : undefined}/>
        <Kpi label="Geciken"       value={overdue.length} color="var(--prio-red)" emphasis={overdue.length > 0} tint="var(--prio-red-bg)" variant={kpiVariant} spark={sparkOverdue} trend={{...trendOverdue, bad: trendOverdue.dir==="up"}} sub={hist.length > 1 ? "son sync'e göre" : "dün gece"} onClick={onJumpJobs ? () => onJumpJobs("overdue") : undefined}/>
        <Kpi label="Bugün teslim"  value={todayDue.length}   variant={kpiVariant} spark={sparkToday} trend={trendToday} sub={hist.length > 1 ? "son sync'e göre" : "stabil"} onClick={onJumpJobs ? () => onJumpJobs("all") : undefined}/>
        <Kpi label="Onay bekleyen" value={review.length}  color="var(--warning)" variant={kpiVariant} spark={sparkReview} trend={trendReview} sub={hist.length > 1 ? "son sync'e göre" : "dün 09:00'dan beri"} onClick={onJumpJobs ? () => onJumpJobs("review") : undefined}/>
        <Kpi label="Hareketsiz"    value={stale.length}   variant={kpiVariant} spark={sparkStale} sub="24 iş saati hareket yok" onClick={onJumpJobs ? () => onJumpJobs("all") : undefined}/>
        <Kpi label="Müşteride"     value={musteride.length} color="var(--musteride)" variant={kpiVariant} sub="✈️ dönüş bekleniyor" onClick={onSwitchTab ? () => onSwitchTab("musteride") : undefined}/>
        <Kpi label="Kapasite"      value={avgCapPct!=null?"%"+avgCapPct:"—"} variant={kpiVariant} trend={{dir:"up", value:"+%5", bad:avgCapPct>85}} sub="ekip ortalaması" onClick={onSwitchTab ? () => onSwitchTab("dept-comp") : undefined}/>
      </KpiGrid>

      {/* Gömülü mini-widget'lar — termin ufku + kapasite ısısı */}
      <div className="bn-grid-2" style={{display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:"var(--grid-gap)", marginTop:"var(--section-gap)"}}>
        <Card padding={0}>
          <CardHead title="Termin ufku" sub="önümüzdeki 14 gün · noktaya tıkla"/>
          <div style={{padding:16}}>
            <LabHorizon briefs={active} now={(data && data.NOW) || Date.now()} onOpenBrief={onOpenBrief}/>
          </div>
        </Card>
        <Card padding={0}>
          <CardHead title="Kapasite ısısı" sub="kişi yükü / kapasite"/>
          <div style={{padding:16, maxHeight:280, overflowY:"auto"}}>
            <LabCapacity briefs={active} users={data.USERS}/>
          </div>
        </Card>
      </div>

      {/* Tablo — tam genişlik */}
      <Card padding={0} style={{marginTop:"var(--section-gap)"}}>
        <div style={{padding:"14px 16px", borderBottom:"1px solid var(--line-soft)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <div>
            <h2 style={{font:"italic 500 18px/1.15 var(--font-display)", color:"var(--ink)", margin:0, letterSpacing:"0"}}>Bugün ve yarın</h2>
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

      {/* Stat kartları — tablonun altında 3 kolon */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"var(--grid-gap)", marginTop:"var(--grid-gap)"}}>
        <Card>
          <CardHead title="Departman özeti" sub="aktif · geciken · kapasite"/>
          <DeptRow s={data.deptStats.tasarim}   color="var(--bw-1)"/>
          <DeptRow s={data.deptStats.editor}    color="var(--bw-4)"/>
          <DeptRow s={data.deptStats.ai}        color="var(--bw-14)"/>
          <DeptRow s={data.deptStats.freelance} color="var(--bw-8)" last/>
        </Card>
        <Card>
          <CardHead title="Sorunlu markalar" sub="canlı brief'lerden"/>
          <ProblemBrands data={data}/>
        </Card>
        {/* Bu hafta parlayan — kişi performansı: sadece yöneticiler görür */}
        {(typeof bnsGetStoredUser === "function" && bnsGetStoredUser()?.role === "admin") && (
        <Card>
          <CardHead title="Bu hafta · parlayan" sub="tamamlanan brief'lerden"/>
          <StarOfTheWeek data={data}/>
        </Card>
        )}
      </div>

      <ManagerSection data={data} user={user} overdue={overdue} review={review} onOpenBrief={onOpenBrief} onSwitchTab={onSwitchTab} onStatusChange={onStatusChange}/>
    </div>
  );
}

// ─── DENSE ──────────────────────────────────────────────────────────────────
function DenseLayout({ data, musteride, active, overdue, today, todayDue, week, stale, review, blocked, onOpenBrief, onSwitchTab, onRefresh, filterOpen, setFilterOpen, deptFilter, setDeptFilter, prioFilter, setPrioFilter, filterActive, kpiVariant }) {
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
        <Kpi label="Bugün"        value={todayDue.length} variant={kpiVariant} spark={[8,7,9,10,11,11,todayDue.length]}/>
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
            <DeptRow s={data.deptStats.tasarim}   color="var(--bw-1)" compact/>
            <DeptRow s={data.deptStats.editor}    color="var(--bw-4)" compact/>
            <DeptRow s={data.deptStats.ai}        color="var(--bw-14)" compact/>
            <DeptRow s={data.deptStats.freelance} color="var(--bw-8)" compact last/>
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
function StoryLayout({ data, musteride, active, overdue, today, todayDue, week, stale, review, blocked, onOpenBrief, onSwitchTab, kpiVariant }) {
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
            <div style={{font:"600 56px/1.1 var(--font-sans)", color:"var(--prio-red)", letterSpacing:"-0.02em", margin:"8px 0 6px", fontVariantNumeric:"tabular-nums"}}>
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
        <Kpi label="Bugün teslim"  value={todayDue.length} variant={kpiVariant} spark={[8,7,9,10,11,11,todayDue.length]} trend={{dir:"flat", value:"="}}/>
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
            <DeptRow s={data.deptStats.tasarim}   color="var(--bw-1)"/>
            <DeptRow s={data.deptStats.editor}    color="var(--bw-4)"/>
            <DeptRow s={data.deptStats.ai}        color="var(--bw-14)"/>
            <DeptRow s={data.deptStats.freelance} color="var(--bw-8)" last/>
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
  const capPct = s.capacity_pct ?? bnsCapPct(s) ?? 0;
  const capColor = capPct > 85 ? "var(--warning)" : capPct > 60 ? color || "var(--info)" : "var(--success)";
  return (
    <div style={{padding: compact ? "8px 0" : "11px 0", borderBottom: last ? "0" : "1px solid var(--line-soft)"}}>
      {/* İsim + sayılar */}
      <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:6}}>
        <span style={{width:8, height:8, borderRadius:2, background:color, flexShrink:0}}/>
        <span style={{font:"600 12px/1 var(--font-sans)", color:"var(--ink)", flex:1}}>{s.name}</span>
        <span style={{font:"600 12px/1 var(--font-mono)", color:"var(--ink)"}}>{s.active}</span>
        {s.overdue > 0 && <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--prio-red)"}}>· {s.overdue}g</span>}
      </div>
      {/* Progress bar + % */}
      <div style={{display:"flex", alignItems:"center", gap:6}}>
        <div style={{flex:1, height:4, background:"var(--line-soft)", borderRadius:999, overflow:"hidden"}}>
          <div style={{height:"100%", background:capColor, borderRadius:999, width:`${Math.min(capPct,100)}%`, transition:"width 600ms ease"}}/>
        </div>
        <span style={{font:"500 11px/1 var(--font-mono)", color:capColor, flexShrink:0}}>%{capPct}</span>
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
    if (b.deltaH <= 0 && b.durum !== "tamamlandi" && b.durum !== "musteride") s.overdue++;
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
    <div style={{padding:"9px 0", borderBottom: last ? "0" : "1px solid var(--line-soft)"}}>
      {/* İsim satırı */}
      <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:2}}>
        <span style={{width:7, height:7, borderRadius:999, background:color||"var(--ink-4)", flexShrink:0}}/>
        <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink)", flex:1}}>{name}</span>
        <span style={{font:"500 12px/1 var(--font-mono)", color:"var(--ink-4)", flexShrink:0}}>{v}</span>
      </div>
      {/* Not satırı */}
      {note && <div style={{font:"400 11px/1.3 var(--font-sans)", color:"var(--ink-3)", paddingLeft:13}}>{note}</div>}
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
  const trendColor = trend.dir === "flat" ? "var(--ink-4)" :
                (good ? "var(--success)" : bad ? "var(--danger)" :
                  (trend.dir === "up" ? "var(--success)" : "var(--danger)"));
  const trendBg = trend.dir === "flat" ? "var(--paper-2)" :
                (good ? "var(--prio-green-bg)" : bad ? "var(--prio-red-bg)" :
                  (trend.dir === "up" ? "var(--prio-green-bg)" : "var(--prio-red-bg)"));
  return (
    <div style={{
      display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0",
      borderBottom: last ? "0" : "1px solid var(--line-soft)", gap: 12
    }}>
      <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink-2)", whiteSpace:"nowrap"}}>{label}</span>
      <span style={{display:"flex", alignItems:"center", gap:7, whiteSpace:"nowrap"}}>
        <span style={{font:"600 15px/1 var(--font-sans)", color:"var(--ink)", fontVariantNumeric:"tabular-nums"}}>{value}</span>
        <span style={{
          font:"600 10px/1 var(--font-sans)", color:trendColor,
          padding:"2px 6px", borderRadius:4, background:trendBg,
        }}>{trend.dir==="up"?"↑":trend.dir==="down"?"↓":"→"} {trend.value}</span>
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
