// app/NewBrief.jsx — API modunda tam intake formu (POST /api/briefs); değilse marka→Slack kanalı yönlendirme.

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

// Yapılandırılmış API tabanı (App.jsx poll'u ile aynı mantık) — yoksa null.
function bnsResolveApiBase() {
  const DEFAULT_API = "https://benseno-api-production.up.railway.app";
  try {
    const p = new URLSearchParams(window.location.search).get("api");
    if (p === "1" || p === "true") return DEFAULT_API;
    if (p && /^https?:\/\//.test(p)) return p.replace(/\/+$/, "");
    const ls = window.localStorage.getItem("bns_api");
    if (ls) return ls === "1" ? DEFAULT_API : ls.replace(/\/+$/, "");
    if (window.BNS_API_BASE) return String(window.BNS_API_BASE).replace(/\/+$/, "");
  } catch (e) { /* sandbox */ }
  return null;
}
window.bnsResolveApiBase = bnsResolveApiBase;

const FIELD_LABEL = { font: "500 11px/1 var(--font-sans)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" };
const FIELD_BOX = { font: "500 14px/1.3 var(--font-sans)", color: "var(--ink)", background: "var(--surface-sub)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 11px", outline: "none", width: "100%", boxSizing: "border-box" };

// ── API modu: tam intake formu → POST /api/briefs ────────────
function APIBriefForm({ apiBase, data, onClose }) {
  const users = (data.USERS || []).filter(u => u.active !== false);
  const brands = data.BRANDS || [];
  const me = data.ME || {};
  const [f, setF] = React.useState({
    marka: "", baslik: "", dept: "", deadlineDate: "", deadlineTime: "17:00",
    leadId: "", contribIds: [], musteri_notu: "", akis: "sirali", maliyet: "", satis: "",
  });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const toggleContrib = (id) => setF(s => ({
    ...s, contribIds: s.contribIds.includes(id) ? s.contribIds.filter(x => x !== id) : [...s.contribIds, id]
  }));

  const valid = f.marka && f.baslik.trim();

  async function submit() {
    if (!valid || busy) return;
    setBusy(true); setErr(null);
    // deadline → ISO (tarih + saat); boşsa null
    let deadline = null;
    if (f.deadlineDate) {
      const t = f.deadlineTime || "17:00";
      deadline = new Date(`${f.deadlineDate}T${t}:00`).toISOString();
    }
    const atanan_ids = [f.leadId, ...f.contribIds].filter(Boolean);
    const body = {
      marka: f.marka, baslik: f.baslik.trim(),
      dept: f.dept || undefined, deadline,
      atanan_ids: atanan_ids.length ? atanan_ids : undefined,
      musteri_notu: f.musteri_notu.trim() || undefined,
      akis: f.akis,
      maliyet: f.maliyet !== "" ? Number(f.maliyet) : undefined,
      satis: f.satis !== "" ? Number(f.satis) : undefined,
      by: me.id || undefined,
      source: "dashboard",
    };
    try {
      const r = await fetch(apiBase + "/api/briefs", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error === "doğrulama"
        ? "Doğrulama hatası: " + (j.issues || []).map(i => (i.path || []).join(".")).join(", ")
        : (j.error || ("HTTP " + r.status)));
      if (window.bnsRefresh) window.bnsRefresh();
      if (window.bnsToast) window.bnsToast(`✅ Brief #${j.no} oluşturuldu`);
      onClose();
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  return (
    <div style={{ padding: "18px", maxHeight: "62vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={FIELD_LABEL}>Marka *</span>
        <select value={f.marka} onChange={e => set("marka", e.target.value)} style={FIELD_BOX}>
          <option value="">Marka seç…</option>
          {brands.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
        </select>
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={FIELD_LABEL}>Başlık / İş *</span>
        <input value={f.baslik} onChange={e => set("baslik", e.target.value)} placeholder="ör. Sosyal medya paketi — Mayıs" style={FIELD_BOX} />
      </label>

      <div style={{ display: "flex", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          <span style={FIELD_LABEL}>Departman</span>
          <select value={f.dept} onChange={e => set("dept", e.target.value)} style={FIELD_BOX}>
            <option value="">—</option>
            <option value="tasarim">Tasarım</option>
            <option value="editor">Editör</option>
            <option value="ai">AI</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          <span style={FIELD_LABEL}>Akış</span>
          <select value={f.akis} onChange={e => set("akis", e.target.value)} style={FIELD_BOX}>
            <option value="sirali">Sıralı</option>
            <option value="paralel">Paralel</option>
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 2 }}>
          <span style={FIELD_LABEL}>Deadline</span>
          <input type="date" value={f.deadlineDate} onChange={e => set("deadlineDate", e.target.value)} style={FIELD_BOX} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          <span style={FIELD_LABEL}>Saat</span>
          <input type="time" value={f.deadlineTime} onChange={e => set("deadlineTime", e.target.value)} style={FIELD_BOX} />
        </label>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={FIELD_LABEL}>İşi yapan (lead)</span>
        <select value={f.leadId} onChange={e => set("leadId", e.target.value)} style={FIELD_BOX}>
          <option value="">—</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}{u.rol ? ` · ${u.rol}` : ""}</option>)}
        </select>
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={FIELD_LABEL}>Katkıda bulunanlar</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {users.filter(u => u.id !== f.leadId).map(u => {
            const on = f.contribIds.includes(u.id);
            return (
              <button key={u.id} type="button" onClick={() => toggleContrib(u.id)} style={{
                cursor: "pointer", border: "1px solid " + (on ? "var(--ember)" : "var(--line)"),
                background: on ? "var(--ember)" : "var(--surface-sub)", color: on ? "#fff" : "var(--ink-2)",
                borderRadius: 999, padding: "5px 10px", font: "500 12px/1 var(--font-sans)",
              }}>{u.name}</button>
            );
          })}
        </div>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={FIELD_LABEL}>Müşteri notu / açıklama</span>
        <textarea value={f.musteri_notu} onChange={e => set("musteri_notu", e.target.value)} rows={3}
          placeholder="Brief detayı, referanslar, özel istekler…" style={{ ...FIELD_BOX, resize: "vertical", font: "400 14px/1.45 var(--font-sans)" }} />
      </label>

      <div style={{ display: "flex", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          <span style={FIELD_LABEL}>Maliyet (₺)</span>
          <input type="number" inputMode="decimal" value={f.maliyet} onChange={e => set("maliyet", e.target.value)} placeholder="—" style={FIELD_BOX} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          <span style={FIELD_LABEL}>Satış (₺)</span>
          <input type="number" inputMode="decimal" value={f.satis} onChange={e => set("satis", e.target.value)} placeholder="—" style={FIELD_BOX} />
        </label>
      </div>

      {err && <div style={{ padding: "8px 11px", background: "var(--prio-red-bg, #fee)", color: "var(--prio-red, #c00)", borderRadius: 8, font: "500 12px/1.4 var(--font-sans)" }}>{err}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
        <Button kind="secondary" onClick={onClose}>İptal</Button>
        <Button kind="primary" onClick={submit} style={!valid || busy ? { opacity: 0.5, pointerEvents: "none" } : {}}>
          {busy ? "Oluşturuluyor…" : "Brief Oluştur"}
        </Button>
      </div>
    </div>
  );
}

function NewBriefModal({ open, onClose, data }) {
  const [marka, setMarka] = React.useState("");
  React.useEffect(() => { if (open) setMarka(""); }, [open]);
  if (!open) return null;

  const apiBase = bnsResolveApiBase();
  const kanal = MARKA_KANAL[marka];
  const kanalUrl = kanal ? `https://benseno.slack.com/app_redirect?channel=${kanal}` : null;

  function handleOpen() {
    if (!kanalUrl) return;
    window.open(kanalUrl, "_blank");
    onClose();
  }

  const wide = !!apiBase;
  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 92,
        animation: "bn-fade 180ms var(--ease-out-quart)"
      }} />
      <div style={{
        position: "fixed", top: wide ? "8vh" : "20vh", left: "50%", transform: "translateX(-50%)",
        width: wide ? "min(520px, 94vw)" : "min(400px, 92vw)", zIndex: 93,
        background: "var(--surface)", border: "1px solid var(--line)",
        borderRadius: 14, boxShadow: "var(--shadow-2)",
        animation: "bn-slide-up 220ms var(--ease-out-quart)"
      }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ font: "600 11px/1 var(--font-sans)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-3)" }}>Yeni brief</div>
            <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18, color: "var(--ink-2)", marginTop: 4 }}>
              {apiBase ? "Tüm alanları doldur → kaydet." : "Marka seç → Slack'te aç."}
            </div>
          </div>
          <button onClick={onClose} style={{ border: 0, background: "transparent", cursor: "pointer", padding: 4, color: "var(--ink-3)" }}>
            <I.X size={16} />
          </button>
        </div>

        {apiBase ? (
          <APIBriefForm apiBase={apiBase} data={data} onClose={onClose} />
        ) : (
          <>
            <div style={{ padding: "20px 18px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={FIELD_LABEL}>Marka</span>
                <select value={marka} onChange={(e) => setMarka(e.target.value)} style={{ ...FIELD_BOX, font: "500 15px/1.3 var(--font-sans)", padding: "10px 12px" }}>
                  <option value="">Marka seç…</option>
                  {(data.BRANDS || []).map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
              </label>
              {marka && (
                <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--paper-2)", borderRadius: 8, font: "500 12px/1.4 var(--font-mono)", color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 8 }}>
                  <I.Slack size={13} />
                  #{kanal || "—"}
                </div>
              )}
            </div>
            <div style={{ padding: "12px 18px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button kind="secondary" onClick={onClose}>İptal</Button>
              <Button kind="primary" icon={<I.Slack size={13} />} onClick={handleOpen} style={!marka ? { opacity: 0.5, pointerEvents: "none" } : {}}>
                Slack'te Aç
              </Button>
            </div>
          </>
        )}
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
