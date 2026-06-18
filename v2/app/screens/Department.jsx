// app/screens/Department.jsx — reused for Tasarım / Editör / AI tabs.

function DepartmentScreen({ data, role, onOpenBrief }) {
  const roleMap = {
    tasarim:   { name: "Tasarım",   emoji: "🎨", stats: data.deptStats.tasarim,   accent: "var(--bw-1)" },
    editor:    { name: "Editör",    emoji: "✍️", stats: data.deptStats.editor,    accent: "var(--bw-4)" },
    ai:        { name: "AI",        emoji: "🤖", stats: data.deptStats.ai,        accent: "var(--bw-14)" },
    freelance: { name: "Freelance", emoji: "🤝", stats: data.deptStats.freelance, accent: "var(--bw-8)" }
  };
  const r = roleMap[role];
  // rows henüz hesaplanmadı — capPct rows.length ile override edilecek (aşağıda)
  const _capPctFromStats = r.stats ? (r.stats.capacity_pct != null ? r.stats.capacity_pct : bnsCapPct(r.stats)) : 0;
  // dept öncelikli eşleşme: departman yöneticileri (rol='yonetici', dept=ilgili) de ekibin içinde sayılır
  const people = data.USERS.filter(u => (u.dept || u.rol) === role);
  // Department her zaman bu rolün tüm briefler'ini gösterir — viewMode (mine/dept/all) etkilemez.
  const allBriefs = (data._allBriefs || data.briefs).filter(b => b.durum !== "musteride"); // müşteridekiler yük sayılmaz
  const rows = allBriefs.filter(b =>
    (b.lead && (b.lead.dept || b.lead.rol) === role) ||
    (b.dept === role) ||
    (Array.isArray(b.contributors) && b.contributors.some(c => c && (c.dept || c.rol) === role))
  );
  const overdueCount = rows.filter(b => b.deltaH <= 0 && b.durum !== "tamamlandi").length;
  // Kapasite: rows.length / (people × 6 slot) — deptStats.active yerine gerçek satır sayısı
  const capPct = r.stats && r.stats.capacity ? Math.min(100, Math.round((rows.length / r.stats.capacity) * 100)) : _capPctFromStats;
  const reviewCount = rows.filter(b => b.durum === "incelemede").length;
  const thisWeek = rows.filter(b => b.deltaH > 0 && b.deltaH <= 168).length;

  // Load per person
  const loadByPerson = people.map(p => {
    const my = allBriefs.filter(b => (b.lead && b.lead.id === p.id) || (Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === p.id)));
    const myOverdue = my.filter(b => b.deltaH <= 0 && b.durum !== "tamamlandi").length;
    return {
      user: p,
      active: my.length,
      overdue: myOverdue,
      // Profil ekranıyla AYNI kapasite hesabı (data.js bnsPersonCapPct) — tutarlılık şart.
      load: Math.max(0, bnsPersonCapPct(p, my.length) + (p.isNew ? -10 : 0))
    };
  });

  return (
    <div className="bn-tab-in">
      <PageHead
        eyebrow={`Departman · ${r.stats.people} kişi`}
        title={`${r.name} departmanı`}
        subtitle={(() => {
          const dr = window.BNS_DATA?.ratings?.dept?.[role];
          const star = dr && dr.cnt ? ` · ⭐ ${dr.avg}/5 (${dr.cnt} iş)` : "";
          return `${rows.length} aktif iş · %${capPct} kapasite · ${overdueCount} geciken${star}`;
        })()}
        actions={null}
      />

      <div className="bns-kpi-5" style={{display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:"var(--grid-gap)", marginBottom:"var(--section-gap)"}}>
        <Kpi label="Aktif iş"     value={rows.length} accent={r.accent}/>
        <Kpi label="Bu hafta"     value={thisWeek}/>
        <Kpi label="Kapasite"     value={`%${capPct}`} color={capPct > 85 ? "var(--warning)" : "var(--ink)"}/>
        <Kpi label="Geciken"      value={overdueCount} color="var(--prio-red)"/>
        <Kpi label="Onay bekleyen" value={reviewCount} color="var(--warning)"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1.6fr", gap:"var(--grid-gap)"}} className="bn-grid-2">
        {/* People */}
        <Card padding={0}>
          <div style={{padding:"14px 16px", borderBottom:"1px solid var(--line)"}}>
            <h2 style={{font:"italic 500 18px/1.15 var(--font-display)", color:"var(--ink)", margin:0}}>{r.name} ekibi</h2>
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
                    <span onClick={() => window.bnsOpenUser && window.bnsOpenUser(p.user)} title={`${p.user.name} · profili aç`} style={{whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", cursor:"pointer"}}>{p.user.name}</span>
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
        <Card padding={0} style={{minWidth:0}}>
          <div style={{padding:"14px 16px", borderBottom:"1px solid var(--line)"}}>
            <h2 style={{font:"italic 500 18px/1.15 var(--font-display)", color:"var(--ink)", margin:0}}>{r.name} işleri</h2>
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
    <span style={{display:"inline-flex", alignItems:"center", gap:5}}>
      <I.Dot size={6} color="var(--ember)"/>
      <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink-2)"}}>{children}</span>
    </span>
  );
}

window.DepartmentScreen = DepartmentScreen;
