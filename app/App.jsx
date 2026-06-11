// app/App.jsx — root, owns global state and tweaks.

// Bir ekran render sırasında hata atarsa TÜM dashboard'ı blank'lamasın diye sınır.
// key={tab} ile sarılır → sekme değişince resetlenir, diğer ekranlar çalışmaya devam eder.
class ScreenErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { try { console.error("Ekran hatası:", err, info); } catch (e) {} }
  render() {
    if (this.state.err) {
      return React.createElement("div", { style: { padding: 24, font: "14px/1.6 var(--font-sans)", color: "var(--ink)" } },
        React.createElement("div", { style: { fontWeight: 600, marginBottom: 8 } }, "⚠️ Bu ekran yüklenemedi"),
        React.createElement("div", { style: { color: "var(--ink-3)", fontSize: 12, fontFamily: "var(--font-mono)" } }, String((this.state.err && this.state.err.message) || this.state.err)),
        React.createElement("div", { style: { marginTop: 12, fontSize: 12, color: "var(--ink-4)" } }, "Diğer sekmeler çalışıyor. Lütfen bu hatayı bildir."));
    }
    return this.props.children;
  }
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "comfortable",
  "defaultView": "all",
  "tableMode": "table",
  "kpiVariant": "trendchart",
  "tabStyle": "underline",
  "ember": "#C24A2C",
  "noise": true,
  "overviewLayout": "editorial"
}/*EDITMODE-END*/;

// ─── DB persistence (Bug 2 fix) ──────────────────────────────────────
// Drawer/status değişikliklerini API'ye yazar. Brief'in lead+contributors'ını
// atanan_ids'e, drawer "notes"'unu musteri_notu'na eşler. Numeric id varsa
// /:id, yoksa by-no/:no fallback. Best-effort: hata fırlatır, çağıran toast'lar.
async function bnsPersistBriefChange(prev, next, byId) {
  const base = (window.bnsResolveApiBase && window.bnsResolveApiBase());
  if (!base) return { skipped: "api kapalı" };                 // ?api=0 → DB'ye yazma
  const idNum = Number(next.id);
  const path = Number.isInteger(idNum) && idNum > 0
    ? `/api/briefs/${idNum}`
    : (next.no != null ? `/api/briefs/by-no/${next.no}` : null);
  if (!path) throw new Error("brief id/no yok — yazılamadı");
  const post = async (suffix, body) => {
    const tok = (typeof localStorage !== "undefined" && localStorage.getItem("bns_token")) || "";
    const r = await fetch(base + path + suffix, {
      method: suffix ? "POST" : "PATCH",
      headers: {
        "content-type": "application/json",
        ...(tok ? { Authorization: "Bearer " + tok } : {}),
      },
      body: JSON.stringify({ ...body, by: byId || undefined, source: "dashboard" }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error === "doğrulama"
      ? "Doğrulama: " + (j.issues || []).map(i => (i.path || []).join(".")).join(", ")
      : (j.error || ("HTTP " + r.status)));
    return j;
  };
  // 1) Durum
  if (next.durum !== prev.durum) await post("/status", { durum: next.durum });
  // 2) PATCH alanları (baslik / not / roller)
  const patch = {};
  if (next.baslik !== prev.baslik) patch.baslik = next.baslik;
  if ((next.notes || "") !== (prev.notes || "")) patch.musteri_notu = next.notes || "";
  const idsOf = (arr) => (arr || []).map(x => x && x.id).filter(Boolean);
  const w0 = idsOf(prev.workers), w1 = idsOf(next.workers);
  if (w0.join(",") !== w1.join(",")) patch.worker_ids = w1;
  const l0 = idsOf(prev.leads), l1 = idsOf(next.leads);
  if (l0.join(",") !== l1.join(",")) patch.lead_ids = l1;
  const o0 = idsOf(prev.observers), o1 = idsOf(next.observers);
  if (o0.join(",") !== o1.join(",")) patch.gozlemci_ids = o1;
  if (Object.keys(patch).length) await post("", patch);
  return { ok: true };
}

// ── Auth helpers ──────────────────────────────────────────────────────────
function bnsGetStoredUser() {
  try {
    const token = localStorage.getItem('bns_token');
    const user  = JSON.parse(localStorage.getItem('bns_user') || 'null');
    if (!token || !user) return null;
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem('bns_token');
      localStorage.removeItem('bns_user');
      return null;
    }
    return user;
  } catch { return null; }
}
function bnsLogout() {
  localStorage.removeItem('bns_token');
  localStorage.removeItem('bns_user');
  location.reload();
}

function App({ currentUser, onLogout }) {
  const data = window.BNS_DATA;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // App state
  // Varsayılan görünüm = giriş yapan kişi (slack_id eşleşmesi); bulunamazsa eski ME fallback'i
  const [user, setUser] = React.useState(
    () => data.USERS.find(u => u.id === currentUser?.slack_id) || data.ME);
  const [tab, setTab] = React.useState("overview");
  const [jobsScope, setJobsScope] = React.useState("all"); // Overview KPI → Jobs deep-link filtresi
  const jumpToJobs = (scope) => { setJobsScope(scope || "all"); setTab("jobs"); };
  // Normal navigasyon (sidebar/alt-nav/buton): Jobs'a giderken KPI deep-link filtresini sıfırla
  const navTo = (id) => { if (id === "jobs") setJobsScope("all"); setTab(id); };
  const isMobile = window.useIsMobile ? window.useIsMobile() : false;
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [viewMode, setViewMode] = React.useState(t.defaultView);
  const [openBrief, setOpenBrief] = React.useState(null);
  const [briefs, setBriefs] = React.useState(data.briefs); // mutable for live edits
  const [palette, setPalette] = React.useState(false);
  const [newBrief, setNewBrief] = React.useState(false);
  // Global erişim: Department/diğer ekranlar buradan modal açabilir
  React.useEffect(() => {
    window.openNewBriefModal = () => setNewBrief(true);
    window.bnsRefresh = () => setPollTick(x => x + 1);   // yazma sonrası anlık poll (NewBrief formu çağırır)
    window.bnsToast = (msg) => setToast(msg);            // başarı/hata bildirimi
  }, []);
  const [toast, setToast] = React.useState(null);
  const [pollTick, setPollTick] = React.useState(0); // Yenile düğmesi için manual trigger
  const [brandStats, setBrandStats] = React.useState(data.brandStats);
  const [history, setHistory] = React.useState(data.history || []); // 7 günlük geçmiş
  const [lastPollTime, setLastPollTime] = React.useState(null); // son başarılı poll zamanı

  // ─── viewMode filter (centralized — tüm screen'ler için) ──────────────
  // Bana / Departman / Tümü filtresi briefs ve completed'a uygulanır.
  // DEFENSIVE: brief'ler farklı kaynaklardan gelir → bazılarında lead={id,rol,..} (obj),
  // bazılarında leadId="U..." (string). Her iki durumu da kapsa.
  const filterByViewMode = React.useCallback((items) => {
    if (!Array.isArray(items)) return items;
    if (viewMode === "all" || !user) return items;

    // USERS lookup (ID → rol) — sadece string ID gelen brief'ler için
    const usersById = ((window.BNS_DATA && window.BNS_DATA.USERS) || []).reduce(
      (acc, u) => { acc[u.id] = u; return acc; }, {}
    );

    // Brief'in tüm ilişkili user ID'lerini topla
    const collectIds = (b) => {
      const ids = new Set();
      if (b.lead?.id) ids.add(b.lead.id);
      if (b.leadId) ids.add(b.leadId);
      (b.contributors || []).forEach(c => c?.id && ids.add(c.id));
      (b.contribIds || []).forEach(id => id && ids.add(id));
      if (b.reviewer?.id) ids.add(b.reviewer.id);
      if (b.reviewerId) ids.add(b.reviewerId);
      return ids;
    };
    // Brief'in tüm ilişkili rol'lerini topla (obj'den + ID lookup'tan)
    const collectRoles = (b) => {
      const roles = new Set();
      if (b.lead?.rol) roles.add(b.lead.rol);
      (b.contributors || []).forEach(c => c?.rol && roles.add(c.rol));
      if (b.reviewer?.rol) roles.add(b.reviewer.rol);
      // String ID-only field'lardan rol türet
      const idsForRole = [b.leadId, ...(b.contribIds || []), b.reviewerId].filter(Boolean);
      idsForRole.forEach(id => {
        const u = usersById[id];
        if (u?.rol) roles.add(u.rol);
      });
      return roles;
    };

    if (viewMode === "mine") {
      return items.filter(b => collectIds(b).has(user.id));
    }
    if (viewMode === "dept") {
      return items.filter(b => collectRoles(b).has(user.rol));
    }
    return items;
  }, [viewMode, user]);

  const filteredBriefs    = React.useMemo(() => filterByViewMode(briefs),         [filterByViewMode, briefs]);
  const filteredCompleted = React.useMemo(() => filterByViewMode(data.completed), [filterByViewMode, data.completed, briefs]);

  // Live data shape — briefs ve completed artık filtered (viewMode'a göre)
  const liveData = { ...data, briefs: filteredBriefs, completed: filteredCompleted, _allBriefs: briefs, _allCompleted: data.completed, brandStats, history };

  // ─── Effects: apply tweak tokens to <html> ────────────────────────────
  React.useEffect(() => { document.documentElement.setAttribute("data-theme", t.theme); }, [t.theme]);
  React.useEffect(() => { document.documentElement.setAttribute("data-density", t.density); }, [t.density]);
  React.useEffect(() => { document.documentElement.setAttribute("data-noise", t.noise ? "on" : "off"); }, [t.noise]);
  React.useEffect(() => {
    document.documentElement.style.setProperty("--ember", t.ember);
    document.documentElement.style.setProperty("--ember-hover", darken(t.ember, 0.12));
    document.documentElement.style.setProperty("--ember-press", darken(t.ember, 0.22));
    document.documentElement.style.setProperty("--ember-tint", t.ember + "1A");
  }, [t.ember]);

  // ─── Cmd+K handler ────────────────────────────────────────────────────
  React.useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setPalette(true); }
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "SELECT") {
        if (!palette && !openBrief && !newBrief) { setNewBrief(true); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [palette, openBrief, newBrief]);

  // ─── Toast auto-hide ───────────────────────────────────────────────────
  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  // ─── Live polling (Work Tracking bot → app/live-data.json) ─────────────
  React.useEffect(() => {
    let cancelled = false;
    let lastEtag = null;
    // Veri kaynağı: opt-in API (Faz 2). Öncelik: ?api= param → localStorage → window.BNS_API_BASE.
    // Hiçbiri yoksa eski statik dosya (app/live-data.json) — varsayılan, kanıtlanmış yol.
    function resolveDataUrl() {
      // Cutover: VARSAYILAN artık API (DB). Escape hatch: ?api=0 → eski statik live-data.json.
      const DEFAULT_API = "https://benseno-api-production.up.railway.app";
      try {
        const p = new URLSearchParams(window.location.search).get("api");
        if (p === "0" || p === "false") return "app/live-data.json?t=" + Date.now();   // escape
        if (p && /^https?:\/\//.test(p)) return p.replace(/\/+$/, "") + "/api/embedded?t=" + Date.now();
        const ls = window.localStorage.getItem("bns_api");
        if (ls === "0") return "app/live-data.json?t=" + Date.now();
        if (ls && ls !== "1") return ls.replace(/\/+$/, "") + "/api/embedded?t=" + Date.now();
        const base = (window.BNS_API_BASE ? String(window.BNS_API_BASE).replace(/\/+$/, "") : DEFAULT_API);
        return base + "/api/embedded?t=" + Date.now();
      } catch (e) { return DEFAULT_API + "/api/embedded?t=" + Date.now(); }
    }
    async function poll() {
      try {
        const r = await fetch(resolveDataUrl(), { cache: "no-store" });
        if (!r.ok || cancelled) return;
        const ed = await r.json();
        if (cancelled) return;
        // EMBEDDED_DATA güncelle (next time data.js bridge yeniden çalışsa diye)
        window.EMBEDDED_DATA = ed;
        // NOW + lastSync güncelle (now: ISO string veya unix timestamp her ikisi)
        if (typeof ed.now === "string")        window.BNS_DATA.NOW = Date.parse(ed.now);
        else if (typeof ed.now === "number")   window.BNS_DATA.NOW = ed.now * (ed.now < 1e12 ? 1000 : 1); // saniye→ms
        if (typeof ed.sync_ts === "number")    window.BNS_DATA.NOW = ed.sync_ts * (ed.sync_ts < 1e12 ? 1000 : 1);
        if (typeof ed.last_sync === "string")  window.BNS_DATA.lastSync = ed.last_sync;
        // Brand list (Slack channels) — briefs hidrasyonundan ÖNCE override et
        if (Array.isArray(ed.bns_brands) && ed.bns_brands.length > 0) {
          // Normalize: string[] veya {name,...}[] her ikisini de destekle
          const normB = ed.bns_brands.map(b =>
            typeof b === "string"
              ? { name: b, color: window.WHEEL?.[window.brandHash?.(b)||0] || "#888" }
              : b
          );
          window.BNS_DATA.BRANDS = normB;
          window.BNS_DATA.BR = Object.fromEntries(normB.map(b => [b.name, b]));
        }
        // User list (Slack workspace) — briefs hidrasyonundan ÖNCE
        if (Array.isArray(ed.bns_users) && ed.bns_users.length > 0) {
          window.BNS_DATA.USERS = ed.bns_users.map(u => window.bnsMergeUser ? window.bnsMergeUser(u) : ({ ...u, rol: u.rol || u.dept || "" }));
        }
        // Brief'leri yeniden hidrate et + state'i güncelle
        if (Array.isArray(ed.bns_briefs) && window.bnsHydrateBrief) {
          const sm = window.bnsSafeMap || ((a, f) => a.map(f));
          const fresh = sm(ed.bns_briefs, window.bnsHydrateBrief, "brief");
          setBriefs(fresh);
          window.BNS_DATA.briefs = fresh;
        }
        if (Array.isArray(ed.bns_completed) && window.bnsHydrateCompleted) {
          const sm = window.bnsSafeMap || ((a, f) => a.map(f));
          window.BNS_DATA.completed = sm(ed.bns_completed, window.bnsHydrateCompleted, "completed");
        }
        // Silinenler (soft-delete) — düz alanlar, hidrasyon gerekmez
        if (Array.isArray(ed.bns_deleted)) {
          window.BNS_DATA.deleted = ed.bns_deleted;
        }
        // Aktivite + yıldız karnesi + KPI history — data.js'teki ortak yardımcı (çift mantık olmasın)
        if (typeof window.bnsApplyExtras === "function") window.bnsApplyExtras(ed);
        // Departman + marka istatistikleri
        if (ed.bns_dept_stats && typeof ed.bns_dept_stats === "object") {
          window.BNS_DATA.deptStats = typeof bnsNormDeptStats === "function" ? bnsNormDeptStats(ed.bns_dept_stats) : ed.bns_dept_stats;
        }
        // Ekip matrisi — tamamlanan işlerden kullanıcı × marka sayısı
        {
          const allC = window.BNS_DATA.completed || [];
          const allB = window.BNS_DATA.briefs    || [];
          const users  = window.BNS_DATA.USERS   || [];
          const brands = window.BNS_DATA.BRANDS  || [];
          const mx = {};
          users.forEach(u => {
            mx[u.id] = {};
            brands.forEach(b => { mx[u.id][b.name] = 0; });
          });
          function addToMatrix(mx, uid, mn) {
            if (uid && mn && mx[uid] && mx[uid][mn] !== undefined) mx[uid][mn]++;
          }
          // tamamlananlar
          allC.forEach(c => {
            const mn = c.marka || c.brand?.name;
            addToMatrix(mx, c.lead?.id, mn);
            (c.contributors || []).forEach(cu => addToMatrix(mx, cu?.id, mn));
          });
          // aktif briefler
          allB.forEach(b => {
            const mn = b.marka || b.brand?.name;
            addToMatrix(mx, b.lead?.id, mn);
            (b.contributors || []).forEach(cu => addToMatrix(mx, cu?.id, mn));
          });
          window.BNS_DATA.matrix = mx;
        }
        // brandStats'ı HER ZAMAN gerçek hidratlanmış brief∪completed'ten hesapla.
        // (data-agent'ın bns_brand_stats'ı sadece {marka,active,overdue} veriyor → isim/renk/metrik
        //  eksik kalıyordu. Marka adı brief.marka, renk hidratlanmış brief.brand.color'dan gelir.)
        {
          const allB = window.BNS_DATA.briefs || [];
          const allC = window.BNS_DATA.completed || [];
          const now  = Date.now();
          const cutoff30 = now - 30 * 24 * 3600 * 1000;
          const names = [...new Set([...allB, ...allC].map(x => x.marka).filter(Boolean))];
          const colorFor = (name) => {
            const hit = allB.find(x => x.marka === name && x.brand && x.brand.color)
                     || allC.find(x => x.marka === name && x.brand && x.brand.color);
            if (hit) return hit.brand.color;
            if (window.WHEEL && window.brandHash) return window.WHEEL[window.brandHash(name)] || "#888";
            return "#888";
          };
          const freshBS = names.map(name => {
            const bs = allB.filter(x => x.marka === name);
            const cs = allC.filter(x => x.marka === name);
            const done30 = cs.filter(x => (x.bitis || 0) >= cutoff30).length;
            const sures  = cs.filter(x => x.sureH > 0).map(x => x.sureH).sort((a,z)=>a-z);
            const medH   = sures.length ? sures[Math.floor(sures.length/2)] : null;
            const madH   = sures.length ? Math.round(sures.reduce((s,v)=>s+Math.abs(v-(medH||0)),0)/sures.length) : null;
            const revs   = cs.map(x => x.revision || 0);
            const avgRev = revs.length ? (revs.reduce((a,v)=>a+v,0)/revs.length).toFixed(1) : null;
            const rs     = cs.map(x => x.rating).filter(r => r != null);
            const rating = rs.length ? (rs.reduce((a,v)=>a+v,0)/rs.length).toFixed(1) : null;
            const stale  = bs.some(x => x.stale) || bs.some(x => x.deltaH <= 0);
            return {
              name, color: colorFor(name),
              active: bs.length, done30,
              medianH: medH != null ? Math.round(medH) : null,
              madH, avgRev, rating, stale
            };
          }).sort((a, z) => z.active - a.active);
          window.BNS_DATA.brandStats = freshBS;
          setBrandStats(freshBS);
        }
        if (Array.isArray(ed.bns_history) && ed.bns_history.length > 0) {
          window.BNS_DATA.history = ed.bns_history;
          setHistory(ed.bns_history);
        }
        window.BNS_DATA.__lastPoll = Date.now();
        setLastPollTime(Date.now()); // footer'daki "son güncelleme" için re-render tetikle
        console.info("[BNS] poll OK · source=" + ed.source + " · reason=" + ed.reason +
                     " · briefs=" + (ed.bns_briefs?.length||0) +
                     " · completed=" + (ed.bns_completed?.length||0));
      } catch (e) {
        // Network/JSON hatası — bir sonraki poll'da tekrar dener. Mock kalır.
      }
    }
    poll(); // ilk çağrı hemen (initial script load'dan farklı timestamp olabilir)
    const id = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [pollTick]); // pollTick değişince yeni interval başlar → manual refresh

  const onRefresh = React.useCallback(() => {
    setPollTick(n => n + 1);
    setToast("Veri güncelleniyor…");
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const onOpenBrief = (b) => {
    const live = briefs.find(x => x.id === b.id) || b;
    setOpenBrief(live);
  };
  const onCloseBrief = () => setOpenBrief(null);
  // Tamamlanan iş → drawer'ı salt-okunur aç (akış görünür, güncelleme kapalı)
  const onOpenCompleted = (c) => setOpenBrief({
    ...c, _readOnly: true, durum: "tamamlandi",
    workers: c.contributors || [], leads: c.lead ? [c.lead] : [], observers: [],
    priority: null, deltaH: null, acilma: c.baslangic || null,
  });
  const onUpdateBrief = (next) => {
    const prev = briefs.find(b => b.id === next.id) || next;
    setBriefs(arr => arr.map(b => b.id === next.id ? next : b));   // optimistic
    setOpenBrief(next);
    bnsPersistBriefChange(prev, next, user && user.id)
      .then(res => { if (res && res.ok) setToast("✓ Kaydedildi"); if (res && res.ok && window.bnsRefresh) window.bnsRefresh(); })
      .catch(e => setToast("⚠ Kaydedilemedi: " + (e.message || e)));
  };
  const onStatusChange = (b, s) => {
    const next = { ...b, durum: s };
    setBriefs(arr => arr.map(x => x.id === b.id ? next : x));   // optimistic
    if (openBrief && openBrief.id === b.id) setOpenBrief(next);
    setToast(`${b.brand?.name || b.marka} · durum güncellendi: ${labelForStatus(s)}`);
    bnsPersistBriefChange(b, next, user && user.id)
      .then(res => { if (res && res.ok && window.bnsRefresh) window.bnsRefresh(); })
      .catch(e => setToast("⚠ Durum kaydedilemedi: " + (e.message || e)));
  };
  const onCreateBrief = (b) => {
    setBriefs(arr => [b, ...arr]);
    setToast(`Yeni brief oluşturuldu · #${b.no} ${b.marka}`);
    setTab("jobs");
  };

  // ─── Pick screen ──────────────────────────────────────────────────────
  let Screen;
  if (tab === "overview" || tab === "manager")
                            Screen = <OverviewScreen   data={liveData} user={user} viewMode={viewMode} setViewMode={setViewMode}
                                       layout={t.overviewLayout} kpiVariant={t.kpiVariant}
                                       onOpenBrief={onOpenBrief} onSwitchTab={navTo} onJumpJobs={jumpToJobs} onRefresh={onRefresh} onStatusChange={onStatusChange}/>;
  else if (tab === "jobs")     Screen = <JobsScreen     data={liveData} user={user} viewMode={viewMode} initialScope={jobsScope} tableMode={isMobile && t.tableMode === "table" ? "cards" : t.tableMode} onOpenBrief={onOpenBrief} onStatusChange={onStatusChange}/>;
  else if (tab === "profile")  Screen = <ProfileScreen  data={liveData} user={user} onOpenBrief={onOpenBrief} currentUser={currentUser}/>;
  else if (tab === "gantt")    Screen = <PlanScreen     data={liveData} onOpenBrief={onOpenBrief}/>;
  else if (tab === "kanban")   Screen = <KanbanScreen   data={liveData} onOpenBrief={onOpenBrief} onStatusChange={onStatusChange}/>;
  else if (tab === "completed")Screen = <CompletedScreen data={liveData} onOpenBrief={onOpenCompleted} currentUser={currentUser}/>;
  else if (tab === "dept-comp")Screen = <DeptCompareScreen data={liveData}/>;
  else if (tab === "design")   Screen = <DepartmentScreen data={liveData} role="tasarim" onOpenBrief={onOpenBrief}/>;
  else if (tab === "editor")   Screen = <DepartmentScreen data={liveData} role="editor"  onOpenBrief={onOpenBrief}/>;
  else if (tab === "ai")       Screen = <DepartmentScreen data={liveData} role="ai"      onOpenBrief={onOpenBrief}/>;
  else if (tab === "freelance") Screen = <DepartmentScreen data={liveData} role="freelance" onOpenBrief={onOpenBrief}/>;
  else if (tab === "gallery")  Screen = <GalleryScreen  data={liveData}/>;
  else if (tab === "multi")    Screen = <MultiScreen    data={liveData} onOpenBrief={onOpenBrief}/>;
  else if (tab === "brand")    Screen = <BrandScreen    data={liveData} onOpenBrief={onOpenBrief}/>;
  else if (tab === "team")     Screen = <TeamScreen     data={liveData}/>;
  else if (tab === "history")  Screen = <HistoryScreen  data={liveData} onOpenByNo={(no) => {
    // Geçmiş satırı → iş detayı: aktifse normal panel, tamamlanmışsa salt-okunur
    const b = (liveData._allBriefs || liveData.briefs || []).find(x => x.no === no);
    if (b) return onOpenBrief(b);
    const c = (liveData._allCompleted || liveData.completed || []).find(x => x.no === no);
    if (c) return onOpenCompleted(c);
    setToast(`#${no} bulunamadı — silinmiş olabilir`);
  }}/>;
  else if (tab === "help")    Screen = <HelpScreen />;
  else if (tab === "users")      Screen = currentUser?.role === 'admin'
    ? <UsersScreen currentUser={currentUser}/>
    : <div style={{padding:48, textAlign:"center", color:"var(--ink-3)"}}>Erişim yok</div>;
  else if (tab === "silinenler") Screen = currentUser?.role === 'admin'
    ? <SilinenlerScreen data={liveData} currentUser={currentUser}/>
    : <div style={{padding:48, textAlign:"center", color:"var(--ink-3)"}}>Erişim yok</div>;
  else Screen = <div>Not found</div>;

  return (
    <div data-screen-label={tab} style={{display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", position:"relative"}}>
      <Header
        user={user}
        viewMode={viewMode} setViewMode={setViewMode}
        theme={t.theme} setTheme={(v) => setTweak("theme", v)}
        onOpenPalette={() => setPalette(true)}
        onNewBrief={() => setNewBrief(true)}
        defaultUsers={Object.assign([...data.USERS], { onPick: (u) => setUser(u) })}
        currentUser={currentUser}
        onLogout={onLogout}
      />
      <div style={{display:"grid", gridTemplateColumns: isMobile ? "1fr" : `${sidebarCollapsed?52:212}px 1fr`, flex:1, overflow:"hidden", transition:"grid-template-columns 200ms cubic-bezier(0.2,0,0,1)"}}>
        {!isMobile && (
          <Sidebar
            active={tab} onChange={navTo}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(v => !v)}
            data={liveData}
            onOpenPalette={() => setPalette(true)}
            currentUser={currentUser}
          />
        )}
        <main key={tab + t.overviewLayout} style={{
          flex: 1, overflowY: "auto", overflowX: "hidden", minWidth: 0,
          background: "var(--paper)",
        }}>
          <div className="bns-main-content" style={{maxWidth: 1400, margin: "0 auto", padding: isMobile ? "8px 14px 88px" : "8px 32px 72px"}}>
            <ScreenErrorBoundary key={tab}>{Screen}</ScreenErrorBoundary>
          </div>
          {(
            <footer className="bns-desktop-footer" style={{
              padding: "14px 28px 28px", maxWidth: 1400, margin: "0 auto",
              display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
              font: "400 11px/1 var(--font-sans)", color: "var(--ink-5)"
            }}>
              <span>
                {data.fmtTr ? data.fmtTr(data.lastSync ? Date.parse(data.lastSync) : data.NOW, {style:"footer"}) : "Son senkron · 21 May 2026 · 14:45 (Europe/Istanbul)"}
                {lastPollTime && (
                  <span style={{marginLeft:8, color:"var(--ink-4)"}}>
                    · <span style={{color:"var(--prio-green)", fontWeight:500}}>●</span> canlı
                    {" · güncellendi " + Math.round((Date.now() - lastPollTime) / 1000) + "sn önce"}
                  </span>
                )}
              </span>
              <span style={{fontFamily:"var(--font-mono)"}}>Benseno v7.13 · GitHub Pages</span>
            </footer>
          )}
        </main>
      </div>

      {/* MobileNav — always rendered, CSS controls visibility (display:none on desktop) */}
      <div className="bns-mobile-nav-wrap">
        <MobileNav active={tab} onChange={navTo} data={liveData}/>
      </div>

      {openBrief && (
        <BriefDrawer brief={openBrief} onClose={onCloseBrief}
          onUpdate={onUpdateBrief} allUsers={data.USERS} currentUser={currentUser}/>
      )}

      <CommandPalette
        open={palette} onClose={() => setPalette(false)}
        data={data}
        currentTheme={t.theme}
        onOpenBrief={(b) => onOpenBrief(b)}
        onNavigate={(id) => setTab(id)}
        onTheme={(v) => setTweak("theme", v)}
        onNewBrief={() => setNewBrief(true)}/>

      <NewBriefModal
        open={newBrief} onClose={() => setNewBrief(false)}
        data={data}
        onCreate={onCreateBrief}/>

      {toast && <Toast msg={toast}/>}
      {/* 🤖 Sistem Asistanı — sağ alt yüzen sohbet */}
      <ChatBot/>

      <ShortcutsHint/>

      <BenseoTweaks t={t} setTweak={setTweak}/>
    </div>
  );
}

// ─── Tweaks panel content ─────────────────────────────────────────────────
function BenseoTweaks({ t, setTweak }) {
  return (
    <TweaksPanel>
      <TweakSection label="Görünüm"/>
      <TweakRadio  label="Tema" value={t.theme}
        options={["light", "dark"]}
        onChange={(v) => setTweak("theme", v)}/>
      <TweakRadio  label="Yoğunluk" value={t.density}
        options={["compact", "comfortable", "spacious"]}
        onChange={(v) => setTweak("density", v)}/>
      <TweakToggle label="Paper noise" value={t.noise}
        onChange={(v) => setTweak("noise", v)}/>

      <TweakSection label="Aktif işler"/>
      <TweakRadio  label="Görünüm" value={t.tableMode}
        options={["table", "kanban", "cards"]}
        onChange={(v) => setTweak("tableMode", v)}/>
      <TweakSelect label="Varsayılan kapsam" value={t.defaultView}
        options={[
          {value:"mine", label:"Bana atanmış"},
          {value:"dept", label:"Departmanım"},
          {value:"all",  label:"Tüm ekip"}
        ]}
        onChange={(v) => setTweak("defaultView", v)}/>

      <TweakSection label="KPI kartları"/>
      <TweakRadio  label="Varyant" value={t.kpiVariant}
        options={["plain", "trendchart"]}
        onChange={(v) => setTweak("kpiVariant", v)}/>

      <TweakSection label="Genel bakış layout'u"/>
      <TweakRadio  label="Düzen" value={t.overviewLayout}
        options={["editorial", "dense", "story"]}
        onChange={(v) => setTweak("overviewLayout", v)}/>

      <TweakSection label="Aksan"/>
      <TweakColor  label="--ember" value={t.ember}
        options={["#C24A2C", "#3360A4", "#2E8F66", "#8E5BA1", "#16161A"]}
        onChange={(v) => setTweak("ember", v)}/>
    </TweaksPanel>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────
function Toast({ msg }) {
  return (
    <div style={{
      position:"fixed", left: "50%", bottom: 24, transform:"translateX(-50%)",
      zIndex: 95, padding:"10px 16px",
      background:"var(--ink)", color:"var(--paper)",
      borderRadius: 999, boxShadow:"var(--shadow-2)",
      font:"500 13px/1 var(--font-sans)",
      display:"inline-flex", alignItems:"center", gap:8,
      animation:"bn-slide-up 200ms var(--ease-out-quart)"
    }}>
      <I.Check size={14}/>
      {msg}
    </div>
  );
}

// ─── Keyboard shortcuts hint card ──────────────────────────────────────────
function ShortcutsHint() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} title="Klavye kısayolları" style={{
        position:"fixed", left: 16, bottom: 16, zIndex: 40,
        border:"1px solid var(--line)", background:"var(--surface)",
        padding:"7px 10px", borderRadius:999, cursor:"pointer",
        font:"500 11px/1 var(--font-mono)", color:"var(--ink-3)",
        boxShadow:"var(--shadow-1)",
        display:"inline-flex", alignItems:"center", gap:6
      }}>
        <I.Command size={12}/> Kısayollar
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{
            position:"fixed", inset:0, background:"var(--overlay)", zIndex: 96,
            backdropFilter:"blur(4px)", WebkitBackdropFilter:"blur(4px)",
            animation:"bn-fade 160ms var(--ease-out-quart)"
          }}/>
          <div style={{
            position:"fixed", left:"50%", top:"50%", transform:"translate(-50%,-50%)",
            zIndex: 97, width:"min(420px, 92vw)",
            background:"var(--surface)", border:"1px solid var(--line)",
            borderRadius: 14, padding: 0, boxShadow:"var(--shadow-2)",
            animation:"bn-slide-up 220ms var(--ease-out-quart)"
          }}>
            <div style={{padding:"14px 18px", borderBottom:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
              <div>
                <Eyebrow>Klavye</Eyebrow>
                <div style={{fontFamily:"var(--font-display)", fontStyle:"italic", fontSize:18, color:"var(--ink-2)", marginTop:4}}>
                  hızlı erişim.
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{border:0, background:"transparent", cursor:"pointer", color:"var(--ink-3)"}}><I.X size={16}/></button>
            </div>
            <div style={{padding:"14px 18px", display:"grid", gap:8}}>
              <Short k="⌘ K" l="Komut paletini aç"/>
              <Short k="N"   l="Yeni brief"/>
              <Short k="↑ ↓" l="Paletteyi gez"/>
              <Short k="↵"   l="Seç"/>
              <Short k="esc" l="Modal / drawer kapat"/>
              <Short k="T"   l="Tema değiştir (palette içinden)"/>
            </div>
          </div>
        </>
      )}
    </>
  );
}
function Short({ k, l }) {
  return (
    <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:14}}>
      <span style={{font:"400 13px/1.4 var(--font-sans)", color:"var(--ink-2)"}}>{l}</span>
      <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-3)",
        padding:"4px 8px", border:"1px solid var(--line)", borderRadius: 5, background:"var(--paper-2)"}}>{k}</span>
    </div>
  );
}

function labelForStatus(s) {
  return {yeni:"Yeni", calisiliyor:"Çalışılıyor", incelemede:"İncelemede", blokeli:"Blokeli", tamamlandi:"Tamamlandı"}[s] || s;
}

function darken(hex, amt) {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 - amt))));
  return "#" + [f(r), f(g), f(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}

// ── AppRoot — auth gate ───────────────────────────────────────────────────
function AppRoot() {
  const [authUser, setAuthUser] = React.useState(() => bnsGetStoredUser());
  if (!authUser) return <LoginScreen onLogin={setAuthUser} />;
  return <App currentUser={authUser} onLogout={bnsLogout} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<AppRoot />);
