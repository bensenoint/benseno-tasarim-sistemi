// app/screens/Brand.jsx — 39 markanın stats listesi + tek marka drill-down detay sayfası.

const TR_AY = { ocak:0, "şubat":1, subat:1, mart:2, nisan:3, "mayıs":4, mayis:4, may:4, haziran:5, haz:5, temmuz:6, tem:6, "ağustos":7, agustos:7, "eylül":8, eylul:8, ekim:9, eki:9, "kasım":10, kasim:10, "aralık":11, aralik:11 };
function parseTRDeadline(s) {
  const m = String(s || "").trim().match(/^(\d{1,2})\s+(\S+)\s+(\d{4})/);
  if (!m) return null;
  const mon = TR_AY[m[2].toLowerCase()];
  if (mon == null) return null;
  return new Date(+m[3], mon, +m[1]);
}
function fmtDate(d) {
  if (!d) return "—";
  try { return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }); } catch { return "—"; }
}
function csvCell(s) { s = String(s == null ? "" : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

function BrandScreen({ data, onOpenBrief }) {
  const [sel, setSel] = React.useState(null);
  const [sort, setSort] = React.useState("active");
  const [search, setSearch] = React.useState("");

  // Tek marka seçiliyse detay sayfasını göster
  if (sel) {
    const stats = (data.brandStats || []).find(b => b.name === sel) || { name: sel };
    return <BrandDetail brand={sel} stats={stats} data={data} onBack={() => setSel(null)} onOpenBrief={onOpenBrief} />;
  }

  let rows = data.brandStats;
  if (search.trim()) { const q = search.toLowerCase(); rows = rows.filter(b => b.name.toLowerCase().includes(q)); }
  rows = [...rows].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "tr");
    if (sort === "medianH") return a.medianH - b.medianH;
    return b[sort] - a[sort];
  });

  const allBriefs = data._allBriefs || data.briefs;
  const totalActive = allBriefs.length;
  const busiest = [...data.brandStats].sort((a, b) => b.active - a.active)[0];
  const avg = (totalActive / Math.max(1, data.brandStats.length)).toFixed(1);

  return (
    <div className="bn-tab-in">
      <PageHead
        title="Marka"
        subtitle={`${data.brandStats.length} marka · marka başına ortalama ${avg} aktif brief · markaya tıkla → detay`}
        actions={<>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"5px 10px", border:"1px solid var(--line)", borderRadius:6, background:"var(--surface)", color:"var(--ink-3)" }}>
            <I.Search size={13}/>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Marka ara…"
              style={{ border:0, outline:"none", background:"transparent", color:"var(--ink)", font:"400 12px/1.2 var(--font-sans)", minWidth:140 }}/>
          </div>
        </>}
      />

      <div className="bns-kpi-4" style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"var(--grid-gap)", marginBottom:"var(--section-gap)" }}>
        <Kpi label="Toplam marka" value={data.brandStats.length}/>
        <Kpi label="En yoğun" value={busiest.active} sub={busiest.name} color={busiest.color}/>
        <Kpi label="Ort. brief/marka" value={avg}/>
        <Kpi label="Sorunlu marka" value={data.brandStats.filter(b => b.stale).length} color="var(--warning)"/>
      </div>

      <Card padding={0}>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
          <table style={{ width:"100%", minWidth:540, borderCollapse:"collapse", font:"400 13px/1.3 var(--font-sans)" }}>
            <thead>
              <tr style={{ background:"var(--surface-sub)" }}>
                {[["name","Marka"],["active","Aktif"],["done30","Son 30g"],["medianH","Medyan deadline"],["madH","MAD"],["avgRev","Ort. revize"],["rating","Puan"],["risk","Risk"]].map(([k, v]) => (
                  <th key={k} onClick={() => k !== "risk" && setSort(k)} style={{ font:"600 11px/1 var(--font-sans)", color:"var(--ink-3)", letterSpacing:"0.04em", textTransform:"uppercase", padding:"10px 12px", borderBottom:"1px solid var(--line-strong)", cursor: k === "risk" ? "default" : "pointer", textAlign: ["active","done30","medianH","madH","avgRev","rating"].includes(k) ? "right" : "left", whiteSpace:"nowrap", userSelect:"none" }}>
                    {v} {sort === k && <span style={{ color:"var(--ink-2)" }}>↓</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b, idx) => (
                <tr key={b.name} onClick={() => setSel(b.name)} title={`${b.name} → tüm işler`} style={{ background: idx % 2 === 1 ? "var(--surface-sub)" : "var(--surface)", cursor:"pointer" }}>
                  <td style={bCs()}>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
                      <span style={{ width:10, height:10, borderRadius:999, background:b.color, flexShrink:0 }}/>
                      <span style={{ font:"500 13px/1 var(--font-sans)", color:"var(--ink)" }}>{b.name}</span>
                      <I.ChevronRight size={13} style={{ color:"var(--ink-4)" }}/>
                    </span>
                  </td>
                  <td style={bCs(true, "right", b.active > 2 ? "var(--ink)" : "var(--ink-3)")}>{b.active}</td>
                  <td style={bCs(true, "right")}>{b.done30 != null ? b.done30 : "—"}</td>
                  <td style={bCs(true, "right")}>{b.medianH != null ? b.medianH + " sa" : "—"}</td>
                  <td style={bCs(true, "right")}>{b.madH != null ? "± " + b.madH + " sa" : "—"}</td>
                  <td style={bCs(true, "right")}>{b.avgRev != null ? b.avgRev : "—"}</td>
                  <td style={bCs(true, "right")}>{b.rating != null ? <span style={{ color:"var(--prio-yellow)" }}>{b.rating}</span> : "—"}</td>
                  <td style={bCs()}>
                    {b.stale ? <span style={{ font:"600 10px/1 var(--font-sans)", letterSpacing:"0.04em", textTransform:"uppercase", color:"var(--prio-orange)", background:"var(--prio-orange-bg)", padding:"3px 7px", borderRadius:999 }}>İzle</span> : <span style={{ font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)" }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Tek marka detay sayfası ─────────────────────────────────────────────────
function BrandDetail({ brand, stats, data, onBack, onOpenBrief }) {
  const now = (window.BNS_DATA && window.BNS_DATA.NOW) || data.NOW || Date.now();

  // Marka brief'lerini birleşik satır modeline çevir (aktif + tamamlanan)
  // Aktif brief'ler HYDRATE edilmiş (lead/priority obje/deltaH/...) → doğrudan BriefTable'a verilir.
  const active = React.useMemo(() => (data._allBriefs || data.briefs || []).filter(b => b.marka === brand), [brand, data]);
  const done   = React.useMemo(() => (data._allCompleted || data.completed || []).filter(c => c.marka === brand), [brand, data]);

  // hydrate brief deadline'ı ms (number) ya da TR string olabilir → ms'e normalize et
  const dlMs = b => { const d = b.deadline; if (typeof d === 'number') return d; const p = parseTRDeadline(d); return p ? p.getTime() : null; };
  // Hem aktif hem tamamlanan kayıtlar HYDRATE edilmiş aynı shape'e sahip (lead obje, contributors dizi)
  // → tek helper ikisinde de çalışır. (Eskiden completed c.leadId/c.contribIds okuyordu; hydrate bunları
  //   lead/contributors objesine çevirdiği için atanan "—" görünüyordu.)
  const rowIds   = b => [b.lead && b.lead.id, ...((b.contributors || []).map(c => c && c.id))].filter(Boolean);
  const rowNames = b => [b.lead && b.lead.name, ...((b.contributors || []).map(c => c && c.name))].filter(Boolean);
  const activeIds = rowIds;

  const [person, setPerson] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [view, setView] = React.useState("active");   // active | done

  // kişi seçenekleri (aktif lead+contributors ∪ tamamlanan lead+contrib)
  const people = React.useMemo(() => {
    const seen = {};
    for (const b of active) { if (b.lead && b.lead.id) seen[b.lead.id] = b.lead.name || b.lead.id; (b.contributors || []).forEach(c => { if (c && c.id) seen[c.id] = c.name || c.id; }); }
    for (const c of done) { if (c.lead && c.lead.id) seen[c.lead.id] = c.lead.name || c.lead.id; (c.contributors || []).forEach(x => { if (x && x.id && !seen[x.id]) seen[x.id] = x.name || x.id; }); }
    return Object.entries(seen).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [active, done]);

  const fromMs = from ? new Date(from + "T00:00:00").getTime() : null;
  const toMs = to ? new Date(to + "T23:59:59").getTime() : null;
  const inRange = ms => { if (ms == null) return !fromMs && !toMs ? true : false; if (fromMs && ms < fromMs) return false; if (toMs && ms > toMs) return false; return true; };

  const filteredActive = active.filter(b => {
    if (person && !activeIds(b).includes(person)) return false;
    if ((fromMs || toMs) && !inRange(dlMs(b))) return false;
    return true;
  });
  const filteredDone = done.filter(c => {
    if (person && !rowIds(c).includes(person)) return false;
    if ((fromMs || toMs) && !inRange(c.deadline || null)) return false;
    return true;
  });

  const overdue = active.filter(b => { const m = dlMs(b); return m != null && m < now * 1000; }).length;
  const shown = view === "active" ? filteredActive.length : filteredDone.length;

  function exportCsv() {
    let head, lines;
    if (view === "active") {
      head = ["No", "Marka", "İş", "Öncelik", "Atanan", "Deadline", "Durum", "Rev", "Maliyet", "Satış"];
      lines = filteredActive.map(b => [b.no, csvCell(brand), csvCell(b.baslik || b.is), csvCell(b.priority && b.priority.label || ""), csvCell([b.lead && b.lead.name, ...((b.contributors || []).map(c => c && c.name))].filter(Boolean).join("; ")), csvCell(fmtDate(dlMs(b) ? new Date(dlMs(b)) : null)), csvCell(b.durum), b.revision || 0, b.maliyet != null ? b.maliyet : "", b.satis != null ? b.satis : ""].join(","));
    } else {
      head = ["No", "Marka", "İş", "Atanan", "Deadline", "Tamamlanma", "Rev", "Puan", "Maliyet", "Satış"];
      lines = filteredDone.map(c => [c.no, csvCell(brand), csvCell(c.baslik || c.is), csvCell(rowNames(c).join("; ")), csvCell(c.deadline ? fmtDate(new Date(c.deadline)) : ""), csvCell(c.bitis ? fmtDate(new Date(c.bitis)) : ""), c.revision || 0, c.rating != null ? c.rating : "", c.maliyet != null ? c.maliyet : "", c.satis != null ? c.satis : ""].join(","));
    }
    const blob = new Blob(["﻿" + [head.join(",")].concat(lines).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${brand}-${view}.csv`; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  const fldStyle = { padding:"6px 9px", border:"1px solid var(--line)", borderRadius:6, background:"var(--surface)", color:"var(--ink)", font:"400 12px/1.2 var(--font-sans)" };
  const seg = (id, label) => (
    <button key={id} onClick={() => setView(id)} style={{ ...fldStyle, cursor:"pointer", background: view === id ? "var(--ember,#C24A2C)" : "var(--surface)", color: view === id ? "#fff" : "var(--ink-3)", borderColor: view === id ? "var(--ember,#C24A2C)" : "var(--line)" }}>{label}</button>
  );

  return (
    <div className="bn-tab-in">
      <PageHead
        title={brand}
        subtitle={`${active.length} aktif · ${done.length} tamamlanan · ${overdue} gecikmiş${stats.medianH != null ? " · medyan " + stats.medianH + " sa" : ""}`}
        actions={<>
          <button onClick={onBack} style={{ ...fldStyle, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:5 }}>
            <span style={{ font:"600 13px/1 var(--font-sans)" }}>←</span> Markalar
          </button>
          <button onClick={exportCsv} style={{ ...fldStyle, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:5 }} title="Filtrelenmiş listeyi CSV indir">
            <I.Down size={13}/> CSV
          </button>
        </>}
      />

      <div className="bns-kpi-4" style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"var(--grid-gap)", marginBottom:"var(--section-gap)" }}>
        <Kpi label="Aktif iş" value={active.length} color={stats.color}/>
        <Kpi label="Tamamlanan" value={done.length}/>
        <Kpi label="Gecikmiş" value={overdue} color={overdue > 0 ? "var(--prio-red)" : undefined}/>
        <Kpi label="Ort. revize" value={stats.avgRev != null ? stats.avgRev : "—"} sub={stats.rating != null ? "puan " + stats.rating : undefined}/>
      </div>

      {/* Filtreler */}
      <Card style={{ marginBottom:"var(--section-gap)" }}>
        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:10 }}>
          {seg("active", `Aktif · ${filteredActive.length}`)}
          {seg("done", `Tamamlanan · ${filteredDone.length}`)}
          <select value={person} onChange={e => setPerson(e.target.value)} style={fldStyle}>
            <option value="">Herkes</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label style={{ font:"400 12px/1.2 var(--font-sans)", color:"var(--ink-3)", display:"inline-flex", alignItems:"center", gap:6 }}>
            <I.Calendar size={13}/> Deadline:
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={fldStyle}/>
            <span style={{ color:"var(--ink-4)" }}>→</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={fldStyle}/>
          </label>
          {(person || from || to) &&
            <button onClick={() => { setPerson(""); setFrom(""); setTo(""); }} style={{ ...fldStyle, cursor:"pointer", color:"var(--ink-3)" }}>Temizle</button>}
          <span style={{ marginLeft:"auto", font:"500 12px/1 var(--font-mono)", color:"var(--ink-3)" }}>{shown} kayıt</span>
        </div>
      </Card>

      {view === "active" ? (
        // Aktif işler — Aktif İşler sayfasıyla birebir zengin tablo (BriefTable)
        <Card padding={0}>
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            <BriefTable rows={filteredActive} onRowClick={onOpenBrief} financeCols/>
          </div>
        </Card>
      ) : (
        // Tamamlananlar — zengin tablo (atanan avatarları, süre, revize, puan, link)
        <Card padding={0}>
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%", minWidth:720, borderCollapse:"collapse", font:"400 13px/1.3 var(--font-sans)" }}>
              <thead>
                <tr style={{ background:"var(--surface-sub)" }}>
                  {[["#","right"],["İş","left"],["Atanan","left"],["Teslim","left"],["Tamamlanma","left"],["Süre","right"],["Rev#","right"],["Puan","right"],["Maliyet","right"],["Satış","right"],["🔗","center"]].map(([v, al], i) => (
                    <th key={i} style={{ font:"600 11px/1 var(--font-sans)", color:"var(--ink-3)", letterSpacing:"0.04em", textTransform:"uppercase", padding:"10px 12px", borderBottom:"1px solid var(--line-strong)", textAlign: al, whiteSpace:"nowrap" }}>{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDone.length === 0 && <tr><td colSpan={11} style={{ ...bCs(), textAlign:"center", color:"var(--ink-4)", padding:"24px" }}>Tamamlanan iş yok</td></tr>}
                {filteredDone.map((c, idx) => (
                  <tr key={"d" + c.no} style={{ background: idx % 2 === 1 ? "var(--surface-sub)" : "var(--surface)" }}>
                    <td style={bCs(true, "right")}>{c.no}</td>
                    <td style={{ ...bCs(), whiteSpace:"normal", maxWidth:280 }}>{c.baslik || c.is}</td>
                    <td style={bCs()}>
                      {c.lead || (c.contributors && c.contributors.length) ? (
                        <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                          {c.lead && <Avatar user={c.lead} size={20}/>}
                          {c.contributors && c.contributors.length > 0 && <AvatarStack users={c.contributors} max={2} size={18}/>}
                          <span style={{ font:"400 12px/1.2 var(--font-sans)", color:"var(--ink-2)", whiteSpace:"nowrap", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis" }}>{rowNames(c).join(", ")}</span>
                        </span>
                      ) : <span style={{ color:"var(--ink-4)" }}>—</span>}
                    </td>
                    <td style={bCs(true)}>{c.deadline ? fmtDate(new Date(c.deadline)) : "—"}</td>
                    <td style={bCs(true)}>{c.bitis ? fmtDate(new Date(c.bitis)) : "—"}</td>
                    <td style={bCs(true, "right")}>{c.sureH != null ? Math.round(c.sureH) + " sa" : "—"}</td>
                    <td style={bCs(true, "right", (c.revision || 0) > 0 ? "var(--prio-orange)" : undefined)}>{c.revision || 0}</td>
                    <td style={bCs(true, "right")}>{c.rating != null ? <span style={{ color:"var(--prio-yellow)" }}>★ {c.rating}</span> : "—"}</td>
                    <td style={bCs(true, "right")}>{fmtTRY(c.maliyet)}</td>
                    <td style={bCs(true, "right")}>{fmtTRY(c.satis)}</td>
                    <td style={bCs(false, "center")}>{c.slack_url && c.slack_url !== "#" ? <a href={c.slack_url} target="_blank" rel="noreferrer" style={{ color:"var(--ember,#C24A2C)", textDecoration:"none" }}>↗</a> : <span style={{ color:"var(--ink-4)" }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function bCs(mono, align, color) {
  return {
    padding:"var(--row-pad) 12px",
    borderBottom:"1px solid var(--line)",
    fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
    fontSize: mono ? 12 : 13,
    color: color || (mono ? "var(--ink-3)" : "var(--ink)"),
    textAlign: align || "left",
    fontVariantNumeric:"tabular-nums",
    whiteSpace:"nowrap"
  };
}

window.BrandScreen = BrandScreen;
window.BrandDetail = BrandDetail;
