// app/screens/Manager.jsx — komuta merkezi for 5 yöneticiler.

function ManagerScreen({ data, user, onOpenBrief, onSwitchTab, onStatusChange }) {
  const briefs = data.briefs;
  const overdue = briefs.filter(b => b.deltaH <= 0);
  const review  = briefs.filter(b => b.durum === "incelemede");
  const blocked = briefs.filter(b => b.durum === "blokeli");

  return (
    <div className="bn-tab-in">
      <PageHead
        eyebrow="Sadece yöneticiler görür · 5 kişi"
        title="Yönetici · komuta merkezi"
        subtitle="bugün dikkat etmen gereken şeyler."
        actions={
          <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink-3)", whiteSpace:"nowrap"}}>
            Senkron · 22 sn önce
          </span>
        }
      />

      {/* Alert grid */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"var(--grid-gap)", marginBottom:"var(--section-gap)"}} className="bn-grid-3">
        <Alert tone="danger" Icon={I.Warn}
          title={`${overdue.length} iş gecikti`}
          body="Şu an deadline'ı geçmiş aktif brief'ler. İlk eylem: yeniden ata veya Slack thread'ini aç."
          action={<Button kind="ink" size="sm" onClick={() => onSwitchTab("jobs")}>Listeyi aç</Button>}
          metric={overdue.length}/>
        <Alert tone="warn" Icon={I.Info}
          title="Tasarım kapasitesi %92"
          body="Eşik %85. Yeni atama önerilmez. Aylin'in yükü 4, Pelin onboarding'de."
          action={<Button kind="secondary" size="sm" onClick={() => onSwitchTab("design")}>Tasarım sekmesi</Button>}
          metric="%92"/>
        <Alert tone="info" Icon={I.Check}
          title={`${review.length} brief onay bekliyor`}
          body="rev tamamlandı · yöneticiler gözden geçirmeli. Tıkla, drawer'da hızlıca onayla."
          action={<Button kind="secondary" size="sm">Onay kuyruğu</Button>}
          metric={review.length}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:"var(--grid-gap)"}} className="bn-grid-2">
        <Card padding={0}>
          <div style={{padding:"14px 16px", borderBottom:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"baseline"}}>
            <div>
              <h2 style={{font:"600 15px/1.2 var(--font-sans)", color:"var(--ink)", margin:0}}>Geciken işler</h2>
              <div style={{font:"400 12px/1.3 var(--font-sans)", color:"var(--ink-3)", marginTop:4}}>deadline 14:30 öncesine düştü · acil müdahale</div>
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
            <WeekStat label="Tamamlanan" value="42" trend={{dir:"up", value:"+8"}}/>
            <WeekStat label="Ortalama tamamlama" value="28,4 sa" trend={{dir:"down", value:"-1,9 sa"}} good/>
            <WeekStat label="Revize oranı" value="%19" trend={{dir:"flat", value:"="}}/>
            <WeekStat label="Stale brief" value="4" trend={{dir:"up", value:"+2"}} bad last/>
          </Card>

          <Card>
            <CardHead title="Eşik kuralları" sub="otomatik tetiklenen uyarılar"/>
            <Rule name="Kapasite > %85" status="ON" hits={2}/>
            <Rule name="Geciken > 5"     status="ON" hits={1}/>
            <Rule name="Stale > 3 gün"   status="ON" hits={4}/>
            <Rule name="Revize > %30"    status="OFF" hits={0} last/>
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
          <span style={{font:"600 28px/1 var(--font-sans)", color: c.fg, letterSpacing:"-0.01em", fontVariantNumeric:"tabular-nums"}}>{metric}</span>
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
