// app/NewBrief.jsx — API modunda tam intake formu (POST /api/briefs); değilse marka→Slack kanalı yönlendirme.

const MARKA_KANAL = {
  "Benseno":             "benseno",   // markasız / müşteri adayı işleri
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
  // Cutover: VARSAYILAN API. ?api=0 / localStorage bns_api=0 → kapalı (eski Slack-yönlendirme).
  const DEFAULT_API = "https://benseno-api-production.up.railway.app";
  try {
    const p = new URLSearchParams(window.location.search).get("api");
    if (p === "0" || p === "false") return null;
    if (p && /^https?:\/\//.test(p)) return p.replace(/\/+$/, "");
    const ls = window.localStorage.getItem("bns_api");
    if (ls === "0") return null;
    if (ls && ls !== "1") return ls.replace(/\/+$/, "");
    if (window.BNS_API_BASE) return String(window.BNS_API_BASE).replace(/\/+$/, "");
  } catch (e) { /* sandbox */ }
  return DEFAULT_API;
}
window.bnsResolveApiBase = bnsResolveApiBase;

const FIELD_LABEL = { font: "500 11px/1 var(--font-sans)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" };
const FIELD_BOX = { font: "500 14px/1.3 var(--font-sans)", color: "var(--ink)", background: "var(--surface-sub)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 11px", outline: "none", width: "100%", boxSizing: "border-box" };

// Çoklu kişi seçici — dropdown'dan ekle, seçilenler chip olarak listelenir + çıkar.
// grouped:true ise dropdown departmana göre optgroup'lar.
function PeoplePicker({ label, users, selected, onChange, grouped }) {
  const byId = (id) => users.find(u => u.id === id);
  const avail = users.filter(u => !selected.includes(u.id));
  const add = (id) => { if (id && !selected.includes(id)) onChange([...selected, id]); };
  const remove = (id) => onChange(selected.filter(x => x !== id));
  const DEPT_LABEL = { tasarim: "Tasarım", editor: "Editör", ai: "AI", freelance: "Freelance" };
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={FIELD_LABEL}>{label}</span>
      <select value="" onChange={e => { add(e.target.value); e.target.value = ""; }} style={FIELD_BOX}>
        <option value="">+ Kişi ekle…</option>
        {grouped
          ? ["tasarim", "editor", "ai", "freelance", "_other"].map(dep => {
              const us = dep === "_other"
                ? avail.filter(u => !["tasarim", "editor", "ai", "freelance"].includes(u.dept))
                : avail.filter(u => u.dept === dep);
              if (!us.length) return null;
              return (
                <optgroup key={dep} label={DEPT_LABEL[dep] || "Diğer"}>
                  {us.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </optgroup>
              );
            })
          : avail.map(u => <option key={u.id} value={u.id}>{u.name}{u.dept ? ` · ${DEPT_LABEL[u.dept] || u.dept}` : ""}</option>)}
      </select>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {selected.map(id => {
            const u = byId(id);
            return (
              <span key={id} style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px",
                borderRadius: 999, background: "var(--surface-sub)", border: "1px solid var(--line)",
                font: "500 12px/1 var(--font-sans)", color: "var(--ink)",
              }}>
                {u ? u.name : id}
                <button type="button" onClick={() => remove(id)} style={{
                  border: 0, background: "transparent", cursor: "pointer", color: "var(--ink-4)",
                  font: "600 13px/1 var(--font-sans)", padding: 0, lineHeight: 1,
                }}>×</button>
              </span>
            );
          })}
        </div>
      )}
    </label>
  );
}

// ── API modu: tam intake formu → POST /api/briefs ────────────
function APIBriefForm({ apiBase, data, onClose }) {
  const users = (data.USERS || []).filter(u => u.active !== false);
  const brands = data.BRANDS || [];
  // Açan kişi = GİRİŞ YAPAN kullanıcı (login). data.ME varsayılanı Görkem'e sabitti —
  // kim açarsa açsın "Görkem açtı" kaydediliyordu; bns_user (login) esas alınır.
  const logged = (() => { try { return JSON.parse(localStorage.getItem("bns_user") || "null"); } catch { return null; } })();
  const me = (logged && users.find(u => u.id === logged.slack_id)) || data.ME || {};
  const [f, setF] = React.useState({
    marka: "", baslik: "", deadlineDate: "", deadlineTime: "17:00",
    workerIds: [], leadIds: [], gozlemciIds: [],   // lead boş → server işi vereni lead yapar
    musteri_notu: "", akis: "paralel", maliyet: "", satis: "", isTipi: "", ucretTipi: "kapsamda",
  });
  const tipler = (window.BNS_DATA && window.BNS_DATA.IS_TIPLERI) || data.IS_TIPLERI || [];
  const [files, setFiles] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));

  const valid = f.marka && f.baslik.trim() && f.workerIds.length && (!tipler.length || f.isTipi);

  async function submit() {
    if (!valid || busy) return;
    setBusy(true); setErr(null);
    // deadline → ISO (tarih + saat); boşsa null
    let deadline = null;
    if (f.deadlineDate) {
      const t = f.deadlineTime || "17:00";
      deadline = new Date(`${f.deadlineDate}T${t}:00`).toISOString();
    }
    const body = {
      marka: f.marka, baslik: f.baslik.trim(), deadline,
      is_tipi: f.isTipi || undefined,
      worker_ids: f.workerIds.length ? f.workerIds : undefined,
      lead_ids: f.leadIds.length ? f.leadIds : undefined,
      gozlemci_ids: f.gozlemciIds.length ? f.gozlemciIds : undefined,
      musteri_notu: f.musteri_notu.trim() || undefined,
      akis: f.akis,
      ucret_tipi: f.ucretTipi,
      maliyet: f.ucretTipi === "ek" && f.maliyet !== "" ? Number(f.maliyet) : undefined,
      satis: f.ucretTipi === "ek" && f.satis !== "" ? Number(f.satis) : undefined,
      by: me.id || undefined,
      source: "dashboard",
    };
    const tok = (typeof localStorage !== "undefined" && localStorage.getItem("bns_token")) || "";
    const writeHeaders = {
      "content-type": "application/json",
      ...(tok ? { Authorization: "Bearer " + tok } : {}),
    };
    try {
      const r = await fetch(apiBase + "/api/briefs", {
        method: "POST", headers: writeHeaders, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error === "doğrulama"
        ? "Doğrulama hatası: " + (j.issues || []).map(i => (i.path || []).join(".")).join(", ")
        : (j.error || ("HTTP " + r.status)));
      // Dosyalar varsa brief thread'ine yükle (best-effort)
      if (files.length && j.id) {
        const payloadFiles = await Promise.all(files.map(file => new Promise((resolve) => {
          const rd = new FileReader();
          rd.onload = () => resolve({ name: file.name, mime: file.type, b64: String(rd.result).split(",")[1] });
          rd.onerror = () => resolve(null);
          rd.readAsDataURL(file);
        })));
        await fetch(apiBase + `/api/briefs/${j.id}/attachments`, {
          method: "POST", headers: writeHeaders,
          body: JSON.stringify({ files: payloadFiles.filter(Boolean), by: me.id || undefined }),
        }).catch(() => {});
      }
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

      {tipler.length > 0 && (
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={FIELD_LABEL}>İş Tipi *</span>
          <select value={f.isTipi} onChange={e => set("isTipi", e.target.value)} style={FIELD_BOX}>
            <option value="">Tip seç…</option>
            {[...new Set(tipler.map(t => t.grup))].map(g => (
              <optgroup key={g} label={g}>
                {tipler.filter(t => t.grup === g).map(t => <option key={t.kod} value={t.kod}>{t.ad}</option>)}
              </optgroup>
            ))}
          </select>
          <span style={{ font: "400 11px/1.3 var(--font-sans)", color: "var(--ink-4)" }}>Sistem tip başına gerçek süreleri öğrenir — İş Tipleri ekranı.</span>
        </label>
      )}

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={FIELD_LABEL}>Akış</span>
        <select value={f.akis} onChange={e => set("akis", e.target.value)} style={FIELD_BOX}>
          <option value="sirali">Sıralı</option>
          <option value="paralel">Paralel</option>
        </select>
        <span style={{ font: "400 11px/1.3 var(--font-sans)", color: "var(--ink-4)" }}>Departman, işi yapan kişilerden otomatik belirlenir.</span>
      </label>

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

      <PeoplePicker label="İşi yapan(lar) *" users={users} selected={f.workerIds} onChange={ids => set("workerIds", ids)} grouped />
      <PeoplePicker label="Lead(ler) — son kontrol (boş bırakırsan briefi açan lead olur)" users={users} selected={f.leadIds} onChange={ids => set("leadIds", ids)} grouped />
      <PeoplePicker label="Gözlemciler (ilgili departman yöneticisi otomatik eklenir)" users={users} selected={f.gozlemciIds} onChange={ids => set("gozlemciIds", ids)} grouped />

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={FIELD_LABEL}>Dosyalar (ops.)</span>
        <input type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))}
          style={{ font: "12px var(--font-sans)" }} />
        {files.length > 0 && <span style={{ font: "400 11px/1.3 var(--font-mono)", color: "var(--ink-4)" }}>{files.length} dosya seçili</span>}
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={FIELD_LABEL}>Müşteri notu / açıklama</span>
        <textarea value={f.musteri_notu} onChange={e => set("musteri_notu", e.target.value)} rows={3}
          placeholder="Brief detayı, referanslar, özel istekler…" style={{ ...FIELD_BOX, resize: "vertical", font: "400 14px/1.45 var(--font-sans)" }} />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={FIELD_LABEL}>Faturalama *</span>
        <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", alignSelf: "flex-start" }}>
          {[["kapsamda", "🔒 Aylık fee"], ["ek", "➕ Ek iş"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => set("ucretTipi", v)}
              style={{ font: "600 12px var(--font-sans)", padding: "8px 14px", border: "none", cursor: "pointer",
                background: f.ucretTipi === v ? "var(--paper-2)" : "transparent",
                color: f.ucretTipi === v ? "var(--ink)" : "var(--ink-3)" }}>{l}</button>
          ))}
        </div>
        <span style={{ font: "400 11px/1.3 var(--font-sans)", color: "var(--ink-4)" }}>
          {f.ucretTipi === "ek"
            ? "Ayrıca faturalanır. Satış belli değilse boş bırak — iş bitince sistem sorar ve takip eder."
            : "Retainer kapsamında — ayrıca faturalanmaz."}</span>
      </label>

      {f.ucretTipi === "ek" && (
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            <span style={FIELD_LABEL}>Satış (₺) — ops.</span>
            <input type="number" inputMode="decimal" value={f.satis} onChange={e => set("satis", e.target.value)} placeholder="belli değilse boş" style={FIELD_BOX} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            <span style={FIELD_LABEL}>Maliyet (₺) — ops.</span>
            <input type="number" inputMode="decimal" value={f.maliyet} onChange={e => set("maliyet", e.target.value)} placeholder="dış tedarik vb." style={FIELD_BOX} />
          </label>
        </div>
      )}

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
  const isMobile = typeof useIsMobile === "function" ? useIsMobile() : false;
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
      <div style={isMobile ? {
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 93,
        maxHeight: "92vh", overflowY: "auto", WebkitOverflowScrolling: "touch",
        background: "var(--surface)", borderTop: "1px solid var(--line)",
        borderRadius: "18px 18px 0 0", boxShadow: "var(--shadow-lg)",
        animation: "bn-slide-up 260ms var(--ease-out-quart)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      } : {
        position: "fixed", top: wide ? "8vh" : "20vh", left: "50%", transform: "translateX(-50%)",
        width: wide ? "min(520px, 94vw)" : "min(400px, 92vw)", zIndex: 93,
        background: "var(--surface)", border: "1px solid var(--line)",
        borderRadius: 14, boxShadow: "var(--shadow-lg)",
        animation: "bn-slide-up 220ms var(--ease-out-quart)"
      }}>
        {isMobile && (
          <div style={{padding:"10px 0 2px", display:"flex", justifyContent:"center"}}>
            <div style={{width:40, height:4, borderRadius:2, background:"var(--line-strong)"}}/>
          </div>
        )}
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
