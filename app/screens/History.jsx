// app/screens/History.jsx — sistem aktivite log'u (sayfalı: 100/sayfa, varsayılan son 1 ay, eskisi arşivden).

// API base'i App.jsx'teki resolveDataUrl ile aynı önceliklerle çözer. null → statik/snapshot (API yok).
function bnsHistApiBase() {
  const DEFAULT_API = "https://benseno-api-production.up.railway.app";
  try {
    if (window.BNS_SNAPSHOT) return null;
    const p = new URLSearchParams(window.location.search).get("api");
    if (p === "0" || p === "false") return null;
    if (p && /^https?:\/\//.test(p)) return p.replace(/\/+$/, "");
    const ls = window.localStorage.getItem("bns_api");
    if (ls === "0") return null;
    if (ls && ls !== "1") return ls.replace(/\/+$/, "");
    return window.BNS_API_BASE ? String(window.BNS_API_BASE).replace(/\/+$/, "") : DEFAULT_API;
  } catch (e) { return DEFAULT_API; }
}
async function bnsFetchEvents({ before, archive }) {
  const base = bnsHistApiBase();
  if (!base) return null;   // statik/snapshot → fallback (data.activity)
  try {
    const tok = (typeof localStorage !== "undefined" && localStorage.getItem("bns_token")) || "";
    const qs = new URLSearchParams({ limit: "100" });
    if (before != null) qs.set("before", String(before));
    if (archive) qs.set("archive", "1");
    const r = await fetch(base + "/api/events?" + qs.toString(), { cache: "no-store", headers: tok ? { Authorization: "Bearer " + tok } : {} });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

function HistoryScreen({ data, onOpenByNo }) {
  const [filter, setFilter] = React.useState("all");
  const [items, setItems] = React.useState(null);        // null → API'den henüz yüklenmedi
  const [hasMore, setHasMore] = React.useState(false);
  const [archiveOn, setArchiveOn] = React.useState(false); // 1 ay sınırı aşıldı (arşiv yüklendi)
  const [loading, setLoading] = React.useState(false);
  const [apiOk, setApiOk] = React.useState(true);

  // İlk yükleme: sayfalı /api/events (son 30 gün). API yoksa data.activity'ye düş.
  React.useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const res = await bnsFetchEvents({});
      if (cancel) return;
      if (res && Array.isArray(res.events)) { setItems(res.events.map(window.bnsMapEvent)); setHasMore(!!res.hasMore); setApiOk(true); }
      else setApiOk(false);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  const loadMore = async (archive) => {
    setLoading(true);
    const before = items && items.length ? items[items.length - 1].t : undefined;
    const res = await bnsFetchEvents({ before, archive });
    if (res && Array.isArray(res.events)) {
      setItems(prev => [...(prev || []), ...res.events.map(window.bnsMapEvent)]);
      setHasMore(!!res.hasMore);
      if (archive) setArchiveOn(true);
    }
    setLoading(false);
  };

  // Kaynak: API çalışıyorsa sayfalı items; değilse eski data.activity (fallback, ~son 80).
  const source = (apiOk && items) ? items : (data.activity || []);
  let all = source.map(a => ({ ...a, _type: typeFromVerb(a.verb) })).sort((a, b) => b.t - a.t);
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
          <div style={{display:"inline-flex", padding:2, background:"transparent", border:"1px solid var(--line)", borderRadius:6}}>
            {[
              ["all", "Tümü"],
              ["open", "Açıldı"],
              ["status", "Durum"],
              ["assign", "Atama"],
              ["done", "Tamamlandı"]
            ].map(([k, v]) => (
              <button key={k} onClick={() => setFilter(k)} style={{
                font: filter === k ? "600 12px/1 var(--font-sans)" : "500 12px/1 var(--font-sans)", padding:"6px 10px",
                border:0, background: filter === k ? "var(--paper-2)" : "transparent",
                color: filter === k ? "var(--ink)" : "var(--ink-4)",
                borderRadius:4, cursor:"pointer"
              }}>{v}</button>
            ))}
          </div>
        }/>

      <Card padding={0}>
        {groups.map((g, gi) => (
          <div key={g.key}>
            <div style={{
              padding:"10px 16px", background:"var(--paper)",
              borderBottom:"1px solid var(--line)", borderTop: gi === 0 ? 0 : "1px solid var(--line)",
              font:"600 11px/1 var(--font-sans)", color:"var(--ink-3)",
              letterSpacing:"0.06em", textTransform:"uppercase",
              position: "sticky", top: 0, zIndex: 4
            }}>{g.key}</div>
            {g.items.map((a, i) => {
              const u = data.USERS.find(x => x.id === a.who) || { id: a.who, name: "Bilinmiyor", initials: "?", color: "#999" };
              const d = new Date(a.t);
              const time = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
              const clickable = !!(a.no && onOpenByNo);
              return (
                <div key={i}
                  onClick={clickable ? () => onOpenByNo(a.no) : undefined}
                  title={clickable ? `#${a.no} detayını aç` : undefined}
                  onMouseEnter={clickable ? (e => e.currentTarget.style.background = "var(--paper-2)") : undefined}
                  onMouseLeave={clickable ? (e => e.currentTarget.style.background = "transparent") : undefined}
                  style={{
                  display:"flex", flexWrap:"wrap", alignItems:"center", gap: 12, rowGap: 6, padding:"10px 16px",
                  cursor: clickable ? "pointer" : "default",
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

      {/* Sayfalama — 100/sayfa, varsayılan son 1 ay; eskisi arşivden. (API yoksa gizli) */}
      {apiOk && (() => {
        const btn = { font:"600 12px/1 var(--font-sans)", padding:"9px 16px", border:"1px solid var(--line)",
          borderRadius:8, background:"var(--surface)", color:"var(--ink)", cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 };
        return (
          <div style={{display:"flex", justifyContent:"center", alignItems:"center", gap:12, padding:"18px 0 6px", flexWrap:"wrap"}}>
            <span style={{font:"400 12px/1 var(--font-sans)", color:"var(--ink-4)"}}>{all.length} kayıt · {archiveOn ? "arşiv dahil" : "son 1 ay"}</span>
            {hasMore && <button onClick={() => loadMore(archiveOn)} disabled={loading} style={btn}>{loading ? "Yükleniyor…" : "Daha fazla yükle (+100)"}</button>}
            {!hasMore && !archiveOn && <button onClick={() => loadMore(true)} disabled={loading} style={btn}>{loading ? "Yükleniyor…" : "Arşivden daha eski göster"}</button>}
            {!hasMore && archiveOn && <span style={{font:"400 12px/1 var(--font-sans)", color:"var(--ink-5)"}}>tüm geçmiş yüklendi</span>}
          </div>
        );
      })()}
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
