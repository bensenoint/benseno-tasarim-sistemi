// app/screens/Profile.jsx — Kişisel performans dashboardı v2
// Aktif işler · tamamlanan · revize · saat · marka · iş tipi · verilen/alınan görevler

function ProfileScreen({ data, user, onOpenBrief, onOpenCompleted, currentUser, initialSel }) {
  const isMobile = typeof useIsMobile === "function" ? useIsMobile() : false;
  const [selectedUser, setSelectedUser] = React.useState(user);
  // Avatar tıklamasından gelen kişi (window.bnsOpenUser → App.jsx initialSel) — t damgası her tıklamada değişir
  React.useEffect(() => {
    if (!initialSel || !initialSel.id) return;
    // önce güncel USERS'ta ara; bulunamazsa tıklamayla gelen nesneye düş (asla eski kişide takılı kalma)
    const found = (data.USERS || []).find(x => x.id === initialSel.id) || initialSel.user || null;
    if (found) setSelectedUser(found);
  }, [initialSel ? initialSel.t : null, initialSel ? initialSel.id : null]);
  const [jobView, setJobView] = useStickyState("profile.jobView", "aktif");   // ana iş tablosu görünümü (dropdown)
  const [markaSel, setMarkaSel] = useStickyState("profile.marka", "all");     // ana iş tablosu marka filtresi
  const [tomorrowOnly, setTomorrowOnly] = useStickyState("profile.tomorrow", false);   // "Yarın" filtresi: deadline'ı yarın olan işler
  const allBriefs    = data._allBriefs    || data.briefs    || [];
  // Tarih aralığı GLOBAL başlık filtresinden gelir — data.completed App.jsx'te bitiş tarihine göre süzülür.
  // (Eski yerel 7/30/90 toggle'ı kaldırıldı; tek tarih kontrolü = global başlık. Çift-filtre yok.)
  const allCompleted = data.completed || data._allCompleted || [];
  // Çıktı hızı (throughput) kendi 4-haftalık penceresini kullanır → tarih aralığından BAĞIMSIZ ham veri.
  const allCompletedRaw = data._allCompleted || data.completed || [];
  const allUsers     = data.USERS || [];
  const drLabel = rangeLabelOf(data.dateRange);

  // Gösterilecek kullanıcıyı her zaman data.USERS'tan id ile TAM kayda eşle — Department'tan
  // gelen kısmi obje (avatar/rol/kapasite eksik) ilk render'da %100/fotosuz görünmesin.
  const u = (data.USERS || []).find(x => x.id === (selectedUser && selectedUser.id)) || selectedUser;

  // ─── Aktif brief'ler (bu kişiyle ilişkili)
  const isRelated = (b, uid) =>
    (b.lead && b.lead.id === uid) ||
    (Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === uid)) ||
    (b.reviewer && b.reviewer.id === uid);

  // Müşteri onayındaki işler aktif yük/kapasite SAYILMAZ — ayrı KPI kartında gösterilir
  const myAll        = allBriefs.filter(b => isRelated(b, u.id));
  const myMusteride  = myAll.filter(b => b.durum === "musteride");
  const myActive     = myAll.filter(b => b.durum !== "musteride");
  const asLead       = allBriefs.filter(b => b.lead && b.lead.id === u.id);
  const asContrib    = allBriefs.filter(b => Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === u.id));
  const asReviewer   = allBriefs.filter(b => b.reviewer && b.reviewer.id === u.id);
  const overdue      = myActive.filter(b => b.deltaH <= 0);
  const urgent       = myActive.filter(b => b.deltaH > 0 && b.deltaH <= 24);

  // ─── Tamamlanan (global tarih aralığında — data.completed zaten süzülü)
  const myCompleted  = allCompleted.filter(b =>
    (b.lead && b.lead.id === u.id) ||
    (Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === u.id))
  );
  const completedAsLead   = myCompleted.filter(b => b.lead && b.lead.id === u.id);
  const completedAsContrib= myCompleted.filter(b => Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === u.id));

  // ─── Revize istatistikleri
  // revision sayısı: tüm ilişkili briflerdeki rev değerleri
  const totalRevActive    = myActive.reduce((s, b) => s + (parseInt(b.revision)||0), 0);
  const totalRevCompleted = myCompleted.reduce((s, b) => s + (parseInt(b.revision)||0), 0);
  const totalRev          = totalRevActive + totalRevCompleted;
  const avgRev            = myCompleted.length > 0 ? (totalRevCompleted / myCompleted.length).toFixed(1) : "—";

  // ─── Saat hesabı (tamamlananlardan)
  const hoursArr = myCompleted.map(b => b.sureH || 0).filter(h => h > 0);
  const totalHours = hoursArr.reduce((s, h) => s + h, 0);
  const avgHours   = hoursArr.length > 0 ? (totalHours / hoursArr.length).toFixed(1) : "—";

  // ─── Marka dağılımı
  const brandCount = {};
  [...myActive, ...myCompleted].forEach(b => {
    brandCount[b.marka] = (brandCount[b.marka] || 0) + 1;
  });
  const topBrands = Object.entries(brandCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, v]) => ({
      name, v,
      color: (data.BRANDS || []).find(b => b.name === name)?.color || "#888"
    }));

  // ─── İş tipi / içerik analizi (baslik'ten keyword çıkar)
  const IS_TYPES = [
    { key: "sosyal medya", label: "Sosyal Medya", keys: ["sosyal", "sm ", "instagram", "story", "post", "reels"] },
    { key: "video",        label: "Video",        keys: ["video", "reel", "film", "klip"] },
    { key: "banner",       label: "Banner/Dijital",keys: ["banner", "dijital", "display", "web"] },
    { key: "brosur",       label: "Bröşür/Baskı", keys: ["bröşür", "broşür", "katalog", "baskı", "davetiye", "afiş"] },
    { key: "paket",        label: "Paket/Batch",  keys: ["batch", "paket", "x7", "x5", "x3", "x6"] },
    { key: "sunum",        label: "Sunum/Deck",   keys: ["sunum", "deck", "ppt", "slide", "rapor"] },
    { key: "logo",         label: "Logo/Kimlik",  keys: ["logo", "kimlik", "marka", "identity"] },
    { key: "diger",        label: "Diğer",        keys: [] }
  ];

  const allMyBriefs = [...myActive, ...myCompleted];
  const typeCount = {};
  IS_TYPES.forEach(t => { typeCount[t.key] = 0; });
  allMyBriefs.forEach(b => {
    const title = ((b.baslik || b.is || "") + " " + (b.marka || "")).toLowerCase();
    let matched = false;
    for (const t of IS_TYPES.slice(0,-1)) {
      if (t.keys.some(k => title.includes(k))) {
        typeCount[t.key]++;
        matched = true;
        break;
      }
    }
    if (!matched) typeCount["diger"]++;
  });
  const typeData = IS_TYPES
    .map(t => ({ label: t.label, v: typeCount[t.key] }))
    .filter(t => t.v > 0)
    .sort((a, b) => b.v - a.v);

  // ─── Verdiğim işler (bu kişi başka birine iş atamışsa — atanan_ids ikinci kişi)
  // "Verdiğim" = bu kişi lead, başka biri contributor
  const delegated = myActive.filter(b =>
    b.lead && b.lead.id === u.id &&
    Array.isArray(b.contributors) && b.contributors.length > 0
  );

  // ─── Aldığım işler (başkası lead, bu kişi contributor)
  const assigned = myActive.filter(b =>
    b.lead && b.lead.id !== u.id &&
    Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === u.id)
  );

  // ─── Gözlemci olduğum aktif işler
  const asObserver = allBriefs.filter(b =>
    b.durum !== "musteride" &&
    Array.isArray(b.observers) && b.observers.some(o => o && o.id === u.id)
  );

  // ─── Ana iş tablosu görünümleri (dropdown). "tamamlanan" zaman aralığına (hero'daki toggle) tabi.
  const JOB_VIEWS = [
    { key: "aktif",      label: "Aktif işler",                rows: myActive,                                   note: "müşteride hariç aktif yük" },
    { key: "lead",       label: "Lead olduğum işler",         rows: asLead.filter(b => b.durum !== "musteride"), note: "lead olduğum aktif işler" },
    { key: "aldigim",    label: "Aldığım / yapacağım işler",  rows: asContrib.filter(b => b.durum !== "musteride"), note: "işi yapan olarak seçildiğim işler (lead ben olsam da)" },
    { key: "gozlemci",   label: "Gözlemci olduğum işler",     rows: asObserver,                                 note: "izlediğim işler" },
    { key: "tamamlanan", label: "Tamamlanan işler",           rows: myCompleted, completed: true,               note: "seçili aralıkta tamamlananlar" },
  ];
  const curView = JOB_VIEWS.find(v => v.key === jobView) || JOB_VIEWS[0];
  // Tamamlananlar BriefTable için güvenli default'larla normalize edilir (priority/deltaH alanları yok).
  const tableRows = curView.completed
    ? curView.rows.map(b => ({ ...b, durum: "tamamlandi",
        priority: b.priority || { code: "grn", label: "—" },
        oncelik: b.oncelik || { code: "ylw", label: "NORMAL" },
        deltaH: (b.deltaH != null ? b.deltaH : null) }))
    : curView.rows;

  // Marka filtresi — seçenekler aktif görünümün işlerinden; seçili marka görünümde yoksa "tümü" gibi davran
  const viewBrands = [...new Set(tableRows.map(b => b.marka).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  const markaActive = markaSel !== "all" && viewBrands.includes(markaSel);
  const markaRows = markaActive ? tableRows.filter(b => b.marka === markaSel) : tableRows;
  // "Yarın" (devam edecek): deadline'ı yarın 00:00 ve sonrası olan işler. Gecikmiş (bugün
  // bitecek varsayılır) ve bugün teslim edilecekler hariç. Tamamlanan görünümünde uygulanmaz.
  const _nowY = (window.BNS_DATA && window.BNS_DATA.NOW) || Date.now();
  const _dY = new Date(_nowY);
  const _startTomY = new Date(_dY.getFullYear(), _dY.getMonth(), _dY.getDate() + 1).getTime();
  const _dlMsY = b => { const d = b.deadline; if (typeof d !== "number") return null; return d < 1e10 ? d * 1000 : d; };
  const _continuesTomorrow = b => { const m = _dlMsY(b); return m != null && m >= _startTomY; };
  const displayRows = (tomorrowOnly && !curView.completed)
    ? markaRows.filter(_continuesTomorrow)
    : markaRows;

  // ─── Durum dağılımı
  const durumMap = {};
  myActive.forEach(b => {
    const d = b.durum || "belirsiz";
    durumMap[d] = (durumMap[d] || 0) + 1;
  });

  // ─── Kapasite — TEK DOĞRULUK KAYNAĞI (data.js bnsPersonCap*) ile hesaplanır.
  //     Departman ekranındaki kişi doluluğu da aynı helper'ı kullanır → tutarlı.
  const CAP_LIMIT = bnsPersonCapLimit(u);
  const capPct    = bnsPersonCapPct(u, myActive.length);

  // ─── Çıktı hızı (son 4 hafta tamamlanan/hafta) — calc.js bnsThroughput, düşük örneklemde uyarır.
  //     Zaman filtresinden BAĞIMSIZ: kendi 4 haftalık penceresini kullanır.
  const nowMsTP = (window.BNS_DATA && window.BNS_DATA.NOW) || Date.now();
  const myDoneTs = allCompletedRaw
    .filter(b => (b.lead && b.lead.id === u.id) || (Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === u.id)))
    .map(b => (b.bitis || 0) * (b.bitis && b.bitis < 1e10 ? 1000 : 1))
    .filter(Boolean);
  const tp = (typeof bnsThroughput === "function") ? bnsThroughput(myDoneTs, nowMsTP, 4) : { perWeek: 0, count: 0, lowSample: true };

  // "Çıktı hızı" ve "Toplam saat" yalnız Görkem'e görünür (yöneticiler dahil diğerlerine kapalı).
  const isGorkem = !!currentUser && (currentUser.slack_id === 'U030C48PL23' || currentUser.id === 'U030C48PL23' || /görkem/i.test(currentUser.name || ''));

  const roleLabel = { yonetici:"Yönetici", tasarim:"Tasarım", editor:"Editör", ai:"AI Operatör" }[u.rol] || u.rol;

  // Dönemsel özet yalnız yöneticilere görünür (giriş yapan kullanıcıya göre).
  const meRec = (data.USERS || []).find(x => x.id === (currentUser && (currentUser.slack_id || currentUser.id)));
  const isManager = !!((currentUser && currentUser.role === "admin") || (meRec && meRec.rol === "yonetici"));

  // ─── Performans özeti — üstte seçili GLOBAL tarih aralığına göre (data.completed zaten süzülü) ───
  const perfRangeLabel = drLabel;
  const perfDone = allCompleted.filter(b =>
    (b.lead && b.lead.id === u.id) ||
    (Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === u.id))
  );
  const perfN = perfDone.length;
  const perfBrands = {};
  perfDone.forEach(b => { if (b.marka) perfBrands[b.marka] = (perfBrands[b.marka] || 0) + 1; });
  const perfBrandList = Object.entries(perfBrands).sort((a, b) => b[1] - a[1]);
  const perfRevTotal = perfDone.reduce((s, b) => s + (parseInt(b.revision) || 0), 0);
  const perfAvgRev = perfN ? (perfRevTotal / perfN).toFixed(1) : "—";
  const perfSureArr = perfDone.map(b => b.sureH || 0).filter(h => h > 0);
  const perfHours = perfSureArr.reduce((s, v) => s + v, 0);
  const perfAvgSure = perfSureArr.length ? (perfHours / perfSureArr.length).toFixed(1) : "—";
  const perfLead = perfDone.filter(b => b.lead && b.lead.id === u.id).length;
  const perfContrib = perfN - perfLead;
  const perfOnTime = perfDone.filter(b => (b.gecikmeH || 0) <= 0).length;
  const perfLate = perfN - perfOnTime;
  const perfOnTimePct = perfN ? Math.round(perfOnTime / perfN * 100) : null;
  const perfRatingArr = perfDone.filter(b => b.rating > 0).map(b => b.rating);
  const perfAvgRating = perfRatingArr.length ? (perfRatingArr.reduce((s, v) => s + v, 0) / perfRatingArr.length).toFixed(1) : "—";
  const perfRows = [
    ["Toplam tamamlanan iş", String(perfN)],
    ["Lead / Katkı", `${perfLead} / ${perfContrib}`],
    ["Teslim edilen iş", String(perfN)],
    ["Zamanında teslim", perfOnTimePct != null ? `${perfOnTime} · %${perfOnTimePct}` : "—"],
    ["Gecikmeli teslim", String(perfLate)],
    ["Toplam revize", String(perfRevTotal)],
    ["Ort. revize / iş", perfAvgRev],
    ["Ort. tamamlama süresi", perfAvgSure !== "—" ? perfAvgSure + " sa" : "—"],
    ["Toplam çalışma süresi", perfHours > 0 ? perfHours.toFixed(0) + " sa" : "—"],
    ["Çalışılan marka", String(perfBrandList.length)],
    ["Ort. puan", perfAvgRating !== "—" ? perfAvgRating + " ★" : "—"],
  ];
  const brandColorOf = (name) => (data.BRANDS || []).find(b => b.name === name)?.color
    || (data.BR && data.BR[name] && data.BR[name].color)
    || (perfDone.find(b => b.marka === name && b.brand && b.brand.color)?.brand.color)
    || "var(--ink-4)";

  return (
    <div className="bn-tab-in">

      {/* ─── Kullanıcı seçici + hero ──────────────────────────── */}
      <div style={{display:"flex", alignItems:"center", gap: isMobile ? 12 : 20, padding: isMobile ? "4px 0 2px" : "20px 0 4px", flexWrap:"wrap"}}>
        {!isMobile && <Avatar user={u} size={64}/>}
        <div style={{flex: isMobile ? "1 1 100%" : 1, minWidth: isMobile ? 0 : 200}}>
          {!isMobile && <Eyebrow>{roleLabel}</Eyebrow>}
          <h1 style={{font:`italic 500 ${isMobile ? 20 : 30}px/1.05 var(--font-display)`, color:"var(--ink)", margin: isMobile ? 0 : "5px 0 0", letterSpacing:"0"}}>{u.name}</h1>
          <div style={{fontFamily:"var(--font-display)", fontStyle:"italic", fontSize: isMobile ? 13 : 17, color:"var(--ink-3)", marginTop: isMobile ? 2 : 6}}>
            {myActive.length} aktif{myMusteride.length > 0 ? ` · ${myMusteride.length} müşteride` : ""} · {myCompleted.length} tamamlandı · {totalRev} toplam revize
          </div>
          {/* ⭐ Kişi yıldız puanı + gün-sonu sebep açıklaması — sadece yöneticiler görür */}
          {(() => {
            if (currentUser?.role !== 'admin') return null;
            const R = window.BNS_DATA && window.BNS_DATA.ratings;
            const my = R && R.users && R.users[u.id];
            if (!my || !my.cnt) return null;
            const why = typeof window.bnsSebep === "function" ? window.bnsSebep("kisi", u.id) : null;
            return (
              <div style={{marginTop:8}}>
                <div style={{display:"flex", alignItems:"center", gap:8}}>
                  <span style={{display:"inline-flex", gap:1}}>
                    {[1,2,3,4,5].map(i => <I.StarFill key={i} size={13} color={i <= Math.round(my.avg) ? "var(--prio-yellow)" : "var(--line-strong)"}/>)}
                  </span>
                  <span style={{font:"600 14px/1 var(--font-mono)", color:"var(--ink)"}}>{my.avg}</span>
                  <span style={{font:"400 11px/1 var(--font-sans)", color:"var(--ink-4)"}}>({my.cnt} puanlı iş)</span>
                </div>
                {why && <div style={{marginTop:8}}><MobileAccordion title="Değerlendirme"><div style={{font:"400 12px/1.5 var(--font-sans)", color:"var(--ink-3)", maxWidth:520}}><Linkify text={why.sebep}/></div></MobileAccordion></div>}
              </div>
            );
          })()}
        </div>

        {/* Tarih aralığı — global başlık filtresinden (yerel toggle kaldırıldı) */}
        <div style={{display:"flex", flexDirection:"column", alignItems: isMobile ? "flex-start" : "flex-end", gap:4}}>
          <span style={{font:"600 10px/1 var(--font-sans)", letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--ink-3)", padding:"5px 10px", border:"1px solid var(--line)", borderRadius:999}}>📅 {drLabel}</span>
          <div style={{font:"400 10px/1 var(--font-sans)", color:"var(--ink-4)"}}>tamamlanan · üstteki global filtreden ayarla</div>
        </div>

        {/* Kullanıcı değiştir — sadece admin görür; departmana göre gruplu dropdown */}
        {currentUser?.role === 'admin' && (() => {
          const DEPT_LABEL = { tasarim: "Tasarım", editor: "Editör", ai: "AI", freelance: "Freelance" };
          const ORDER = ["tasarim", "editor", "ai", "freelance", "_other"];
          const grouped = {};
          for (const usr of allUsers) {
            const d = ["tasarim","editor","ai","freelance"].includes(usr.dept) ? usr.dept : "_other";
            (grouped[d] = grouped[d] || []).push(usr);
          }
          Object.values(grouped).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name, "tr")));
          return (
            <div style={{display:"flex", alignItems:"center", gap:8}}>
              <select value={u.id} onChange={e => {
                const nu = allUsers.find(x => x.id === e.target.value);
                if (nu) setSelectedUser(nu);
              }} style={{
                padding:"7px 10px", border:"1px solid var(--line)", borderRadius:6,
                background:"var(--surface)", color:"var(--ink)",
                font:"500 13px/1.2 var(--font-sans)", cursor:"pointer", outline:"none", minWidth:200,
              }}>
                {ORDER.map(d => {
                  const us = grouped[d];
                  if (!us || !us.length) return null;
                  return (
                    <optgroup key={d} label={DEPT_LABEL[d] || "Diğer"}>
                      {us.map(usr => <option key={usr.id} value={usr.id}>{usr.name}</option>)}
                    </optgroup>
                  );
                })}
              </select>
            </div>
          );
        })()}
      </div>

      <div style={{height:16}}/>

      {/* ─── KPI şeridi ──────────────────────────────────────── */}
      <div className="bns-kpi-8" style={{display:"grid", gridAutoFlow:"column", gridAutoColumns:"minmax(0,1fr)", gap:"var(--grid-gap)", marginBottom:"var(--section-gap)", overflowX:"auto"}}>
        <Kpi label="Aktif iş"      value={myActive.length} color={myActive.length > CAP_LIMIT ? "var(--prio-red)" : undefined}/>
        <Kpi label="Müşteride"     value={myMusteride.length} color={myMusteride.length > 0 ? "var(--musteride)" : undefined} sub="✈️ dönüş bekleniyor"/>
        <Kpi label="Tamamlanan"    value={myCompleted.length} sub="kayıtlı"/>
        {isGorkem && <Kpi label="Çıktı hızı"    value={tp.lowSample ? "—" : tp.perWeek + "/hf"} sub={tp.lowSample ? `${tp.count} iş/4hf · veri ince` : `son 4 hafta · ${tp.count} iş`}/>}
        <Kpi label="Toplam revize" value={totalRev} sub={`ort. ${avgRev}/iş`}/>
        {isGorkem && <Kpi label="Toplam saat"   value={totalHours > 0 ? totalHours.toFixed(0)+"sa" : "—"} sub={`ort. ${avgHours}sa/iş`}/>}
        <Kpi label="Lead olarak"   value={asLead.length} sub="açtığım"/>
        <Kpi label="Contributor"   value={asContrib.length} sub="atandığım"/>
        <Kpi label="Kapasite"      value={capPct+"%"} color={capPct>=100?"var(--prio-red)":capPct>=75?"var(--prio-orange)":undefined}/>
        <Kpi label="Marka"         value={Object.keys(brandCount).length} sub="farklı"/>
      </div>

      {/* ─── İşlerim — tam genişlik tek tablo + dropdown görünüm seçici ─── */}
      <Card padding={0} style={{minWidth:0, marginBottom:"var(--grid-gap)"}}>
        <div style={{padding:"13px 16px", borderBottom:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap"}}>
          <div style={{display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", flex: isMobile ? "1 1 100%" : undefined, width: isMobile ? "100%" : undefined}}>
            <select value={jobView} onChange={e => setJobView(e.target.value)} aria-label="İş görünümü"
              style={{font:`600 13px/1 var(--font-sans)`, color:"var(--ink)", background:"var(--paper-2)", border:"1px solid var(--line)", borderRadius:6, padding:"7px 28px 7px 10px", cursor:"pointer", flex: isMobile ? "1 1 0" : undefined, minWidth: isMobile ? 0 : undefined}}>
              {JOB_VIEWS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
            </select>
            <select value={markaActive ? markaSel : "all"} onChange={e => setMarkaSel(e.target.value)} aria-label="Marka filtresi"
              style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink)", background:"var(--paper-2)", border:"1px solid var(--line)", borderRadius:6, padding:"7px 28px 7px 10px", cursor:"pointer", flex: isMobile ? "1 1 0" : undefined, minWidth: isMobile ? 0 : undefined}}>
              <option value="all">Tüm markalar</option>
              {viewBrands.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={() => setTomorrowOnly(v => !v)} title="Yarın teslim edilecek / devam edecek işler"
              style={{font:"600 13px/1 var(--font-sans)", borderRadius:6, padding:"7px 12px", cursor:"pointer",
                border:"1px solid " + (tomorrowOnly ? "var(--ember)" : "var(--line)"),
                background: tomorrowOnly ? "var(--ember-tint)" : "var(--paper-2)",
                color: tomorrowOnly ? "var(--ember)" : "var(--ink-3)", flex: isMobile ? "1 1 0" : undefined, minWidth: isMobile ? 0 : undefined}}>
              🌅 Yarın
            </button>
            <div style={{font:"400 11px/1.3 var(--font-sans)", color:"var(--ink-4)"}}>
              {curView.completed && (overdue.length || urgent.length) ? "" : (overdue.length > 0 && jobView==="aktif" && !markaActive && <span style={{color:"var(--prio-red)", fontWeight:600}}>{overdue.length} gecikmiş · </span>)}
              toplam {displayRows.length}{markaActive ? ` · ${markaSel}` : ""} · {curView.note}
            </div>
          </div>
          <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
            <span style={{font:"500 10px/1 var(--font-mono)", padding:"3px 7px", borderRadius:4, background:"var(--paper-2)", color:"var(--ink-4)"}}>lead: {asLead.length}</span>
            <span style={{font:"500 10px/1 var(--font-mono)", padding:"3px 7px", borderRadius:4, background:"var(--paper-2)", color:"var(--ink-4)"}}>contrib: {asContrib.length}</span>
            {asObserver.length > 0 && <span style={{font:"500 10px/1 var(--font-mono)", padding:"3px 7px", borderRadius:4, background:"var(--paper-2)", color:"var(--ink-4)"}}>gözlemci: {asObserver.length}</span>}
            {curView.completed && <span style={{font:"500 10px/1 var(--font-mono)", padding:"3px 7px", borderRadius:4, background:"var(--paper-2)", color:"var(--ink-4)"}}>aralık: {drLabel}</span>}
          </div>
        </div>
        {displayRows.length > 0
          ? <BriefTable rows={displayRows} onRowClick={curView.completed && onOpenCompleted ? onOpenCompleted : onOpenBrief}/>
          : <div style={{padding:32, textAlign:"center", color:"var(--ink-4)", font:"400 13px/1.4 var(--font-sans)"}}>{markaActive ? `${markaSel} markasında bu görünümde iş yok.` : "Bu görünümde iş yok."}</div>
        }
      </Card>

      {/* ─── İş tipi analizi + Tamamlananlar ────────────────── */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1.8fr", gap:"var(--grid-gap)", marginBottom:"var(--grid-gap)"}} className="bn-grid-2">

        {/* İş tipi */}
        <Card>
          <CardHead title="İş tipi dağılımı" sub={`aktif + ${drLabel} · anahtar kelimeden`}/>
          {typeData.length > 0 ? (
            <div style={{marginTop:8}}>
              {typeData.map((t,i) => {
                const maxV = typeData[0].v;
                return (
                  <div key={t.label} style={{marginBottom: i<typeData.length-1?10:0}}>
                    <div style={{display:"flex", justifyContent:"space-between", marginBottom:4}}>
                      <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink-2)"}}>{t.label}</span>
                      <span style={{font:"600 12px/1 var(--font-mono)", color:"var(--ink-3)"}}>{t.v}</span>
                    </div>
                    <div style={{height:5, background:"var(--line-soft)", borderRadius:999, overflow:"hidden"}}>
                      <div style={{
                        width:"100%", height:"100%",
                        background: "var(--ember)", opacity: 0.65 + (i===0?0.35:0),
                        borderRadius:999,
                        transform:`scaleX(${Math.round((t.v/maxV)*100)/100})`, transformOrigin:"left",
                        transition:"transform 400ms cubic-bezier(0.2,0,0,1)"
                      }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{font:"400 12px/1 var(--font-sans)", color:"var(--ink-4)", marginTop:8}}>Henüz veri yok</div>
          )}

          {/* Revize özeti */}
          {totalRev > 0 && (
            <div style={{marginTop:16, paddingTop:14, borderTop:"1px solid var(--line)"}}>
              <Eyebrow style={{marginBottom:8}}>Revize Özeti</Eyebrow>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
                <StatBox label="Toplam revize" value={totalRev}/>
                <StatBox label="Ort. revize/iş" value={avgRev}/>
                <StatBox label="Tamamlanan rev." value={totalRevCompleted}/>
                <StatBox label="Aktif iş rev." value={totalRevActive}/>
              </div>
            </div>
          )}
        </Card>

        {/* Tamamlanan işler */}
        <Card padding={0}>
          <div style={{padding:"13px 16px", borderBottom:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <div>
              <h2 style={{font:"italic 500 18px/1.15 var(--font-display)", color:"var(--ink)", margin:0, letterSpacing:"0"}}>Tamamlanan işler</h2>
              <div style={{font:"400 11px/1.3 var(--font-sans)", color:"var(--ink-4)", marginTop:3}}>
                {myCompleted.length} iş · {totalHours > 0 ? totalHours.toFixed(0)+"sa toplam" : "süre kaydı yok"}
              </div>
            </div>
            <div style={{display:"flex", gap:6}}>
              <span style={{font:"500 10px/1 var(--font-mono)", padding:"3px 7px", borderRadius:4, background:"var(--paper-2)", color:"var(--ink-4)"}}>lead: {completedAsLead.length}</span>
              <span style={{font:"500 10px/1 var(--font-mono)", padding:"3px 7px", borderRadius:4, background:"var(--paper-2)", color:"var(--ink-4)"}}>contrib: {completedAsContrib.length}</span>
            </div>
          </div>
          {myCompleted.length > 0 ? (
            <div style={{overflowX:"auto", WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%", minWidth:480, borderCollapse:"collapse", font:"400 12px/1.3 var(--font-sans)"}}>
                <thead>
                  <tr style={{background:"var(--paper-2)"}}>
                    {["Marka","İş","Rol","Revize","Süre","Gecikme"].map(h => (
                      <th key={h} style={{padding:"7px 12px", textAlign:"left", font:"600 10px/1 var(--font-sans)", color:"var(--ink-4)", letterSpacing:"0.06em", textTransform:"uppercase", whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myCompleted.slice(0,12).map((b,i) => {
                    const isLead = b.lead && b.lead.id === u.id;
                    return (
                      <tr key={b.id} style={{borderTop:"1px solid var(--line-soft)", cursor:"pointer"}}
                        title="İşin detayını aç"
                        onMouseEnter={e=>e.currentTarget.style.background="var(--surface-sub)"}
                        onMouseLeave={e=>e.currentTarget.style.background=""}
                        onClick={() => onOpenCompleted ? onOpenCompleted(b) : (onOpenBrief && onOpenBrief(b))}>
                        <td style={{padding:"8px 12px", whiteSpace:"nowrap"}}>
                          <div style={{display:"flex", alignItems:"center", gap:6}}>
                            <span style={{width:7,height:7,borderRadius:999,background:(data.BRANDS||[]).find(br=>br.name===b.marka)?.color||"#888",flexShrink:0}}/>
                            <span style={{color:"var(--ink-2)", fontWeight:500}}>{b.marka}</span>
                          </div>
                        </td>
                        <td style={{padding:"8px 12px", color:"var(--ink)", maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{b.baslik || b.is || "—"}</td>
                        <td style={{padding:"8px 12px", whiteSpace:"nowrap"}}>
                          <span style={{display:"inline-flex", alignItems:"center", gap:5}}>
                            <I.Dot size={6} color={isLead?"var(--ember)":"var(--ink-4)"}/>
                            <span style={{font:"600 10px/1 var(--font-sans)", color: isLead?"var(--ember)":"var(--ink-4)"}}>
                              {isLead ? "Lead" : "Contrib"}
                            </span>
                          </span>
                        </td>
                        <td style={{padding:"8px 12px", color:"var(--ink-3)", textAlign:"center", fontVariantNumeric:"tabular-nums"}}>{b.revision || b.rev || 0}</td>
                        <td style={{padding:"8px 12px", color:"var(--ink-3)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums"}}>{b.sureH ? b.sureH.toFixed(1)+"sa" : "—"}</td>
                        <td style={{padding:"8px 12px", whiteSpace:"nowrap", color: b.gecikme && b.gecikme !== "—" ? "var(--prio-orange)" : "var(--ink-4)"}}>{b.gecikme || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {myCompleted.length > 12 && (
                <div style={{padding:"10px 14px", font:"400 12px/1 var(--font-sans)", color:"var(--ink-4)", borderTop:"1px solid var(--line-soft)"}}>
                  +{myCompleted.length - 12} daha — tamamlananlar sekmesinde tümünü gör
                </div>
              )}
            </div>
          ) : (
            <div style={{padding:32, font:"400 12px/1.4 var(--font-sans)", color:"var(--ink-4)", textAlign:"center"}}>Kayıtlı tamamlanan iş yok</div>
          )}
        </Card>
      </div>

      {/* ─── Kapasite + Marka dağılımı (en alt, yan yana) ─── */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"var(--grid-gap)", marginBottom:"var(--grid-gap)"}} className="bn-grid-2">
        <Card>
          <CardHead title="Kapasite" sub={`${myActive.length} / ${CAP_LIMIT} iş limiti`}/>
          <div style={{margin:"8px 0 4px"}}>
            <div style={{display:"flex", justifyContent:"space-between", marginBottom:6}}>
              <span style={{font:"600 28px/1.15 var(--font-sans)", color: capPct>=100?"var(--prio-red)":capPct>=75?"var(--prio-orange)":"var(--ink)", letterSpacing:"-0.02em"}}>%{capPct}</span>
              <span style={{font:"400 12px/1.4 var(--font-sans)", color:"var(--ink-4)", textAlign:"right"}}>
                {capPct < 75 ? "Müsait" : capPct < 100 ? "Dolmak üzere" : "Kapasite aşıldı"}
              </span>
            </div>
            <div style={{height:8, background:"var(--line-soft)", borderRadius:999, overflow:"hidden"}}>
              <div style={{width:"100%", height:"100%", borderRadius:999,
                background: capPct>=100?"var(--prio-red)":capPct>=75?"var(--prio-orange)":"var(--prio-green)",
                transform:`scaleX(${Math.min(capPct,100)/100})`, transformOrigin:"left",
                transition:"transform 400ms cubic-bezier(0.2,0,0,1)"}}/>
            </div>
          </div>
          <div style={{marginTop:12, display:"flex", flexDirection:"column", gap:4}}>
            {Object.entries(durumMap).slice(0,4).map(([d,n]) => (
              <div key={d} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 0", borderBottom:"1px solid var(--line-soft)"}}>
                <span style={{font:"400 12px/1 var(--font-sans)", color:"var(--ink-3)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:160}}>{d}</span>
                <span style={{font:"600 12px/1 var(--font-mono)", color:"var(--ink-2)"}}>{n}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="Marka dağılımı" sub="aktif + tamamlanan"/>
          {topBrands.length > 0
            ? topBrands.map((b,i) => <BrandBar key={b.name} {...b} last={i===topBrands.length-1}/>)
            : <div style={{font:"400 12px/1 var(--font-sans)", color:"var(--ink-4)"}}>Henüz veri yok</div>
          }
        </Card>
      </div>

      {/* ─── Dönemsel özet — yalnız yöneticilere, seçili tarih aralığına göre (sayfa altı) ─── */}
      {isManager && (
      <Card padding={0} style={{minWidth:0, marginTop:"var(--section-gap)"}}>
        <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:10, padding:"13px 16px", borderBottom:"1px solid var(--line-strong)", flexWrap:"wrap"}}>
          <span style={{font:"italic 500 18px/1.1 var(--font-display)", color:"var(--ink)"}}>Dönemsel özet</span>
          <span style={{font:"600 10px/1 var(--font-sans)", letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--ink-3)", padding:"4px 9px", border:"1px solid var(--line)", borderRadius:999}}>{perfRangeLabel}</span>
        </div>
        {perfN === 0 ? (
          <div style={{padding:"20px 16px", font:"400 13px/1.5 var(--font-sans)", color:"var(--ink-4)"}}>
            Seçili aralıkta ({perfRangeLabel.toLowerCase()}) {u.name.split(" ")[0]} için tamamlanan iş kaydı yok. Üstteki 📅 tarih aralığını genişletmeyi dene.
          </div>
        ) : (
          <>
            <div style={{overflowX:"auto", WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%", borderCollapse:"collapse", font:"400 13px/1.3 var(--font-sans)"}}>
                <tbody>
                  {perfRows.map(([label, val], i) => (
                    <tr key={label} style={{background: i % 2 === 1 ? "var(--row-stripe)" : "transparent"}}>
                      <td style={{padding:"9px 16px", borderBottom:"1px solid var(--line)", color:"var(--ink-3)", whiteSpace:"nowrap"}}>{label}</td>
                      <td style={{padding:"9px 16px", borderBottom:"1px solid var(--line)", textAlign:"right", font:"500 13px/1.3 var(--font-mono)", color:"var(--ink)", fontVariantNumeric:"tabular-nums"}}>{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {perfBrandList.length > 0 && (
              <div style={{padding:"12px 16px", borderTop:"1px solid var(--line-strong)"}}>
                <div style={{font:"600 10px/1 var(--font-sans)", letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--ink-3)", marginBottom:9}}>Çalışılan markalar ({perfBrandList.length})</div>
                <div style={{display:"flex", flexWrap:"wrap", gap:7}}>
                  {perfBrandList.map(([name, cnt]) => (
                    <span key={name} style={{display:"inline-flex", alignItems:"center", gap:6, padding:"5px 10px", border:"1px solid var(--line)", borderRadius:999, background:"var(--surface)"}}>
                      <span style={{width:8, height:8, borderRadius:999, background:brandColorOf(name), flexShrink:0}}/>
                      <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink-2)"}}>{name}</span>
                      <span style={{font:"600 11px/1 var(--font-mono)", color:"var(--ink-4)"}}>{cnt}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Card>
      )}

    </div>
  );
}

// ─── Verdiğim/Aldığım işler için satır bileşeni ──────────────────────────────
function DelegateRow({ brief: b, mode, uid, onOpen, last }) {
  const other = mode === "delegated"
    ? (b.contributors || []).filter(c => c)
    : (b.lead ? [b.lead] : []);
  return (
    <div onClick={() => onOpen && onOpen(b)}
      style={{
        display:"flex", alignItems:"center", gap:10, padding:"9px 14px",
        borderBottom: last ? "none" : "1px solid var(--line-soft)",
        cursor:"pointer", transition:"background 100ms"
      }}
      onMouseEnter={e=>e.currentTarget.style.background="var(--surface-sub)"}
      onMouseLeave={e=>e.currentTarget.style.background=""}>
      <PriorityBadge p={b.oncelik||{code:"ylw",label:"NORMAL"}}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{font:"500 12px/1.35 var(--font-sans)", color:"var(--ink)", overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical"}}>
          {b.marka} · {b.baslik || b.is || "—"}
        </div>
        <div style={{font:"400 11px/1.2 var(--font-sans)", color:"var(--ink-4)", marginTop:2}}>
          {mode === "delegated" ? "→ " : "← "}
          {other.map(u => u.name.split(" ")[0]).join(", ") || "—"}
        </div>
      </div>
      {b.durum && (
        <span style={{font:"400 10px/1 var(--font-sans)", color:"var(--ink-4)", whiteSpace:"nowrap", maxWidth:100, overflow:"hidden", textOverflow:"ellipsis"}}>{b.durum.split(" ")[0]}</span>
      )}
    </div>
  );
}

// ─── Yardımcı bileşenler ─────────────────────────────────────────────────────
function BrandBar({ name, v, color, last }) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderBottom: last ? "none" : "1px solid var(--line-soft)"}}>
      <span style={{width:7, height:7, borderRadius:999, background: color, flexShrink:0}}/>
      <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{name}</span>
      <div style={{width:60, height:4, background:"var(--line-soft)", borderRadius:999, overflow:"hidden"}}>
        <div style={{width: Math.min(v*14,100)+"%", height:"100%", background: color, opacity:0.8}}/>
      </div>
      <span style={{font:"600 11px/1 var(--font-mono)", color:"var(--ink-4)", minWidth:16, textAlign:"right"}}>{v}</span>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={{padding:"8px 10px", background:"var(--paper-2)", borderRadius:0, textAlign:"center"}}>
      <div style={{font:"600 18px/1.15 var(--font-sans)", color:"var(--ink)", fontVariantNumeric:"tabular-nums"}}>{value}</div>
      <div style={{font:"400 10px/1.3 var(--font-sans)", color:"var(--ink-4)", marginTop:4}}>{label}</div>
    </div>
  );
}

window.ProfileScreen = ProfileScreen;
