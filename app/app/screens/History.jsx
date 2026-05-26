// app/screens/History.jsx — sistem aktivite log'u.

function HistoryScreen({ data }) {
  const [filter, setFilter] = React.useState("all");
  // viewMode'dan bağımsız: her zaman TÜM brief ve tamamlananları kullan
  const allBriefs    = data._allBriefs    || data.briefs    || [];
  const allCompleted = data._allCompleted || data.completed || [];

  const extras = [];
  allBriefs.slice(0, 30).forEach((b) => {
    if (!b.acilma) return;
    const acan = b.lead;
    if (!acan) return;
    extras.push({
      t: b.acilma,
      who: acan.id, verb: "açtı", target: b.baslik,
      brand: b.brand, _type: "open"
    });
  });
  allCompleted.slice(0, 20).forEach((c) => {
    if (!c.bitis) return;
    const tamamlayan = (c.contributors && c.contributors[0]) || c.lead;
    if (!tamamlayan) return;
    extras.push({
      t: c.bitis,
      who: tamamlayan.id, verb: "tamamladı", target: c.baslik,
      brand: c.brand, meta: c.sureH != null && c.sureH > 0 ? c.sureH.toFixed(1) + " sa" : "",
      _type: "done"
    });
  });
  let all = [
    ...data.activity.map(a => ({ ...a, _type: typeFromVerb(a.verb) })),
    ...extras
  ].sort((a, b) => b.t - a.t).slice(0, 80);

  if (filter !== "all") all = all.filter(a => a._type === filter);

  // Group by day
  const groups = [];
  let lastDay = "";
  all.forEach(a => {
    const d = new Date(a.t);
    const holidayLabel = typeof isTRHoliday === "function" && isTRHoliday(d) ? ` 🎌 ${isTRHolidayName(d)}` : "";
    const key = `${d.getDate()} ${["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"][d.getMonth()]} · ${["Pazar","Pzt","Salı","Çar","Per","Cuma","Cmt"][d.getDay()]}${holidayLabel}`;
    if (key !== lastDay) { groups.push({ key, items: [] }); lastDay = key; }
    groups[groups.length - 1].items.push(a);
  });

  return (
    <div className="bn-tab-in">
      <PageHead
        title="Geçmiş"
        subtitle="sistem aktivite log'u · brief açıldı / atandı / durumu değişti / tamamlandı"
        actions={
          <div style={{display:"inline-flex", padding:3, background:"var(--paper-2)", borderRadius:8}}>
            {[
              ["all", "Tümü"],
              ["open", "Açıldı"],
              ["status", "Durum"],
              ["assign", "Atama"],
              ["done", "Tamamlandı"]
            ].map(([k, v]) => (
              <button key={k} onClick={() => setFilter(k)} style={{
                font:"500 12px/1 var(--font-sans)", padding:"6px 10px",
                border:0, background: filter === k ? "var(--surface)" : "transparent",
                color: filter === k ? "var(--ink)" : "var(--ink-3)",
                borderRadius:6, cursor:"pointer",
                boxShadow: filter === k ? "0 1px 2px rgba(22,22,26,0.06)" : "none"
              }}>{v}</button>
            ))}
          </div>
        }/>

      <Card padding={0}>
        {groups.map((g, gi) => (
          <div key={g.key}>
            <div style={{
              padding:"10px 16px", background:"var(--surface-sub)",
              borderBottom:"1px solid var(--line)", borderTop: gi === 0 ? 0 : "1px solid var(--line)",
              font:"600 11px/1 var(--font-sans)", color:"var(--ink-3)",
              letterSpacing:"0.06em", textTransform:"uppercase",
              position: "sticky", top: 0, zIndex: 4
            }}>{g.key}</div>
            {g.items.map((a, i) => {
              const u = data.USERS.find(x => x.id === a.who) || { id: a.who, name: "Bilinmiyor", initials: "?", color: "#999" };
              const d = new Date(a.t);
              const time = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
              return (
                <div key={i} style={{
                  display:"flex", alignItems:"center", gap: 12, padding:"10px 16px",
                  borderBottom: i === g.items.length - 1 ? 0 : "1px solid var(--line-soft)"
                }}>
                  <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)", minWidth: 44}}>{time}</span>
                  <VerbDot type={a._type}/>
                  <Avatar user={u} size={20}/>
                  <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink)", whiteSpace:"nowrap"}}>{u.name.split(" ")[0]}</span>
                  <span style={{font:"400 13px/1 var(--font-sans)", color:"var(--ink-3)", whiteSpace:"nowrap"}}>{a.verb}</span>
                  {a.brand && <BrandChip brand={a.brand} size="sm"/>}
                  <span style={{font:"500 13px/1.3 var(--font-sans)", color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex: 1, minWidth: 0}}>
                    {a.target}
                  </span>
                  {a.meta && (
                    <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)", padding:"3px 7px", background:"var(--paper-2)", borderRadius: 4, whiteSpace:"nowrap"}}>
                      {a.meta}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </Card>
    </div>
  );
}

function VerbDot({ type }) {
  const map = {
    open:   "var(--ink-3)",
    status: "var(--info)",
    assign: "var(--ember)",
    done:   "var(--success)",
    comment:"var(--ink-4)",
    reject: "var(--danger)",
    update: "var(--warning)"
  };
  return (
    <span style={{
      width: 8, height: 8, borderRadius: 999,
      background: map[type] || "var(--ink-3)",
      flexShrink: 0
    }}/>
  );
}

function typeFromVerb(v) {
  if (v.includes("açtı"))          return "open";
  if (v.includes("değişt"))         return "status";
  if (v.includes("atadı") || v.includes("contributor")) return "assign";
  if (v.includes("tamamladı"))      return "done";
  if (v.includes("onayladı"))       return "done";
  if (v.includes("yorum"))          return "comment";
  if (v.includes("reddetti"))       return "reject";
  if (v.includes("deadline"))       return "update";
  if (v.includes("rev"))            return "update";
  return "open";
}

window.HistoryScreen = HistoryScreen;
