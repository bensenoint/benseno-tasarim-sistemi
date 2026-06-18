// app/screens/Lab.jsx — v2 SANDBOX "Analitik Lab" ekranı.
// Tasarım denemeleri: anlamlı grafikler + interaktif alanlar. Gerçek liveData'ya bağlı.
// 7 bölüm: Ody aksiyon kartı · filtre çipleri+tablo · termin ufku · kapasite ısısı ·
//          kalite/teslim · durum akış hunisi · marka drill-down.

// ── küçük yardımcılar ──────────────────────────────────────────────
function labNow(data) { return (data && data.NOW) || (window.BNS_DATA && window.BNS_DATA.NOW) || Date.now(); }
function labPrioColor(code) {
  return ({ over: "var(--prio-red)", red: "var(--prio-red)", org: "var(--prio-orange)",
            ylw: "var(--prio-yellow)", grn: "var(--prio-green)" })[code] || "var(--ink-4)";
}
function labPersonOn(b, uid) {
  return (b.lead && b.lead.id === uid) || (Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === uid));
}
function LabCard({ title, hint, children, pad = 16 }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 0, marginBottom: 16, overflow: "hidden" }}>
      {title && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <span style={{ font: "italic 500 18px/1.15 var(--font-display)", color: "var(--ink)", letterSpacing: "0" }}>{title}</span>
          {hint && <span style={{ font: "400 11px/1.3 var(--font-sans)", color: "var(--ink-4)" }}>{hint}</span>}
        </div>
      )}
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}

// ── ① Ody aksiyon kartı ────────────────────────────────────────────
function LabOdyCard({ active, overdue, today, review, extended, onChip }) {
  const mood = overdue > 2 ? "😠" : overdue >= 1 ? "😟" : active >= 6 ? "😅" : review > 0 ? "🤔" : "🙂";
  const line = overdue > 2 ? `${overdue} iş gecikti — acil müdahale gerek!`
    : overdue >= 1 ? `${overdue} geciken iş var, önce onlara bak.`
    : active >= 6 ? "Yoğun bir gün; işler kontrol altında."
    : review > 0 ? `${review} iş incelemede, gözden geçirilmeyi bekliyor.`
    : "Her şey yolunda görünüyor. 👍";
  const chips = [
    overdue > 0 && { k: "overdue", t: `${overdue} geciken`, c: "var(--prio-red)" },
    today > 0 && { k: "today", t: `${today} bugün teslim`, c: "var(--prio-orange)" },
    review > 0 && { k: "review", t: `${review} incelemede`, c: "var(--ink-2)" },
    extended > 0 && { k: "extended", t: `${extended} uzatılmış`, c: "var(--prio-yellow)" },
  ].filter(Boolean);
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 0, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 40, lineHeight: 1, flexShrink: 0 }}>{mood}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "600 14px/1.3 var(--font-sans)", color: "var(--ink)", marginBottom: 8 }}>{line}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {chips.length ? chips.map(ch => (
            <button key={ch.k} onClick={() => onChip(ch.k)} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              font: "600 12px/1 var(--font-sans)", color: ch.c, background: "transparent",
              border: 0, padding: "2px 0", cursor: "pointer" }}>
              <I.Dot size={6} color={ch.c}/>{ch.t} →
            </button>
          )) : <span style={{ font: "400 12px/1 var(--font-sans)", color: "var(--ink-4)" }}>aksiyon gerektiren iş yok</span>}
        </div>
      </div>
    </div>
  );
}

// ── ③ Termin ufku şeridi (14 gün) ──────────────────────────────────
function LabHorizon({ briefs, now, onOpenBrief }) {
  const W = 1000, H = 172, padL = 8, padR = 8, top = 20, bot = 28;
  const dMin = -3, dMax = 14;
  const xOf = (days) => padL + ((Math.max(dMin, Math.min(dMax, days)) - dMin) / (dMax - dMin)) * (W - padL - padR);
  const items = briefs
    .filter(b => b.durum !== "musteride" && b.deltaH != null && b.deltaH / 24 <= dMax)
    .map((b, i) => ({ b, d: b.deltaH / 24, i }));
  const ticks = [-2, 0, 2, 4, 6, 8, 10, 12, 14];
  const x0 = xOf(0);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        {/* geçmiş (gecikme) bölgesi */}
        <rect x={padL} y={top} width={x0 - padL} height={H - top - bot} fill="var(--prio-red)" opacity="0.06" />
        {ticks.map(t => (
          <g key={t}>
            <line x1={xOf(t)} y1={top} x2={xOf(t)} y2={H - bot} stroke="var(--line)" strokeWidth={t === 0 ? 2 : 1} strokeDasharray={t === 0 ? "" : "3 4"} opacity={t === 0 ? 0.9 : 0.5} />
            <text x={xOf(t)} y={H - 8} fill="var(--ink-4)" fontSize="11" textAnchor="middle" fontFamily="var(--font-sans)">{t === 0 ? "bugün" : (t < 0 ? `${t}g` : `+${t}g`)}</text>
          </g>
        ))}
        {items.map(({ b, d, i }) => {
          const cx = xOf(d);
          const cy = top + 8 + ((i * 41) % (H - top - bot - 16));
          const col = labPrioColor((b.oncelik && b.oncelik.code) || (b.priority && b.priority.code));
          return (
            <circle key={b.id} cx={cx} cy={cy} r={6} fill={col} stroke="var(--surface)" strokeWidth="1.5"
              style={{ cursor: "pointer" }} onClick={() => onOpenBrief && onOpenBrief(b)}>
              <title>{`${b.marka} · ${b.baslik}\n${d < 0 ? Math.abs(Math.round(d)) + " gün gecikmiş" : Math.round(d) + " gün kaldı"}`}</title>
            </circle>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
        {[["ACİL", "red"], ["YÜKSEK", "org"], ["NORMAL", "ylw"], ["DÜŞÜK", "grn"]].map(([l, c]) => (
          <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 5, font: "500 11px/1 var(--font-sans)", color: "var(--ink-4)" }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: labPrioColor(c) }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── ④ Kapasite ısı şeridi ──────────────────────────────────────────
function LabCapacity({ briefs, users, onSwitchTab }) {
  const rows = (users || [])
    .filter(u => u && u.active !== false)
    .map(u => {
      const load = briefs.filter(b => b.durum !== "musteride" && labPersonOn(b, u.id)).length;
      const cap = (typeof bnsPersonCapLimit === "function" ? bnsPersonCapLimit(u) : 6) || 6;
      return { u, load, cap, pct: Math.round((load / cap) * 100) };
    })
    .filter(r => r.load > 0 || r.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 14);
  const barColor = (pct) => pct > 100 ? "var(--prio-red)" : pct > 75 ? "var(--prio-orange)" : pct > 40 ? "var(--prio-yellow)" : "var(--prio-green)";
  if (!rows.length) return <div style={{ color: "var(--ink-4)", font: "400 13px var(--font-sans)" }}>Veri yok.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map(({ u, load, cap, pct }) => (
        <div key={u.id} title={`${load}/${cap} iş`} style={{ display: "grid", gridTemplateColumns: "100px 1fr 56px", alignItems: "center", gap: 14, padding: "5px 0" }}>
          <span style={{ font: "400 13px/1.2 var(--font-sans)", color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name || u.id}</span>
          {/* editoryal ince cetvel: 1px çizgi + ince dolgu */}
          <div style={{ height: 1, background: "var(--line)", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: -1, height: 3, width: Math.min(100, pct) + "%", background: barColor(pct), transition: "width 240ms" }} />
          </div>
          <span style={{ textAlign: "right", font: "500 16px/1 var(--font-display)", color: barColor(pct) }}>%{pct}</span>
        </div>
      ))}
    </div>
  );
}

// ── ⑤ Kalite & teslim dağılımı ─────────────────────────────────────
function LabQuality({ completed }) {
  const rated = completed.filter(c => c.rating > 0);
  const buckets = [1, 2, 3, 4, 5].map(s => rated.filter(c => Math.round(c.rating) === s).length);
  const maxB = Math.max(1, ...buckets);
  const avg = rated.length ? (rated.reduce((a, c) => a + c.rating, 0) / rated.length) : 0;
  const ds = { zamaninda: 0, uzatildi: 0, gec: 0 };
  completed.forEach(c => { if (ds[c.delivery_status] != null) ds[c.delivery_status]++; });
  const dsTotal = ds.zamaninda + ds.uzatildi + ds.gec || 1;
  const dsDefs = [["zamaninda", "Zamanında", "var(--prio-green)"], ["uzatildi", "Uzatılarak", "var(--prio-yellow)"], ["gec", "Gecikmeli", "var(--prio-red)"]];
  if (!completed.length) return <div style={{ color: "var(--ink-4)", font: "400 13px var(--font-sans)" }}>Seçili aralıkta tamamlanan iş yok.</div>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div>
        <div style={{ font: "500 11px/1 var(--font-sans)", color: "var(--ink-4)", marginBottom: 10 }}>Kalite puanı dağılımı · ort. <b style={{ color: "var(--ember)" }}>{avg.toFixed(1)}</b></div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 120 }}>
          {buckets.map((n, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ font: "600 11px/1 var(--font-mono)", color: "var(--ink-3)" }}>{n}</span>
              <div title={`${i + 1} yıldız: ${n} iş`} style={{ width: "100%", height: Math.round((n / maxB) * 90) + 4, background: "var(--ember)", opacity: 0.35 + 0.13 * i, borderRadius: "5px 5px 0 0" }} />
              <span style={{ font: "600 11px/1 var(--font-sans)", color: "var(--ink-4)" }}>{i + 1}★</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ font: "500 11px/1 var(--font-sans)", color: "var(--ink-4)", marginBottom: 10 }}>Teslim performansı</div>
        <div style={{ display: "flex", height: 22, borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
          {dsDefs.map(([k, , c]) => ds[k] > 0 && (
            <div key={k} title={`${ds[k]} iş`} style={{ width: (ds[k] / dsTotal * 100) + "%", background: c }} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {dsDefs.map(([k, l, c]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, font: "500 12px/1 var(--font-sans)", color: "var(--ink-2)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}
              <span style={{ marginLeft: "auto", font: "600 12px var(--font-mono)", color: "var(--ink-3)" }}>{ds[k]} · %{Math.round(ds[k] / dsTotal * 100)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ⑥ Durum akış hunisi ────────────────────────────────────────────
function LabFunnel({ briefs, completedCount }) {
  const order = [["yeni", "Yeni", "var(--ink-3)"], ["calisiliyor", "Çalışılıyor", "var(--prio-orange)"],
    ["incelemede", "İncelemede", "var(--prio-yellow)"], ["blokeli", "Blokeli", "var(--prio-red)"],
    ["musteride", "Müşteride", "var(--musteride)"], ["tamamlandi", "Tamamlandı", "var(--prio-green)"]];
  const counts = {};
  briefs.forEach(b => { counts[b.durum] = (counts[b.durum] || 0) + 1; });
  counts.tamamlandi = completedCount;
  const max = Math.max(1, ...order.map(([k]) => counts[k] || 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {order.map(([k, l, c]) => {
        const n = counts[k] || 0;
        return (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "92px 1fr 40px", alignItems: "center", gap: 10 }}>
            <span style={{ font: "500 12px/1 var(--font-sans)", color: "var(--ink-3)" }}>{l}</span>
            <div style={{ height: 24, background: "var(--paper-2)", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: Math.max(2, (n / max) * 100) + "%", height: "100%", background: c, opacity: 0.85, borderRadius: 5, transition: "width 240ms" }} />
            </div>
            <span style={{ font: "700 13px/1 var(--font-mono)", color: "var(--ink-2)", textAlign: "right" }}>{n}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── ⑦ Marka drill-down ─────────────────────────────────────────────
function LabBrands({ briefs, completed, brands, sel, onSel }) {
  const names = [...new Set(briefs.map(b => b.marka).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  const colorOf = (name) => (brands || []).find(br => br.name === name)?.color || "var(--ink-4)";
  if (sel) {
    const bs = briefs.filter(b => b.marka === sel);
    const cs = completed.filter(c => c.marka === sel);
    const overdue = bs.filter(b => b.deltaH <= 0 && b.durum !== "musteride").length;
    const rated = cs.filter(c => c.rating > 0);
    const avg = rated.length ? (rated.reduce((a, c) => a + c.rating, 0) / rated.length).toFixed(1) : "—";
    const rev = bs.reduce((a, b) => a + (b.rev_ic || 0) + (b.rev_musteri || 0), 0);
    const kpi = [["Aktif iş", bs.length], ["Geciken", overdue], ["Ort. puan", avg], ["Tamamlanan", cs.length], ["Revizyon", rev]];
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ width: 12, height: 12, borderRadius: 4, background: colorOf(sel) }} />
          <span style={{ font: "italic 500 18px/1.15 var(--font-display)", color: "var(--ink)", letterSpacing: "0" }}>{sel}</span>
          <button onClick={() => onSel(null)} style={{ marginLeft: "auto", font: "500 12px/1 var(--font-sans)", color: "var(--ink-3)", background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>← tüm markalar</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
          {kpi.map(([l, v]) => (
            <div key={l} style={{ background: "var(--paper-2)", borderRadius: 0, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ font: "700 22px/1 var(--font-sans)", color: "var(--ink)" }}>{v}</div>
              <div style={{ font: "500 11px/1 var(--font-sans)", color: "var(--ink-4)", marginTop: 5 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {names.map(name => {
        const n = briefs.filter(b => b.marka === name).length;
        return (
          <button key={name} onClick={() => onSel(name)} style={{
            display: "inline-flex", alignItems: "center", gap: 7, font: "500 12px/1 var(--font-sans)", color: "var(--ink-2)",
            background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "7px 12px", cursor: "pointer" }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: colorOf(name) }} />{name}
            <span style={{ font: "600 11px var(--font-mono)", color: "var(--ink-4)" }}>{n}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── ② filtre çipleri + tablo ───────────────────────────────────────
function LabJobList({ briefs, chip, setChip, now, onOpenBrief }) {
  const defs = [["all", "Tümü"], ["overdue", "Geciken"], ["today", "Bugün teslim"], ["review", "İncelemede"], ["extended", "Uzatılmış"]];
  const rows = briefs.filter(b => {
    if (chip === "overdue") return b.deltaH <= 0 && b.durum !== "tamamlandi" && b.durum !== "musteride";
    if (chip === "today") return b.deltaH > 0 && b.deltaH <= 24;
    if (chip === "review") return b.durum === "incelemede";
    if (chip === "extended") return b.uzatildi;
    return b.durum !== "musteride";
  }).sort((a, b) => (a.deltaH ?? 999) - (b.deltaH ?? 999)).slice(0, 40);
  return (
    <div>
      <div style={{ display: "inline-flex", gap: 1, flexWrap: "wrap", marginBottom: 12, padding: 2, border: "1px solid var(--line)", borderRadius: 6 }}>
        {defs.map(([k, l]) => (
          <button key={k} onClick={() => setChip(k)} style={{
            font: `${chip === k ? 600 : 500} 12px/1 var(--font-sans)`, color: chip === k ? "var(--ink)" : "var(--ink-4)",
            background: chip === k ? "var(--paper-2)" : "transparent", border: 0, borderRadius: 4,
            padding: "6px 13px", cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      {rows.length ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((b, i) => (
            <div key={b.id} onClick={() => onOpenBrief && onOpenBrief(b)} style={{
              display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 10, alignItems: "center",
              padding: "9px 8px", borderBottom: "1px solid var(--line)", cursor: "pointer",
              background: i % 2 ? "var(--surface-sub)" : "transparent" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: labPrioColor((b.oncelik && b.oncelik.code) || (b.priority && b.priority.code)), flexShrink: 0 }} />
              <span style={{ font: "500 13px/1.2 var(--font-sans)", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span style={{ color: "var(--ink-4)" }}>{b.marka} · </span>{b.baslik}
              </span>
              {b.uzatildi && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, font: "600 10px/1 var(--font-sans)", color: "var(--prio-yellow)" }}><I.Dot size={6} color="var(--prio-yellow)"/>uzatıldı</span>}
              <span style={{ font: "600 11px/1 var(--font-mono)", color: b.deltaH <= 0 ? "var(--prio-red)" : "var(--ink-4)", textAlign: "right", whiteSpace: "nowrap" }}>
                {b.deltaH == null ? "—" : b.deltaH <= 0 ? `${Math.abs(Math.round(b.deltaH / 24))}g geç` : `${Math.round(b.deltaH / 24)}g`}
              </span>
            </div>
          ))}
        </div>
      ) : <div style={{ padding: 24, textAlign: "center", color: "var(--ink-4)", font: "400 13px var(--font-sans)" }}>Bu filtrede iş yok.</div>}
    </div>
  );
}

// ── ana ekran ──────────────────────────────────────────────────────
function LabScreen({ data, user, currentUser, onOpenBrief, onSwitchTab }) {
  const now = labNow(data);
  const briefs = (data && data.briefs) || [];
  const completed = (data && data.completed) || [];
  const [chip, setChip] = React.useState("all");
  const [brandSel, setBrandSel] = React.useState(null);

  const overdue = briefs.filter(b => b.deltaH <= 0 && b.durum !== "tamamlandi" && b.durum !== "musteride").length;
  const today = briefs.filter(b => b.deltaH > 0 && b.deltaH <= 24).length;
  const review = briefs.filter(b => b.durum === "incelemede").length;
  const extended = briefs.filter(b => b.uzatildi).length;
  const activeCount = briefs.filter(b => b.durum !== "musteride").length;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ font: "italic 500 30px/1.05 var(--font-display)", color: "var(--ink)", letterSpacing: "0", marginBottom: 4 }}>Analitik Lab</div>
      <div style={{ font: "400 13px/1.4 var(--font-sans)", color: "var(--ink-4)", marginBottom: 18 }}>
        Deneysel görseller ve interaktif alanlar — gerçek verilerle. (v2 sandbox)
      </div>

      <LabOdyCard active={activeCount} overdue={overdue} today={today} review={review} extended={extended} onChip={setChip} />

      <LabCard title="Termin ufku" hint="önümüzdeki 14 gün · noktaya tıkla → iş detayı">
        <LabHorizon briefs={briefs} now={now} onOpenBrief={onOpenBrief} />
      </LabCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <LabCard title="Kapasite ısısı" hint="kişi yükü / kapasite">
          <LabCapacity briefs={briefs} users={data.USERS} onSwitchTab={onSwitchTab} />
        </LabCard>
        <LabCard title="Durum akışı" hint="pipeline dağılımı">
          <LabFunnel briefs={briefs} completedCount={completed.length} />
        </LabCard>
      </div>

      <LabCard title="Kalite & teslim" hint="seçili tarih aralığındaki tamamlananlar">
        <LabQuality completed={completed} />
      </LabCard>

      <LabCard title="Markalar" hint={brandSel ? "" : "bir markaya tıkla → mini panel"}>
        <LabBrands briefs={briefs} completed={completed} brands={data.BRANDS} sel={brandSel} onSel={setBrandSel} />
      </LabCard>

      <LabCard title="İşler" hint="filtre çipleri ile süz · satıra tıkla → aç">
        <LabJobList briefs={briefs} chip={chip} setChip={setChip} now={now} onOpenBrief={onOpenBrief} />
      </LabCard>
    </div>
  );
}

window.LabScreen = LabScreen;
