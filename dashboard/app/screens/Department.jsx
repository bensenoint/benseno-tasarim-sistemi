// app/screens/Department.jsx — reused for Tasarım / Editör / AI tabs.

function DepartmentScreen({ data, role, onOpenBrief }) {
  const roleMap = {
    tasarim: { name: "Tasarım", emoji: "🎨", stats: data.deptStats.tasarim, accent: "var(--bw-1)" },
    editor:  { name: "Editör",  emoji: "✍️", stats: data.deptStats.editor,  accent: "var(--bw-4)" },
    ai:      { name: "AI",      emoji: "🤖", stats: data.deptStats.ai,      accent: "var(--bw-14)" }
  };
  const r = roleMap[role];
  const people = data.USERS.filter(u => u.rol === role);
  // Department her zaman bu rolün tüm briefler'ini gösterir — viewMode (mine/dept/all) etkilemez.
  const allBriefs = data._allBriefs || data.briefs;
  const rows = allBriefs.filter(b => (b.lead && b.lead.rol === role) || (Array.isArray(b.contributors) && b.contributors.some(c => c && c.rol === role)));
  const overdueCount = rows.filter(b => b.deltaH <= 0).length;
  const reviewCount = rows.filter(b => b.durum === "incelemede").length;
  const thisWeek = rows.filter(b => b.deltaH > 0 && b.deltaH <= 168).length;

  // Load per person
  const loadByPerson = people.map(p => {
    const my = allBriefs.filter(b => (b.lead && b.lead.id === p.id) || (Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === p.id)));
    const myOverdue = my.filter(b => b.deltaH <= 0).length;
    return {
      user: p,
      active: my.length,
      overdue: myOverdue,
      load: Math.min(100, my.length * 18 + (p.isNew ? -10 : 0))
    };
  });

  return (
    <div className="bn-tab-in">
      <PageHead
        eyebrow={`Departman · ${r.stats.people} kişi`}
        title={`${r.name} departmanı`}
        subtitle={`${r.stats.active} aktif iş · %${r.stats.capacity} kapasite · ${overdueCount} geciken`}
        actions={<Button kind="primary" size="sm" icon={<I.Plus size={13}/>}>Departmana brief ata</Button>}
      />

      <div style={{display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:"var(--grid-gap)", marginBottom:"var(--section-gap)"}}>
        <Kpi label="Aktif iş"     value={r.stats.active} accent={r.accent}/>
        <Kpi label="Bu hafta"     value={thisWeek}/>
        <Kpi label="Kapasite"     value={`%${r.stats.capacity}`} color={r.stats.capacity > 85 ? "var(--warning)" : "var(--ink)"}/>
        <Kpi label="Geciken"      value={overdueCount} color="var(--prio-red)"/>
        <Kpi label="Onay bekleyen" value={reviewCount} color="var(--warning)"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1.6fr", gap:"var(--grid-gap)"}} className="bn-grid-2">
        {/* People */}
        <Card padding={0}>
          <div style={{padding:"14px 16px", borderBottom:"1px solid var(--line)"}}>
            <h2 style={{font:"600 15px/1.2 var(--font-sans)", color:"var(--ink)", margin:0}}>{r.name} ekibi</h2>
            <div style={{font:"400 12px/1.3 var(--font-sans)", color:"var(--ink-3)", marginTop:4}}>{people.length} kişi · yüke göre sıralı</div>
          </div>
          <div>
            {loadByPerson.sort((a,b) => b.load - a.load).map((p, i) => (
              <div key={p.user.id} style={{
                display:"flex", alignItems:"center", gap: 10, padding:"11px 16px",
                borderBottom: i === loadByPerson.length - 1 ? "0" : "1px solid var(--line-soft)"
              }}>
                <Avatar user={p.user} size={28}/>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{display:"flex", alignItems:"center", gap: 6, font:"500 13px/1 var(--font-sans)", color:"var(--ink)"}}>
                    <span style={{whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{p.user.name}</span>
                    {p.user.isNew && <Tag>onboarding</Tag>}
                  </div>
                  <div style={{font:"400 11px/1.2 var(--font-sans)", color:"var(--ink-3)", marginTop: 3}}>
                    {p.active} aktif{p.overdue > 0 ? <span style={{color:"var(--prio-red)"}}> · {p.overdue} geciken</span> : null}
                  </div>
                </div>
                <div style={{width: 70, display:"flex", flexDirection:"column", alignItems:"flex-end", gap: 3}}>
                  <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)"}}>%{p.load}</span>
                  <div style={{width: 70, height: 4, background:"var(--line-soft)", borderRadius:999, overflow:"hidden"}}>
                    <div style={{width: p.load+"%", height:"100%", background: p.load > 85 ? "var(--warning)" : r.accent}}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Briefs */}
        <Card padding={0}>
          <div style={{padding:"14px 16px", borderBottom:"1px solid var(--line)"}}>
            <h2 style={{font:"600 15px/1.2 var(--font-sans)", color:"var(--ink)", margin:0}}>{r.name} işleri</h2>
            <div style={{font:"400 12px/1.3 var(--font-sans)", color:"var(--ink-3)", marginTop:4}}>{rows.length} aktif</div>
          </div>
          <BriefTable rows={rows} onRowClick={onOpenBrief}/>
        </Card>
      </div>
    </div>
  );
}

function Tag({ children }) {
  return (
    <span style={{
      font:"600 9px/1 var(--font-sans)", letterSpacing:"0.06em", textTransform:"uppercase",
      padding:"3px 6px", borderRadius: 999,
      background: "var(--ember-tint)", color:"var(--ember)"
    }}>{children}</span>
  );
}

window.DepartmentScreen = DepartmentScreen;
