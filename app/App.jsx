// app/App.jsx — root, owns global state and tweaks.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "comfortable",
  "defaultView": "all",
  "tableMode": "table",
  "kpiVariant": "trendchart",
  "tabStyle": "underline",
  "ember": "#C24A2C",
  "noise": false,
  "overviewLayout": "editorial"
}/*EDITMODE-END*/;

function App() {
  const data = window.BNS_DATA;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // App state
  const [user, setUser] = React.useState(data.ME);
  const [tab, setTab] = React.useState("overview");
  const [viewMode, setViewMode] = React.useState(t.defaultView);
  const [openBrief, setOpenBrief] = React.useState(null);
  const [briefs, setBriefs] = React.useState(data.briefs); // mutable for live edits
  const [palette, setPalette] = React.useState(false);
  const [newBrief, setNewBrief] = React.useState(false);
  const [toast, setToast] = React.useState(null);

  // Live data shape
  const liveData = { ...data, briefs };

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
    async function poll() {
      try {
        const r = await fetch("app/live-data.json?t=" + Date.now(), { cache: "no-store" });
        if (!r.ok || cancelled) return;
        const ed = await r.json();
        if (cancelled) return;
        // EMBEDDED_DATA güncelle (next time data.js bridge yeniden çalışsa diye)
        window.EMBEDDED_DATA = ed;
        // NOW + lastSync güncelle
        if (typeof ed.now === "string")        window.BNS_DATA.NOW = Date.parse(ed.now);
        if (typeof ed.last_sync === "string")  window.BNS_DATA.lastSync = ed.last_sync;
        // Brand list (Slack channels) — briefs hidrasyonundan ÖNCE override et
        if (Array.isArray(ed.bns_brands) && ed.bns_brands.length > 0) {
          window.BNS_DATA.BRANDS = ed.bns_brands;
          window.BNS_DATA.BR = Object.fromEntries(ed.bns_brands.map(b => [b.name, b]));
        }
        // Brief'leri yeniden hidrate et + state'i güncelle
        if (Array.isArray(ed.bns_briefs) && window.bnsHydrateBrief) {
          const fresh = ed.bns_briefs.map(window.bnsHydrateBrief);
          setBriefs(fresh);
          window.BNS_DATA.briefs = fresh;
        }
        if (Array.isArray(ed.bns_completed) && window.bnsHydrateCompleted) {
          window.BNS_DATA.completed = ed.bns_completed.map(window.bnsHydrateCompleted);
        }
        // Departman + marka istatistikleri
        if (ed.bns_dept_stats && typeof ed.bns_dept_stats === "object") {
          window.BNS_DATA.deptStats = ed.bns_dept_stats;
        }
        if (Array.isArray(ed.bns_brand_stats) && ed.bns_brand_stats.length > 0) {
          window.BNS_DATA.brandStats = ed.bns_brand_stats;
        }
        window.BNS_DATA.__lastPoll = Date.now();
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
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const onOpenBrief = (b) => {
    const live = briefs.find(x => x.id === b.id) || b;
    setOpenBrief(live);
  };
  const onCloseBrief = () => setOpenBrief(null);
  const onUpdateBrief = (next) => {
    setBriefs(arr => arr.map(b => b.id === next.id ? next : b));
    setOpenBrief(next);
  };
  const onStatusChange = (b, s) => {
    const next = { ...b, durum: s };
    setBriefs(arr => arr.map(x => x.id === b.id ? next : x));
    if (openBrief && openBrief.id === b.id) setOpenBrief(next);
    setToast(`${b.brand?.name || b.marka} · durum güncellendi: ${labelForStatus(s)}`);
  };
  const onCreateBrief = (b) => {
    setBriefs(arr => [b, ...arr]);
    setToast(`Yeni brief oluşturuldu · #${b.no} ${b.marka}`);
    setTab("jobs");
  };

  // ─── Pick screen ──────────────────────────────────────────────────────
  let Screen;
  if (tab === "overview")   Screen = <OverviewScreen   data={liveData} user={user} viewMode={viewMode}
                                       layout={t.overviewLayout} kpiVariant={t.kpiVariant}
                                       onOpenBrief={onOpenBrief} onSwitchTab={setTab}/>;
  else if (tab === "manager")  Screen = <ManagerScreen  data={liveData} user={user} onOpenBrief={onOpenBrief} onSwitchTab={setTab} onStatusChange={onStatusChange}/>;
  else if (tab === "jobs")     Screen = <JobsScreen     data={liveData} user={user} viewMode={viewMode} tableMode={t.tableMode} onOpenBrief={onOpenBrief} onStatusChange={onStatusChange}/>;
  else if (tab === "profile")  Screen = <ProfileScreen  data={liveData} user={user} onOpenBrief={onOpenBrief}/>;
  else if (tab === "gantt")    Screen = <PlanScreen     data={liveData} onOpenBrief={onOpenBrief}/>;
  else if (tab === "kanban")   Screen = <KanbanScreen   data={liveData} onOpenBrief={onOpenBrief} onStatusChange={onStatusChange}/>;
  else if (tab === "completed")Screen = <CompletedScreen data={liveData}/>;
  else if (tab === "dept-comp")Screen = <DeptCompareScreen data={liveData}/>;
  else if (tab === "design")   Screen = <DepartmentScreen data={liveData} role="tasarim" onOpenBrief={onOpenBrief}/>;
  else if (tab === "editor")   Screen = <DepartmentScreen data={liveData} role="editor"  onOpenBrief={onOpenBrief}/>;
  else if (tab === "ai")       Screen = <DepartmentScreen data={liveData} role="ai"      onOpenBrief={onOpenBrief}/>;
  else if (tab === "timeline") Screen = <DeadlinesScreen data={liveData} onOpenBrief={onOpenBrief}/>;
  else if (tab === "gallery")  Screen = <GalleryScreen  data={liveData}/>;
  else if (tab === "multi")    Screen = <MultiScreen    data={liveData} onOpenBrief={onOpenBrief}/>;
  else if (tab === "brand")    Screen = <BrandScreen    data={liveData} onOpenBrief={onOpenBrief}/>;
  else if (tab === "team")     Screen = <TeamScreen     data={liveData}/>;
  else if (tab === "history")  Screen = <HistoryScreen  data={liveData}/>;
  else Screen = <div>Not found</div>;

  return (
    <div data-screen-label={tab}>
      <Header
        user={user}
        viewMode={viewMode} setViewMode={setViewMode}
        theme={t.theme} setTheme={(v) => setTweak("theme", v)}
        onOpenPalette={() => setPalette(true)}
        onNewBrief={() => setNewBrief(true)}
        defaultUsers={Object.assign(data.USERS.slice(0, 5), { onPick: (u) => setUser(u) })}
      />
      <TabBar active={tab} onChange={setTab} style={t.tabStyle}/>

      <main key={tab + t.overviewLayout} style={{
        maxWidth: 1440, margin: "0 auto",
        padding: "8px 24px 64px"
      }}>
        {Screen}
      </main>

      {openBrief && (
        <BriefDrawer brief={openBrief} onClose={onCloseBrief}
          onUpdate={onUpdateBrief} allUsers={data.USERS}/>
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

      <ShortcutsHint/>

      <footer style={{
        padding: "16px 24px 32px", maxWidth: 1440, margin: "0 auto",
        display: "flex", justifyContent: "space-between", alignItems:"center", flexWrap: "wrap", gap: 8,
        font: "400 12px/1 var(--font-sans)", color:"var(--ink-4)"
      }}>
        <span>{data.fmtTr ? data.fmtTr(data.lastSync ? Date.parse(data.lastSync) : data.NOW, {style:"footer"}) : "Son senkron · 18 May 2026 · 14:30 (Europe/Istanbul)"}</span>
        <span style={{fontFamily:"var(--font-mono)"}}>Benseno v7.13 · GitHub Pages</span>
      </footer>

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

      <TweakSection label="Tab bar"/>
      <TweakRadio  label="Stil" value={t.tabStyle}
        options={["underline", "pill", "hairline"]}
        onChange={(v) => setTweak("tabStyle", v)}/>

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

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
