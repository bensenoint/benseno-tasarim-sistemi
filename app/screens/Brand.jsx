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
function usersMap() {
  return ((window.BNS_DATA && window.BNS_DATA.USERS) || []).reduce((m, u) => { m[u.id] = u; return m; }, {});
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
  const uById = usersMap();
  const now = (window.BNS_DATA && window.BNS_DATA.NOW) || data.NOW || Date.now();

  // Marka brief'lerini birleşik satır modeline çevir (aktif + tamamlanan)
  const rows = React.useMemo(() => {
    const active = (data._allBriefs || data.briefs || []).filter(b => b.marka === brand);
    const done = (data._allCompleted || data.completed || []).filter(c => c.marka === brand);
    const nm = ids => (ids || []).map(id => (uById[id] && uById[id].name) || id);
    const out = [];
    for (const b of active) {
      const persons = [...nm(b.atanan_ids), ...nm(b.editor_ids)];
      const dl = parseTRDeadline(b.deadline);
      out.push({ kind:"active", no:b.no, is:b.is, durum:b.durum || "—", priority:b.priority || "", persons, personIds:[...(b.atanan_ids||[]), ...(b.editor_ids||[])], deadline:dl, deadlineLabel:b.deadline || "—", bitis:null, bitisLabel:"—", ref:b });
    }
    for (const c of done) {
      const persons = nm([c.leadId, ...(c.contribIds || [])].filter(Boolean));
      const dl = c.deadline ? new Date(c.deadline) : null;
      const bt = c.bitis ? new Date(c.bitis) : null;
      out.push({ kind:"done", no:c.no, is:c.baslik || c.is, durum:"✅ Tamamlandı", priority:"", persons, personIds:[c.leadId, ...(c.contribIds||[])].filter(Boolean), deadline:dl, deadlineLabel: dl ? fmtDate(dl) : "—", bitis:bt, bitisLabel: bt ? fmtDate(bt) : "—", ref:c });
    }
    return out;
  }, [brand, data]);

  const [person, setPerson] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [kind, setKind] = React.useState("all");

  // kişi seçenekleri (id+isim)
  const people = React.useMemo(() => {
    const seen = {};
    for (const r of rows) r.personIds.forEach((id, i) => { if (id && !seen[id]) seen[id] = r.persons[i] || id; });
    return Object.entries(seen).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [rows]);

  const fromD = from ? new Date(from + "T00:00:00") : null;
  const toD = to ? new Date(to + "T23:59:59") : null;
  const filtered = rows.filter(r => {
    if (kind !== "all" && r.kind !== kind) return false;
    if (person && !r.personIds.includes(person)) return false;
    if (fromD && (!r.deadline || r.deadline < fromD)) return false;
    if (toD && (!r.deadline || r.deadline > toD)) return false;
    return true;
  }).sort((a, b) => (b.deadline ? b.deadline.getTime() : 0) - (a.deadline ? a.deadline.getTime() : 0));

  const activeCount = rows.filter(r => r.kind === "active").length;
  const doneCount = rows.filter(r => r.kind === "done").length;
  const overdue = rows.filter(r => r.kind === "active" && r.deadline && r.deadline.getTime() < now).length;

  function exportCsv() {
    const head = ["No", "İş", "Durum", "Atananlar", "Deadline", "Tamamlanma"];
    const lines = [head.join(",")].concat(filtered.map(r => [r.no, csvCell(r.is), csvCell(r.durum), csvCell(r.persons.join("; ")), csvCell(r.deadlineLabel), csvCell(r.bitisLabel)].join(",")));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${brand}-isler.csv`; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  const fldStyle = { padding:"6px 9px", border:"1px solid var(--line)", borderRadius:6, background:"var(--surface)", color:"var(--ink)", font:"400 12px/1.2 var(--font-sans)" };

  return (
    <div className="bn-tab-in">
      <PageHead
        title={brand}
        subtitle={`${activeCount} aktif · ${doneCount} tamamlanan · ${overdue} gecikmiş${stats.medianH != null ? " · medyan " + stats.medianH + " sa" : ""}`}
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
        <Kpi label="Aktif iş" value={activeCount} color={stats.color}/>
        <Kpi label="Tamamlanan" value={doneCount}/>
        <Kpi label="Gecikmiş" value={overdue} color={overdue > 0 ? "var(--prio-red)" : undefined}/>
        <Kpi label="Ort. revize" value={stats.avgRev != null ? stats.avgRev : "—"} sub={stats.rating != null ? "puan " + stats.rating : undefined}/>
      </div>

      {/* Filtreler */}
      <Card style={{ marginBottom:"var(--section-gap)" }}>
        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:10 }}>
          <select value={kind} onChange={e => setKind(e.target.value)} style={fldStyle}>
            <option value="all">Tüm işler</option>
            <option value="active">Aktif</option>
            <option value="done">Tamamlanan</option>
          </select>
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
          {(person || from || to || kind !== "all") &&
            <button onClick={() => { setPerson(""); setFrom(""); setTo(""); setKind("all"); }} style={{ ...fldStyle, cursor:"pointer", color:"var(--ink-3)" }}>Temizle</button>}
          <span style={{ marginLeft:"auto", font:"500 12px/1 var(--font-mono)", color:"var(--ink-3)" }}>{filtered.length} kayıt</span>
        </div>
      </Card>

      <Card padding={0}>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
          <table style={{ width:"100%", minWidth:640, borderCollapse:"collapse", font:"400 13px/1.3 var(--font-sans)" }}>
            <thead>
              <tr style={{ background:"var(--surface-sub)" }}>
                {["#","İş","Durum","Atanan(lar)","Deadline","Tamamlanma"].map((v, i) => (
                  <th key={i} style={{ font:"600 11px/1 var(--font-sans)", color:"var(--ink-3)", letterSpacing:"0.04em", textTransform:"uppercase", padding:"10px 12px", borderBottom:"1px solid var(--line-strong)", textAlign: i === 0 ? "right" : "left", whiteSpace:"nowrap" }}>{v}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ ...bCs(), textAlign:"center", color:"var(--ink-4)", padding:"24px" }}>Filtreye uyan iş yok</td></tr>
              )}
              {filtered.map((r, idx) => (
                <tr key={r.kind + r.no} onClick={() => r.kind === "active" && onOpenBrief && onOpenBrief(r.ref)} style={{ background: idx % 2 === 1 ? "var(--surface-sub)" : "var(--surface)", cursor: r.kind === "active" ? "pointer" : "default" }}>
                  <td style={bCs(true, "right")}>{r.priority} {r.no}</td>
                  <td style={{ ...bCs(), whiteSpace:"normal", maxWidth:280 }}>{r.is}</td>
                  <td style={bCs()}><span style={{ font:"400 12px/1.3 var(--font-sans)", color:"var(--ink-2)" }}>{r.durum}</span></td>
                  <td style={{ ...bCs(), whiteSpace:"normal", maxWidth:200 }}>{r.persons.join(", ") || "—"}</td>
                  <td style={bCs(true)}>{r.deadlineLabel}</td>
                  <td style={bCs(true)}>{r.bitisLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
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
