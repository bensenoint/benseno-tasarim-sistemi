// app/screens/Multi.jsx — Multi-assignment view (Lead/Contributor/Reviewer).

function MultiScreen({ data, onOpenBrief }) {
  const multi = data.briefs.filter(b => b.contributors.length > 0 || b.reviewer);
  const leadOnly  = data.briefs.length - multi.length;
  const withContrib = data.briefs.filter(b => b.contributors.length > 0).length;
  const withReviewer = data.briefs.filter(b => b.reviewer).length;
  const triRole = data.briefs.filter(b => b.contributors.length > 0 && b.reviewer).length;

  return (
    <div className="bn-tab-in">
      <PageHead
        title="Multi-atama"
        subtitle="Açan · Atanan · İnceleyici — birden fazla rolün atandığı brief'ler"/>

      <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"var(--grid-gap)", marginBottom:"var(--section-gap)"}}>
        <Kpi label="Multi-atama" value={multi.length} sub={`${data.briefs.length} brief'in ${Math.round(multi.length/data.briefs.length*100)}%'si`}/>
        <Kpi label="Atanan var"    value={withContrib}/>
        <Kpi label="İnceleyici var" value={withReviewer}/>
        <Kpi label="3 rol birden"    value={triRole} accent="var(--ember)"/>
      </div>

      <Card padding={0}>
        <div style={{padding:"14px 16px", borderBottom:"1px solid var(--line)"}}>
          <h2 style={{font:"600 15px/1.2 var(--font-sans)", color:"var(--ink)", margin:0}}>Multi-atanmış brief'ler</h2>
          <div style={{font:"400 12px/1.3 var(--font-sans)", color:"var(--ink-3)", marginTop:4}}>her satırda 3 rol kolonu</div>
        </div>
        <div style={{overflow:"auto"}}>
          <table style={{width:"100%", borderCollapse:"collapse", font:"400 13px/1.3 var(--font-sans)"}}>
            <thead>
              <tr style={{background:"var(--surface-sub)"}}>
                {["#","Marka","İş","Açan","Atanan","İnceleyici","Öncelik","Durum"].map((h, i) => (
                  <th key={i} style={{
                    font:"600 11px/1 var(--font-sans)", color:"var(--ink-3)",
                    letterSpacing:"0.04em", textTransform:"uppercase",
                    padding:"10px 12px", borderBottom:"1px solid var(--line-strong)",
                    textAlign:"left", whiteSpace:"nowrap"
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {multi.map((b, idx) => (
                <tr key={b.id} onClick={() => onOpenBrief(b)} style={{
                  cursor:"pointer",
                  background: idx % 2 === 1 ? "var(--surface-sub)" : "var(--surface)"
                }}>
                  <td style={multiCs(true)}>{b.no}</td>
                  <td style={multiCs()}><BrandChip brand={b.brand} size="sm"/></td>
                  <td style={{...multiCs(), maxWidth: 280, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{b.baslik}</td>
                  <td style={multiCs()}>
                    <UserMini user={b.lead}/>
                  </td>
                  <td style={multiCs()}>
                    {b.contributors.length === 0
                      ? <span style={{color:"var(--ink-4)"}}>—</span>
                      : <div style={{display:"flex", flexDirection:"column", gap: 4}}>{b.contributors.map(u => <UserMini key={u.id} user={u}/>)}</div>}
                  </td>
                  <td style={multiCs()}>
                    {b.reviewer ? <UserMini user={b.reviewer}/> : <span style={{color:"var(--ink-4)"}}>—</span>}
                  </td>
                  <td style={multiCs()}><PriorityBadge p={b.priority} deltaH={b.deltaH} compact/></td>
                  <td style={multiCs()}><StatusPill status={b.durum}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function UserMini({ user }) {
  return (
    <span style={{display:"inline-flex", alignItems:"center", gap: 6}}>
      <Avatar user={user} size={18}/>
      <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink)", whiteSpace:"nowrap"}}>{user.name.split(" ")[0]}</span>
    </span>
  );
}

function multiCs(mono) {
  return {
    padding:"var(--row-pad) 12px",
    borderBottom:"1px solid var(--line)",
    fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
    fontSize: mono ? 12 : 13,
    color: mono ? "var(--ink-3)" : "var(--ink)",
    verticalAlign:"top",
    fontVariantNumeric:"tabular-nums"
  };
}

window.MultiScreen = MultiScreen;
