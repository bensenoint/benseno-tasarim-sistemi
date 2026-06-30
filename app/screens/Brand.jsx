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

function BrandScreen({ data, onOpenBrief, onOpenCompleted, initialSel }) {
  const [sel, setSel] = React.useState(initialSel ? initialSel.name : null);
  React.useEffect(() => { if (initialSel) setSel(initialSel.name); }, [initialSel]);
  const [sort, setSort] = React.useState("active");
  const [search, setSearch] = React.useState("");

  // Tek marka seçiliyse detay sayfasını göster
  if (sel) {
    const stats = (data.brandStats || []).find(b => b.name === sel) || { name: sel };
    return <BrandDetail brand={sel} stats={stats} data={data} onBack={() => setSel(null)} onSwitch={setSel} onOpenBrief={onOpenBrief} onOpenCompleted={onOpenCompleted} />;
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
              <tr style={{ background:"var(--paper)" }}>
                {[["name","Marka"],["active","Aktif"],["done30","Son 30g"],["medianH","Medyan deadline"],["madH","MAD"],["avgRev","Ort. revize"],["rating","Puan"],["risk","Risk"]].map(([k, v]) => (
                  <th key={k} onClick={() => k !== "risk" && setSort(k)} style={{ font:"600 11px/1 var(--font-sans)", color:"var(--ink-3)", letterSpacing:"0.04em", textTransform:"uppercase", padding:"10px 12px", borderBottom:"1px solid var(--line-strong)", cursor: k === "risk" ? "default" : "pointer", textAlign: ["active","done30","medianH","madH","avgRev","rating"].includes(k) ? "right" : "left", whiteSpace:"nowrap", userSelect:"none" }}>
                    {v} {sort === k && <span style={{ color:"var(--ink-2)" }}>↓</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b, idx) => (
                <tr key={b.name} onClick={() => setSel(b.name)} title={`${b.name} → tüm işler`} style={{ background: idx % 2 === 1 ? "var(--row-stripe)" : "transparent", cursor:"pointer" }}>
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
                    {b.stale ? <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}><I.Dot size={6} color="var(--prio-orange)"/><span style={{ font:"600 10px/1 var(--font-sans)", letterSpacing:"0.04em", textTransform:"uppercase", color:"var(--prio-orange)" }}>İzle</span></span> : <span style={{ font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)" }}>—</span>}
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
function BrandDetail({ brand, stats, data, onBack, onSwitch, onOpenBrief, onOpenCompleted }) {
  const now = (window.BNS_DATA && window.BNS_DATA.NOW) || data.NOW || Date.now();

  // Marka brief'lerini birleşik satır modeline çevir (aktif + tamamlanan)
  // Aktif brief'ler HYDRATE edilmiş (lead/priority obje/deltaH/...) → doğrudan BriefTable'a verilir.
  // Aktif = müşteri onayında olmayanlar; musteride ayrı sekmede gösterilir
  const active    = React.useMemo(() => (data._allBriefs || data.briefs || []).filter(b => b.marka === brand && b.durum !== "musteride"), [brand, data]);
  const musteride = React.useMemo(() => (data._allBriefs || data.briefs || []).filter(b => b.marka === brand && b.durum === "musteride"), [brand, data]);
  const done   = React.useMemo(() => (data.completed || data._allCompleted || []).filter(c => c.marka === brand), [brand, data]);

  // hydrate brief deadline'ı ms (number) ya da TR string olabilir → ms'e normalize et
  const dlMs = b => { const d = b.deadline; if (typeof d === 'number') return d; const p = parseTRDeadline(d); return p ? p.getTime() : null; };
  // Hem aktif hem tamamlanan kayıtlar HYDRATE edilmiş aynı shape'e sahip (lead obje, contributors dizi)
  // → tek helper ikisinde de çalışır. (Eskiden completed c.leadId/c.contribIds okuyordu; hydrate bunları
  //   lead/contributors objesine çevirdiği için atanan "—" görünüyordu.)
  const rowIds   = b => [...window.bnsLeadList(b).map(l => l && l.id),   ...((b.contributors || []).map(c => c && c.id))].filter(Boolean);
  const rowNames = b => [...window.bnsLeadList(b).map(l => l && l.name), ...((b.contributors || []).map(c => c && c.name))].filter(Boolean);
  const activeIds = rowIds;

  const [person, setPerson] = React.useState("");
  const [view, setView] = React.useState("active");   // active | musteride | done
  const [tomorrowOnly, setTomorrowOnly] = React.useState(false);   // "Yarın": yarın ve sonrası devam edecek aktif işler
  const [statusSel, setStatusSel] = React.useState("");   // aktif görünümde statüye göre filtre ("" = tüm aktif)

  // kişi seçenekleri (aktif lead+contributors ∪ tamamlanan lead+contrib)
  const people = React.useMemo(() => {
    const seen = {};
    for (const b of active) { window.bnsLeadList(b).forEach(l => { if (l && l.id) seen[l.id] = l.name || l.id; }); (b.contributors || []).forEach(c => { if (c && c.id) seen[c.id] = c.name || c.id; }); }
    for (const c of done) { window.bnsLeadList(c).forEach(l => { if (l && l.id && !seen[l.id]) seen[l.id] = l.name || l.id; }); (c.contributors || []).forEach(x => { if (x && x.id && !seen[x.id]) seen[x.id] = x.name || x.id; }); }
    return Object.entries(seen).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [active, done]);

  // "Yarın" (devam edecek): deadline'ı yarın 00:00 ve sonrası olan aktif işler.
  // Gecikmiş (bugün bitecek varsayılır) ve bugün teslim edilecekler HARİÇ. (now referans NOW)
  const _d = new Date(now);
  const startTom = new Date(_d.getFullYear(), _d.getMonth(), _d.getDate() + 1).getTime();
  const continuesTomorrow = ms => ms != null && ms >= startTom;

  const filteredActive = active.filter(b => {
    if (person && !activeIds(b).includes(person)) return false;
    if (statusSel && b.durum !== statusSel) return false;
    if (tomorrowOnly && !continuesTomorrow(dlMs(b))) return false;
    return true;
  });
  const filteredMusteride = musteride.filter(b => {
    if (person && !activeIds(b).includes(person)) return false;
    return true;
  });
  const filteredDone = done.filter(c => {
    if (person && !rowIds(c).includes(person)) return false;
    return true;
  });

  // now zaten ms — eski "*1000" çarpanı eşiği ~58000 yılına taşıyıp HER işi gecikmiş sayıyordu
  const overdue = active.filter(b => { const m = dlMs(b); return m != null && m < now; }).length;
  const shown = view === "active" ? filteredActive.length : view === "musteride" ? filteredMusteride.length : filteredDone.length;
  // Tamamlanan finans toplamı (görüntülenen satırlar): faturalanan/tahsil = Σ satış · ilgili bayrak
  const sumDone = filteredDone.reduce((a, c) => {
    a.m += Number(c.maliyet) || 0; a.s += Number(c.satis) || 0;
    if (c.fatura) a.fa += Number(c.satis) || 0;
    if (c.odeme)  a.od += Number(c.satis) || 0;
    return a;
  }, { m: 0, s: 0, fa: 0, od: 0 });

  function exportCsv() {
    let head, lines;
    if (view === "active") {
      head = ["No", "Marka", "İş", "Öncelik", "Atanan", "Deadline", "Durum", "Rev", "Maliyet", "Satış", "Fatura", "Ödeme"];
      lines = filteredActive.map(b => [b.no, csvCell(brand), csvCell(b.baslik || b.is), csvCell(b.priority && b.priority.label || ""), csvCell([b.lead && b.lead.name, ...((b.contributors || []).map(c => c && c.name))].filter(Boolean).join("; ")), csvCell(fmtDate(dlMs(b) ? new Date(dlMs(b)) : null)), csvCell(b.durum), b.revision || 0, b.maliyet != null ? b.maliyet : "", b.satis != null ? b.satis : "", b.fatura ? "Evet" : "Hayır", b.odeme ? "Evet" : "Hayır"].join(","));
    } else {
      head = ["No", "Marka", "İş", "Atanan", "Deadline", "Tamamlanma", "Rev", "Puan", "Maliyet", "Satış", "Fatura", "Ödeme"];
      lines = filteredDone.map(c => [c.no, csvCell(brand), csvCell(c.baslik || c.is), csvCell(rowNames(c).join("; ")), csvCell(c.deadline ? fmtDate(new Date(c.deadline)) : ""), csvCell(c.bitis ? fmtDate(new Date(c.bitis)) : ""), c.revision || 0, c.rating != null ? c.rating : "", c.maliyet != null ? c.maliyet : "", c.satis != null ? c.satis : "", c.fatura ? "Evet" : "Hayır", c.odeme ? "Evet" : "Hayır"].join(","));
    }
    const blob = new Blob(["﻿" + [head.join(",")].concat(lines).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${brand}-${view}.csv`; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  const fldStyle = { padding:"6px 9px", border:"1px solid var(--line)", borderRadius:6, background:"var(--surface)", color:"var(--ink)", font:"400 12px/1.2 var(--font-sans)" };
  // TEK durum filtresi — aktif alt-statüler + Müşteri Onayında + Tamamlanan tek dropdownda.
  const ACTIVE_STATUSES = [["yeni","Yeni"],["calisiliyor","İş planında"],["basladi","İşe başlandı"],["incelemede","İncelemede"],["beklemede","Beklemede"],["revizyon","Revizyon"],["blokeli","Blokeli"]];
  const durumVal = view === "active" ? ("active" + (statusSel ? ":" + statusSel : "")) : view;
  const pickDurum = (val) => {
    setTomorrowOnly(false);
    if (val === "musteride" || val === "done") { setView(val); setStatusSel(""); }
    else if (val.indexOf("active:") === 0) { setView("active"); setStatusSel(val.slice(7)); }
    else { setView("active"); setStatusSel(""); }
  };

  return (
    <div className="bn-tab-in">
      <PageHead
        title={brand}
        subtitle={`${active.length} aktif · ${done.length} tamamlanan · ${overdue} gecikmiş${stats.medianH != null ? " · medyan " + stats.medianH + " sa" : ""}`}
        actions={<>
          {/* Hızlı marka geçişi — listeye dönmeden başka markanın detayına atla */}
          {onSwitch && (
            <select value={brand} onChange={(e) => onSwitch(e.target.value)} title="Başka markaya geç"
              style={{ ...fldStyle, cursor:"pointer", maxWidth:180 }}>
              {[...(data.brandStats || [])].sort((a, b) => a.name.localeCompare(b.name, "tr")).map(b => (
                <option key={b.name} value={b.name}>{b.name}{b.active ? ` (${b.active})` : ""}</option>
              ))}
            </select>
          )}
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
        <div className="bns-chip-scroll" style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:10 }}>
          {/* TEK durum filtresi: aktif alt-statüler + Müşteri Onayında + Tamamlanan, sayılarıyla */}
          <label style={{ display:"inline-flex", alignItems:"center", gap:6, font:"400 12px/1.2 var(--font-sans)", color:"var(--ink-4)" }}>
            <span style={{ font:"600 10px/1 var(--font-sans)", textTransform:"uppercase", letterSpacing:"0.05em" }}>Durum</span>
            <select value={durumVal} onChange={e => pickDurum(e.target.value)} style={{ ...fldStyle, fontWeight:600, color:"var(--ink)" }} title="Statüye göre filtrele">
              <optgroup label="Aktif işler">
                <option value="active">Tüm aktif ({active.length})</option>
                {ACTIVE_STATUSES.map(([v,l]) => (
                  <option key={v} value={"active:"+v}>{l} ({active.filter(b => b.durum === v).length})</option>
                ))}
              </optgroup>
              <optgroup label="Diğer">
                <option value="musteride">✈️ Müşteri Onayında ({musteride.length})</option>
                <option value="done">✓ Tamamlanan ({done.length})</option>
              </optgroup>
            </select>
          </label>
          <select value={person} onChange={e => setPerson(e.target.value)} style={fldStyle} title="Kişiye göre filtrele">
            <option value="">👤 Herkes</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {view === "active" && (
            <button onClick={() => setTomorrowOnly(v => !v)} title="Yarın ve sonrası devam edecek aktif işler"
              style={{ ...fldStyle, cursor:"pointer",
                background: tomorrowOnly ? "var(--ember-tint)" : "var(--surface)",
                borderColor: tomorrowOnly ? "var(--ember)" : "var(--line)",
                color: tomorrowOnly ? "var(--ember)" : "var(--ink-3)", fontWeight: tomorrowOnly ? 600 : 400 }}>
              🌅 Yarın{tomorrowOnly ? " ✓" : ""}
            </button>
          )}
          {(person || statusSel || tomorrowOnly) &&
            <button onClick={() => { setPerson(""); setStatusSel(""); setTomorrowOnly(false); }} style={{ ...fldStyle, cursor:"pointer", color:"var(--ink-3)" }}>Temizle</button>}
          <span style={{ marginLeft:"auto", font:"500 12px/1 var(--font-mono)", color:"var(--ink-3)" }}>{shown} kayıt</span>
        </div>
      </Card>

      {view === "active" || view === "musteride" ? (
        // Aktif / Müşteri Onayında — Aktif İşler sayfasıyla birebir zengin tablo (BriefTable)
        <Card padding={0}>
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            <BriefTable rows={view === "musteride" ? filteredMusteride : filteredActive} onRowClick={onOpenBrief} financeCols/>
          </div>
        </Card>
      ) : (
        // Tamamlananlar — zengin tablo (atanan avatarları, süre, revize, puan, link)
        <Card padding={0}>
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%", minWidth:720, borderCollapse:"collapse", font:"400 13px/1.3 var(--font-sans)" }}>
              <thead>
                <tr style={{ background:"var(--paper)" }}>
                  {[["#","right"],["İş","left"],["Atanan","left"],["Teslim","left"],["Tamamlanma","left"],["Süre","right"],["Rev#","right"],["Puan","right"],["Maliyet","right"],["Satış","right"],["Fatura","center"],["Ödeme","center"],["🔗","center"]].map(([v, al], i) => (
                    <th key={i} style={{ font:"600 11px/1 var(--font-sans)", color:"var(--ink-3)", letterSpacing:"0.04em", textTransform:"uppercase", padding:"10px 12px", borderBottom:"1px solid var(--line-strong)", textAlign: al, whiteSpace:"nowrap" }}>{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDone.length === 0 && <tr><td colSpan={13} style={{ ...bCs(), textAlign:"center", color:"var(--ink-4)", padding:"24px" }}>Tamamlanan iş yok</td></tr>}
                {filteredDone.map((c, idx) => (
                  <tr key={"d" + c.no}
                    onClick={() => (onOpenCompleted || onOpenBrief) && (onOpenCompleted || onOpenBrief)(c)}
                    title="İş detayını aç"
                    onMouseEnter={e => e.currentTarget.style.background = "var(--paper-2)"}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 1 ? "var(--row-stripe)" : "transparent"}
                    style={{ background: idx % 2 === 1 ? "var(--row-stripe)" : "transparent", cursor:"pointer" }}>
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
                    <td style={bCs(false, "center")}>{c.fatura ? <span title="Fatura kesildi" style={{ color:"var(--ok,#1a8f5a)", fontWeight:700 }}>✓</span> : <span style={{ color:"var(--ink-4)" }}>—</span>}</td>
                    <td style={bCs(false, "center")}>{c.odeme ? <span title="Ödeme yapıldı" style={{ color:"var(--ok,#1a8f5a)", fontWeight:700 }}>✓</span> : <span style={{ color:"var(--ink-4)" }}>—</span>}</td>
                    <td style={bCs(false, "center")}>{c.slack_url && c.slack_url !== "#" ? <a href={c.slack_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color:"var(--ember,#C24A2C)", textDecoration:"none" }}>↗</a> : <span style={{ color:"var(--ink-4)" }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
              {filteredDone.length > 0 && (
                <tfoot>
                  <tr style={{ background:"var(--paper)", borderTop:"2px solid var(--line-strong)" }}>
                    <td colSpan={8} style={{ ...bCs(), textAlign:"right", font:"700 11px/1 var(--font-sans)", letterSpacing:"0.04em", textTransform:"uppercase", color:"var(--ink-2)" }}>Toplam</td>
                    <td style={{ ...bCs(true, "right"), fontWeight:700, color:"var(--ink)" }}>{fmtTRY(sumDone.m)}</td>
                    <td style={{ ...bCs(true, "right"), fontWeight:700, color:"var(--ink)" }}>{fmtTRY(sumDone.s)}</td>
                    <td style={{ ...bCs(true, "right"), fontWeight:700, color:"var(--ink-2)" }} title="Faturalanan tutar (Σ satış · fatura kesilmiş)">{fmtTRY(sumDone.fa)}</td>
                    <td style={{ ...bCs(true, "right"), fontWeight:700, color:"var(--ok,#1a8f5a)" }} title="Tahsil edilen tutar (Σ satış · ödeme yapılmış)">{fmtTRY(sumDone.od)}</td>
                    <td style={bCs()}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}

      {/* ⭐ Marka yıldız karnesi — LİSTENİN ALTINDA, döneme özel lazy değerlendirme */}
      {(() => {
        const rated = done.filter(c => c.rating > 0);
        const avg = rated.length ? +(rated.reduce((s, c) => s + c.rating, 0) / rated.length).toFixed(1) : 0;
        const PS = window.PeriodSebep;
        return (
          <Card style={{ marginTop:"var(--section-gap)" }}>
            <div style={{ font:"600 9.5px/1 var(--font-sans)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:"0.07em" }}>⭐ Yıldız Karnesi</div>
            <div style={{ display:"flex", flexWrap:"wrap", alignItems:"flex-start", gap:12, rowGap:6, marginTop:10 }}>
              <span style={{ font:"600 13px/1.3 var(--font-sans)", color:"var(--ink)", minWidth:120, flexShrink:0 }}>{brand}</span>
              <span style={{ display:"inline-flex", gap:1, flexShrink:0, paddingTop:1 }}>
                {[1,2,3,4,5].map(i => <I.StarFill key={i} size={12} color={i <= Math.round(avg) ? "var(--prio-yellow)" : "var(--line-strong)"}/>)}
              </span>
              <span style={{ font:"600 13px/1.3 var(--font-mono)", color:"var(--ink)", flexShrink:0 }}>{rated.length ? avg : "—"}</span>
              <span style={{ font:"400 11px/1.4 var(--font-sans)", color:"var(--ink-4)", flexShrink:0 }}>({rated.length} iş)</span>
              {PS && <PS type="marka" skey={brand} range={data.dateRange}/>}
            </div>
            <div style={{ marginTop:8, font:"400 10px/1 var(--font-sans)", color:"var(--ink-4)" }}>
              Puan ortalaması seçili tarih aralığındaki tamamlanan işlerden · Değerlendirmeyi açtığında o döneme özel yorum üretilir
            </div>
          </Card>
        );
      })()}

      {/* 📡 Kanal Özeti & 🌙 Gün Sonu Insight — günlük arşiv + tarih filtresi */}
      <BrandDailyPanel brand={brand}/>
    </div>
  );
}

// ── Marka günlük arşivi: kanal özeti + gün-sonu insight, tarih seçimiyle ──────
// "Şu an (canlı)" = saatlik güncellenen güncel özet; geçmiş günler brand_daily arşivinden.
function BrandDailyPanel({ brand }) {
  const [daily, setDaily] = React.useState([]);     // [{tarih, ozet, insight}] yeni→eski
  const [sel, setSel] = React.useState("live");
  const API = window.BNS_API_BASE || "https://benseno-api-production.up.railway.app";
  React.useEffect(() => {
    let dead = false;
    setDaily([]); setSel("live");
    const _tok = (typeof localStorage !== "undefined" && localStorage.getItem("bns_token")) || "";
    fetch(`${API}/api/brands/by-name/${encodeURIComponent(brand)}/daily`, {
      headers: _tok ? { Authorization: "Bearer " + _tok } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!dead && j) setDaily(j.daily || []); })
      .catch(() => {});
    return () => { dead = true; };
  }, [brand]);

  const bm = (window.BNS_DATA && window.BNS_DATA.BR && window.BNS_DATA.BR[brand]) || {};
  const fmtTarih = (t) => { try { return new Date(t).toLocaleDateString("tr-TR", { timeZone:"Europe/Istanbul", day:"numeric", month:"long", year:"numeric", weekday:"short" }); } catch { return String(t).slice(0, 10); } };
  const fmtAt = ms => { try { return new Date(ms).toLocaleString("tr-TR", { timeZone:"Europe/Istanbul", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }); } catch { return ""; } };

  const selDay = sel === "live" ? null : daily.find(d => String(d.tarih).slice(0, 10) === sel);
  const ozet    = sel === "live" ? bm.kanal_ozet : (selDay && selDay.ozet);
  const insight = sel === "live" ? bm.son_insight : (selDay && selDay.insight);
  const ozetSub = sel === "live"
    ? (bm.kanal_ozet_at ? `canlı · ${fmtAt(bm.kanal_ozet_at)} itibarıyla · saatte bir güncellenir` : "saatte bir güncellenir")
    : `${fmtTarih(selDay && selDay.tarih)} arşivi`;
  const insSub = sel === "live"
    ? (bm.son_insight_tarih ? `en son: ${fmtTarih(bm.son_insight_tarih)} · hafta içi 18:45'te üretilir` : "hafta içi 18:45'te üretilir")
    : `${fmtTarih(selDay && selDay.tarih)} arşivi`;

  if (!bm.kanal_ozet && !bm.son_insight && daily.length === 0) return null;

  const Kart = ({ icon, title, text, sub, accent }) => (
    <Card style={{ flex:1, minWidth:300, borderTop:`3px solid ${accent}` }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <span style={{ fontSize:16 }}>{icon}</span>
        <span style={{ font:"600 12px/1 var(--font-sans)", letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--ink-3)" }}>{title}</span>
      </div>
      {text
        ? <MobileAccordion title="Detayı oku"><div style={{ font:"400 13px/1.65 var(--font-sans)", color:"var(--ink-2)", whiteSpace:"pre-wrap" }}><Linkify text={text}/></div></MobileAccordion>
        : <div style={{ font:"400 12px/1.5 var(--font-sans)", color:"var(--ink-4)" }}>Bu gün için kayıt yok.</div>}
      <div style={{ marginTop:10, paddingTop:8, borderTop:"1px solid var(--line-soft)", font:"400 10px/1.4 var(--font-sans)", color:"var(--ink-4)" }}>{sub}</div>
    </Card>
  );

  return (
    <div style={{ marginTop:"var(--section-gap)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        <span style={{ font:"600 13px/1 var(--font-sans)", color:"var(--ink)" }}>Günlük Kanal Takibi</span>
        <select value={sel} onChange={e => setSel(e.target.value)} style={{
          padding:"6px 10px", border:"1px solid var(--line)", borderRadius:6,
          background:"var(--surface)", color:"var(--ink)", font:"500 12px/1.2 var(--font-sans)",
          cursor:"pointer", outline:"none",
        }}>
          <option value="live">Şu an (canlı)</option>
          {daily.map(d => {
            const key = String(d.tarih).slice(0, 10);
            return <option key={key} value={key}>{fmtTarih(d.tarih)}</option>;
          })}
        </select>
        <span style={{ font:"400 11px/1 var(--font-sans)", color:"var(--ink-4)" }}>
          {daily.length > 0 ? `${daily.length} günlük arşiv` : "arşiv hafta içi 18:45'te birikir"}
        </span>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:"var(--grid-gap)" }}>
        <Kart icon="📡" title="Kanal Özeti" text={ozet} sub={ozetSub} accent="var(--info, #4a7dbd)"/>
        <Kart icon="🌙" title="Gün Sonu Insight" text={insight} sub={insSub} accent="var(--prio-yellow)"/>
      </div>
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
