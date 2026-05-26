// app/NewBrief.jsx — marka seç → Slack kanalını aç.

const MARKA_KANAL = {
  "Bauhaus":             "marka-bauhaus",
  "Beta":                "marka-beta",
  "Cimporglobal":        "marka-cimporglobal",
  "Cureffect":           "marka-cureffect",
  "Egosport":            "marka-egosport",
  "Gürsoy":              "marka-gursoy",
  "Hasvet":              "marka-hasvet",
  "Hendex":              "marka-hendex",
  "JNJ":                 "marka-jnj",
  "JNJ Acuvue ME":       "marka-jnj-acuvue-me",
  "JNJ Vision TR":       "marka-jnj-vision-tr",
  "Jungleous":           "marka-jungleous",
  "KMR Amos":            "marka-kmr-amos",
  "KMR Copic":           "marka-kmr-copic",
  "KMR Lamy":            "marka-kmr-lamy",
  "KMR Marshmallow":     "marka-kmr-marshmallow",
  "KMR Max":             "marka-kmr-max",
  "KMR Panfix":          "marka-kmr-panfix",
  "KMR Serve":           "marka-kmr-serve",
  "Kuzeypet":            "marka-kuzeypet",
  "KZY Bark":            "marka-kzy-bark",
  "KZY Everclean":       "marka-kzy-everclean",
  "KZY Ferplast":        "marka-kzy-ferplast",
  "KZY Flamingo":        "marka-kzy-flamingo",
  "KZY Simple Solution": "marka-kzy-simplesolution",
  "KZY Supreme":         "marka-kzy-supreme",
  "KZY Vet's Best":      "marka-kzy-vetsbest",
  "Marmara Holding":     "marka-marmaraholding",
  "Muffik":              "marka-muffik",
  "Polisan":             "marka-polisan",
  "Splenda":             "marka-splenda",
  "Tour2America":        "marka-tour2america",
  "VDM Petdent":        "marka-vdm-petdent",
};

function NewBriefModal({ open, onClose, data }) {
  const [marka, setMarka] = React.useState("");
  React.useEffect(() => { if (open) setMarka(""); }, [open]);
  if (!open) return null;

  const kanal = MARKA_KANAL[marka];
  const kanalUrl = kanal ? `https://benseno.slack.com/app_redirect?channel=${kanal}` : null;

  function handleOpen() {
    if (!kanalUrl) return;
    window.open(kanalUrl, "_blank");
    onClose();
  }

  return (
    <>
      <div onClick={onClose} style={{
        position:"fixed", inset:0, background:"var(--overlay)", zIndex: 92,
        animation: "bn-fade 180ms var(--ease-out-quart)"
      }}/>
      <div style={{
        position:"fixed", top:"20vh", left:"50%", transform:"translateX(-50%)",
        width:"min(400px, 92vw)", zIndex: 93,
        background:"var(--surface)", border:"1px solid var(--line)",
        borderRadius: 14, boxShadow:"var(--shadow-2)",
        animation: "bn-slide-up 220ms var(--ease-out-quart)"
      }}>
        {/* Header */}
        <div style={{padding:"14px 18px", borderBottom:"1px solid var(--line)", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
          <div>
            <div style={{font:"600 11px/1 var(--font-sans)", letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--ink-3)"}}>Yeni brief</div>
            <div style={{fontFamily:"var(--font-display)", fontStyle:"italic", fontSize:18, color:"var(--ink-2)", marginTop:4}}>
              Marka seç → Slack'te aç.
            </div>
          </div>
          <button onClick={onClose} style={{border:0, background:"transparent", cursor:"pointer", padding:4, color:"var(--ink-3)"}}>
            <I.X size={16}/>
          </button>
        </div>

        {/* Body */}
        <div style={{padding:"20px 18px"}}>
          <label style={{display:"flex", flexDirection:"column", gap:8}}>
            <span style={{font:"500 11px/1 var(--font-sans)", letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--ink-3)"}}>Marka</span>
            <select value={marka} onChange={(e) => setMarka(e.target.value)} style={{
              font:"500 15px/1.3 var(--font-sans)", color:"var(--ink)",
              background:"var(--surface-sub)", border:"1px solid var(--line)",
              borderRadius: 8, padding:"10px 12px", outline:"none", width:"100%"
            }}>
              <option value="">Marka seç…</option>
              {(data.BRANDS || []).map(b => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </label>

          {marka && (
            <div style={{marginTop:14, padding:"10px 12px", background:"var(--paper-2)", borderRadius:8, font:"500 12px/1.4 var(--font-mono)", color:"var(--ink-3)", display:"flex", alignItems:"center", gap:8}}>
              <I.Slack size={13}/>
              #{kanal || "—"}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"12px 18px", borderTop:"1px solid var(--line)", display:"flex", justifyContent:"flex-end", gap:8}}>
          <Button kind="secondary" onClick={onClose}>İptal</Button>
          <Button kind="primary" icon={<I.Slack size={13}/>} onClick={handleOpen}
            style={!marka ? {opacity:0.5, pointerEvents:"none"} : {}}>
            Slack'te Aç
          </Button>
        </div>
      </div>
    </>
  );
}

function priorityFromDh(dh) {
  if (dh <= 0)  return { code:"over", label:"GEÇMİŞ", color:"var(--prio-red)" };
  if (dh <= 8)  return { code:"red",  label:"ACİL",   color:"var(--prio-red)" };
  if (dh <= 24) return { code:"org",  label:"YÜKSEK", color:"var(--prio-orange)" };
  if (dh <= 72) return { code:"ylw",  label:"NORMAL", color:"var(--prio-yellow)" };
  return            { code:"grn",  label:"DÜŞÜK",  color:"var(--prio-green)" };
}

window.NewBriefModal = NewBriefModal;
window.priorityFromDh = priorityFromDh;
