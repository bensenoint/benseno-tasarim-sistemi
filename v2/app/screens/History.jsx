// app/screens/History.jsx — sistem aktivite log'u (takvim filtresine bağlı · 100/sayfa · tür filtresi).

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
async function bnsFetchEvents({ before, from, to }) {
  const base = bnsHistApiBase();
  if (!base) return null;   // statik/snapshot → fallback (data.activity)
  try {
    const tok = (typeof localStorage !== "undefined" && localStorage.getItem("bns_token")) || "";
    const qs = new URLSearchParams({ limit: "100" });
    if (before != null) qs.set("before", String(before));
    if (typeof from === "number") qs.set("from", String(from));
    if (typeof to === "number") qs.set("to", String(to));
    const r = await fetch(base + "/api/events?" + qs.toString(), { cache: "no-store", headers: tok ? { Authorization: "Bearer " + tok } : {} });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

// Aktivite türleri — TÜM yapılanları kapsar (kind alanı bnsMapEvent'ten gelir).
var BNS_HIST_KINDS = [
  ["all", "Tümü"], ["open", "Açılan"], ["status", "Durum"], ["done", "Tamamlanan"],
  ["assign", "Atama"], ["edit", "Düzenleme"], ["finance", "Finans"], ["delete", "Silme"],
];

function HistoryScreen({ data, onOpenByNo }) {
  const [filter, setFilter] = React.useState("all");
  const [items, setItems] = React.useState(null);   // null → API'den henüz yüklenmedi
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [apiOk, setApiOk] = React.useState(true);

  // Üst global takvim filtresi → Geçmiş'i de süzer.
  const dr = data.dateRange || {};
  const from = typeof dr.from === "number" ? dr.from : null;
  const to = typeof dr.to === "number" ? dr.to : null;
  const rangeLabel = ({ today:"Bugün", yesterday:"Dün", "7d":"Son 7 gün", "30d":"Son 30 gün", "90d":"Son 90 gün", year:"Bu yıl", all:"Tüm zamanlar", custom:"Seçili aralık" })[dr.preset] || "Seçili aralık";

  // İlk sayfa — tarih aralığı değişince yeniden yükle.
  React.useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const res = await bnsFetchEvents({ from, to });
      if (cancel) return;
      if (res && Array.isArray(res.events)) { setItems(res.events.map(window.bnsMapEvent)); setHasMore(!!res.hasMore); setApiOk(true); }
      else { setApiOk(false); setItems(null); }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [from, to]);

  const loadMore = async () => {
    setLoading(true);
    const before = items && items.length ? items[items.length - 1].t : undefined;
    const res = await bnsFetchEvents({ from, to, before });
    if (res && Array.isArray(res.events)) {
      setItems(prev => [...(prev || []), ...res.events.map(window.bnsMapEvent)]);
      setHasMore(!!res.hasMore);
    }
    setLoading(false);
  };

  // Kaynak: API çalışıyorsa sayfalı items; değilse eski data.activity (fallback). Her iki halde de a.kind/a.action mevcut.
  const source = (apiOk && items) ? items : (data.activity || []);
  let all = source.slice().sort((a, b) => b.t - a.t);
  if (filter !== "all") all = all.filter(a => a.kind === filter);

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
        subtitle={`sistem aktivite log'u · ${rangeLabel} · açıldı / durum / atama / düzenleme / tamamlandı`}
        actions={
          <div style={{display:"inline-flex", flexWrap:"wrap", gap:2, padding:2, background:"transparent", border:"1px solid var(--line)", borderRadius:6}}>
            {BNS_HIST_KINDS.map(([k, v]) => (
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
        {groups.length === 0 && (
          <div style={{padding:"28px 16px", textAlign:"center", font:"400 13px/1.4 var(--font-sans)", color:"var(--ink-4)"}}>
            {loading ? "Yükleniyor…" : "Bu aralıkta kayıt yok."}
          </div>
        )}
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
                  <VerbDot kind={a.kind}/>
                  <Avatar user={u} size={20}/>
                  <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink)", whiteSpace:"nowrap"}}>{u.name.split(" ")[0]}</span>
                  <span style={{font:"400 13px/1.3 var(--font-sans)", color:"var(--ink-3)", whiteSpace:"nowrap"}}>{a.action || a.verb}</span>
                  {a.brand && <BrandChip brand={a.brand} size="sm"/>}
                  <span style={{font:"500 13px/1.3 var(--font-sans)", color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex: 1, minWidth: 0}}>
                    {a.target}
                  </span>
                  {a.tag && (
                    <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)", padding:"3px 7px", background:"var(--paper-2)", borderRadius:4, whiteSpace:"nowrap", flexShrink:0}}>
                      {a.tag}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </Card>

      {/* Sayfalama — 100/sayfa, seçili tarih aralığında. (API yoksa gizli) */}
      {apiOk && (() => {
        const btn = { font:"600 12px/1 var(--font-sans)", padding:"9px 16px", border:"1px solid var(--line)",
          borderRadius:8, background:"var(--surface)", color:"var(--ink)", cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 };
        return (
          <div style={{display:"flex", justifyContent:"center", alignItems:"center", gap:12, padding:"18px 0 6px", flexWrap:"wrap"}}>
            <span style={{font:"400 12px/1 var(--font-sans)", color:"var(--ink-4)"}}>{all.length} kayıt · {rangeLabel}</span>
            {hasMore && <button onClick={loadMore} disabled={loading} style={btn}>{loading ? "Yükleniyor…" : "Daha fazla yükle (+100)"}</button>}
            {!hasMore && all.length > 0 && <span style={{font:"400 12px/1 var(--font-sans)", color:"var(--ink-5)"}}>bu aralıktaki tüm kayıtlar yüklendi</span>}
          </div>
        );
      })()}
    </div>
  );
}

function VerbDot({ kind }) {
  const map = {
    open:    "var(--ink-3)",
    status:  "var(--info)",
    done:    "var(--success)",
    assign:  "var(--ember)",
    edit:    "var(--warning)",
    finance: "var(--musteride)",
    delete:  "var(--danger)",
    other:   "var(--ink-4)",
  };
  return (
    <span style={{
      width: 8, height: 8, borderRadius: 999,
      background: map[kind] || "var(--ink-3)",
      flexShrink: 0
    }}/>
  );
}

window.HistoryScreen = HistoryScreen;
