// app/NewBrief.jsx — modal for creating a new brief.

function NewBriefModal({ open, onClose, onCreate, data }) {
  const [marka, setMarka] = React.useState("");
  const [baslik, setBaslik] = React.useState("");
  const [leadId, setLeadId] = React.useState("");
  const [contribIds, setContribIds] = React.useState([]);
  const [reviewerId, setReviewerId] = React.useState("");
  const [deadlineH, setDeadlineH] = React.useState(48);
  React.useEffect(() => {
    if (open) {
      setMarka(""); setBaslik(""); setLeadId(""); setContribIds([]); setReviewerId(""); setDeadlineH(48);
    }
  }, [open]);
  if (!open) return null;

  const valid = marka && baslik && leadId;

  function submit() {
    if (!valid) return;
    const brand = data.BRANDS.find(b => b.name === marka);
    const lead = data.USERS.find(u => u.id === leadId);
    const contributors = contribIds.map(id => data.USERS.find(u => u.id === id)).filter(Boolean);
    const reviewer = reviewerId ? data.USERS.find(u => u.id === reviewerId) : null;
    const dh = Number(deadlineH);
    onCreate({
      id: "br_n" + Date.now(),
      no: 200 + Math.floor(Math.random() * 9000),
      marka, brand, baslik, lead, contributors, reviewer,
      acilma: data.NOW,
      deadline: data.NOW + dh * 3600 * 1000,
      deltaH: dh,
      durum: "yeni",
      priority: priorityFromDh(dh),
      revision: 0, stale: false, slack_url: "#"
    });
    onClose();
  }

  return (
    <>
      <div onClick={onClose} style={{
        position:"fixed", inset:0, background:"var(--overlay)", zIndex: 92,
        animation: "bn-fade 180ms var(--ease-out-quart)"
      }}/>
      <div style={{
        position:"fixed", top:"10vh", left:"50%", transform:"translateX(-50%)",
        width:"min(560px, 92vw)", zIndex: 93,
        background:"var(--surface)", border:"1px solid var(--line)",
        borderRadius: 14, boxShadow:"var(--shadow-2)",
        animation: "bn-slide-up 220ms var(--ease-out-quart)"
      }}>
        <div style={{padding:"14px 18px", borderBottom:"1px solid var(--line)", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
          <div>
            <div style={{font:"600 11px/1 var(--font-sans)", letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--ink-3)"}}>Yeni brief</div>
            <div style={{fontFamily:"var(--font-display)", fontStyle:"italic", fontSize:18, color:"var(--ink-2)", marginTop:4}}>
              Slack yerine hızlıca buradan.
            </div>
          </div>
          <button onClick={onClose} style={{
            border:0, background:"transparent", cursor:"pointer",
            padding:4, color:"var(--ink-3)"
          }}><I.X size={16}/></button>
        </div>
        <div style={{padding:"16px 18px", display:"grid", gap: 14}}>
          <Field label="Marka">
            <select value={marka} onChange={(e) => setMarka(e.target.value)} style={inputCss}>
              <option value="">Marka seç…</option>
              {data.BRANDS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="İş başlığı">
            <input value={baslik} onChange={(e) => setBaslik(e.target.value)}
              placeholder="Örn. Mart kampanya görselleri" style={inputCss}/>
          </Field>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 12}}>
            <Field label="Açan">
              <select value={leadId} onChange={(e) => setLeadId(e.target.value)} style={inputCss}>
                <option value="">Açan seç…</option>
                {data.USERS.filter(u => u.rol !== "yonetici" || true).map(u => (
                  <option key={u.id} value={u.id}>{u.name} · {u.rol}</option>
                ))}
              </select>
            </Field>
            <Field label="Reviewer (ops.)">
              <select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} style={inputCss}>
                <option value="">—</option>
                {data.USERS.filter(u => u.rol === "yonetici").map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={`Deadline · ${deadlineH < 24 ? deadlineH + " sa" : Math.round(deadlineH/24) + " gün"} sonra`}>
            <input type="range" min="2" max="240" step="1" value={deadlineH} onChange={(e) => setDeadlineH(+e.target.value)}
              style={{width:"100%", accentColor:"var(--ember)"}}/>
            <div style={{display:"flex", justifyContent:"space-between", font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)", marginTop: 4}}>
              <span>2 sa</span><span>10 gün</span>
            </div>
            <div style={{marginTop:8, display:"flex", alignItems:"center", gap:8}}>
              <PriorityBadge p={priorityFromDh(deadlineH)} deltaH={deadlineH}/>
              <span style={{font:"400 12px/1 var(--font-sans)", color:"var(--ink-3)"}}>
                otomatik öncelik (deadline'a göre)
              </span>
            </div>
          </Field>
        </div>
        <div style={{padding:"12px 18px", borderTop:"1px solid var(--line)", display:"flex", justifyContent:"flex-end", gap: 8}}>
          <Button kind="secondary" onClick={onClose}>İptal</Button>
          <Button kind="primary" icon={<I.Send size={13}/>} onClick={submit}
            style={!valid ? { opacity: 0.5, pointerEvents:"none" } : {}}>Brief'i oluştur</Button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return (
    <label style={{display:"flex", flexDirection:"column", gap:6}}>
      <span style={{
        font:"500 11px/1 var(--font-sans)", letterSpacing:"0.06em", textTransform:"uppercase",
        color:"var(--ink-3)"
      }}>{label}</span>
      {children}
    </label>
  );
}

const inputCss = {
  font:"500 14px/1.3 var(--font-sans)", color:"var(--ink)",
  background:"var(--surface-sub)", border:"1px solid var(--line)",
  borderRadius: 8, padding:"9px 11px", outline:"none", width:"100%"
};

function priorityFromDh(dh) {
  if (dh <= 0)  return { code:"over", label:"GEÇMİŞ", color:"var(--prio-red)" };
  if (dh <= 8)  return { code:"red",  label:"ACİL",   color:"var(--prio-red)" };
  if (dh <= 24) return { code:"org",  label:"YÜKSEK", color:"var(--prio-orange)" };
  if (dh <= 72) return { code:"ylw",  label:"NORMAL", color:"var(--prio-yellow)" };
  return            { code:"grn",  label:"DÜŞÜK",  color:"var(--prio-green)" };
}

window.NewBriefModal = NewBriefModal;
window.priorityFromDh = priorityFromDh;
