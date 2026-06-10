// app/screens/Profile.jsx — Kişisel performans dashboardı v2
// Aktif işler · tamamlanan · revize · saat · marka · iş tipi · verilen/alınan görevler

const TIME_RANGES = [
  { key: "7",   label: "7 gün",  days: 7   },
  { key: "30",  label: "30 gün", days: 30  },
  { key: "90",  label: "90 gün", days: 90  },
  { key: "all", label: "Tümü",   days: null },
];

function TimeRangeToggle({ value, onChange }) {
  return (
    <div style={{display:"inline-flex", padding:3, background:"var(--paper-2)", borderRadius:8, gap:1}}>
      {TIME_RANGES.map(r => (
        <button key={r.key} onClick={() => onChange(r.key)} style={{
          font:"500 11px/1 var(--font-sans)", padding:"5px 10px", border:0,
          background: value === r.key ? "var(--surface)" : "transparent",
          color: value === r.key ? "var(--ink)" : "var(--ink-3)",
          borderRadius:5, cursor:"pointer",
          boxShadow: value === r.key ? "0 1px 2px rgba(22,22,26,0.06)" : "none"
        }}>{r.label}</button>
      ))}
    </div>
  );
}

function ProfileScreen({ data, user, onOpenBrief, currentUser }) {
  const [selectedUser, setSelectedUser] = React.useState(user);
  const [timeRange, setTimeRange] = React.useState("30");
  const allBriefs    = data._allBriefs    || data.briefs    || [];
  const allCompleted = data._allCompleted || data.completed || [];
  const allUsers     = data.USERS || [];

  // Zaman filtresi — sadece tamamlananlara uygulanır, aktifler hep gösterilir
  const rangeDays = TIME_RANGES.find(r => r.key === timeRange)?.days;
  const cutoff = rangeDays ? (Date.now() - rangeDays * 86400000) : 0;

  const u = selectedUser;

  // ─── Aktif brief'ler (bu kişiyle ilişkili)
  const isRelated = (b, uid) =>
    (b.lead && b.lead.id === uid) ||
    (Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === uid)) ||
    (b.reviewer && b.reviewer.id === uid);

  const myActive     = allBriefs.filter(b => isRelated(b, u.id));
  const asLead       = allBriefs.filter(b => b.lead && b.lead.id === u.id);
  const asContrib    = allBriefs.filter(b => Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === u.id));
  const asReviewer   = allBriefs.filter(b => b.reviewer && b.reviewer.id === u.id);
  const overdue      = myActive.filter(b => b.deltaH <= 0);
  const urgent       = myActive.filter(b => b.deltaH > 0 && b.deltaH <= 24);

  // ─── Tamamlanan (zaman filtresiyle)
  const myCompleted  = allCompleted.filter(b => {
    const inRange = !cutoff || ((b.bitis || b.deadline || 0) * (b.bitis < 1e10 ? 1000 : 1)) >= cutoff;
    return inRange && (
      (b.lead && b.lead.id === u.id) ||
      (Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === u.id))
    );
  });
  const completedAsLead   = myCompleted.filter(b => b.lead && b.lead.id === u.id);
  const completedAsContrib= myCompleted.filter(b => Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === u.id));

  // ─── Revize istatistikleri
  // revision sayısı: tüm ilişkili briflerdeki rev değerleri
  const totalRevActive    = myActive.reduce((s, b) => s + (parseInt(b.revision)||0), 0);
  const totalRevCompleted = myCompleted.reduce((s, b) => s + (parseInt(b.revision)||0), 0);
  const totalRev          = totalRevActive + totalRevCompleted;
  const avgRev            = myCompleted.length > 0 ? (totalRevCompleted / myCompleted.length).toFixed(1) : "—";

  // ─── Saat hesabı (tamamlananlardan)
  const hoursArr = myCompleted.map(b => b.sureH || 0).filter(h => h > 0);
  const totalHours = hoursArr.reduce((s, h) => s + h, 0);
  const avgHours   = hoursArr.length > 0 ? (totalHours / hoursArr.length).toFixed(1) : "—";

  // ─── Marka dağılımı
  const brandCount = {};
  [...myActive, ...myCompleted].forEach(b => {
    brandCount[b.marka] = (brandCount[b.marka] || 0) + 1;
  });
  const topBrands = Object.entries(brandCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, v]) => ({
      name, v,
      color: (data.BRANDS || []).find(b => b.name === name)?.color || "#888"
    }));

  // ─── İş tipi / içerik analizi (baslik'ten keyword çıkar)
  const IS_TYPES = [
    { key: "sosyal medya", label: "Sosyal Medya", keys: ["sosyal", "sm ", "instagram", "story", "post", "reels"] },
    { key: "video",        label: "Video",        keys: ["video", "reel", "film", "klip"] },
    { key: "banner",       label: "Banner/Dijital",keys: ["banner", "dijital", "display", "web"] },
    { key: "brosur",       label: "Bröşür/Baskı", keys: ["bröşür", "broşür", "katalog", "baskı", "davetiye", "afiş"] },
    { key: "paket",        label: "Paket/Batch",  keys: ["batch", "paket", "x7", "x5", "x3", "x6"] },
    { key: "sunum",        label: "Sunum/Deck",   keys: ["sunum", "deck", "ppt", "slide", "rapor"] },
    { key: "logo",         label: "Logo/Kimlik",  keys: ["logo", "kimlik", "marka", "identity"] },
    { key: "diger",        label: "Diğer",        keys: [] }
  ];

  const allMyBriefs = [...myActive, ...myCompleted];
  const typeCount = {};
  IS_TYPES.forEach(t => { typeCount[t.key] = 0; });
  allMyBriefs.forEach(b => {
    const title = ((b.baslik || b.is || "") + " " + (b.marka || "")).toLowerCase();
    let matched = false;
    for (const t of IS_TYPES.slice(0,-1)) {
      if (t.keys.some(k => title.includes(k))) {
        typeCount[t.key]++;
        matched = true;
        break;
      }
    }
    if (!matched) typeCount["diger"]++;
  });
  const typeData = IS_TYPES
    .map(t => ({ label: t.label, v: typeCount[t.key] }))
    .filter(t => t.v > 0)
    .sort((a, b) => b.v - a.v);

  // ─── Verdiğim işler (bu kişi başka birine iş atamışsa — atanan_ids ikinci kişi)
  // "Verdiğim" = bu kişi lead, başka biri contributor
  const delegated = myActive.filter(b =>
    b.lead && b.lead.id === u.id &&
    Array.isArray(b.contributors) && b.contributors.length > 0
  );

  // ─── Aldığım işler (başkası lead, bu kişi contributor)
  const assigned = myActive.filter(b =>
    b.lead && b.lead.id !== u.id &&
    Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === u.id)
  );

  // ─── Durum dağılımı
  const durumMap = {};
  myActive.forEach(b => {
    const d = b.durum || "belirsiz";
    durumMap[d] = (durumMap[d] || 0) + 1;
  });

  // ─── Kapasite (departmandaki kapasite sınırı vs aktif)
  const CAP_LIMIT = u.rol === "tasarim" ? 6 : u.rol === "editor" ? 8 : u.rol === "ai" ? 6 : 10;
  const capPct    = Math.round((myActive.length / CAP_LIMIT) * 100);

  const roleLabel = { yonetici:"Yönetici", tasarim:"Tasarım", editor:"Editör", ai:"AI Operatör" }[u.rol] || u.rol;

  return (
    <div className="bn-tab-in">

      {/* ─── Kullanıcı seçici + hero ──────────────────────────── */}
      <div style={{display:"flex", alignItems:"flex-start", gap:20, padding:"20px 0 4px", flexWrap:"wrap"}}>
        <Avatar user={u} size={64}/>
        <div style={{flex:1, minWidth:200}}>
          <Eyebrow>{roleLabel}</Eyebrow>
          <h1 style={{font:"600 26px/1.1 var(--font-sans)", color:"var(--ink)", margin:"5px 0 0", letterSpacing:"-0.01em"}}>{u.name}</h1>
          <div style={{fontFamily:"var(--font-display)", fontStyle:"italic", fontSize:17, color:"var(--ink-3)", marginTop:6}}>
            {myActive.length} aktif · {myCompleted.length} tamamlandı · {totalRev} toplam revize
          </div>
          {/* ⭐ Kişi yıldız puanı + gün-sonu sebep açıklaması — sadece yöneticiler görür */}
          {(() => {
            if (currentUser?.role !== 'admin') return null;
            const R = window.BNS_DATA && window.BNS_DATA.ratings;
            const my = R && R.users && R.users[u.id];
            if (!my || !my.cnt) return null;
            const why = typeof window.bnsSebep === "function" ? window.bnsSebep("kisi", u.id) : null;
            return (
              <div style={{marginTop:8}}>
                <div style={{display:"flex", alignItems:"center", gap:8}}>
                  <span style={{display:"inline-flex", gap:1}}>
                    {[1,2,3,4,5].map(i => <I.StarFill key={i} size={13} color={i <= Math.round(my.avg) ? "var(--prio-yellow)" : "var(--line-strong)"}/>)}
                  </span>
                  <span style={{font:"600 14px/1 var(--font-mono)", color:"var(--ink)"}}>{my.avg}</span>
                  <span style={{font:"400 11px/1 var(--font-sans)", color:"var(--ink-4)"}}>({my.cnt} puanlı iş)</span>
                </div>
                {why && <div style={{marginTop:5, font:"400 12px/1.5 var(--font-sans)", color:"var(--ink-3)", maxWidth:520}}>{why.sebep}</div>}
              </div>
            );
          })()}
        </div>

        {/* Zaman filtresi */}
        <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8}}>
          <TimeRangeToggle value={timeRange} onChange={setTimeRange}/>
          <div style={{font:"400 10px/1 var(--font-sans)", color:"var(--ink-4)"}}>
            tamamlanan · {rangeDays ? `son ${rangeDays} gün` : "tüm zamanlar"}
          </div>
        </div>

        {/* Kullanıcı değiştir — sadece admin görür; departmana göre gruplu dropdown */}
        {currentUser?.role === 'admin' && (() => {
          const DEPT_LABEL = { tasarim: "Tasarım", editor: "Editör", ai: "AI", freelance: "Freelance" };
          const ORDER = ["tasarim", "editor", "ai", "freelance", "_other"];
          const grouped = {};
          for (const usr of allUsers) {
            const d = ["tasarim","editor","ai","freelance"].includes(usr.dept) ? usr.dept : "_other";
            (grouped[d] = grouped[d] || []).push(usr);
          }
          Object.values(grouped).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name, "tr")));
          return (
            <div style={{display:"flex", alignItems:"center", gap:8}}>
              <select value={u.id} onChange={e => {
                const nu = allUsers.find(x => x.id === e.target.value);
                if (nu) setSelectedUser(nu);
              }} style={{
                padding:"7px 10px", border:"1px solid var(--line)", borderRadius:8,
                background:"var(--surface)", color:"var(--ink)",
                font:"500 13px/1.2 var(--font-sans)", cursor:"pointer", outline:"none", minWidth:200,
              }}>
                {ORDER.map(d => {
                  const us = grouped[d];
                  if (!us || !us.length) return null;
                  return (
                    <optgroup key={d} label={DEPT_LABEL[d] || "Diğer"}>
                      {us.map(usr => <option key={usr.id} value={usr.id}>{usr.name}</option>)}
                    </optgroup>
                  );
                })}
              </select>
            </div>
          );
        })()}
      </div>

      <div style={{height:16}}/>

      {/* ─── KPI şeridi ──────────────────────────────────────── */}
      <div className="bns-kpi-8" style={{display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:"var(--grid-gap)", marginBottom:"var(--section-gap)"}}>
        <Kpi label="Aktif iş"      value={myActive.length} color={myActive.length > CAP_LIMIT ? "var(--prio-red)" : undefined}/>
        <Kpi label="Tamamlanan"    value={myCompleted.length} sub="kayıtlı"/>
        <Kpi label="Toplam revize" value={totalRev} sub={`ort. ${avgRev}/iş`}/>
        <Kpi label="Toplam saat"   value={totalHours > 0 ? totalHours.toFixed(0)+"sa" : "—"} sub={`ort. ${avgHours}sa/iş`}/>
        <Kpi label="Lead olarak"   value={asLead.length} sub="açtığım"/>
        <Kpi label="Contributor"   value={asContrib.length} sub="atandığım"/>
        <Kpi label="Kapasite"      value={capPct+"%"} color={capPct>=100?"var(--prio-red)":capPct>=75?"var(--prio-orange)":undefined}/>
        <Kpi label="Marka"         value={Object.keys(brandCount).length} sub="farklı"/>
      </div>

      {/* ─── Ana grid ────────────────────────────────────────── */}
      <div style={{display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:"var(--grid-gap)", marginBottom:"var(--grid-gap)"}} className="bn-grid-2">

        {/* Sol: aktif işler */}
        <Card padding={0} style={{minWidth:0}}>
          <div style={{padding:"13px 16px", borderBottom:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <div>
              <h2 style={{font:"600 14px/1.2 var(--font-sans)", color:"var(--ink)", margin:0}}>Üzerimdeki aktif işler</h2>
              <div style={{font:"400 11px/1.3 var(--font-sans)", color:"var(--ink-4)", marginTop:3}}>
                {overdue.length > 0 && <span style={{color:"var(--prio-red)", fontWeight:600}}>{overdue.length} gecikmiş · </span>}
                {urgent.length > 0 && <span style={{color:"var(--prio-orange)", fontWeight:600}}>{urgent.length} bugün · </span>}
                toplam {myActive.length}
              </div>
            </div>
            <div style={{display:"flex", gap:6}}>
              <span style={{font:"500 10px/1 var(--font-mono)", padding:"3px 7px", borderRadius:4, background:"var(--paper-2)", color:"var(--ink-4)"}}>lead: {asLead.length}</span>
              <span style={{font:"500 10px/1 var(--font-mono)", padding:"3px 7px", borderRadius:4, background:"var(--paper-2)", color:"var(--ink-4)"}}>contrib: {asContrib.length}</span>
              {asReviewer.length > 0 && <span style={{font:"500 10px/1 var(--font-mono)", padding:"3px 7px", borderRadius:4, background:"var(--paper-2)", color:"var(--ink-4)"}}>review: {asReviewer.length}</span>}
            </div>
          </div>
          {myActive.length > 0
            ? <BriefTable rows={myActive} onRowClick={onOpenBrief}/>
            : <div style={{padding:32, textAlign:"center", color:"var(--ink-4)", font:"400 13px/1.4 var(--font-sans)"}}>Aktif iş yok 🎉</div>
          }
        </Card>

        {/* Sağ kolon */}
        <div style={{display:"flex", flexDirection:"column", gap:"var(--grid-gap)"}}>

          {/* Kapasite göstergesi */}
          <Card>
            <CardHead title="Kapasite" sub={`${myActive.length} / ${CAP_LIMIT} iş limiti`}/>
            <div style={{margin:"8px 0 4px"}}>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:6}}>
                <span style={{font:"600 28px/1.15 var(--font-sans)", color: capPct>=100?"var(--prio-red)":capPct>=75?"var(--prio-orange)":"var(--ink)", letterSpacing:"-0.02em"}}>
                  %{capPct}
                </span>
                <span style={{font:"400 12px/1.4 var(--font-sans)", color:"var(--ink-4)", textAlign:"right"}}>
                  {capPct < 75 ? "Müsait" : capPct < 100 ? "Dolmak üzere" : "Kapasite aşıldı"}
                </span>
              </div>
              <div style={{height:8, background:"var(--line-soft)", borderRadius:999, overflow:"hidden"}}>
                <div style={{
                  width:"100%", height:"100%", borderRadius:999,
                  background: capPct>=100?"var(--prio-red)":capPct>=75?"var(--prio-orange)":"var(--prio-green)",
                  transform:`scaleX(${Math.min(capPct,100)/100})`, transformOrigin:"left",
                  transition:"transform 400ms cubic-bezier(0.2,0,0,1)"
                }}/>
              </div>
            </div>
            {/* Durum dağılımı */}
            <div style={{marginTop:12, display:"flex", flexDirection:"column", gap:4}}>
              {Object.entries(durumMap).slice(0,4).map(([d,n]) => (
                <div key={d} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 0", borderBottom:"1px solid var(--line-soft)"}}>
                  <span style={{font:"400 12px/1 var(--font-sans)", color:"var(--ink-3)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:160}}>{d}</span>
                  <span style={{font:"600 12px/1 var(--font-mono)", color:"var(--ink-2)"}}>{n}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Marka dağılımı */}
          <Card>
            <CardHead title="Marka dağılımı" sub="aktif + tamamlanan"/>
            {topBrands.length > 0
              ? topBrands.map((b,i) => <BrandBar key={b.name} {...b} last={i===topBrands.length-1}/>)
              : <div style={{font:"400 12px/1 var(--font-sans)", color:"var(--ink-4)"}}>Henüz veri yok</div>
            }
          </Card>
        </div>
      </div>

      {/* ─── Verdiğim / Aldığım işler ────────────────────────── */}
      <div style={{display:"flex", flexDirection:"column", gap:"var(--grid-gap)", marginBottom:"var(--grid-gap)"}}>
        <Card padding={0}>
          <div style={{padding:"13px 16px", borderBottom:"1px solid var(--line)"}}>
            <h2 style={{font:"600 14px/1.2 var(--font-sans)", color:"var(--ink)", margin:0}}>Verdiğim işler</h2>
            <div style={{font:"400 11px/1.3 var(--font-sans)", color:"var(--ink-4)", marginTop:3}}>
              Ben lead, başkası yapıyor · {delegated.length} iş
            </div>
          </div>
          {delegated.length > 0 ? (
            <div style={{padding:"4px 0"}}>
              {delegated.map((b,i) => (
                <DelegateRow key={b.id} brief={b} mode="delegated" onOpen={onOpenBrief} last={i===delegated.length-1}/>
              ))}
            </div>
          ) : (
            <div style={{padding:24, font:"400 12px/1.4 var(--font-sans)", color:"var(--ink-4)", textAlign:"center"}}>Başkasına atadığın aktif iş yok</div>
          )}
        </Card>

        <Card padding={0}>
          <div style={{padding:"13px 16px", borderBottom:"1px solid var(--line)"}}>
            <h2 style={{font:"600 14px/1.2 var(--font-sans)", color:"var(--ink)", margin:0}}>Aldığım işler</h2>
            <div style={{font:"400 11px/1.3 var(--font-sans)", color:"var(--ink-4)", marginTop:3}}>
              Başkası açtı, ben yapıyorum · {assigned.length} iş
            </div>
          </div>
          {assigned.length > 0 ? (
            <div style={{padding:"4px 0"}}>
              {assigned.map((b,i) => (
                <DelegateRow key={b.id} brief={b} mode="assigned" uid={u.id} onOpen={onOpenBrief} last={i===assigned.length-1}/>
              ))}
            </div>
          ) : (
            <div style={{padding:24, font:"400 12px/1.4 var(--font-sans)", color:"var(--ink-4)", textAlign:"center"}}>Başkasından aldığın aktif iş yok</div>
          )}
        </Card>
      </div>

      {/* ─── İş tipi analizi + Tamamlananlar ────────────────── */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1.8fr", gap:"var(--grid-gap)", marginBottom:"var(--grid-gap)"}} className="bn-grid-2">

        {/* İş tipi */}
        <Card>
          <CardHead title="İş tipi dağılımı" sub="tüm zamanlar · anahtar kelimeden"/>
          {typeData.length > 0 ? (
            <div style={{marginTop:8}}>
              {typeData.map((t,i) => {
                const maxV = typeData[0].v;
                return (
                  <div key={t.label} style={{marginBottom: i<typeData.length-1?10:0}}>
                    <div style={{display:"flex", justifyContent:"space-between", marginBottom:4}}>
                      <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink-2)"}}>{t.label}</span>
                      <span style={{font:"600 12px/1 var(--font-mono)", color:"var(--ink-3)"}}>{t.v}</span>
                    </div>
                    <div style={{height:5, background:"var(--line-soft)", borderRadius:999, overflow:"hidden"}}>
                      <div style={{
                        width:"100%", height:"100%",
                        background: "var(--ember)", opacity: 0.65 + (i===0?0.35:0),
                        borderRadius:999,
                        transform:`scaleX(${Math.round((t.v/maxV)*100)/100})`, transformOrigin:"left",
                        transition:"transform 400ms cubic-bezier(0.2,0,0,1)"
                      }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{font:"400 12px/1 var(--font-sans)", color:"var(--ink-4)", marginTop:8}}>Henüz veri yok</div>
          )}

          {/* Revize özeti */}
          {totalRev > 0 && (
            <div style={{marginTop:16, paddingTop:14, borderTop:"1px solid var(--line)"}}>
              <Eyebrow style={{marginBottom:8}}>Revize Özeti</Eyebrow>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
                <StatBox label="Toplam revize" value={totalRev}/>
                <StatBox label="Ort. revize/iş" value={avgRev}/>
                <StatBox label="Tamamlanan rev." value={totalRevCompleted}/>
                <StatBox label="Aktif iş rev." value={totalRevActive}/>
              </div>
            </div>
          )}
        </Card>

        {/* Tamamlanan işler */}
        <Card padding={0}>
          <div style={{padding:"13px 16px", borderBottom:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <div>
              <h2 style={{font:"600 14px/1.2 var(--font-sans)", color:"var(--ink)", margin:0}}>Tamamlanan işler</h2>
              <div style={{font:"400 11px/1.3 var(--font-sans)", color:"var(--ink-4)", marginTop:3}}>
                {myCompleted.length} iş · {totalHours > 0 ? totalHours.toFixed(0)+"sa toplam" : "süre kaydı yok"}
              </div>
            </div>
            <div style={{display:"flex", gap:6}}>
              <span style={{font:"500 10px/1 var(--font-mono)", padding:"3px 7px", borderRadius:4, background:"var(--paper-2)", color:"var(--ink-4)"}}>lead: {completedAsLead.length}</span>
              <span style={{font:"500 10px/1 var(--font-mono)", padding:"3px 7px", borderRadius:4, background:"var(--paper-2)", color:"var(--ink-4)"}}>contrib: {completedAsContrib.length}</span>
            </div>
          </div>
          {myCompleted.length > 0 ? (
            <div style={{overflowX:"auto", WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%", minWidth:480, borderCollapse:"collapse", font:"400 12px/1.3 var(--font-sans)"}}>
                <thead>
                  <tr style={{background:"var(--paper-2)"}}>
                    {["Marka","İş","Rol","Revize","Süre","Gecikme"].map(h => (
                      <th key={h} style={{padding:"7px 12px", textAlign:"left", font:"600 10px/1 var(--font-sans)", color:"var(--ink-4)", letterSpacing:"0.06em", textTransform:"uppercase", whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myCompleted.slice(0,12).map((b,i) => {
                    const isLead = b.lead && b.lead.id === u.id;
                    return (
                      <tr key={b.id} style={{borderTop:"1px solid var(--line-soft)", cursor: b.slack_url && b.slack_url !== "#" ? "pointer" : "default"}}
                        onMouseEnter={e=>e.currentTarget.style.background="var(--surface-sub)"}
                        onMouseLeave={e=>e.currentTarget.style.background=""}
                        onClick={() => b.slack_url && b.slack_url !== "#" && window.open(b.slack_url, "_blank")}>
                        <td style={{padding:"8px 12px", whiteSpace:"nowrap"}}>
                          <div style={{display:"flex", alignItems:"center", gap:6}}>
                            <span style={{width:7,height:7,borderRadius:999,background:(data.BRANDS||[]).find(br=>br.name===b.marka)?.color||"#888",flexShrink:0}}/>
                            <span style={{color:"var(--ink-2)", fontWeight:500}}>{b.marka}</span>
                          </div>
                        </td>
                        <td style={{padding:"8px 12px", color:"var(--ink)", maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{b.baslik || b.is || "—"}</td>
                        <td style={{padding:"8px 12px", whiteSpace:"nowrap"}}>
                          <span style={{font:"600 10px/1 var(--font-sans)", padding:"2px 6px", borderRadius:4, background: isLead?"var(--ember-tint)":"var(--paper-2)", color: isLead?"var(--ember)":"var(--ink-4)"}}>
                            {isLead ? "Lead" : "Contrib"}
                          </span>
                        </td>
                        <td style={{padding:"8px 12px", color:"var(--ink-3)", textAlign:"center", fontVariantNumeric:"tabular-nums"}}>{b.revision || b.rev || 0}</td>
                        <td style={{padding:"8px 12px", color:"var(--ink-3)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums"}}>{b.sureH ? b.sureH.toFixed(1)+"sa" : "—"}</td>
                        <td style={{padding:"8px 12px", whiteSpace:"nowrap", color: b.gecikme && b.gecikme !== "—" ? "var(--prio-orange)" : "var(--ink-4)"}}>{b.gecikme || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {myCompleted.length > 12 && (
                <div style={{padding:"10px 14px", font:"400 12px/1 var(--font-sans)", color:"var(--ink-4)", borderTop:"1px solid var(--line-soft)"}}>
                  +{myCompleted.length - 12} daha — tamamlananlar sekmesinde tümünü gör
                </div>
              )}
            </div>
          ) : (
            <div style={{padding:32, font:"400 12px/1.4 var(--font-sans)", color:"var(--ink-4)", textAlign:"center"}}>Kayıtlı tamamlanan iş yok</div>
          )}
        </Card>
      </div>

    </div>
  );
}

// ─── Verdiğim/Aldığım işler için satır bileşeni ──────────────────────────────
function DelegateRow({ brief: b, mode, uid, onOpen, last }) {
  const other = mode === "delegated"
    ? (b.contributors || []).filter(c => c)
    : (b.lead ? [b.lead] : []);
  return (
    <div onClick={() => onOpen && onOpen(b)}
      style={{
        display:"flex", alignItems:"center", gap:10, padding:"9px 14px",
        borderBottom: last ? "none" : "1px solid var(--line-soft)",
        cursor:"pointer", transition:"background 100ms"
      }}
      onMouseEnter={e=>e.currentTarget.style.background="var(--surface-sub)"}
      onMouseLeave={e=>e.currentTarget.style.background=""}>
      <PriorityBadge p={b.prio||b.priority||{code:"grn",label:"—"}} deltaH={b.deltaH||999} compact/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{font:"500 12px/1.35 var(--font-sans)", color:"var(--ink)", overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical"}}>
          {b.marka} · {b.baslik || b.is || "—"}
        </div>
        <div style={{font:"400 11px/1.2 var(--font-sans)", color:"var(--ink-4)", marginTop:2}}>
          {mode === "delegated" ? "→ " : "← "}
          {other.map(u => u.name.split(" ")[0]).join(", ") || "—"}
        </div>
      </div>
      {b.durum && (
        <span style={{font:"400 10px/1 var(--font-sans)", color:"var(--ink-4)", whiteSpace:"nowrap", maxWidth:100, overflow:"hidden", textOverflow:"ellipsis"}}>{b.durum.split(" ")[0]}</span>
      )}
    </div>
  );
}

// ─── Yardımcı bileşenler ─────────────────────────────────────────────────────
function BrandBar({ name, v, color, last }) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderBottom: last ? "none" : "1px solid var(--line-soft)"}}>
      <span style={{width:7, height:7, borderRadius:999, background: color, flexShrink:0}}/>
      <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{name}</span>
      <div style={{width:60, height:4, background:"var(--line-soft)", borderRadius:999, overflow:"hidden"}}>
        <div style={{width: Math.min(v*14,100)+"%", height:"100%", background: color, opacity:0.8}}/>
      </div>
      <span style={{font:"600 11px/1 var(--font-mono)", color:"var(--ink-4)", minWidth:16, textAlign:"right"}}>{v}</span>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={{padding:"8px 10px", background:"var(--paper-2)", borderRadius:7, textAlign:"center"}}>
      <div style={{font:"600 18px/1.15 var(--font-sans)", color:"var(--ink)", fontVariantNumeric:"tabular-nums"}}>{value}</div>
      <div style={{font:"400 10px/1.3 var(--font-sans)", color:"var(--ink-4)", marginTop:4}}>{label}</div>
    </div>
  );
}

window.ProfileScreen = ProfileScreen;
