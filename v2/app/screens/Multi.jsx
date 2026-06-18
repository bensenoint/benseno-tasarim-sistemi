// app/screens/Multi.jsx — Paralel ve sıralı multi-atama görünümü.

// durum string'inden atama tipini çıkar
function getAssignType(durum) {
  if (!durum) return "sirali";
  // "Paralel" sadece açık atama formatında: "Paralel X+Y", "Paralel X tek atanan", "Paralel X+Y+Z"
  if (/Paralel\s+\w[^·)]*(\+\w|\s+tek)/i.test(durum)) return "paralel";
  if (/sıralı|sirali|sequential/i.test(durum)) return "sirali";
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
  const users = data.USERS || [];

  // Yalnız SIRALI (onay zinciri) işler gösterilir — paralel işler zaten diğer
  // tablolarda izleniyor; bu ekran el-değiştirme akışını takip etmek için.
  const sirali = (data._allBriefs || data.briefs).filter(b => b.akis === "sirali");
  const [filtre, setFiltre] = React.useState("all");   // KPI kartları tıklanabilir filtre
  const gecikmis  = sirali.filter(b => b.deltaH <= 0);
  const musteride = sirali.filter(b => b.durum === "musteride");
  const shown = filtre === "gecikmis" ? gecikmis : filtre === "musteride" ? musteride : sirali;
  const tgl = (k) => setFiltre(f => f === k ? "all" : k);   // aynı karta tekrar tıkla → filtreyi kaldır

  return (
    <div className="bn-tab-in">
      <PageHead
        title="Sıralı İşler"
        subtitle="⛓️ onay zinciri — kimin tamamladığı, sıranın kimde olduğu"
      />

      {/* KPI */}
      <div className="bn-grid-3" style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"var(--grid-gap)", marginBottom:"var(--section-gap)"}}>
        <Kpi label="Sıralı iş" value={sirali.length} sub="aktif onay zinciri" onClick={() => setFiltre("all")} active={filtre === "all"}/>
        <Kpi label="Gecikmiş" value={gecikmis.length} color={gecikmis.length ? "var(--prio-red)" : undefined} sub="termin geçti" onClick={() => tgl("gecikmis")} active={filtre === "gecikmis"}/>
        <Kpi label="Müşteride" value={musteride.length} color="var(--musteride)" sub="✈️ dönüş bekleniyor" onClick={() => tgl("musteride")} active={filtre === "musteride"}/>
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
      background:"var(--surface)", border:"1px solid var(--line)", borderRadius:0,
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
          <span style={{display:"inline-flex", alignItems:"center", gap:5}}>
            <I.Dot size={6} color={typeColor}/>
            <span style={{font:"600 10px/1 var(--font-sans)", letterSpacing:"0.07em", textTransform:"uppercase", color: typeColor}}>{typeLabel}</span>
          </span>
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
                padding:"4px 8px 4px 5px", borderRadius:0,
                background: "transparent",
                border: `1px solid ${done ? "var(--prio-green)" : "var(--line)"}`,
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
        <PriorityBadge p={b.oncelik || { code: "ylw", label: "NORMAL" }}/>
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
