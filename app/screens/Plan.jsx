// app/screens/Plan.jsx — gantt + deadlines timeline.

// ─── TÜRKİYE RESMİ TATİLLERİ ────────────────────────────────────────────────
// MM-DD formatında sabit tatiller (her yıl tekrar eder)
const TR_FIXED_HOLIDAYS = [
  "01-01", // Yılbaşı
  "04-23", // Ulusal Egemenlik ve Çocuk Bayramı
  "05-01", // Emek ve Dayanışma Günü
  "05-19", // Atatürk'ü Anma, Gençlik ve Spor Bayramı
  "07-15", // Demokrasi ve Millî Birlik Günü
  "08-30", // Zafer Bayramı
  "10-28", // Cumhuriyet Bayramı arifesi (öğleden sonra — tam gün sayılır)
  "10-29", // Cumhuriyet Bayramı
];

// Yıla göre değişen dini bayramlar (Hicri takvim)
// 2025–2027 tarihleri
const TR_VARIABLE_HOLIDAYS = [
  // Ramazan Bayramı 2025: 30 Mar – 1 Nis (arife 29 Mar)
  "2025-03-29","2025-03-30","2025-03-31","2025-04-01",
  // Kurban Bayramı 2025: 5–9 Haz (arife 4 Haz)
  "2025-06-04","2025-06-05","2025-06-06","2025-06-07","2025-06-08","2025-06-09",
  // Ramazan Bayramı 2026: 19–21 Mar (arife 18 Mar)
  "2026-03-18","2026-03-19","2026-03-20","2026-03-21",
  // Kurban Bayramı 2026: 25–28 May (arife 24 May)
  "2026-05-24","2026-05-25","2026-05-26","2026-05-27","2026-05-28",
  // Ramazan Bayramı 2027: 8–10 Mar (arife 7 Mar)
  "2027-03-07","2027-03-08","2027-03-09","2027-03-10",
  // Kurban Bayramı 2027: 14–17 May (arife 13 May)
  "2027-05-13","2027-05-14","2027-05-15","2027-05-16","2027-05-17",
];

const TR_VAR_SET = new Set(TR_VARIABLE_HOLIDAYS);

function isTRHoliday(date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  if (TR_FIXED_HOLIDAYS.includes(`${mm}-${dd}`)) return true;
  if (TR_VAR_SET.has(`${yyyy}-${mm}-${dd}`)) return true;
  return false;
}

function isTRHolidayName(date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  const key = `${mm}-${dd}`;
  if (key === "01-01") return "Yılbaşı";
  if (key === "04-23") return "23 Nisan";
  if (key === "05-01") return "1 Mayıs";
  if (key === "05-19") return "19 Mayıs";
  if (key === "07-15") return "15 Temmuz";
  if (key === "08-30") return "30 Ağustos";
  if (key === "10-28") return "Cum. Arife";
  if (key === "10-29") return "Cumhuriyet";
  const isoKey = `${yyyy}-${mm}-${dd}`;
  if (["2025-03-29","2026-03-18","2027-03-07"].includes(isoKey) ||
      ["2025-03-30","2026-03-19","2027-03-08"].includes(isoKey) ||
      ["2025-03-31","2026-03-20","2027-03-09"].includes(isoKey) ||
      ["2025-04-01","2026-03-21","2027-03-10"].includes(isoKey)) return "Ramazan";
  return "Kurban";
}

window.isTRHoliday = isTRHoliday;
window.isTRHolidayName = isTRHolidayName;

// ─── PLAN (gantt) ───────────────────────────────────────────────────────────
function PlanScreen({ data, onOpenBrief }) {
  const [horizon, setHorizon] = React.useState(14);
  const days = horizon;
  const dayMs = 24 * 3600 * 1000;
  const todayStart = new Date(data.NOW); todayStart.setHours(0,0,0,0);
  const startMs = todayStart.getTime() - 2 * dayMs;
  const endMs = startMs + days * dayMs;
  const span = endMs - startMs;

  // Sort by start time
  const allBriefs = data._allBriefs || data.briefs || [];
  const visible = allBriefs
    .filter(b => b.deadline >= startMs && b.acilma <= endMs)
    .sort((a, b) => a.deadline - b.deadline)
    .slice(0, 60);

  const colW = 100 / days;

  return (
    <div className="bn-tab-in">
      <PageHead
        title={`Plan · ${days} günlük gantt`}
        subtitle="brief'lerin başlangıçtan deadline'a süresi · öncelik renkleriyle"
        actions={<>
          <Button kind={horizon===7 ?"secondary":"ghost"} size="sm" onClick={() => setHorizon(7)}>7 gün</Button>
          <Button kind={horizon===14?"secondary":"ghost"} size="sm" onClick={() => setHorizon(14)}>14 gün</Button>
          <Button kind={horizon===30?"secondary":"ghost"} size="sm" onClick={() => setHorizon(30)}>30 gün</Button>
        </>}
      />

      <Card padding={0}>
        {/* Day header */}
        <div style={{display:"flex", borderBottom:"1px solid var(--line)", background:"var(--surface-sub)"}}>
          <div style={{width: 240, padding:"10px 14px", borderRight:"1px solid var(--line)", font:"600 11px/1 var(--font-sans)", color:"var(--ink-3)", letterSpacing:"0.04em", textTransform:"uppercase"}}>Brief</div>
          <div style={{flex:1, display:"flex", position:"relative"}}>
            {Array.from({length: days}).map((_, i) => {
              const d = new Date(startMs + i * dayMs);
              const isToday = i === 2;
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const isHoliday = !isWeekend && isTRHoliday(d);
              const holidayName = isHoliday ? isTRHolidayName(d) : null;
              const isOff = isWeekend || isHoliday;
              return (
                <div key={i} title={holidayName || undefined} style={{
                  flex:1, padding:"8px 6px", borderRight: i < days-1 ? "1px solid var(--line-soft)" : 0,
                  display:"flex", flexDirection:"column", alignItems:"center",
                  background: isToday ? "var(--ember-tint)" : isOff ? "var(--paper-2)" : "transparent"
                }}>
                  <span style={{font:"500 10px/1 var(--font-mono)", color: isHoliday ? "var(--prio-orange)" : "var(--ink-4)"}}>
                    {isHoliday ? "[T]" : ["Pzr","Pzt","Sal","Çar","Per","Cum","Cmt"][d.getDay()]}
                  </span>
                  <span style={{font:"600 13px/1 var(--font-sans)", color: isToday ? "var(--ember)" : isHoliday ? "var(--prio-orange)" : "var(--ink)", marginTop: 3}}>{d.getDate()}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rows */}
        <div style={{position:"relative", maxHeight: "62vh", overflowY:"auto"}}>
          {visible.map(b => {
            const left = Math.max(0, (b.acilma - startMs) / span) * 100;
            const right = Math.max(0, Math.min(1, (b.deadline - startMs) / span)) * 100;
            const w = Math.max(2.2, right - left);
            const color = b.priority.code === "over" ? "var(--prio-red)" :
                          b.priority.code === "red"  ? "var(--prio-red)" :
                          b.priority.code === "org"  ? "var(--prio-orange)" :
                          b.priority.code === "ylw"  ? "var(--prio-yellow)" : "var(--prio-green)";
            return (
              <div key={b.id} onClick={() => onOpenBrief(b)} style={{
                display:"flex", borderBottom:"1px solid var(--line-soft)",
                cursor:"pointer", minHeight: 36, alignItems:"stretch"
              }}>
                <div style={{
                  width: 240, padding:"7px 14px", borderRight:"1px solid var(--line)",
                  display:"flex", alignItems:"center", gap:8, minWidth: 0
                }}>
                  <BrandChip brand={b.brand} size="sm"/>
                  <span style={{font:"500 12px/1.3 var(--font-sans)", color:"var(--ink-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1}}>{b.baslik}</span>
                </div>
                <div style={{flex:1, position:"relative"}}>
                  {/* Today line */}
                  <div style={{position:"absolute", left: `${colW * 2 + colW / 2}%`, top: 0, bottom: 0, width: 1, background: "var(--ember)", opacity: 0.5}}/>
                  <div title={b.baslik} style={{
                    position:"absolute", top: 6, bottom: 6,
                    left: left + "%", width: w + "%",
                    background: color, opacity: 0.85,
                    borderRadius: 4, padding:"0 8px",
                    display:"flex", alignItems:"center",
                    overflow:"hidden", whiteSpace:"nowrap",
                    color: "#fff", font:"500 11px/1 var(--font-sans)"
                  }}>
                    <Avatar user={b.lead} size={16} borderColor="rgba(0,0,0,0.15)"/>
                    <span style={{marginLeft: 6, overflow:"hidden", textOverflow:"ellipsis"}}>{b.marka}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div style={{marginTop: 12, display:"flex", alignItems:"center", gap: 18, font:"500 12px/1 var(--font-sans)", color:"var(--ink-3)", flexWrap:"wrap"}}>
        <Legend color="var(--prio-red)"    label="Acil / geçmiş"/>
        <Legend color="var(--prio-orange)" label="Yüksek"/>
        <Legend color="var(--prio-yellow)" label="Normal"/>
        <Legend color="var(--prio-green)"  label="Düşük"/>
        <span style={{marginLeft:"auto", display:"inline-flex", alignItems:"center", gap:6}}>
          <span style={{width:1, height:12, background:"var(--ember)"}}/> bugün
        </span>
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span style={{display:"inline-flex", alignItems:"center", gap: 6}}>
      <span style={{width:10, height:10, background:color, borderRadius:2, opacity:0.85}}/>
      {label}
    </span>
  );
}

// ─── DEADLINES (horizontal dot timeline) ────────────────────────────────────
function DeadlinesScreen({ data, onOpenBrief }) {
  const days = 14;
  const dayMs = 24 * 3600 * 1000;
  const todayStart = new Date(data.NOW); todayStart.setHours(0,0,0,0);
  const startMs = todayStart.getTime();
  const endMs = startMs + days * dayMs;

  const allBriefs2 = data._allBriefs || data.briefs || [];
  const visible = allBriefs2.filter(b => b.deltaH > -24 && b.deadline < endMs)
    .sort((a, b) => a.deadline - b.deadline);

  // Bucket by day
  const buckets = Array.from({length: days}).map((_, i) => ({
    day: new Date(startMs + i * dayMs),
    items: visible.filter(b => {
      const d = new Date(b.deadline);
      const s = new Date(startMs + i * dayMs);
      return d.getDate() === s.getDate() && d.getMonth() === s.getMonth();
    })
  }));

  const colorFor = (b) => b.priority.code === "over" ? "var(--prio-red)" :
                         b.priority.code === "red"  ? "var(--prio-red)" :
                         b.priority.code === "org"  ? "var(--prio-orange)" :
                         b.priority.code === "ylw"  ? "var(--prio-yellow)" : "var(--prio-green)";

  return (
    <div className="bn-tab-in">
      <PageHead title="Deadlines · 14 gün" subtitle="önümüzdeki iki haftada teslim edilecek brief'ler"/>
      <Card padding={20}>
        {/* Track */}
        <div style={{position:"relative", height: 22, margin:"24px 0 36px"}}>
          <div style={{position:"absolute", left: 0, right: 0, top: 11, height: 2, background:"var(--line-strong)", borderRadius: 2}}/>
          {buckets.map((b, i) => {
            const x = (i / (days - 1)) * 100;
            const isToday = i === 0;
            return (
              <div key={i} style={{position:"absolute", left: `${x}%`, top: 0, transform: "translateX(-50%)"}}>
                <div style={{width: isToday ? 12 : 6, height: isToday ? 12 : 6, borderRadius: 999, background: isToday ? "var(--ember)" : "var(--line-strong)", margin:"5px auto"}}/>
                <div style={{font:"500 10px/1 var(--font-mono)", color: isToday ? "var(--ember)" : "var(--ink-4)", marginTop: 6, textAlign:"center", whiteSpace:"nowrap"}}>
                  {b.day.getDate()}/{b.day.getMonth() + 1}
                </div>
              </div>
            );
          })}
        </div>

        {/* Day cards */}
        <div className="bns-deadlines-grid" style={{display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap: 8}}>
          {buckets.slice(0, 7).map((bk, i) => {
            const isHoliday = isTRHoliday(bk.day);
            const isWeekend = bk.day.getDay() === 0 || bk.day.getDay() === 6;
            const isOff = i > 0 && (isHoliday || isWeekend);
            const holidayName = isHoliday ? isTRHolidayName(bk.day) : null;
            return (
            <div key={i} style={{
              border:"1px solid " + (i === 0 ? "rgba(194,74,44,0.4)" : isOff ? "var(--line-soft)" : "var(--line)"),
              borderRadius: 8, padding: 10, minHeight: 100,
              background: i === 0 ? "rgba(194,74,44,0.04)" : isOff ? "var(--paper-2)" : "var(--surface)"
            }}>
              <div style={{font:"600 12px/1 var(--font-sans)", color: i === 0 ? "var(--ember)" : isHoliday ? "var(--prio-orange)" : "var(--ink-2)", marginBottom: 8}}>
                {i === 0 ? "Bugün" : i === 1 ? "Yarın" : isHoliday ? `★ ${holidayName}` : ["Pzr","Pzt","Sal","Çar","Per","Cum","Cmt"][bk.day.getDay()]}
              </div>
              <div style={{display:"flex", flexDirection:"column", gap: 6}}>
                {bk.items.slice(0, 5).map(b => (
                  <button key={b.id} onClick={() => onOpenBrief(b)} style={{
                    display:"flex", alignItems:"center", gap: 6, padding:"5px 6px",
                    background:"var(--surface-sub)", border:0, borderRadius: 6,
                    cursor:"pointer", textAlign:"left", color:"var(--ink)"
                  }}>
                    <span style={{width:6, height:6, borderRadius:999, background: colorFor(b), flexShrink:0}}/>
                    <span style={{font:"500 11px/1.3 var(--font-sans)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1}}>{b.marka}</span>
                  </button>
                ))}
                {bk.items.length === 0 && (
                  <div style={{font:"400 11px/1.3 var(--font-sans)", color:"var(--ink-4)", padding: 4}}>—</div>
                )}
                {bk.items.length > 5 && (
                  <span style={{font:"500 10px/1 var(--font-mono)", color:"var(--ink-4)", padding: 4}}>+{bk.items.length - 5}</span>
                )}
              </div>
            </div>
          );
          })}
        </div>
      </Card>
    </div>
  );
}

window.PlanScreen = PlanScreen;
window.DeadlinesScreen = DeadlinesScreen;
