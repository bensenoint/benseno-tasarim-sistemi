(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __commonJS = (cb, mod) => function __require2() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // app/App.jsx
  var require_App = __commonJS({
    "app/App.jsx"() {
      var import_jsx_runtime = __require("react/jsx-runtime");
      var TWEAK_DEFAULTS = (
        /*EDITMODE-BEGIN*/
        {
          "theme": "light",
          "density": "comfortable",
          "defaultView": "all",
          "tableMode": "table",
          "kpiVariant": "trendchart",
          "tabStyle": "underline",
          "ember": "#C24A2C",
          "noise": true,
          "overviewLayout": "editorial"
        }
      );
      function App() {
        const data = window.BNS_DATA;
        const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
        const [user, setUser] = React.useState(data.ME);
        const [tab, setTab] = React.useState("overview");
        const isMobile = window.useIsMobile ? window.useIsMobile() : false;
        const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
        const [viewMode, setViewMode] = React.useState(t.defaultView);
        const [openBrief, setOpenBrief] = React.useState(null);
        const [briefs, setBriefs] = React.useState(data.briefs);
        const [palette, setPalette] = React.useState(false);
        const [newBrief, setNewBrief] = React.useState(false);
        React.useEffect(() => {
          window.openNewBriefModal = () => setNewBrief(true);
        }, []);
        const [toast, setToast] = React.useState(null);
        const [pollTick, setPollTick] = React.useState(0);
        const [brandStats, setBrandStats] = React.useState(data.brandStats);
        const [history, setHistory] = React.useState(data.history || []);
        const [lastPollTime, setLastPollTime] = React.useState(null);
        const filterByViewMode = React.useCallback((items) => {
          if (!Array.isArray(items)) return items;
          if (viewMode === "all" || !user) return items;
          const usersById = (window.BNS_DATA && window.BNS_DATA.USERS || []).reduce(
            (acc, u) => {
              acc[u.id] = u;
              return acc;
            },
            {}
          );
          const collectIds = (b) => {
            const ids = /* @__PURE__ */ new Set();
            if (b.lead?.id) ids.add(b.lead.id);
            if (b.leadId) ids.add(b.leadId);
            (b.contributors || []).forEach((c) => c?.id && ids.add(c.id));
            (b.contribIds || []).forEach((id) => id && ids.add(id));
            if (b.reviewer?.id) ids.add(b.reviewer.id);
            if (b.reviewerId) ids.add(b.reviewerId);
            return ids;
          };
          const collectRoles = (b) => {
            const roles = /* @__PURE__ */ new Set();
            if (b.lead?.rol) roles.add(b.lead.rol);
            (b.contributors || []).forEach((c) => c?.rol && roles.add(c.rol));
            if (b.reviewer?.rol) roles.add(b.reviewer.rol);
            const idsForRole = [b.leadId, ...b.contribIds || [], b.reviewerId].filter(Boolean);
            idsForRole.forEach((id) => {
              const u = usersById[id];
              if (u?.rol) roles.add(u.rol);
            });
            return roles;
          };
          if (viewMode === "mine") {
            return items.filter((b) => collectIds(b).has(user.id));
          }
          if (viewMode === "dept") {
            return items.filter((b) => collectRoles(b).has(user.rol));
          }
          return items;
        }, [viewMode, user]);
        const filteredBriefs = React.useMemo(() => filterByViewMode(briefs), [filterByViewMode, briefs]);
        const filteredCompleted = React.useMemo(() => filterByViewMode(data.completed), [filterByViewMode, data.completed, briefs]);
        const liveData = { ...data, briefs: filteredBriefs, completed: filteredCompleted, _allBriefs: briefs, _allCompleted: data.completed, brandStats, history };
        React.useEffect(() => {
          document.documentElement.setAttribute("data-theme", t.theme);
        }, [t.theme]);
        React.useEffect(() => {
          document.documentElement.setAttribute("data-density", t.density);
        }, [t.density]);
        React.useEffect(() => {
          document.documentElement.setAttribute("data-noise", t.noise ? "on" : "off");
        }, [t.noise]);
        React.useEffect(() => {
          document.documentElement.style.setProperty("--ember", t.ember);
          document.documentElement.style.setProperty("--ember-hover", darken(t.ember, 0.12));
          document.documentElement.style.setProperty("--ember-press", darken(t.ember, 0.22));
          document.documentElement.style.setProperty("--ember-tint", t.ember + "1A");
        }, [t.ember]);
        React.useEffect(() => {
          function onKey(e) {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
              e.preventDefault();
              setPalette(true);
            }
            if (e.key === "n" && !e.metaKey && !e.ctrlKey && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "SELECT") {
              if (!palette && !openBrief && !newBrief) {
                setNewBrief(true);
              }
            }
          }
          window.addEventListener("keydown", onKey);
          return () => window.removeEventListener("keydown", onKey);
        }, [palette, openBrief, newBrief]);
        React.useEffect(() => {
          if (!toast) return;
          const id = setTimeout(() => setToast(null), 2400);
          return () => clearTimeout(id);
        }, [toast]);
        React.useEffect(() => {
          let cancelled = false;
          let lastEtag = null;
          async function poll() {
            try {
              const r = await fetch("app/live-data.json?t=" + Date.now(), { cache: "no-store" });
              if (!r.ok || cancelled) return;
              const ed = await r.json();
              if (cancelled) return;
              window.EMBEDDED_DATA = ed;
              if (typeof ed.now === "string") window.BNS_DATA.NOW = Date.parse(ed.now);
              else if (typeof ed.now === "number") window.BNS_DATA.NOW = ed.now * (ed.now < 1e12 ? 1e3 : 1);
              if (typeof ed.sync_ts === "number") window.BNS_DATA.NOW = ed.sync_ts * (ed.sync_ts < 1e12 ? 1e3 : 1);
              if (typeof ed.last_sync === "string") window.BNS_DATA.lastSync = ed.last_sync;
              if (Array.isArray(ed.bns_brands) && ed.bns_brands.length > 0) {
                const normB = ed.bns_brands.map(
                  (b) => typeof b === "string" ? { name: b, color: window.WHEEL?.[window.brandHash?.(b) || 0] || "#888" } : b
                );
                window.BNS_DATA.BRANDS = normB;
                window.BNS_DATA.BR = Object.fromEntries(normB.map((b) => [b.name, b]));
              }
              if (Array.isArray(ed.bns_users) && ed.bns_users.length > 0) {
                window.BNS_DATA.USERS = ed.bns_users.map((u) => ({ ...u, rol: u.rol || u.dept || "" }));
              }
              if (Array.isArray(ed.bns_briefs) && window.bnsHydrateBrief) {
                const fresh = ed.bns_briefs.map(window.bnsHydrateBrief);
                setBriefs(fresh);
                window.BNS_DATA.briefs = fresh;
              }
              if (Array.isArray(ed.bns_completed) && window.bnsHydrateCompleted) {
                window.BNS_DATA.completed = ed.bns_completed.map(window.bnsHydrateCompleted);
              }
              if (ed.bns_dept_stats && typeof ed.bns_dept_stats === "object") {
                window.BNS_DATA.deptStats = typeof bnsNormDeptStats === "function" ? bnsNormDeptStats(ed.bns_dept_stats) : ed.bns_dept_stats;
              }
              {
                let addToMatrix2 = function(mx2, uid, mn) {
                  if (uid && mn && mx2[uid] && mx2[uid][mn] !== void 0) mx2[uid][mn]++;
                };
                var addToMatrix = addToMatrix2;
                const allC = window.BNS_DATA.completed || [];
                const allB = window.BNS_DATA.briefs || [];
                const users = window.BNS_DATA.USERS || [];
                const brands = window.BNS_DATA.BRANDS || [];
                const mx = {};
                users.forEach((u) => {
                  mx[u.id] = {};
                  brands.forEach((b) => {
                    mx[u.id][b.name] = 0;
                  });
                });
                allC.forEach((c) => {
                  const mn = c.marka || c.brand?.name;
                  addToMatrix2(mx, c.lead?.id, mn);
                  (c.contributors || []).forEach((cu) => addToMatrix2(mx, cu?.id, mn));
                });
                allB.forEach((b) => {
                  const mn = b.marka || b.brand?.name;
                  addToMatrix2(mx, b.lead?.id, mn);
                  (b.contributors || []).forEach((cu) => addToMatrix2(mx, cu?.id, mn));
                });
                window.BNS_DATA.matrix = mx;
              }
              if (Array.isArray(ed.bns_brand_stats) && ed.bns_brand_stats.length > 0) {
                window.BNS_DATA.brandStats = ed.bns_brand_stats;
                setBrandStats(ed.bns_brand_stats);
              } else if (window.BNS_DATA.BRANDS && window.BNS_DATA.briefs) {
                const allB = window.BNS_DATA.briefs;
                const allC = window.BNS_DATA.completed || [];
                const now = Date.now();
                const cutoff30 = now - 30 * 24 * 3600 * 1e3;
                const freshBS = window.BNS_DATA.BRANDS.map((b) => {
                  const active = allB.filter((x) => x.marka === b.name).length;
                  const done30 = allC.filter((x) => x.marka === b.name && (x.bitis || 0) >= cutoff30).length;
                  const sures = allC.filter((x) => x.marka === b.name && x.sureH > 0).map((x) => x.sureH).sort((a, z) => a - z);
                  const medH = sures.length ? sures[Math.floor(sures.length / 2)] : null;
                  const madH = sures.length ? Math.round(sures.reduce((s, v) => s + Math.abs(v - (medH || 0)), 0) / sures.length) : null;
                  const revs = allC.filter((x) => x.marka === b.name).map((x) => x.revision || 0);
                  const avgRev = revs.length ? (revs.reduce((a, v) => a + v, 0) / revs.length).toFixed(1) : null;
                  const hasStale = allB.some((x) => x.marka === b.name && x.stale);
                  const hasOverdue = allB.some((x) => x.marka === b.name && x.deltaH <= 0);
                  return {
                    ...b,
                    active,
                    done30,
                    medianH: medH != null ? Math.round(medH) : null,
                    madH,
                    avgRev,
                    rating: null,
                    stale: hasStale || hasOverdue
                  };
                });
                window.BNS_DATA.brandStats = freshBS;
                setBrandStats(freshBS);
              }
              if (Array.isArray(ed.bns_history) && ed.bns_history.length > 0) {
                window.BNS_DATA.history = ed.bns_history;
                setHistory(ed.bns_history);
              }
              window.BNS_DATA.__lastPoll = Date.now();
              setLastPollTime(Date.now());
              console.info("[BNS] poll OK \xB7 source=" + ed.source + " \xB7 reason=" + ed.reason + " \xB7 briefs=" + (ed.bns_briefs?.length || 0) + " \xB7 completed=" + (ed.bns_completed?.length || 0));
            } catch (e) {
            }
          }
          poll();
          const id = setInterval(poll, 3e4);
          return () => {
            cancelled = true;
            clearInterval(id);
          };
        }, [pollTick]);
        const onRefresh = React.useCallback(() => {
          setPollTick((n) => n + 1);
          setToast("Veri g\xFCncelleniyor\u2026");
        }, []);
        const onOpenBrief = (b) => {
          const live = briefs.find((x) => x.id === b.id) || b;
          setOpenBrief(live);
        };
        const onCloseBrief = () => setOpenBrief(null);
        const onUpdateBrief = (next) => {
          setBriefs((arr) => arr.map((b) => b.id === next.id ? next : b));
          setOpenBrief(next);
        };
        const onStatusChange = (b, s) => {
          const next = { ...b, durum: s };
          setBriefs((arr) => arr.map((x) => x.id === b.id ? next : x));
          if (openBrief && openBrief.id === b.id) setOpenBrief(next);
          setToast(`${b.brand?.name || b.marka} \xB7 durum g\xFCncellendi: ${labelForStatus(s)}`);
        };
        const onCreateBrief = (b) => {
          setBriefs((arr) => [b, ...arr]);
          setToast(`Yeni brief olu\u015Fturuldu \xB7 #${b.no} ${b.marka}`);
          setTab("jobs");
        };
        let Screen;
        if (tab === "overview") Screen = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          OverviewScreen,
          {
            data: liveData,
            user,
            viewMode,
            setViewMode,
            layout: t.overviewLayout,
            kpiVariant: t.kpiVariant,
            onOpenBrief,
            onSwitchTab: setTab,
            onRefresh
          }
        );
        else if (tab === "manager") Screen = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ManagerScreen, { data: liveData, user, onOpenBrief, onSwitchTab: setTab, onStatusChange });
        else if (tab === "jobs") Screen = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(JobsScreen, { data: liveData, user, viewMode, tableMode: t.tableMode, onOpenBrief, onStatusChange });
        else if (tab === "profile") Screen = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileScreen, { data: liveData, user, onOpenBrief });
        else if (tab === "gantt") Screen = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlanScreen, { data: liveData, onOpenBrief });
        else if (tab === "kanban") Screen = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KanbanScreen, { data: liveData, onOpenBrief, onStatusChange });
        else if (tab === "completed") Screen = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompletedScreen, { data: liveData });
        else if (tab === "dept-comp") Screen = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeptCompareScreen, { data: liveData });
        else if (tab === "design") Screen = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DepartmentScreen, { data: liveData, role: "tasarim", onOpenBrief });
        else if (tab === "editor") Screen = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DepartmentScreen, { data: liveData, role: "editor", onOpenBrief });
        else if (tab === "ai") Screen = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DepartmentScreen, { data: liveData, role: "ai", onOpenBrief });
        else if (tab === "gallery") Screen = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GalleryScreen, { data: liveData });
        else if (tab === "multi") Screen = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MultiScreen, { data: liveData, onOpenBrief });
        else if (tab === "brand") Screen = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandScreen, { data: liveData, onOpenBrief });
        else if (tab === "team") Screen = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TeamScreen, { data: liveData });
        else if (tab === "history") Screen = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HistoryScreen, { data: liveData });
        else Screen = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "Not found" });
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "data-screen-label": tab, style: { display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", position: "relative" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            Header,
            {
              user,
              viewMode,
              setViewMode,
              theme: t.theme,
              setTheme: (v) => setTweak("theme", v),
              onOpenPalette: () => setPalette(true),
              onNewBrief: () => setNewBrief(true),
              defaultUsers: Object.assign([...data.USERS], { onPick: (u) => setUser(u) })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flex: 1, overflow: "hidden" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              Sidebar,
              {
                active: tab,
                onChange: setTab,
                collapsed: sidebarCollapsed,
                onToggle: () => setSidebarCollapsed((v) => !v),
                data: liveData
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { style: {
              flex: 1,
              overflowY: "auto",
              overflowX: "clip",
              background: "var(--paper)"
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bns-main-content", style: { maxWidth: 1400, margin: "0 auto", padding: "8px 32px 72px" }, children: Screen }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", { className: "bns-desktop-footer", style: {
                padding: "14px 28px 28px",
                maxWidth: 1400,
                margin: "0 auto",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                font: "400 11px/1 var(--font-sans)",
                color: "var(--ink-5)"
              }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
                  data.fmtTr ? data.fmtTr(data.lastSync ? Date.parse(data.lastSync) : data.NOW, { style: "footer" }) : "Son senkron \xB7 21 May 2026 \xB7 14:45 (Europe/Istanbul)",
                  lastPollTime && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { marginLeft: 8, color: "var(--ink-4)" }, children: [
                    "\xB7 ",
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: "var(--prio-green)", fontWeight: 500 }, children: "\u25CF" }),
                    " canl\u0131",
                    " \xB7 g\xFCncellendi " + Math.round((Date.now() - lastPollTime) / 1e3) + "sn \xF6nce"
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontFamily: "var(--font-mono)" }, children: "Benseno v7.13 \xB7 GitHub Pages" })
              ] })
            ] }, tab + t.overviewLayout)
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bns-mobile-nav-wrap", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MobileNav, { active: tab, onChange: setTab, data: liveData }) }),
          openBrief && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            BriefDrawer,
            {
              brief: openBrief,
              onClose: onCloseBrief,
              onUpdate: onUpdateBrief,
              allUsers: data.USERS,
              currentUser: user
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            CommandPalette,
            {
              open: palette,
              onClose: () => setPalette(false),
              data,
              currentTheme: t.theme,
              onOpenBrief: (b) => onOpenBrief(b),
              onNavigate: (id) => setTab(id),
              onTheme: (v) => setTweak("theme", v),
              onNewBrief: () => setNewBrief(true)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            NewBriefModal,
            {
              open: newBrief,
              onClose: () => setNewBrief(false),
              data,
              onCreate: onCreateBrief
            }
          ),
          toast && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toast, { msg: toast }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShortcutsHint, {}),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BenseoTweaks, { t, setTweak })
        ] });
      }
      function BenseoTweaks({ t, setTweak }) {
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TweaksPanel, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TweakSection, { label: "G\xF6r\xFCn\xFCm" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            TweakRadio,
            {
              label: "Tema",
              value: t.theme,
              options: ["light", "dark"],
              onChange: (v) => setTweak("theme", v)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            TweakRadio,
            {
              label: "Yo\u011Funluk",
              value: t.density,
              options: ["compact", "comfortable", "spacious"],
              onChange: (v) => setTweak("density", v)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            TweakToggle,
            {
              label: "Paper noise",
              value: t.noise,
              onChange: (v) => setTweak("noise", v)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TweakSection, { label: "Aktif i\u015Fler" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            TweakRadio,
            {
              label: "G\xF6r\xFCn\xFCm",
              value: t.tableMode,
              options: ["table", "kanban", "cards"],
              onChange: (v) => setTweak("tableMode", v)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            TweakSelect,
            {
              label: "Varsay\u0131lan kapsam",
              value: t.defaultView,
              options: [
                { value: "mine", label: "Bana atanm\u0131\u015F" },
                { value: "dept", label: "Departman\u0131m" },
                { value: "all", label: "T\xFCm ekip" }
              ],
              onChange: (v) => setTweak("defaultView", v)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TweakSection, { label: "KPI kartlar\u0131" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            TweakRadio,
            {
              label: "Varyant",
              value: t.kpiVariant,
              options: ["plain", "trendchart"],
              onChange: (v) => setTweak("kpiVariant", v)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TweakSection, { label: "Genel bak\u0131\u015F layout'u" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            TweakRadio,
            {
              label: "D\xFCzen",
              value: t.overviewLayout,
              options: ["editorial", "dense", "story"],
              onChange: (v) => setTweak("overviewLayout", v)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TweakSection, { label: "Aksan" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            TweakColor,
            {
              label: "--ember",
              value: t.ember,
              options: ["#C24A2C", "#3360A4", "#2E8F66", "#8E5BA1", "#16161A"],
              onChange: (v) => setTweak("ember", v)
            }
          )
        ] });
      }
      function Toast({ msg }) {
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
          position: "fixed",
          left: "50%",
          bottom: 24,
          transform: "translateX(-50%)",
          zIndex: 95,
          padding: "10px 16px",
          background: "var(--ink)",
          color: "var(--paper)",
          borderRadius: 999,
          boxShadow: "var(--shadow-2)",
          font: "500 13px/1 var(--font-sans)",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          animation: "bn-slide-up 200ms var(--ease-out-quart)"
        }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(I.Check, { size: 14 }),
          msg
        ] });
      }
      function ShortcutsHint() {
        const [open, setOpen] = React.useState(false);
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { onClick: () => setOpen(true), title: "Klavye k\u0131sayollar\u0131", style: {
            position: "fixed",
            left: 16,
            bottom: 16,
            zIndex: 40,
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: "7px 10px",
            borderRadius: 999,
            cursor: "pointer",
            font: "500 11px/1 var(--font-mono)",
            color: "var(--ink-3)",
            boxShadow: "var(--shadow-1)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(I.Command, { size: 12 }),
            " K\u0131sayollar"
          ] }),
          open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { onClick: () => setOpen(false), style: {
              position: "fixed",
              inset: 0,
              background: "var(--overlay)",
              zIndex: 96,
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              animation: "bn-fade 160ms var(--ease-out-quart)"
            } }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
              position: "fixed",
              left: "50%",
              top: "50%",
              transform: "translate(-50%,-50%)",
              zIndex: 97,
              width: "min(420px, 92vw)",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: 0,
              boxShadow: "var(--shadow-2)",
              animation: "bn-slide-up 220ms var(--ease-out-quart)"
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eyebrow, { children: "Klavye" }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18, color: "var(--ink-2)", marginTop: 4 }, children: "h\u0131zl\u0131 eri\u015Fim." })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => setOpen(false), style: { border: 0, background: "transparent", cursor: "pointer", color: "var(--ink-3)" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(I.X, { size: 16 }) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "14px 18px", display: "grid", gap: 8 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Short, { k: "\u2318 K", l: "Komut paletini a\xE7" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Short, { k: "N", l: "Yeni brief" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Short, { k: "\u2191 \u2193", l: "Paletteyi gez" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Short, { k: "\u21B5", l: "Se\xE7" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Short, { k: "esc", l: "Modal / drawer kapat" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Short, { k: "T", l: "Tema de\u011Fi\u015Ftir (palette i\xE7inden)" })
              ] })
            ] })
          ] })
        ] });
      }
      function Short({ k, l }) {
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { font: "400 13px/1.4 var(--font-sans)", color: "var(--ink-2)" }, children: l }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
            font: "500 11px/1 var(--font-mono)",
            color: "var(--ink-3)",
            padding: "4px 8px",
            border: "1px solid var(--line)",
            borderRadius: 5,
            background: "var(--paper-2)"
          }, children: k })
        ] });
      }
      function labelForStatus(s) {
        return { yeni: "Yeni", calisiliyor: "\xC7al\u0131\u015F\u0131l\u0131yor", incelemede: "\u0130ncelemede", blokeli: "Blokeli", tamamlandi: "Tamamland\u0131" }[s] || s;
      }
      function darken(hex, amt) {
        const m = hex.match(/^#([0-9a-f]{6})$/i);
        if (!m) return hex;
        const n = parseInt(m[1], 16);
        let r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
        const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 - amt))));
        return "#" + [f(r), f(g), f(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
      }
      ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ (0, import_jsx_runtime.jsx)(App, {}));
    }
  });
  require_App();
})();
