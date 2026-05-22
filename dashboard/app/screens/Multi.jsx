// app/screens/Multi.jsx — Paralel ve sıralı multi-atama görünümü.

// durum string'inden atama tipini çıkar
function getAssignType(durum) {
  if (!durum) return "sirali";
  const d = durum.toLowerCase();
  if (/paralel|parallel/i.test(d)) return "paralel";
  if (/sıralı|sirali|sequential/i.test(d)) return "sirali";
  return "sirali"; // tip belirtilmemişse sıralı varsayılan
}

// gecmis string'inden kim 🎨 verdi (işi teslim etti) çıkar
function getCompletedIds(gecmis, users) {
  if (!gecmis) return [];
  // 🎨 işareti — genellikle "🎨UserAdı HH:MM" veya "→🎨" şeklinde
  const completedNames = [];
  const parts = gecmis.split(/[/→·]/);
  for (const p of parts) {
    if (p.includes("🎨") && !p.includes("reaction") && !p.includes("yok") && !p.includes("vermedi") && !p.includes("✅")) {
      // "🎨Arda 14:00" gibi
      const nameMatch = p.replace("🎨","").trim().match(/^([A-ZÇĞİÖŞÜa-zçğışöüI][a-zçğışöüI]+)/);
      if (nameMatch) completedNames.push(nameMatch[1].toLowerCase());
    }
  }
  return users.filter(u => completedNames.some(n => u.name.toLowerCase().startsWith(n))).map(u => u.id);
}

// Sıralı atamada sıra numarasını çıkar: "Sıralı 1️⃣ Eren" → 1
function getOrderNum(durum) {
  const m = durum.match(/Sıralı\s*([1-9️⃣])/i);
  if (!m) return null;
  const n = m[1].codePointAt(0);
  if (n >= 49 && n <= 57) return n - 48; // 1-9 ASCII
  // emoji number: 1️⃣=49+variation = check unicode
  const emojis = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"];
  const idx = emojis.findIndex(e => durum.includes(e));
  return idx >= 0 ? idx + 1 : null;
}

function MultiScreen({ data, onOpenBrief }) {
  const [tab, setTab] = React.useState("all");
  const users = data.USERS || [];

  // Multi-atanmış: 2+ atanan VEYA reviewer olan briefler
  const allMulti = data.briefs.filter(b =>
    (b.contributors && b.contributors.length > 0) || b.reviewer
  );

  const paralel = allMulti.filter(b => getAssignType(b.durum_raw || b.durum) === "paralel");
  const sirali  = allMulti.filter(b => getAssignType(b.durum_raw || b.durum) === "sirali");

  const shown = tab === "paralel" ? paralel : tab === "sirali" ? sirali : allMulti;

  return (
    <div className="bn-tab-in">
      <PageHead
        title="Multi-atama"
        subtitle="Paralel · Sıralı — kimin tamamladığı, kimin devam ettiği"
      />

      {/* KPI */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"var(--grid-gap)", marginBottom:"var(--section-gap)"}}>
        <Kpi label="Toplam multi" value={allMulti.length} sub={`${data.briefs.length} aktif brief`}/>
        <Kpi label="Paralel" value={paralel.length} sub="aynı anda birden fazla kişi"/>
        <Kpi label="Sıralı" value={sirali.length} sub="biri bitince diğeri başlar"/>
      </div>

      {/* Tab */}
      <div style={{display:"inline-flex", padding:3, background:"var(--paper-2)", borderRadius:8, marginBottom:14}}>
        {[["all","Tümü"], ["paralel","Paralel"], ["sirali","Sıralı"]].map(([k,v]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            font:"500 12px/1 var(--font-sans)", padding:"6px 12px", border:0,
            background: tab===k ? "var(--surface)" : "transparent",
            color: tab===k ? "var(--ink)" : "var(--ink-3)",
            borderRadius:6, cursor:"pointer",
            boxShadow: tab===k ? "0 1px 2px rgba(22,22,26,0.06)" : "none"
          }}>{v} {tab===k ? "" : `· ${k==="all"?allMulti.length:k==="paralel"?paralel.length:sirali.length}`}</button>
        ))}
      </div>

      {/* List */}
      <div style={{display:"flex", flexDirection:"column", gap: 10}}>
        {shown.length === 0 && (
          <div style={{padding:32, textAlign:"center", color:"var(--ink-4)", font:"400 13px/1.4 var(--font-sans)"}}>
            Bu kategoride brief yok.
          </div>
        )}
        {shown.map(b => (
          <MultiCard key={b.id} brief={b} users={users} onClick={() => onOpenBrief(b)}/>
        ))}
      </div>
    </div>
  );
}

function MultiCard({ brief: b, users, onClick }) {
  const type = getAssignType(b.durum_raw || b.durum);
  const completedIds = getCompletedIds(b.gecmis || "", users);
  const allMembers = [b.lead, ...(b.contributors || [])].filter(Boolean);
  const orderNum = type === "sirali" ? getOrderNum(b.durum_raw || b.durum) : null;

  const typeLabel = type === "paralel" ? "Paralel" : type === "sirali" ? "Sıralı" : "Multi";
  const typeColor = type === "paralel" ? "var(--info)" : type === "sirali" ? "var(--warning)" : "var(--ink-3)";

  return (
    <div onClick={onClick} style={{
      background:"var(--surface)", border:"1px solid var(--line)", borderRadius:10,
      padding:"14px 16px", cursor:"pointer",
      display:"grid", gridTemplateColumns:"1fr auto",
      gap:12, alignItems:"start"
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor="var(--ember-muted)"}
    onMouseLeave={e => e.currentTarget.style.borderColor="var(--line)"}
    >
      {/* Sol: başlık + tipler */}
      <div>
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
          <span style={{
            font:"600 10px/1 var(--font-sans)", letterSpacing:"0.07em", textTransform:"uppercase",
            color: typeColor, padding:"3px 7px", borderRadius:4,
            background: type === "paralel" ? "rgba(59,130,246,0.08)" : type === "sirali" ? "rgba(245,158,11,0.1)" : "var(--paper-2)"
          }}>{typeLabel}</span>
          <BrandChip brand={b.brand} size="sm"/>
          <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)"}}>#{b.no}</span>
          {orderNum && (
            <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--warning)"}}>Sıra {orderNum}</span>
          )}
        </div>

        <div style={{font:"500 14px/1.3 var(--font-sans)", color:"var(--ink)", marginBottom:10}}>
          {b.baslik}
        </div>

        {/* Kişiler — kim tamamladı, kim devam ediyor */}
        <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
          {allMembers.map((u, i) => {
            const done = completedIds.includes(u.id);
            const isLead = i === 0;
            return (
              <div key={u.id} style={{
                display:"inline-flex", alignItems:"center", gap:5,
                padding:"4px 8px 4px 5px", borderRadius:20,
                background: done ? "rgba(34,197,94,0.08)" : "var(--surface-sub)",
                border: `1px solid ${done ? "rgba(34,197,94,0.25)" : "var(--line)"}`,
              }}>
                <Avatar user={u} size={18}/>
                <span style={{font:"500 12px/1 var(--font-sans)", color: done ? "var(--prio-green)" : "var(--ink)"}}>
                  {u.name.split(" ")[0]}
                </span>
                {isLead && <span style={{font:"500 10px/1 var(--font-sans)", color:"var(--ink-4)"}}>lead</span>}
                {done
                  ? <span style={{fontSize:12}}>✅</span>
                  : <span style={{width:6, height:6, borderRadius:999, background:"var(--prio-orange)", flexShrink:0}}/>
                }
              </div>
            );
          })}
        </div>
      </div>

      {/* Sağ: öncelik + durum + deadline */}
      <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6}}>
        <PriorityBadge p={b.priority} deltaH={b.deltaH} compact/>
        <StatusPill status={b.durum}/>
        <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)"}}>
          {b.deadline ? new Date(b.deadline).toLocaleDateString("tr-TR",{day:"numeric",month:"short"}) : "—"}
        </span>
      </div>
    </div>
  );
}

window.MultiScreen = MultiScreen;
window.MultiCard = MultiCard;
