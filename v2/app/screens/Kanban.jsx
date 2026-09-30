// app/screens/Kanban.jsx — full kanban with 5 columns (including tamamlandı).

function KanbanScreen({ data, onOpenBrief, onStatusChange }) {
  const isMobile = typeof useIsMobile === "function" ? useIsMobile() : false;
  const [dragId, setDragId] = React.useState(null);          // sürüklenen kart id
  const [dragOverCol, setDragOverCol] = React.useState(null); // üzerine gelinen kolon id
  const [prioFilter, setPrioFilter] = useStickyState("kanban.prio", "all");
  const [markaFilter, setMarkaFilter] = useStickyState("kanban.marka", "all");   // müşteri (marka) filtresi
  const [search, setSearch]         = useStickyState("kanban.search", "");
  const [person, setPerson]         = useStickyState("kanban.person", "all");   // çalışan (lead+contributor) filtresi

  // Müşteri (marka) seçenekleri — aktif + tamamlanan brief'lerden, alfabetik.
  const markaOpts = [...new Set([
    ...(data._allBriefs || data.briefs || []).map(b => b.marka),
    ...(data._allCompleted || data.completed || []).map(c => c.marka),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));

  // Çalışan seçenekleri — aktif + tamamlanan brief'lerdeki lead+contributor'lardan.
  const personOpts = peopleOf([...(data._allBriefs || data.briefs || []), ...(data._allCompleted || data.completed || [])]);
  const onPerson = (b) => person === "all" || [...window.bnsLeadList(b), ...(b.contributors || [])].some(p => p && p.id === person);

  const cols = [
    { id: "yeni",        label: "Yeni",        Ic: I.Inbox,  accent: "var(--ink-3)" },
    { id: "calisiliyor", label: "İş planında", Ic: I.Pencil, accent: "var(--info)" },
    { id: "basladi",     label: "İşe başlandı", Ic: I.Clock,  accent: "var(--ok, #2E8F66)" },
    { id: "incelemede",  label: "İncelemede",  Ic: I.User,   accent: "var(--warning)" },
    { id: "beklemede",   label: "Bekliyor",    Ic: I.Clock,  accent: "var(--ink-3)" },
    { id: "revizyon",    label: "Revizyon",    Ic: I.Pencil, accent: "var(--warning)" },
    { id: "musteride",   label: "✈️ Müşteri Onayında", Ic: I.Clock, accent: "var(--musteride)" },
    { id: "blokeli",     label: "Blokeli",     Ic: I.Warn,   accent: "var(--danger)" },
    { id: "tamamlandi",  label: "Tamamlandı",  Ic: I.Check,  accent: "var(--success)" }
  ];

  // for the Tamamlandı column we use completed[]; map to active brief shape (lightly)
  // Arama filtresi tamamlananlara da uygulanır — slice'tan ÖNCE (yoksa filtre yalnız ilk 12'de arar)
  let allCompleted = data._allCompleted || data.completed || [];
  if (markaFilter !== "all") allCompleted = allCompleted.filter(c => c.marka === markaFilter);
  if (person !== "all") allCompleted = allCompleted.filter(onPerson);
  if (search.trim()) {
    const cq = search.toLowerCase().trim();
    allCompleted = allCompleted.filter(c =>
      (c.baslik||"").toLowerCase().includes(cq) ||
      (c.marka||"").toLowerCase().includes(cq) ||
      window.bnsLeadList(c).some(l => l && (l.name||"").toLowerCase().includes(cq))
    );
  }
  const completedAsBriefs = allCompleted.slice(0, 12).map(c => {
    // Gerçek gecikmeyi veya "zamanında" badge'ini göster
    const gh = c.gecikmeH || 0;
    return {
      id: c.id, no: c.no, marka: c.marka, brand: c.brand, baslik: c.baslik,
      lead: c.lead, contributors: c.contributors || [], reviewer: null,
      durum: "tamamlandi",
      deadline: c.bitis, acilma: c.baslangic,
      deltaH: gh > 0 ? -gh : null,   // null → "zamanında" badge
      priority: gh > 0
        ? { code:"red", label:"GEÇ", color:"var(--prio-red)" }
        : { code:"grn", label:"ZAMANINDA", color:"var(--prio-green)" },
      revision: c.revision
    };
  });

  // Filtrele — viewMode'dan bağımsız tüm brief'ler
  let allBriefs = data._allBriefs || data.briefs;
  if (markaFilter !== "all") allBriefs = allBriefs.filter(b => b.marka === markaFilter);
  if (person !== "all") allBriefs = allBriefs.filter(onPerson);
  if (prioFilter !== "all") allBriefs = allBriefs.filter(b => b.priority && b.priority.code === prioFilter);   // null-guard (Jobs.jsx deseni)
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    allBriefs = allBriefs.filter(b =>
      (b.baslik||"").toLowerCase().includes(q) ||
      (b.marka||"").toLowerCase().includes(q) ||
      window.bnsLeadList(b).some(l => l && (l.name||"").toLowerCase().includes(q))
    );
  }

  // ── KİŞİ-BAZLI DURUM GÖRÜNÜMÜ (v2, 2026-09-29) ──────────────────────────
  // Çok kişili işte biri 🚀 başlattığında işin GENEL durumu 'basladi' olur ve öyle
  // KALIR; ama işi yapan DİĞER kişi kendi başlatana kadar işi kendi kanbanında
  // eski yerinde (İş planında) görür. Kaynak: brief_assignees.calisiyor işareti.
  // Atanan olmayanlar (yönetici vb.) her zaman genel durumu görür.
  const efDurum = (b) => {
    if (b.durum !== "basladi") return b.durum;
    const me = (b.contributors || []).find(c => c && c.id === _kanbanUid);
    if (!me) return b.durum;
    return me.calisiyor ? "basladi" : "calisiliyor";
  };

  // Sürükle-bırak: hedef kolon = yeni durum. Yan etkili kolonlarda (tamamlandi/musteride) onay sor.
  const SIDE_EFFECT = { tamamlandi: "Tamamlandı", musteride: "Müşteri Onayında" };
  const handleDrop = (colId, e) => {
    if (e) e.preventDefault();
    let payload = null;
    try { payload = JSON.parse(e.dataTransfer.getData("text/bns")); } catch (_) {}
    const id = (payload && payload.id != null) ? payload.id : dragId;
    setDragOverCol(null); setDragId(null);
    if (id == null) return;
    const brief = allBriefs.find(b => b.id === id) || completedAsBriefs.find(c => c.id === id);
    if (!brief) return;
    // İş zaten genel 'basladi' ve BEN başlamamışım → durum değişmez, yalnız benim
    // calisiyor işaretim açılır (ben-basladim; tek-aktif-iş kapısından geçer).
    if (colId === "basladi" && brief.durum === "basladi") {
      const me = (brief.contributors || []).find(c => c && c.id === _kanbanUid);
      if (me && !me.calisiyor) { benBasladim(brief); }
      return;
    }
    if (efDurum(brief) === colId || brief.durum === colId) return;   // aynı kolon → işlem yok
    if (SIDE_EFFECT[colId] && !window.confirm(`#${brief.no} işini '${SIDE_EFFECT[colId]}' olarak işaretle?`)) return;
    if (typeof onStatusChange === "function") onStatusChange(brief, colId);
  };

  const benBasladim = (brief, zorla) => {
    const API = window.BNS_API_BASE || "https://benseno-api-production.up.railway.app";
    const tok = (typeof localStorage !== "undefined" && localStorage.getItem("bns_token")) || "";
    fetch(`${API}/api/briefs/${brief.id}/ben-basladim`, {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + tok },
      body: JSON.stringify(zorla ? { zorla: true } : {}),
    }).then(async r => {
      const j = await r.json().catch(() => ({}));
      if (r.status === 409 && j.cakisma) {
        if (window.confirm(`Şu an #${j.cakisma.no} "${j.cakisma.baslik || ""}" üzerinde çalışıyorsun — bu işe başlarsan o beklemeye alınır. Devam?`)) benBasladim(brief, true);
        return;
      }
      if (r.ok && typeof window.bnsRefresh === "function") window.bnsRefresh();
      if (!r.ok && j.error) alert("Başlatılamadı: " + j.error);
    }).catch(() => {});
  };

  // Kolon içi iş-sırası — KİŞİSEL (v2, 2026-09-29; sunucu senkronu 2026-09-30):
  // Ekipteki kimsenin kuyruk sırası (kisi_sira) ve kanban görünümü etkilenmez.
  // Saklama: localStorage ANINDA (çevrimdışı dayanıklı) + user_ayar'a 2sn debounce ile
  // yazılır → cihazdan bağımsız aynı sıra. Açılışta sunucudaki değer local'i günceller;
  // sunucuya erişilemezse localStorage ile aynen çalışır (bozulma yok).
  const _kanbanUid = (() => { try { return (JSON.parse(localStorage.getItem("bns_user") || "null") || {}).slack_id || "anon"; } catch (e) { return "anon"; } })();
  const _kanbanKey = "bns_kanban_kisisel_" + _kanbanUid;
  const [kisiselSira, setKisiselSira] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(_kanbanKey) || "{}"); } catch (e) { return {}; }
  });
  const _ayarTimer = React.useRef(null);
  const _AYAR_API = window.BNS_API_BASE || "https://benseno-api-production.up.railway.app";
  const _ayarTok = () => (typeof localStorage !== "undefined" && localStorage.getItem("bns_token")) || "";
  React.useEffect(() => {   // açılışta sunucudan çek (varsa local'i ezer — en güncel kaynak)
    if (_kanbanUid === "anon") return;
    let iptal = false;
    fetch(`${_AYAR_API}/api/ayar/kanban_sira`, { headers: { Authorization: "Bearer " + _ayarTok() } })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (iptal || !j || !j.deger) return;
        setKisiselSira(j.deger);
        try { localStorage.setItem(_kanbanKey, JSON.stringify(j.deger)); } catch (e) {}
      }).catch(() => {});
    return () => { iptal = true; };
  }, []);
  const reorderKanban = (colId, orderIds) => {
    setKisiselSira(prev => {
      const next = { ...prev, [colId]: orderIds };
      try { localStorage.setItem(_kanbanKey, JSON.stringify(next)); } catch (e) {}
      // Sunucuya debounce'lu yaz (art arda sürüklemede tek istek)
      if (_kanbanUid !== "anon") {
        clearTimeout(_ayarTimer.current);
        _ayarTimer.current = setTimeout(() => {
          fetch(`${_AYAR_API}/api/ayar/kanban_sira`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + _ayarTok() },
            body: JSON.stringify({ deger: next }),
          }).catch(() => {});
        }, 2000);
      }
      return next;
    });
  };

  return (
    <div className="bn-tab-in">
      <PageHead
        title="Kanban"
        subtitle="durum bazlı kolonlar · sürükle-bırak ile statü değiştir · kolon içi sıralaman yalnız SANA özeldir"
        actions={<>
          <select value={markaFilter} onChange={e => setMarkaFilter(e.target.value)} aria-label="Müşteri filtresi"
            style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink)", background:"var(--paper-2)", border:"1px solid var(--line)", borderRadius:6, padding:"7px 28px 7px 10px", cursor:"pointer", maxWidth:180}}>
            <option value="all">Tüm müşteriler</option>
            {markaOpts.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <PersonFilter value={person} onChange={setPerson} people={personOpts}/>
          <PrioFilter value={prioFilter} onChange={setPrioFilter}/>
        </>}
      />

      {/* Arama */}
      <div className="bns-hide-mobile" style={{marginBottom:12}}>
        <div style={{display:"inline-flex", alignItems:"center", gap:6, background:"var(--paper)", border:"1px solid var(--line)", borderRadius:6, padding:"6px 10px", width:240}}>
          <I.Search size={13} style={{color:"var(--ink-4)", flexShrink:0}}/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Brief, marka, kişi…"
            style={{border:0, background:"transparent", font:"500 13px/1 var(--font-sans)", color:"var(--ink)", outline:"none", width:"100%"}}/>
        </div>
      </div>

      {(allBriefs.length + allCompleted.length) === 0 && (
        <div style={{font:"400 13px/1.5 var(--font-sans)", color:"var(--ink-4)", padding:"16px 4px"}}>Bu görünümde iş yok. Filtreyi temizlemeyi ya da İşler'e bakmayı dene.</div>
      )}

      <div className="bns-kanban-grid" style={{
        display:"grid", gridTemplateColumns:`repeat(${cols.length}, 220px)`, gap: 12,
        minHeight: 540, overflowX:"auto", WebkitOverflowScrolling:"touch"
      }}>
        {cols.map(col => {
          let items = col.id === "tamamlandi" ? completedAsBriefs
            : col.id === "incelemede" ? allBriefs.filter(b => { const d = efDurum(b); return d === "incelemede" || d === "kontrole"; })
            : allBriefs.filter(b => efDurum(b) === col.id);
          // İş-yapma sırası: müşteride/blokeli/tamamlandı dışındaki kolonlarda en üstte ilk yapılacak iş.
          // Brief sırası = işi yapanların en küçük kisi_sira'sı (profildeki kuyruk sırası ile aynı kaynak).
          if (!["musteride", "blokeli", "tamamlandi"].includes(col.id)) {
            const rank = (b) => {
              const ks = (b.contributors || []).map(c => (c && c.kisi_sira != null) ? c.kisi_sira : Infinity);
              return ks.length ? Math.min(...ks) : Infinity;
            };
            items = [...items].sort((a, b) => (rank(a) - rank(b)) || ((a.no || 0) - (b.no || 0)));
            // Kişisel sıra varsa onu uygula: listedeki id'ler kişisel dizideki konumuna göre,
            // dizide olmayanlar (yeni işler) mevcut kuyruk düzeniyle SONA eklenir.
            const ks = kisiselSira[col.id];
            if (Array.isArray(ks) && ks.length) {
              const pos = new Map(ks.map((id, i) => [id, i]));
              items = [...items].sort((a, b) => {
                const pa = pos.has(a.id) ? pos.get(a.id) : Infinity;
                const pb = pos.has(b.id) ? pos.get(b.id) : Infinity;
                return pa - pb || 0;
              });
            }
          }
          return (
            <div key={col.id}
              onDragOver={!isMobile ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverCol !== col.id) setDragOverCol(col.id); } : undefined}
              onDragLeave={!isMobile ? (e) => { if (e.currentTarget === e.target) setDragOverCol(c => (c === col.id ? null : c)); } : undefined}
              onDrop={!isMobile ? (e) => handleDrop(col.id, e) : undefined}
              style={{
              background: dragOverCol === col.id ? "var(--ember-tint)" : "transparent",
              border:"1px solid var(--line)",
              outline: dragOverCol === col.id ? "2px dashed var(--ody)" : "none", outlineOffset: -2,
              borderRadius: 0, padding: 10,
              display:"flex", flexDirection:"column", gap: 8,
              minWidth: 0, overflow:"hidden", transition:"background 120ms"
            }}>
              <div style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"4px 6px 10px", borderBottom:"1px solid var(--line)", marginBottom: 4
              }}>
                <span style={{display:"inline-flex", alignItems:"center", gap:8, font:"600 13px/1 var(--font-sans)", color:"var(--ink-2)"}}>
                  <span style={{width:8, height:8, borderRadius:999, background: col.accent}}/>
                  <col.Ic size={13}/> {col.label}
                </span>
                <span style={{
                  font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)",
                  padding:"3px 6px", background:"var(--paper)", borderRadius: 4, border:"1px solid var(--line)"
                }}>{items.length}</span>
              </div>
              <div style={{display:"flex", flexDirection:"column", gap: 8, flex:1, overflowY:"auto", overflowX:"hidden", maxHeight: "60vh", minWidth:0}}>
                {items.map(b => {
                  // Aynı kolondaki başka kartın üstüne bırakınca sıralama (yalnız iş-sırası kolonlarında).
                  const orderable = !["musteride", "blokeli", "tamamlandi"].includes(col.id);
                  const sameCol = (id) => items.some(x => x.id === id);
                  return <KanbanCard key={b.id} brief={b} onClick={() => onOpenBrief(b)}
                  draggable={!isMobile}
                  dragging={dragId === b.id}
                  onDragStartCard={(e) => { try { e.dataTransfer.setData("text/bns", JSON.stringify({ id: b.id, from: b.durum })); } catch (_) {} e.dataTransfer.effectAllowed = "move"; setDragId(b.id); }}
                  onDragEndCard={() => { setDragId(null); setDragOverCol(null); }}
                  onDragOverCard={(orderable && !isMobile) ? (e) => { if (dragId != null && sameCol(dragId)) { e.preventDefault(); e.stopPropagation(); } } : undefined}
                  onDropCard={(orderable && !isMobile) ? (e) => {
                    if (dragId == null || !sameCol(dragId)) return;   // farklı kolon → kolona bubble (statü değişir)
                    e.preventDefault(); e.stopPropagation();
                    if (dragId !== b.id) {
                      const ids = items.map(x => x.id).filter(id => id !== dragId);
                      const ti = ids.indexOf(b.id);
                      ids.splice(ti < 0 ? ids.length : ti, 0, dragId);
                      reorderKanban(col.id, ids);
                    }
                    setDragId(null); setDragOverCol(null);
                  } : undefined}
                />;
                })}
                {items.length === 0 && (
                  <div style={{padding: 20, textAlign:"center", color:"var(--ink-4)", font:"400 12px/1.4 var(--font-sans)"}}>
                    boş.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ brief, onClick, draggable, dragging, onDragStartCard, onDragEndCard, onDragOverCard, onDropCard }) {
  return (
    <button onClick={onClick}
      draggable={draggable || undefined}
      onDragStart={draggable ? onDragStartCard : undefined}
      onDragEnd={draggable ? onDragEndCard : undefined}
      onDragOver={onDragOverCard}
      onDrop={onDropCard}
      style={{
      display:"flex", flexDirection:"column", gap: 6, padding: "10px 10px 8px",
      background:"var(--paper)", border:"1px solid var(--line)", borderRadius: 0,
      cursor: draggable ? "grab" : "pointer", textAlign:"left", color:"var(--ink)",
      width:"100%", minWidth:0, boxSizing:"border-box",
      opacity: dragging ? 0.4 : 1, transition:"opacity 120ms"
    }}>
      {/* Üst satır: marka chip + numara */}
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:4, minWidth:0}}>
        <div style={{minWidth:0, overflow:"hidden", flex:1}}>
          <BrandChip brand={brief.brand} size="sm"/>
        </div>
        <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)", flexShrink:0, display:"inline-flex", alignItems:"center"}}>{typeof bnsFazEtiket === "function" ? bnsFazEtiket(brief) : "#" + brief.no}<NotifDot n={((window.BNS_NOTIF && window.BNS_NOTIF.briefs) || {})[brief.id]} briefId={brief.id}/></span>
      </div>
      {/* İş adı — 2 satıra kadar */}
      <div style={{
        font:"500 13px/1.4 var(--font-sans)", color:"var(--ink)",
        display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical",
        overflow:"hidden", wordBreak:"break-word"
      }}>{brief.baslik || "—"}</div>
      {/* Alt satır: öncelik + avatarlar */}
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:4, marginTop:2}}>
        <span style={{display:"flex", alignItems:"center", gap:6, minWidth:0}}>
          <PriorityBadge p={brief.oncelik || { code: "ylw", label: "NORMAL" }}/>
          {brief.deltaH != null && <span style={{font:"500 10px/1 var(--font-mono)", color:(brief.deltaH<=8?"var(--prio-red)":"var(--ink-4)")}}>{formatDelta(brief.deltaH)}</span>}
        </span>
        <span style={{display:"inline-flex", flexShrink:0}}>
          <Avatar user={brief.lead} size={18}/>
          {brief.contributors && brief.contributors.length > 0 &&
            <span style={{marginLeft:-5}}><AvatarStack users={brief.contributors} max={2} size={16}/></span>}
        </span>
      </div>
    </button>
  );
}

window.KanbanScreen = KanbanScreen;
window.KanbanCard = KanbanCard;
