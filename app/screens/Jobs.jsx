// app/screens/Jobs.jsx — Aktif İşler tab. Supports table / kanban / cards view.

function JobsScreen({ data, user, tableMode, initialScope, onOpenBrief, onOpenCompleted, onStatusChange, setDateRange }) {
  const isMobile = typeof useIsMobile === "function" ? useIsMobile() : false;
  const [scope, setScope] = useStickyState("jobs.scope", "all");
  // İkinci sıra (detay) KPI kartları varsayılan KAPALI; bir statü kartına basınca açılır, tekrar basınca kapanır.
  const [detailOpen, setDetailOpen] = React.useState(false);
  // Overview KPI'dan deep-link ile gelindiğinde filtreyi güncelle (refresh'te initialScope=null → sticky korunur)
  React.useEffect(() => { if (initialScope) { setScope(initialScope); setDetailOpen(true); } }, [initialScope]);
  const [search, setSearch] = useStickyState("jobs.search", "");
  const [prioFilter, setPrioFilter] = useStickyState("jobs.prio", "all");
  const [person, setPerson] = useStickyState("jobs.person", "all");   // kişi (lead+contributor) filtresi
  const [markaFilter, setMarkaFilter] = useStickyState("jobs.marka", "all");   // marka filtresi
  // Mobil görünüm geçişi: tablo / liste / kanban (referans). Desktop tableMode prop'unu kullanır.
  const [mView, setMView] = React.useState("table");
  const view = isMobile ? mView : tableMode;

  // viewMode (mine/dept/all) filtresi App.jsx'te merkezi uygulanır — data.briefs zaten filtered.
  // Müşteri onayında bekleyenler aktif listeden çıkar — kendi sayfaları var (revize dönünce otomatik geri gelir)
  // Marka filtresi KAYNAKTA uygulanır → hem liste hem statü-KPI sayıları markayla daralır.
  const mf = (arr) => markaFilter === "all" ? arr : arr.filter(b => b.marka === markaFilter);
  const comp = mf(data.completed || []);                                // seçili aralık tamamlananlar (markalı)

  // ── Tarih filtresi (üst global) → TÜM KPI kartları + listeler DURUM-ARALIĞI çakışması (rapor/arşiv) ──
  // Bir iş, ilgili DURUMDA seçili aralık boyunca BULUNDUYSA sayılır (geçiş anı değil). Dün bir statüye
  // girip bugün hâlâ o statüdeyse, bugün de o statüde sayılır (süreklilik). Havuz: TÜM aktif + TÜM tamamlanmış.
  const _dr = data.dateRange || {};
  const winFrom = typeof _dr.from === "number" ? _dr.from : -Infinity;
  const winTo   = typeof _dr.to   === "number" ? _dr.to   :  Infinity;
  const NOW = data.NOW || Date.now();
  const overlaps = (start, end) => start <= winTo && end >= winFrom;   // [start,end] aralığı pencereyle çakışıyor mu
  const evPool = mf([...(data._allBriefs || data.briefs || []), ...(data._allCompleted || data.completed || [])]);
  const EV_STATUS = new Set(["calisiliyor", "basladi", "incelemede", "beklemede", "revizyon", "blokeli", "musteride"]);
  // Açılış anı: created_at (aktif) ya da en erken statü olayı (tamamlanan created_at taşımaz).
  const openTs = (b) => {
    if (typeof b.created_at === "number") return b.created_at;
    const ev = (b.durum_olaylari || []).map(e => e.ts).filter(Number.isFinite);
    return ev.length ? Math.min(...ev) : null;
  };
  // İşin durum zaman çizelgesi: ardışık olaylardan [{durum,start,end}] aralıkları. Son aralık tamamlanışa
  // (bitis) ya da NOW'a kadar sürer. İlk olaydan önce açılış varsa ve ilk olay 'yeni' değilse 'yeni' aralığı eklenir.
  const statusIntervals = (b) => {
    const evs = (b.durum_olaylari || []).filter(e => Number.isFinite(e.ts)).slice().sort((x, y) => x.ts - y.ts);
    const end = (typeof b.bitis === "number") ? b.bitis : NOW;
    const open = openTs(b);
    const out = [];
    if (evs.length === 0) {
      const d = b.durum || (b.bitis ? "tamamlandi" : null);
      if (d != null && open != null) out.push({ durum: d, start: open, end });
      return out;
    }
    if (open != null && open < evs[0].ts && evs[0].durum !== "yeni") out.push({ durum: "yeni", start: open, end: evs[0].ts });
    for (let i = 0; i < evs.length; i++) out.push({ durum: evs[i].durum, start: evs[i].ts, end: (i + 1 < evs.length ? evs[i + 1].ts : end) });
    return out;
  };
  const inStatusDuring = (b, durum) => statusIntervals(b).some(iv => iv.durum === durum && overlaps(iv.start, iv.end));
  // Gecikme DÖNEMİ [deadline, bitis|NOW] pencereyle çakışıyor mu (gerçekten geç + müşteride hariç).
  const overdueDuring = (b) => {
    if (typeof b.deadline !== "number") return false;
    const end = (typeof b.bitis === "number") ? b.bitis : NOW;
    if (end <= b.deadline) return false;   // hiç gecikmeye düşmedi
    const late = b.bitis ? (b.delivery_status === "gec")
                         : (typeof b.deltaH === "number" && b.deltaH <= 0 && b.durum !== "musteride");
    return late && overlaps(b.deadline, end);
  };
  // Aktif işler = dönemde bir an AKTİF statüde bulunmuş iş (müşteride + tamamlanmış HARİÇ; onların kendi kartı var).
  const ACTIVE_SET = new Set(["yeni", "calisiliyor", "basladi", "incelemede", "beklemede", "revizyon", "blokeli"]);
  const activeDuring = (b) => statusIntervals(b).some(iv => ACTIVE_SET.has(iv.durum) && overlaps(iv.start, iv.end));
  const cntStatus = (durum) => evPool.filter(b => inStatusDuring(b, durum)).length;

  // Tamamlanmış brief'i BriefTable için güvenli default'larla normalize et (deltaH null → detayda sayısal-guard'la elenir).
  const normComp = (c) => ({ ...c,
    durum: c.durum || "tamamlandi",   // tamamlanan brief'lerde durum yok → statü pill'i "Tamamlandı" gösterir
    priority: c.priority || { code: "grn", label: "—" },
    oncelik: c.oncelik || { code: "ylw", label: "NORMAL" },
    // Gecikme sütunu deltaH'tan hesaplanır; tamamlananda deltaH yok → geç teslimi gecikmeH'ten türet
    // (geç teslim → negatif "X GECİKTİ"; zamanında → null/nötr). Detay metrikleri de bununla tutarlı olur.
    deltaH: c.deltaH != null ? c.deltaH
      : (typeof c.gecikmeH === "number" && c.gecikmeH > 0 ? -c.gecikmeH : null) });
  const norm = (b) => b.bitis ? normComp(b) : b;   // tamamlanmışsa normalize; devam eden iş olduğu gibi (satır-içi düzenlenebilir kalır)

  const isCompletedScope = scope === "tamamlandi";
  let rows;
  if (isCompletedScope)            rows = comp.map(c => normComp({ ...c, durum: "tamamlandi" }));      // aralıkta tamamlananlar
  else if (scope === "yeni")       rows = evPool.filter(b => inStatusDuring(b, "yeni")).map(norm);     // aralıkta 'yeni' durumda olan işler
  else if (scope === "overdue")    rows = evPool.filter(overdueDuring).map(norm);                      // aralıkta gecikme döneminde olan işler
  else if (EV_STATUS.has(scope))   rows = evPool.filter(b => inStatusDuring(b, scope)).map(norm);      // aralıkta o statüde bulunan işler
  else if (scope === "review")     rows = evPool.filter(b => inStatusDuring(b, "incelemede")).map(norm); // geriye uyum (Overview deep-link)
  else                             rows = evPool.filter(activeDuring).map(norm);                        // "all" (Aktif işler) + "open" → dönemde aktif statüde bulunan işler
  // Öncelik filtresi (tüm scope'larda): "over" = geçmiş/geciken, diğerleri renk kodu
  if (prioFilter === "over")       rows = rows.filter(b => typeof b.deltaH === "number" && b.deltaH <= 0);
  else if (prioFilter !== "all")   rows = rows.filter(b => b.priority && b.priority.code === prioFilter);
  if (person !== "all") rows = rows.filter(b => [b.lead, ...(b.contributors || [])].some(p => p && p.id === person));
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    rows = rows.filter(b =>
      (b.baslik || "").toLowerCase().includes(q) ||
      (b.marka  || "").toLowerCase().includes(q) ||
      (b.lead?.name || "").toLowerCase().includes(q) ||
      (b.contributors || []).some(u => (u?.name || "").toLowerCase().includes(q))
    );
  }

  // Kişi seçenekleri — aktif işlerdeki lead+contributor'lardan (alfabetik, Türkçe).
  const personOpts = peopleOf(data.briefs.filter(b => b.durum !== "musteride"));
  // Marka seçenekleri — HAM veriden (markaFilter'dan bağımsız; aksi halde seçince liste daralırdı), alfabetik.
  const markaOpts = [...new Set([...(data.briefs || []), ...(data.completed || [])].map(b => b.marka).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));

  // Statü KPI kartları — DURUM-ARALIĞI çakışması: aralık boyunca ilgili durumda BULUNAN benzersiz iş sayısı.
  // Aktif işler=dönemde aktif statüde bulunan; statüler=o durumda bulunan; Geciken=gecikme döneminde; Tamamlandı=aralıkta biten.
  const cntAktif = evPool.filter(activeDuring).length;
  const cntYeni = evPool.filter(b => inStatusDuring(b, "yeni")).length;
  const cntOverdue = evPool.filter(overdueDuring).length;
  const statusCards = [
    { key: "all",         label: "Aktif işler",  value: cntAktif },
    { key: "yeni",        label: "Yeni",         value: cntYeni,                 color: "var(--ink-3)" },
    { key: "calisiliyor", label: "İş planında",  value: cntStatus("calisiliyor"), color: "var(--info)" },
    { key: "basladi",     label: "İşe başlandı", value: cntStatus("basladi"),     color: "var(--ok, #2E8F66)" },
    { key: "incelemede",  label: "İncelemede",   value: cntStatus("incelemede"),  color: "var(--warning)" },
    { key: "beklemede",   label: "Bekliyor",     value: cntStatus("beklemede"),   color: "var(--ink-3)" },
    { key: "revizyon",    label: "Revizyon",     value: cntStatus("revizyon"),    color: "var(--warning)" },
    { key: "blokeli",     label: "Blokeli",      value: cntStatus("blokeli"),     color: "var(--danger)" },
    { key: "musteride",   label: "Müşteri onayı",value: cntStatus("musteride"),   color: "var(--musteride)" },
    { key: "overdue",     label: "Geciken",      value: cntOverdue, color: "var(--prio-red)" },
    { key: "tamamlandi",  label: "Tamamlandı",   value: comp.length,        color: "var(--success, #2E8F66)" },
  ];
  const activeKey = scope === "review" ? "incelemede" : scope === "open" ? "all" : scope;   // KPI vurgusu (legacy review→incelemede)

  // ── İkinci satır: seçili karta özel DETAY KPI'lar ── (NOW yukarıda tanımlı)
  const _d = new Date(NOW); const dayEnd = new Date(_d.getFullYear(), _d.getMonth(), _d.getDate(), 23, 59, 59).getTime();
  const weekEnd = NOW + 7 * 24 * 3600 * 1000;
  const avg = (arr, f) => arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : 0;
  let detailKpis;
  if (isCompletedScope) {
    const n = comp.length, wS = comp.filter(c => c.sureH > 0), ds = (k) => comp.filter(c => c.delivery_status === k).length;
    const rated = comp.filter(c => c.rating > 0);
    detailKpis = [
      { label: "Adet", value: n },
      { label: "Ort. süre · saat", value: wS.length ? avg(wS, c => c.sureH).toFixed(1) : "—" },
      { label: "Toplam · saat", value: wS.length ? Math.round(wS.reduce((s, c) => s + c.sureH, 0)) : "—" },
      { label: "Ort. gecikme · saat", value: n ? avg(comp, c => c.gecikmeH || 0).toFixed(1) : "—" },
      { label: "Ort. revize", value: n ? avg(comp, c => c.revision || 0).toFixed(1) : "—" },
      { label: "Ort. puan", value: rated.length ? avg(rated, c => c.rating).toFixed(1) + " / 5" : "—", color: "var(--warning)" },
      { label: "Zamanında", value: n ? "%" + Math.round(ds("zamaninda") / n * 100) : "—", color: "var(--success, #2E8F66)" },
      { label: "Uzatılarak", value: n ? "%" + Math.round(ds("uzatildi") / n * 100) : "—", color: "var(--warning)" },
      { label: "Geciken", value: n ? "%" + Math.round(ds("gec") / n * 100) : "—", color: "var(--prio-red)" },
    ];
  } else {
    // Aday metrikler — seçili statünün alt kümesi (rows) üzerinden. Her statü kendi anlamlı setini seçer.
    const fmtH = (h) => !h ? "—" : h >= 48 ? Math.round(h / 24) + " gün" : Math.round(h) + " sa";
    const n = rows.length;
    const overdueArr = rows.filter(b => typeof b.deltaH === "number" && b.deltaH <= 0);
    const nonOver = rows.filter(b => typeof b.deltaH === "number" && b.deltaH > 0);
    const C = (label, value, color) => ({ label, value, color });
    const cand = {
      adet:      C("Adet", n),
      geciken:   C("Geciken", overdueArr.length, overdueArr.length ? "var(--prio-red)" : undefined),
      ortGecikme:C("Ort. gecikme", overdueArr.length ? fmtH(avg(overdueArr, b => -b.deltaH)) : "—", "var(--prio-red)"),
      enCokGec:  C("En çok geciken", overdueArr.length ? fmtH(Math.max(...overdueArr.map(b => -b.deltaH))) : "—", "var(--prio-red)"),
      risk:      C("Termin riski", rows.filter(b => typeof bnsIsRisk === "function" && bnsIsRisk(b.durum, b.deltaH)).length, "var(--prio-orange)"),
      bugun:     C("Bugün teslim", rows.filter(b => b.deadline && b.deadline <= dayEnd && b.deltaH > 0).length),
      hafta:     C("Bu hafta", rows.filter(b => b.deadline && b.deadline <= weekEnd && b.deltaH > 0).length),
      acil:      C("Acil", rows.filter(b => b.priority && b.priority.code === "red").length, "var(--prio-red)"),
      yuksek:    C("Yüksek", rows.filter(b => b.priority && b.priority.code === "org").length, "var(--prio-orange)"),
      ortKalan:  C("Ort. kalan", nonOver.length ? fmtH(avg(nonOver, b => b.deltaH)) : "—"),
      uzat:      C("Uzatılmış", rows.filter(b => (b.uzatma_sayisi || 0) > 0).length),
      revTop:    C("Toplam revize", rows.reduce((s, b) => s + (b.revision || b.rev || 0), 0)),
      revIc:     C("İç revize", rows.reduce((s, b) => s + (b.rev_ic || 0), 0)),
      revMus:    C("Müşteri revize", rows.reduce((s, b) => s + (b.rev_musteri || 0), 0), "var(--musteride)"),
      musBekle:  C("Müşteri dönüşü", rows.filter(b => b.musteri_bekliyor).length, "var(--musteride)"),
      kisi:      C("Kişi", new Set(rows.flatMap(b => [b.lead, ...(b.contributors || [])].filter(Boolean).map(p => p.id))).size),
      marka:     C("Marka", new Set(rows.map(b => b.marka).filter(Boolean)).size),
      stale:     C("Hareketsiz", rows.filter(b => b.stale).length, "var(--prio-orange)"),
      ortYas:    C("Ort. açık yaş", (() => { const a = rows.filter(b => b.created_at); return a.length ? fmtH(avg(a, b => (NOW - b.created_at) / 3600000)) : "—"; })()),
      ortAtil:   C("Ort. süredir", (() => { const a = rows.filter(b => b.updated_at); return a.length ? fmtH(avg(a, b => (NOW - b.updated_at) / 3600000)) : "—"; })()),
      ortMus:    C("Ort. müşteride", (() => { const a = rows.filter(b => b.son_gonderim_at); return a.length ? fmtH(avg(a, b => (NOW - b.son_gonderim_at) / 3600000)) : "—"; })(), "var(--musteride)"),
      enUzunMus: C("En uzun bekleyen", (() => { const a = rows.filter(b => b.son_gonderim_at); return a.length ? fmtH(Math.max(...a.map(b => (NOW - b.son_gonderim_at) / 3600000))) : "—"; })(), "var(--musteride)"),
      gonderim:  C("Toplam gönderim", rows.reduce((s, b) => s + (b.gonderim_sayisi || 0), 0)),
    };
    const SETS = {
      all:        ["adet", "geciken", "risk", "bugun", "hafta", "acil", "ortKalan", "uzat", "kisi", "marka"],
      yeni:       ["adet", "ortYas", "stale", "bugun", "geciken", "acil"],
      calisiliyor:["adet", "bugun", "hafta", "geciken", "ortKalan", "acil", "uzat"],
      basladi:    ["adet", "risk", "bugun", "geciken", "ortKalan", "kisi"],
      incelemede: ["adet", "ortAtil", "bugun", "geciken", "revTop"],
      beklemede:  ["adet", "ortAtil", "stale", "geciken", "acil"],
      revizyon:   ["adet", "revIc", "revMus", "revTop", "musBekle", "geciken"],
      musteride:  ["adet", "ortMus", "enUzunMus", "gonderim", "musBekle", "geciken"],
      blokeli:    ["adet", "ortAtil", "geciken", "acil", "kisi"],
      overdue:    ["adet", "ortGecikme", "enCokGec", "acil", "risk", "uzat"],
    };
    detailKpis = (SETS[activeKey] || SETS.all).map(k => cand[k]).filter(Boolean);
  }

  // Kart tıklama: aynı karta (açıkken) basınca detayı kapat; farklı/kapalıyken o statüyü seç + detayı aç.
  const onCardClick = (key) => {
    if (key === scope && detailOpen) setDetailOpen(false);
    else { setScope(key); setDetailOpen(true); }
  };
  // Tarih kısayolları (üst global tarih filtresiyle çalışır; preset kodları DateRangeControl ile aynı).
  const DAY = 86400000;
  const _today0 = (() => { const d = new Date(NOW); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); })();
  const setPreset = (code) => {
    if (!setDateRange) return;
    if (code === "today")          setDateRange({ from: _today0, to: NOW, preset: "today" });
    else if (code === "yesterday") setDateRange({ from: _today0 - DAY, to: _today0 - 1, preset: "yesterday" });
    else if (code === "7d")        setDateRange({ from: NOW - 7 * DAY, to: NOW, preset: "7d" });
    else if (code === "30d")       setDateRange({ from: NOW - 30 * DAY, to: NOW, preset: "30d" });
  };
  const curPreset = (data.dateRange || {}).preset;
  const SHORTCUTS = [["today", "Bugün"], ["yesterday", "Dün"], ["7d", "7 gün"], ["30d", "30 gün"]];

  return (
    <div className="bn-tab-in">
      <PageHead
        title="Aktif işler"
        subtitle="11 sütun · sırala · filtrele · drawer'da düzenle"
        actions={isMobile ? null : <>
          {setDateRange && (
            <div style={{display:"inline-flex", gap:4, marginRight:4}}>
              {SHORTCUTS.map(([code, lbl]) => (
                <button key={code} onClick={() => setPreset(code)} title={`Tarih: ${lbl}`} style={{
                  font:`${curPreset===code?600:500} 11px/1 var(--font-sans)`, padding:"6px 10px",
                  border:"1px solid " + (curPreset===code ? "var(--ember)" : "var(--line)"), borderRadius:6, cursor:"pointer",
                  background: curPreset===code ? "var(--ember-tint)" : "var(--surface)",
                  color: curPreset===code ? "var(--ember)" : "var(--ink-3)", transition:"all 120ms",
                }}>{lbl}</button>
              ))}
            </div>
          )}
          <Button kind="ghost" size="sm" icon={<I.Refresh size={13}/>}>Yenile</Button>
        </>}
      />

      {/* Mobil: görünüm geçişi (tablo / liste / kanban) — referans ikon segment */}
      {isMobile && (
        <div style={{display:"flex", padding:3, border:"1px solid var(--line)", borderRadius:10, gap:2, marginBottom:12, width:"fit-content"}}>
          {[["table", <I.Grid size={15}/>], ["list", <I.List size={15}/>], ["kanban", <I.Columns size={15}/>]].map(([k, ic]) => (
            <button key={k} onClick={() => setMView(k)} aria-label={k} style={{
              padding:"7px 13px", border:0, borderRadius:7, cursor:"pointer",
              display:"inline-flex", alignItems:"center", justifyContent:"center",
              background: mView===k ? "var(--ember-tint)" : "transparent",
              color: mView===k ? "var(--ember)" : "var(--ink-4)", transition:"all 150ms",
            }}>{ic}</button>
          ))}
        </div>
      )}

      {/* Statü KPI kartları (desktop) — tıklanınca o statüye filtreler */}
      {!isMobile && (
        <KpiGrid cols={statusCards.length}>
          {statusCards.map(c => (
            <Kpi key={c.key} label={c.label} value={c.value} color={c.color}
              active={activeKey === c.key} onClick={() => onCardClick(c.key)}/>
          ))}
        </KpiGrid>
      )}

      {/* İkinci satır: seçili karta özel detay KPI'lar (desktop) — varsayılan kapalı; karta basınca efektle açılır */}
      {!isMobile && detailOpen && (
        <>
          <div style={{margin:"24px 0 -16px", font:"600 10px/1 var(--font-sans)", letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--ink-4)"}}>
            {(statusCards.find(c => c.key === activeKey) || { label: "Aktif işler" }).label} · detay
          </div>
          <KpiGrid key={scope} cols={detailKpis.length}>
            {detailKpis.map((d, i) => (
              <Kpi key={i} label={d.label} value={d.value} color={d.color}/>
            ))}
          </KpiGrid>
        </>
      )}

      {/* Filter row — kartlar ile liste arasında ferah bir bant (tasarım örneği ritmi) */}
      <div className="bns-sticky-filters" style={{
        display:"flex", alignItems:"center", gap: 14, margin:"22px 0 16px", flexWrap:"wrap"
      }}>
        {/* Mobil: statü filtresi segment (desktop'ta KPI kartları kullanılır) */}
        {isMobile && (
          <Segment value={activeKey} onChange={setScope}
            options={statusCards.map(c => [c.key, `${c.label} · ${c.value}`])}/>
        )}

        <div style={{display:"inline-flex", gap: 6, alignItems:"center"}}>
          <span style={{font:"500 11px/1 var(--font-sans)", color:"var(--ink-4)", letterSpacing:"0.06em", textTransform:"uppercase"}}>Öncelik</span>
          <PrioFilter value={prioFilter} onChange={setPrioFilter}/>
        </div>

        <select value={markaFilter} onChange={e => setMarkaFilter(e.target.value)} aria-label="Marka filtresi"
          style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink)", background:"var(--surface)",
            border:"1px solid var(--line)", borderRadius:6, padding:"6px 26px 6px 10px", cursor:"pointer", maxWidth:180}}>
          <option value="all">Tüm markalar</option>
          {markaOpts.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <PersonFilter value={person} onChange={setPerson} people={personOpts}/>

        <div className="bns-hide-mobile" style={{marginLeft:"auto", display:"flex", gap: 8, alignItems:"center"}}>
          <SearchBox value={search} onChange={setSearch}/>
        </div>
      </div>

      {!isCompletedScope && view === "kanban" ? <KanbanView rows={rows} onOpenBrief={onOpenBrief}/> :
       !isCompletedScope && (view === "cards" || view === "list") ? <CardsView rows={rows} onOpenBrief={onOpenBrief}/> :
       <BriefTable rows={rows}
         onRowClick={isCompletedScope ? (onOpenCompleted || onOpenBrief)
           : (b => (b.bitis ? (onOpenCompleted || onOpenBrief) : onOpenBrief)(b))}
         onStatusChange={isCompletedScope ? undefined : onStatusChange}/>}

      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop: 14, font:"400 12px/1 var(--font-sans)", color:"var(--ink-3)", flexWrap:"wrap", gap:8}}>
        <span>{rows.length} satır · son senkron {(() => { const d = new Date(data.NOW); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); })()}</span>
        <span>Slack Canvas <span style={{fontFamily:"var(--font-mono)", color:"var(--ink-4)"}}>F0B1B6XUD44</span></span>
      </div>
    </div>
  );
}

function Segment({ value, onChange, options }) {
  return (
    <div style={{display:"inline-flex", padding:2, border:"1px solid var(--line)", borderRadius:6, flexWrap:"wrap"}}>
      {options.map(([k,v]) => (
        <button key={k} onClick={() => onChange(k)} style={{
          font:`${value===k?600:500} 12px/1 var(--font-sans)`,
          padding:"6px 11px", border:0, cursor:"pointer", borderRadius:4,
          background: value===k ? "var(--paper-2)" : "transparent",
          color: value===k ? "var(--ink)" : "var(--ink-4)",
          transition:"background 120ms cubic-bezier(0.2,0,0,1), color 120ms cubic-bezier(0.2,0,0,1)"
        }}>{v}</button>
      ))}
    </div>
  );
}

function PrioFilter({ value, onChange }) {
  const opts = [
    ["all", null, "tümü"],
    ["over", "var(--prio-red)", "geçmiş"],
    ["red", "var(--prio-red)", "acil"],
    ["org", "var(--prio-orange)", "yüksek"],
    ["ylw", "var(--prio-yellow)", "normal"],
    ["grn", "var(--prio-green)", "düşük"]
  ];
  return (
    <div style={{display:"inline-flex", gap: 4}}>
      {opts.map(([k, c, label]) => (
        <button key={k} onClick={() => onChange(k)} title={label} style={{
          width: 22, height: 22, border:"1px solid " + (value === k ? "var(--ink)" : "var(--line)"),
          borderRadius: 999, background: c || "var(--surface)",
          padding: 0, cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center",
          opacity: value === "all" || value === k ? 1 : 0.4
        }}>
          {k === "all" && <span style={{font:"500 9px/1 var(--font-mono)", color:"var(--ink-3)"}}>×</span>}
        </button>
      ))}
    </div>
  );
}

function SearchBox({ value, onChange }) {
  return (
    <div style={{
      display:"inline-flex", alignItems:"center", gap:6,
      padding:"5px 10px", border:"1px solid var(--line)", borderRadius:6,
      background:"var(--surface)", color:"var(--ink-3)"
    }}>
      <I.Search size={13}/>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Brief, marka, kişi…"
        style={{border:0, outline:"none", background:"transparent", color:"var(--ink)",
          font:"400 12px/1.2 var(--font-sans)", minWidth: 160}}/>
    </div>
  );
}

// ─── KANBAN VIEW ─────────────────────────────────────────────────────────────
function KanbanView({ rows, onOpenBrief }) {
  const cols = [
    { id: "yeni",        label: "Yeni",        Ic: I.Inbox },
    { id: "calisiliyor", label: "İş planında", Ic: I.Pencil },
    { id: "incelemede",  label: "İncelemede",  Ic: I.User },
    { id: "blokeli",     label: "Blokeli",     Ic: I.Warn }
  ];
  return (
    <div className="bns-kanban-grid" style={{display:"grid", gridTemplateColumns: "repeat(4, 220px)", gap: 12, minHeight: 480, overflowX:"auto", WebkitOverflowScrolling:"touch"}}>
      {cols.map(col => {
        const items = rows.filter(b => b.durum === col.id);
        return (
          <div key={col.id} style={{
            background:"var(--surface-sub)", border:"1px solid var(--line)",
            borderRadius: 10, padding: 10, display:"flex", flexDirection:"column", gap: 8,
            minWidth: 0, overflow:"hidden"
          }}>
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"4px 6px 8px"}}>
              <span style={{display:"inline-flex", alignItems:"center", gap:8, font:"600 13px/1 var(--font-sans)", color:"var(--ink-2)"}}>
                <col.Ic size={14}/> {col.label}
              </span>
              <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)", padding:"3px 6px", background:"var(--surface)", borderRadius: 4, border:"1px solid var(--line)"}}>{items.length}</span>
            </div>
            {items.map(b => (
              <button key={b.id} onClick={() => onOpenBrief(b)} style={{
                display:"block", padding: 10,
                background:"var(--surface)", border:"1px solid var(--line)", borderRadius: 8,
                cursor:"pointer", textAlign:"left", color:"var(--ink)",
                width:"100%", boxSizing:"border-box", overflow:"hidden"
              }}>
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap: 6, marginBottom: 8}}>
                  <BrandChip brand={b.brand} size="sm"/>
                  <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)", flexShrink:0}}>#{b.no}</span>
                </div>
                <div style={{
                  font:"500 13px/1.35 var(--font-sans)", color:"var(--ink)",
                  marginBottom: 8, wordBreak:"break-word", overflowWrap:"anywhere", whiteSpace:"normal"
                }}>{b.baslik}</div>
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap: 6, marginTop: 2}}>
                  <span style={{display:"flex", alignItems:"center", gap:6, minWidth:0}}>
                    <PriorityBadge p={b.oncelik || { code: "ylw", label: "NORMAL" }}/>
                    {b.deltaH != null && <span style={{font:"500 11px/1 var(--font-mono)", color:(b.deltaH<=8?"var(--prio-red)":"var(--ink-4)")}}>{formatDelta(b.deltaH)}</span>}
                  </span>
                  <Avatar user={b.lead} size={20}/>
                </div>
              </button>
            ))}
            {items.length === 0 && (
              <div style={{padding: 20, textAlign:"center", color:"var(--ink-4)", font:"400 12px/1.4 var(--font-sans)"}}>
                bu kolonda brief yok.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── CARDS VIEW ─────────────────────────────────────────────────────────────
function CardsView({ rows, onOpenBrief }) {
  const isMobile = typeof useIsMobile === "function" ? useIsMobile() : false;

  // Mobil: kompakt 2-satır özet satırları (tıkla → detay bottom-sheet). Desktop: tam kart.
  if (isMobile) {
    return (
      <div style={{display:"flex", flexDirection:"column", gap: 0, border:"1px solid var(--line)"}}>
        {rows.map((b, i) => (
          <button key={b.id} onClick={() => onOpenBrief(b)} style={{
            display:"flex", flexDirection:"column", gap: 5, padding:"11px 13px",
            background: i % 2 ? "var(--row-stripe)" : "transparent",
            border: 0, borderTop: i ? "1px solid var(--line-soft)" : "none",
            cursor:"pointer", textAlign:"left", color:"var(--ink)", width:"100%",
          }}>
            <div style={{display:"flex", alignItems:"baseline", gap: 8}}>
              <span style={{flex:1, minWidth:0, font:"500 14px/1.25 var(--font-sans)", color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{b.baslik}</span>
              <span style={{flexShrink:0, font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)"}}>#{b.no}</span>
            </div>
            <div style={{display:"flex", alignItems:"center", gap: 10, flexWrap:"wrap"}}>
              <BrandChip brand={b.brand} size="sm"/>
              <StatusPill status={b.durum}/>
              {b.deltaH != null && <span style={{font:"500 11px/1 var(--font-mono)", color:(b.deltaH<=8?"var(--prio-red)":"var(--ink-4)")}}>{formatDelta(b.deltaH)}</span>}
              <span style={{marginLeft:"auto", font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)"}}>{formatDate(b.deadline)}</span>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap: 12}}>
      {rows.map(b => (
        <button key={b.id} onClick={() => onOpenBrief(b)} style={{
          display:"flex", flexDirection:"column", gap: 10, padding: 14,
          background:"var(--surface)", border:"1px solid var(--line)", borderRadius: 10,
          cursor:"pointer", textAlign:"left", color:"var(--ink)"
        }}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
            <BrandChip brand={b.brand} size="sm"/>
            <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)"}}>#{b.no}</span>
          </div>
          <div style={{font:"600 14px/1.3 var(--font-sans)", color:"var(--ink)"}}>{b.baslik}</div>
          <div style={{display:"flex", alignItems:"center", gap: 8}}>
            <PriorityBadge p={b.oncelik || { code: "ylw", label: "NORMAL" }}/>
            {b.deltaH != null && <span style={{font:"500 11px/1 var(--font-mono)", color:(b.deltaH<=8?"var(--prio-red)":"var(--ink-4)")}}>{formatDelta(b.deltaH)}</span>}
            <StatusPill status={b.durum}/>
          </div>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginTop: 2, paddingTop: 8, borderTop:"1px solid var(--line-soft)"}}>
            <span style={{display:"inline-flex", alignItems:"center", gap:6}}>
              <Avatar user={b.lead} size={18}/>
              {b.contributors.length > 0 && <AvatarStack users={b.contributors} max={2} size={16}/>}
            </span>
            <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)"}}>{formatDate(b.deadline)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// Bir brief listesinden benzersiz kişiler (lead + contributors), alfabetik (Türkçe).
// Hem aktif (Jobs) hem tamamlanan (Completed) ekranlarda kişi filtresi için kullanılır.
function peopleOf(rows) {
  const m = new Map();
  for (const b of (rows || [])) {
    for (const p of [b.lead, ...(b.contributors || [])]) {
      if (p && p.id && !m.has(p.id)) m.set(p.id, { id: p.id, name: p.name });
    }
  }
  return [...m.values()].sort((a, b) => (a.name || "").localeCompare(b.name || "", "tr"));
}

// Kişi filtresi dropdown'u — Kanban'daki müşteri filtresiyle aynı stil.
function PersonFilter({ value, onChange, people }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label="Kişi filtresi"
      style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink)", background:"var(--surface)",
        border:"1px solid var(--line)", borderRadius:6, padding:"6px 26px 6px 10px", cursor:"pointer", maxWidth:170}}>
      <option value="all">Tüm kişiler</option>
      {(people || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

window.JobsScreen = JobsScreen;
window.KanbanView = KanbanView;
