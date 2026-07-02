// app/screens/DeptCompare.jsx — Departmanlar özet: yıldız karnesi + 4 departman karşılaştırması (tarih filtresine bağlı).

var BNS_DEPTS = ["tasarim", "editor", "ai", "freelance"];
var BNS_DEPT_TR = { tasarim: "Tasarım", editor: "Editör", ai: "AI", freelance: "Freelance" };
var BNS_DEPT_PALETTE = { tasarim: "var(--bw-1)", editor: "var(--bw-4)", ai: "var(--bw-14)", freelance: "var(--bw-8)" };

// Bir tamamlanan işin departmana ait olup olmadığı (lead / brief.dept / contributor).
function bnsCompletedInDept(c, role) {
  return (window.bnsLeadList(c).some(l => l && (l.dept || l.rol) === role)) ||
    c.dept === role ||
    (Array.isArray(c.contributors) && c.contributors.some(x => x && (x.dept || x.rol) === role));
}

// ⭐ Yıldız Karnesi — ORTAK bileşen. Puan ortalamaları SEÇİLİ TARİH ARALIĞINDAKİ tamamlanan işlerin
// rating'lerinden hesaplanır. AI sebep açıklamaları da tarihe duyarlı: seçili aralığın
// sonunda yürürlükte olan dönem yorumu gösterilir (bnsSebepFor → tarihli arşiv).
// Döneme özel AI değerlendirmesi — LAZY: accordion AÇILDIĞINDA seçili [from,to]
// için /api/sebep-period'tan getirilir (sayfa/tarih değişiminde otomatik çalışmaz).
// Tarih aralığı değişirse açık accordion yeniden yükler; kapalıysa hiçbir maliyet yok.
function PeriodSebep({ type, skey, range }) {
  const [open, setOpen] = React.useState(false);
  const [st, setSt] = React.useState({ loading: false, text: null, bos: false, err: null, loaded: false });
  const from = (range && typeof range.from === "number") ? range.from : 0;
  const to   = (range && typeof range.to   === "number") ? range.to   : Date.now();
  const rk = type + ":" + skey + ":" + from + ":" + to;
  const prev = React.useRef(rk);
  if (prev.current !== rk) { prev.current = rk; if (st.loaded || st.loading) setSt({ loading: false, text: null, bos: false, err: null, loaded: false }); }

  const load = () => {
    if (st.loaded || st.loading) return;
    if (typeof window.bnsApiGet !== "function") { setSt({ loading: false, text: null, bos: false, err: "Değerlendirme yalnız canlı (API) modda üretilir.", loaded: true }); return; }
    setSt(s => ({ ...s, loading: true }));
    window.bnsApiGet(`/api/sebep-period?type=${encodeURIComponent(type)}&key=${encodeURIComponent(skey)}&from=${from}&to=${to}`)
      .then(j => setSt({ loading: false, text: j && j.sebep ? j.sebep : null, bos: !!(j && j.bos), err: null, loaded: true }))
      .catch(() => setSt({ loading: false, text: null, bos: false, err: "Değerlendirme yüklenemedi.", loaded: true }));
  };
  const toggle = () => { const n = !open; setOpen(n); if (n) load(); };

  // Fragment: toggle satırın SAĞINA yaslanır (marginLeft:auto), açılan panel ise
  // flex-basis:100% ile ALT satıra tam genişlik düşer — editoryal yıldız karnesi düzeni.
  return (
    <React.Fragment>
      <button onClick={toggle} title={open ? "Kapat" : "Döneme özel değerlendirmeyi aç"}
        style={{marginLeft:"auto", display:"inline-flex", alignItems:"center", gap:6, background:"none", border:"none", padding:"2px 0", cursor:"pointer",
          font:`${open?600:500} 11px/1 var(--font-sans)`, letterSpacing:".02em", color: open ? "var(--ink-2)" : "var(--ink-4)", flexShrink:0}}>
        <span style={{display:"inline-block", fontSize:9, transition:"transform .15s", transform:open?"rotate(90deg)":"none", color:"var(--ink-4)"}}>▸</span>
        Değerlendirme
      </button>
      {open && <div style={{flexBasis:"100%", width:"100%", marginTop:4, paddingLeft:13, borderLeft:"2px solid var(--line-strong)",
        font:"400 12.5px/1.6 var(--font-sans)", color:"var(--ink-2)", overflowWrap:"anywhere"}}>
        {st.loading ? <span style={{color:"var(--ink-4)", fontStyle:"italic"}}>değerlendirme hazırlanıyor…</span>
         : st.err ? <span style={{color:"var(--ink-4)"}}>{st.err}</span>
         : st.bos ? <span style={{color:"var(--ink-4)"}}>Bu dönemde değerlendirilecek tamamlanan iş yok.</span>
         : st.text ? <Linkify text={st.text}/>
         : <span style={{color:"var(--ink-4)"}}>—</span>}
      </div>}
    </React.Fragment>
  );
}
window.PeriodSebep = PeriodSebep;  // Marka detay gibi diğer ekranlar da lazy dönem-yorumunu kullanabilsin.

// Modül kapsamında — StarReport içinde TANIMLANMAZ. (İçeride tanımlansaydı her parent
// re-render'da yeni bileşen kimliği oluşur, PeriodSebep remount olur, açık accordion +
// yüklenen yorum kaybolurdu.) range, PeriodSebep'e geçer.
function StarRow({ label, avg, cnt, stype, skey, big, range }) {
  return (
    <div style={{display:"flex", flexWrap:"wrap", alignItems:"flex-start", gap:12, rowGap:6, padding:"9px 0", borderBottom:"1px solid var(--line-soft)"}}>
      <span style={{font:`${big?600:500} 13px/1.3 var(--font-sans)`, color:"var(--ink)", minWidth:150, flexShrink:0}}>{label}</span>
      <span style={{display:"inline-flex", gap:1, flexShrink:0, paddingTop:1}}>
        {[1,2,3,4,5].map(i => <I.StarFill key={i} size={12} color={i <= Math.round(avg) ? "var(--prio-yellow)" : "var(--line-strong)"}/>)}
      </span>
      <span style={{font:"600 13px/1.3 var(--font-mono)", color:"var(--ink)", flexShrink:0}}>{cnt ? avg : "—"}</span>
      <span style={{font:"400 11px/1.4 var(--font-sans)", color:"var(--ink-4)", flexShrink:0}}>({cnt} iş)</span>
      <PeriodSebep type={stype} skey={skey} range={range}/>
    </div>
  );
}

function StarReport({ data, depts }) {
  const list = depts || BNS_DEPTS;
  const comp = data.completed || [];           // üst global tarih aralığına süzülü
  const rated = comp.filter(c => c.rating > 0);
  const avgOf = (arr) => arr.length ? arr.reduce((s, c) => s + c.rating, 0) / arr.length : 0;
  const firmaAvg = +avgOf(rated).toFixed(1), firmaCnt = rated.length;
  const range = data.dateRange;

  return (
    <Card style={{marginBottom:"var(--section-gap)"}}>
      <Eyebrow>⭐ Yıldız Karnesi</Eyebrow>
      <div style={{marginTop:6}}>
        {list.length > 1 && <StarRow label="Benseno (tüm firma)" avg={firmaAvg} cnt={firmaCnt} stype="firma" skey="benseno" range={range} big/>}
        {list.map(role => {
          const dr = rated.filter(c => bnsCompletedInDept(c, role));
          return <StarRow key={role} label={BNS_DEPT_TR[role] || role} avg={+avgOf(dr).toFixed(1)} cnt={dr.length} stype="dept" skey={role} range={range} big={list.length === 1}/>;
        })}
      </div>
      <div style={{marginTop:8, font:"400 10px/1 var(--font-sans)", color:"var(--ink-4)"}}>
        Puan ortalamaları seçili tarih aralığındaki tamamlanan işlerden · Değerlendirmeyi açtığında o döneme özel yorum üretilir (tarih değişince yeniden)
      </div>
    </Card>
  );
}
window.StarReport = StarReport;

function DeptCompareScreen({ data }) {
  const raw = data.deptStats || {};
  const DEPT_DEF = {
    tasarim:   { name: "Tasarım",   people: 7, capacity: 42 },
    editor:    { name: "Editör",    people: 8, capacity: 48 },
    ai:        { name: "AI",        people: 1, capacity:  6 },
    freelance: { name: "Freelance", people: 3, capacity: 36 },
  };
  const allBriefs    = data._allBriefs    || data.briefs    || [];
  const allCompleted = data.completed || data._allCompleted || [];   // seçili tarih aralığına süzülü
  const _allCompleted = data._allCompleted || data.completed || []; // TÜM tamamlananlar (geri-hesaplama için)
  const RANGE_LABELS = { today:"Bugün", yesterday:"Dün", "7d":"Son 7 gün", "30d":"Son 30 gün", "90d":"Son 90 gün", year:"Bu yıl", all:"Tüm zamanlar", custom:"Seçili aralık" };
  const rangeLabel = RANGE_LABELS[(data.dateRange || {}).preset] || "Seçili aralık";

  // Aktif yük / kapasite tarihe duyarlı: seçili aralığın SONU geçmişteyse, o tarihte
  // açık olan iş kümesini zaman damgalarından geri-hesapla; bugünü kapsıyorsa güncel.
  const _now = (window.BNS_DATA && window.BNS_DATA.NOW) || Date.now();
  const _dr = data.dateRange || {};
  const cutoff = (typeof _dr.to === "number" && _dr.to < _now) ? _dr.to : null;
  const asOfBriefs = bnsBriefsAsOf(allBriefs, _allCompleted, cutoff);

  function deptCompleted(role) { return allCompleted.filter(c => bnsCompletedInDept(c, role)); }

  const d = {};
  for (const role of BNS_DEPTS) {
    const active = bnsDeptActive(asOfBriefs, role);
    const doneR = deptCompleted(role);                              // aralıkta tamamlanan
    const sures = doneR.filter(c => c.sureH > 0).map(c => c.sureH);
    const avgH  = sures.length ? Math.round(sures.reduce((a,v)=>a+v,0)/sures.length) : 0;
    const revs  = doneR.map(c => c.revision || 0);
    const avgRev = revs.length ? parseFloat((revs.reduce((a,v)=>a+v,0)/revs.length).toFixed(2)) : 0;
    const stat = { ...DEPT_DEF[role], ...(raw[role] || {}) };
    // Geciken: geçmiş modda o tarihte deadline geçmiş açık işler; bugünde mevcut delta.
    const overdue = cutoff
      ? active.filter(b => typeof b.deadline === "number" && b.deadline < cutoff).length
      : active.filter(b => b.deltaH <= 0 && b.durum !== "tamamlandi").length;
    d[role] = {
      name: stat.name || (BNS_DEPT_TR[role]),
      people: stat.people || 0,
      capacity: stat.capacity || 0,
      active: active.length,
      overdue,
      completed: doneR.length,                                     // aralıkta tamamlanan
      avgComplete: avgH,
      revRate: avgRev,
      capacity_pct: (stat.capacity > 0) ? bnsDeptCapPct(asOfBriefs, stat, role) : 0,
    };
  }

  const metrics = [
    { key: "completed",   label: "Tamamlanan iş",          unit: "" },
    { key: "avgComplete", label: "Ort. tamamlama süresi",  unit: "sa" },
    { key: "overdue",     label: "Geciken iş",             unit: "" },
    { key: "active",      label: "Aktif yük",              unit: "" },
    { key: "revRate",     label: "Revize oranı",           unit: "%" }
  ];

  return (
    <div className="bn-tab-in">
      <PageHead
        title="Departmanlar özet"
        subtitle={`tasarım · editör · AI · freelance · ${rangeLabel}`}/>

      {/* ⭐ Yıldız Karnesi — tüm departmanlar (tarihe duyarlı) */}
      <StarReport data={data} depts={BNS_DEPTS}/>

      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: "var(--section-gap)"}}>
        {BNS_DEPTS.map(k => {
          const s = d[k];
          return (
            <Card key={k} accent={BNS_DEPT_PALETTE[k]}>
              <Eyebrow>{s.name} · {s.people} kişi</Eyebrow>
              <div style={{display:"flex", alignItems:"baseline", gap: 10, marginTop: 8}}>
                <span style={{font:"600 36px/1.15 var(--font-sans)", color:"var(--ink)", letterSpacing:"-0.01em", fontVariantNumeric:"tabular-nums"}}>{s.active}</span>
                <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink-3)"}}>aktif iş</span>
              </div>
              <div style={{font:"500 12px/1.4 var(--font-sans)", color:"var(--ink-3)", marginTop: 6}}>
                <span style={{color:"var(--prio-red)", fontWeight: 600}}>{s.overdue}</span> geciken ·{" "}
                <span style={{color: s.capacity_pct > 85 ? "var(--warning)" : "var(--ink)", fontWeight: 600}}>%{s.capacity_pct}</span> kapasite
              </div>
              <div style={{marginTop: 12, height: 6, background:"var(--line-soft)", borderRadius:999, overflow:"hidden"}}>
                <div style={{width: s.capacity_pct + "%", height:"100%", background: BNS_DEPT_PALETTE[k]}}/>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHead title="Metrik karşılaştırma" sub={`bar chart · ${rangeLabel}`}/>
        <div style={{display:"flex", flexDirection:"column", gap: 18, paddingTop: 4}}>
          {metrics.map(m => {
            const max = Math.max(...BNS_DEPTS.map(k => d[k][m.key]));
            return (
              <div key={m.key}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom: 8}}>
                  <span style={{font:"600 13px/1 var(--font-sans)", color:"var(--ink-2)"}}>{m.label}</span>
                  <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)"}}>en yüksek: {fmtN(max, m.unit)}</span>
                </div>
                <div style={{display:"grid", gridTemplateColumns: "100px 1fr", rowGap: 6, columnGap: 12, alignItems:"center"}}>
                  {BNS_DEPTS.map(k => {
                    const s = d[k];
                    const w = max === 0 ? 0 : (s[m.key] / max) * 100;
                    return (
                      <React.Fragment key={k}>
                        <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink-2)"}}>{s.name}</span>
                        <div style={{display:"flex", alignItems:"center", gap: 10}}>
                          <div style={{flex:1, height: 18, background:"var(--paper-2)", borderRadius: 4, overflow:"hidden"}}>
                            <div style={{
                              width:"100%", height:"100%", background: BNS_DEPT_PALETTE[k],
                              transform:`scaleX(${w/100})`, transformOrigin:"left",
                              transition:"transform 240ms cubic-bezier(0.2,0,0,1)"
                            }}/>
                          </div>
                          <span style={{font:"600 12px/1 var(--font-mono)", color:"var(--ink)", minWidth: 56, textAlign:"right", fontVariantNumeric:"tabular-nums"}}>
                            {fmtN(s[m.key], m.unit)}
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function fmtN(v, unit) {
  if (v == null || isNaN(v)) return "—";
  if (unit === "%") return "%" + (Number.isInteger(v) ? v : v.toFixed(2));
  if (unit === "sa") return (Number.isInteger(v) ? v : v.toFixed(1)).toString().replace(".", ",") + " sa";
  return String(v);
}

window.DeptCompareScreen = DeptCompareScreen;
