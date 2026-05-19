// app/screens/Profile.jsx — single-user view.

function ProfileScreen({ data, user, onOpenBrief }) {
  const myActive = data.briefs.filter(b => b.lead.id === user.id || b.contributors.some(c => c.id === user.id) || (b.reviewer && b.reviewer.id === user.id));
  const leadCount    = data.briefs.filter(b => b.lead.id === user.id).length;
  const contribCount = data.briefs.filter(b => b.contributors.some(c => c.id === user.id)).length;
  const reviewCount  = data.briefs.filter(b => b.reviewer && b.reviewer.id === user.id).length;
  const brandsTouched = new Set(myActive.map(b => b.marka)).size;
  const completed30 = data.completed.filter(b => b.lead.id === user.id).length;

  const roleLabel = {yonetici: user.title || "Yönetici", tasarim: "Tasarım", editor: "Editör", ai: "AI Operatör"}[user.rol];

  // Top brands for this user (by # of related briefs)
  const brandCount = {};
  myActive.forEach(b => { brandCount[b.marka] = (brandCount[b.marka] || 0) + 1; });
  data.completed.filter(c => c.lead.id === user.id).forEach(b => { brandCount[b.marka] = (brandCount[b.marka] || 0) + 1; });
  const topBrands = Object.entries(brandCount).sort((a,b) => b[1] - a[1]).slice(0, 6)
    .map(([name, v]) => ({ name, v, color: data.BRANDS.find(b => b.name === name)?.color || "#888" }));

  return (
    <div className="bn-tab-in">
      <div style={{
        display:"flex", alignItems:"flex-end", gap: 18, padding: "24px 0 8px", flexWrap:"wrap"
      }}>
        <Avatar user={user} size={72}/>
        <div style={{flex:1, minWidth: 220}}>
          <Eyebrow>{roleLabel}</Eyebrow>
          <h1 style={{font:"600 28px/1.1 var(--font-sans)", color:"var(--ink)", margin:"6px 0 0", letterSpacing:"-0.01em"}}>{user.name}</h1>
          <div style={{
            fontFamily:"var(--font-display)", fontStyle:"italic", fontSize:18, color:"var(--ink-2)", marginTop:8
          }}>aktif {myActive.length}, lead {leadCount}, {brandsTouched} markaya değdi.</div>
        </div>
        <div style={{display:"flex", gap: 8}}>
          <Button kind="secondary" icon={<I.Slack size={14}/>}>Slack DM</Button>
          <Button kind="primary" icon={<I.Plus size={14}/>}>Brief ata</Button>
        </div>
      </div>

      <div style={{height: 22}}/>

      <div style={{display:"grid", gridTemplateColumns:"repeat(8, 1fr)", gap:"var(--grid-gap)", marginBottom:"var(--section-gap)"}} className="bn-kpi-grid">
        <Kpi label="Aktif iş"    value={myActive.length}/>
        <Kpi label="Tamamlanan"  value={completed30 + 7} sub="son 30 gün"/>
        <Kpi label="Toplam saat" value="142,5"/>
        <Kpi label="Lead"        value={leadCount}/>
        <Kpi label="Contributor" value={contribCount}/>
        <Kpi label="Reviewer"    value={reviewCount}/>
        <Kpi label="Marka"       value={brandsTouched}/>
        <Kpi label="Ort. tamamlama" value="28,2 sa" trend={{dir:"down", value:"-2,1", good:true}}/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.7fr 1fr", gap:"var(--grid-gap)"}} className="bn-grid-2">
        <Card padding={0}>
          <div style={{padding:"14px 16px", borderBottom:"1px solid var(--line)"}}>
            <h2 style={{font:"600 15px/1.2 var(--font-sans)", color:"var(--ink)", margin:0}}>Üzerimdeki işler</h2>
            <div style={{font:"400 12px/1.3 var(--font-sans)", color:"var(--ink-3)", marginTop:4}}>lead + contributor + reviewer · {myActive.length} brief</div>
          </div>
          {myActive.length > 0 ? <BriefTable rows={myActive} onRowClick={onOpenBrief}/> : (
            <div style={{padding: 32, textAlign:"center"}}>
              <Eyebrow style={{justifyContent:"center", display:"flex"}}>Hafif gün</Eyebrow>
              <div style={{font:"500 16px/1.4 var(--font-sans)", color:"var(--ink-2)", margin:"10px 0 4px"}}>Bu hafta sana atanmış iş yok.</div>
              <div style={{font:"400 13px/1.4 var(--font-sans)", color:"var(--ink-4)"}}>Tasarım takımında 4 açık brief var — bakmak ister misin?</div>
            </div>
          )}
        </Card>

        <div style={{display:"flex", flexDirection:"column", gap:"var(--grid-gap)"}}>
          <Card>
            <CardHead title="Marka dağılımı" sub="aktif + son 30 gün"/>
            {topBrands.map((b, i) => <BrandBar key={b.name} {...b} last={i === topBrands.length - 1}/>)}
            {topBrands.length === 0 && <Eyebrow>Henüz veri yok</Eyebrow>}
          </Card>
          <Card>
            <CardHead title="Son aktiviteler"/>
            {data.activity.slice(0, 5).map((a, i) => (
              <Activity key={i} time={relTimeShort(a.t)}
                text={`${a.target} · ${a.verb}${a.meta ? " · " + a.meta : ""}`}
                last={i === 4}/>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function BrandBar({ name, v, color, last }) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom: last ? "0" : "1px solid var(--line)"}}>
      <span style={{width:8, height:8, borderRadius:999, background: color, flexShrink:0}}/>
      <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink)", minWidth: 130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{name}</span>
      <div style={{flex:1, height:5, background:"var(--line-soft)", borderRadius:999, overflow:"hidden"}}>
        <div style={{width: Math.min(v*12, 100)+"%", height:"100%", background: color, opacity:0.85}}/>
      </div>
      <span style={{font:"500 12px/1 var(--font-mono)", color:"var(--ink-3)", minWidth: 20, textAlign:"right"}}>{v}</span>
    </div>
  );
}

function Activity({ time, text, last }) {
  return (
    <div style={{display:"flex", alignItems:"flex-start", gap:14, padding:"9px 0", borderBottom: last ? "0" : "1px solid var(--line)"}}>
      <span style={{font:"500 11px/1.3 var(--font-mono)", color:"var(--ink-4)", minWidth: 50, marginTop:1}}>{time}</span>
      <span style={{font:"400 13px/1.3 var(--font-sans)", color:"var(--ink-2)"}}>{text}</span>
    </div>
  );
}

function relTimeShort(ts) {
  const now = window.BNS_DATA.NOW;
  const m = (now - ts) / 60000;
  if (m < 60) return Math.round(m) + " dk";
  if (m < 60*24) return Math.round(m/60) + " sa";
  return Math.round(m/(60*24)) + " gün";
}

window.ProfileScreen = ProfileScreen;
