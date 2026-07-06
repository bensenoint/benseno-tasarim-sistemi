// app/screens/Bugun.jsx — kişisel "Bugün" bakışı: sıradaki iş + bugün deadline + geciken + kapasite.
function BugunScreen({ data, user, currentUser, onOpenBrief, onStatusChange, onRemind, onBack }) {
  // Kullanıcıyı data.USERS'tan çöz (Panom/Profil ile aynı) — atanan id'leri Slack id (U…); user.id
  // DB id olabilir. Yanlış eşleşme "işlerim" listesini boş bırakır. slack_id||id ile eşle.
  const _uraw = user || currentUser || {};
  const _sid = _uraw.slack_id || _uraw.id;
  const u = (data.USERS || []).find(x => x.id === _sid) || _uraw;
  const now = (window.BNS_DATA && window.BNS_DATA.NOW) || Date.now();
  const briefs = (data._allBriefs || data.briefs || []);
  const mine = briefs.filter(b => b.durum !== "tamamlandi" &&
    (window.bnsIsLead(b, u.id) || (Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === u.id))));
  const aktif = mine.filter(b => b.durum !== "musteride");
  const myKisiSira = (b) => { const c = (b.contributors||[]).find(x => x && x.id === u.id); return (c && c.kisi_sira != null) ? c.kisi_sira : Infinity; };
  const sirada = [...aktif].sort((a,b) => (myKisiSira(a)-myKisiSira(b)) || ((a.deadline||Infinity)-(b.deadline||Infinity)))[0] || null;
  const isToday = (ms) => { if (!ms) return false; const d = new Date(ms), n = new Date(now); return d.toDateString() === n.toDateString(); };
  const bugunDl = aktif.filter(b => isToday(b.deadline));
  const geciken = aktif.filter(b => b.deltaH <= 0);
  const dr = data.dateRange || {}; const cutoff = (typeof dr.to === "number" && dr.to < now) ? dr.to : null;
  const capBriefs = bnsBriefsAsOf(briefs, (data._allCompleted || data.completed || []), cutoff).filter(b => b.durum !== "musteride");
  const capPct = bnsPersonCapPct(u, bnsPersonLoad(capBriefs, u.id) / 5);

  const Row = (b) => (
    <div key={b.id} onClick={() => onOpenBrief && onOpenBrief(b)} style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid var(--line-soft)", cursor:"pointer" }}>
      <span style={{ font:"500 13px/1.3 var(--font-sans)", color:"var(--ink)" }}>#{b.no} {b.marka} — {b.baslik || b.is}</span>
      <BriefActions brief={b} currentUser={u} onStatusChange={onStatusChange} onRemind={onRemind} compact/>
    </div>
  );
  const Section = ({ title, rows, empty }) => (
    <Card style={{ padding:16, marginBottom:"var(--section-gap)" }}>
      <div style={{ font:"600 13px/1 var(--font-sans)", color:"var(--ink)", marginBottom:8 }}>{title} <span style={{ color:"var(--ink-4)", font:"400 12px var(--font-mono)" }}>{rows.length}</span></div>
      {rows.length ? rows.map(Row) : <div style={{ font:"400 13px var(--font-sans)", color:"var(--ink-4)" }}>{empty}</div>}
    </Card>
  );

  return (
    <div className="bn-tab-in">
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"var(--section-gap)" }}>
        <button onClick={() => onBack && onBack()} style={{ font:"600 12px/1 var(--font-sans)", padding:"6px 10px", border:"1px solid var(--line)", borderRadius:6, background:"var(--paper-2)", color:"var(--ink-2)", cursor:"pointer" }}>← Panom</button>
        <h2 style={{ font:"600 18px/1 var(--font-sans)", color:"var(--ink)", margin:0 }}>🗓️ Bugün</h2>
        <span style={{ marginLeft:"auto", font:"600 12px/1 var(--font-mono)", color: capPct > 85 ? "var(--warning)" : "var(--ink-3)" }}>Kapasiten %{capPct}</span>
      </div>
      {sirada && (
        <Card style={{ padding:16, marginBottom:"var(--section-gap)", borderLeft:"3px solid var(--ember)" }}>
          <div style={{ font:"600 11px/1 var(--font-sans)", color:"var(--ember)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:6 }}>Sıradaki iş</div>
          <div onClick={() => onOpenBrief && onOpenBrief(sirada)} style={{ font:"600 15px/1.3 var(--font-sans)", color:"var(--ink)", marginBottom:10, cursor:"pointer" }}>#{sirada.no} {sirada.marka} — {sirada.baslik || sirada.is}</div>
          <BriefActions brief={sirada} currentUser={u} onStatusChange={onStatusChange} onRemind={onRemind}/>
        </Card>
      )}
      <Section title="Bugün deadline" rows={bugunDl} empty="Bugün teslimi olan işin yok."/>
      <Section title="Geciken" rows={geciken} empty="Geciken işin yok 🎉"/>
    </div>
  );
}
