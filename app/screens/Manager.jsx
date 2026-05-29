// app/screens/Manager.jsx — komuta merkezi for 5 yöneticiler.

function ManagerScreen({ data, user, onOpenBrief, onSwitchTab, onStatusChange }) {
  // Yönetici komuta merkezi tüm sistemi izler — viewMode (mine/dept/all) etkilemez.
  const briefs = data._allBriefs || data.briefs;
  const overdue = briefs.filter(b => b.deltaH <= 0 && b.durum !== "tamamlandi");
  const review  = briefs.filter(b => b.durum === "incelemede");
  const blocked = briefs.filter(b => b.durum === "blokeli");

  // Senkron zamanı
  const nowTs = data.NOW || Date.now();
  const syncAgo = Math.round((Date.now() - nowTs) / 1000);
  const syncLabel = syncAgo < 60 ? `${syncAgo} sn önce` : syncAgo < 3600 ? `${Math.round(syncAgo/60)} dk önce` : `${Math.round(syncAgo/3600)} sa önce`;

  // Bu hafta özet — allCompleted'dan hesapla
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

  // Kapasite: live dept stats'tan tasarım departmanı (en kritik)
  const ds = data.deptStats || {};
  const tasarimCap = ds.tasarim ? (ds.tasarim.capacity_pct != null ? ds.tasarim.capacity_pct : bnsCapPct(ds.tasarim)) : null;

  // Eşik kuralları — live hesapla (tasarimCap'tan sonra)
  const H = 3600 * 1000;
  const capHits   = (tasarimCap != null && tasarimCap > 85) ? 1 : 0; // Kapasite > %85
  const overdueHits = overdue.length > 5 ? 1 : 0;                    // Geciken > 5
  const staleHits   = briefs.filter(b => b.stale || ((nowTs - (b.acilma||0)) > 3 * 24 * H && b.durum === "yeni")).length;
  const revHits     = avgRevPct > 30 ? 1 : 0;
  const capLabel = tasarimCap != null ? `Tasarım kapasitesi %${tasarimCap}` : "Tasarım kapasitesi";
  const capMetric = tasarimCap != null ? `%${tasarimCap}` : "—";
  const capTone = tasarimCap != null && tasarimCap > 85 ? "warn" : "info";

  return (
    <div className="bn-tab-in">
      <PageHead
        eyebrow="Sadece yöneticiler görür · 5 kişi"
        title="Yönetici · komuta merkezi"
        subtitle="bugün dikkat etmen gereken şeyler."
        actions={
          <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink-3)", whiteSpace:"nowrap"}}>
            Senkron · {syncLabel}
          </span>
        }
      />

      {/* Alert grid */}
      <div className="bn-grid-3" style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"var(--grid-gap)", marginBottom:"var(--section-gap)"}}>
        <Alert tone="danger" Icon={I.Warn}
          title={`${overdue.length} iş gecikti`}
          body="Şu an deadline'ı geçmiş aktif brief'ler. İlk eylem: yeniden ata veya Slack thread'ini aç."
          action={<Button kind="ink" size="sm" onClick={() => onSwitchTab("jobs")}>Listeyi aç</Button>}
          metric={overdue.length}/>
        <Alert tone={capTone} Icon={I.Info}
          title={capLabel}
          body={tasarimCap > 85 ? "Eşik %85 aşıldı. Yeni atama önerilmez." : tasarimCap != null ? `Eşik %85. Kapasite müsait (%${tasarimCap}).` : "Kapasite verisi bekleniyor."}
          action={<Button kind="secondary" size="sm" onClick={() => onSwitchTab("design")}>Tasarım sekmesi</Button>}
          metric={capMetric}/>
        <Alert tone="info" Icon={I.Check}
          title={`${review.length} brief onay bekliyor`}
          body="rev tamamlandı · yöneticiler gözden geçirmeli. Tıkla, drawer'da hızlıca onayla."
          action={<Button kind="secondary" size="sm" onClick={() => onSwitchTab("jobs")}>Onay kuyruğu</Button>}
          metric={review.length}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:"var(--grid-gap)"}} className="bn-grid-2">
        <Card padding={0}>
          <div style={{padding:"14px 16px", borderBottom:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"baseline"}}>
            <div>
              <h2 style={{font:"600 15px/1.2 var(--font-sans)", color:"var(--ink)", margin:0}}>Geciken işler</h2>
              <div style={{font:"400 12px/1.3 var(--font-sans)", color:"var(--ink-3)", marginTop:4}}>deadline {(() => { const d = new Date(nowTs); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); })()} öncesine düştü · acil müdahale</div>
            </div>
            <Button kind="ghost" size="sm" icon={<I.Move size={13}/>}>Yeniden ata</Button>
          </div>
          <BriefTable rows={overdue} onRowClick={onOpenBrief} onStatusChange={onStatusChange}/>
        </Card>

        <div style={{display:"flex", flexDirection:"column", gap:"var(--grid-gap)"}}>
          <Card>
            <CardHead title="Onay bekleyenler" sub={`${review.length} brief · rev tamamlandı`}/>
            {review.slice(0, 5).map((b, i) => (
              <ApprovalRow key={b.id} brief={b} onClick={() => onOpenBrief(b)} last={i === Math.min(4, review.length - 1)}/>
            ))}
            {review.length > 5 && (
              <button onClick={() => onSwitchTab("jobs")} style={{
                marginTop: 8, font:"500 12px/1 var(--font-sans)", color:"var(--ink-3)",
                background:"transparent", border:0, cursor:"pointer", padding: 4
              }}>+{review.length - 5} daha →</button>
            )}
          </Card>

          <Card>
            <CardHead title="Bu hafta · özet"/>
            <WeekStat label="Tamamlanan" value={String(weekCount)}
              trend={{dir: weekCountDelta > 0 ? "up" : weekCountDelta < 0 ? "down" : "flat",
                      value: (weekCountDelta > 0 ? "+" : "") + weekCountDelta}}/>
            <WeekStat label="Ortalama tamamlama"
              value={avgSure > 0 ? avgSure.toFixed(1).replace(".",",") + " sa" : "—"}
              trend={{dir: sureDelta < 0 ? "down" : sureDelta > 0 ? "up" : "flat",
                      value: (sureDelta > 0 ? "+" : "") + sureDelta.toFixed(1).replace(".",",") + " sa"}} good/>
            <WeekStat label="Revize oranı"
              value={avgRevPct > 0 ? "%" + avgRevPct : "—"}
              trend={{dir:"flat", value:"="}}/>
            <WeekStat label="Hareketsiz brief" value={String(staleCount)}
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

window.ManagerScreen = ManagerScreen;
