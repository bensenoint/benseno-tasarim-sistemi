// app/screens/Takvim.jsx — Resmî tatil takvimi (yalnız admin). Hafta sonları otomatiktir;
// buradaki kayıtlar iş günü matematiğini (kapasite yayılımı, net iş saati, kalan gün,
// fatura toplu günü) sistem genelinde etkiler. yarim=true → 09:00-13:00 mesai, 0.5 gün kapasite.

function TakvimScreen() {
  const [tatiller, setTatiller] = React.useState(null);   // null=yükleniyor
  const [f, setF] = React.useState({ gun: "", ad: "", yarim: false, tur: "tatil" });
  const [turF, setTurF] = React.useState("hepsi");   // liste filtresi
  const [st, setSt] = React.useState(null);
  const yil = new Date().getFullYear();
  const [selYil, setSelYil] = React.useState(String(yil));

  const yukle = async () => {
    try {
      const j = await window.bnsApiGet("/api/tatiller");
      setTatiller((j && j.tatiller) || []);
    } catch (e) { setTatiller([]); }
  };
  React.useEffect(() => { yukle(); }, []);

  const apiYaz = async (method, path, body) => {
    const apiBase = (window.bnsResolveApiBase && window.bnsResolveApiBase()) || "https://benseno-api-production.up.railway.app";
    const tok = localStorage.getItem("bns_token");
    const r = await fetch(apiBase + path, {
      method, headers: { "content-type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || ("HTTP " + r.status)); }
  };
  const ekle = async () => {
    if (!f.gun || !f.ad.trim()) { setSt("Tarih ve ad gerekli."); return; }
    setSt("kaydediliyor");
    try { await apiYaz("POST", "/api/tatiller", { gun: f.gun, ad: f.ad, yarim: f.yarim, tur: f.tur }); setF({ gun: "", ad: "", yarim: false, tur: f.tur }); setSt(null); yukle(); if (window.bnsRefresh) window.bnsRefresh(); }
    catch (e) { setSt(String(e.message)); }
  };
  const sil = async (gun) => {
    if (typeof window !== "undefined" && !window.confirm(gun + " tatilini silmek istediğine emin misin?")) return;
    try { await apiYaz("DELETE", "/api/tatiller/" + gun); yukle(); if (window.bnsRefresh) window.bnsRefresh(); }
    catch (e) { setSt(String(e.message)); }
  };

  const GUN_TR = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
  const fmt = (g) => {
    const d = new Date(g + "T12:00:00+03:00");
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" }) + " · " + GUN_TR[d.getDay()];
  };
  const yillar = tatiller ? [...new Set(tatiller.map(t => t.gun.slice(0, 4)))].sort() : [];
  const liste = (tatiller || []).filter(t => t.gun.slice(0, 4) === selYil)
    .filter(t => turF === "hepsi" ? true : (t.tur || "tatil") === turF);

  const TH = { font: "600 10px/1 var(--font-sans)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".05em", textAlign: "left", padding: "0 10px 8px 0", borderBottom: "1px solid var(--line)" };
  const TD = { font: "400 12.5px/1.45 var(--font-sans)", color: "var(--ink-2)", padding: "9px 10px 9px 0", borderBottom: "1px solid var(--paper-2)" };
  const FIELD = { font: "400 13px var(--font-sans)", padding: "8px 10px", border: "1px solid var(--line-strong)", borderRadius: 6, background: "var(--surface)", color: "var(--ink)", outline: "none" };

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: "var(--grid-gap)" }}>
      <div>
        <div style={{ font: "italic 500 24px/1.15 var(--font-display)", color: "var(--ink)" }}>Takvim</div>
        <div style={{ font: "400 13px/1.5 var(--font-sans)", color: "var(--ink-3)", marginTop: 4 }}>
          Resmî tatiller — kapasite bölünmesi, çalışma süresi ölçümü, kalan iş günü ve fatura takip günü bu takvime göre hesaplanır. Hafta sonları otomatik; yarım gün = 09:00-13:00 mesai, 0,5 gün kapasite. 🏠 Evden çalışma günleri normal iş günüdür — yalnız kayıt tutulur (evden-vs-ofis verim raporlarının temeli).</div>
      </div>

      <Card style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ font: "500 10px/1 var(--font-sans)", letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-4)" }}>Tür</span>
            <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
              {[["tatil", "🏛 Resmî tatil"], ["evden", "🏠 Evden çalışma"]].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setF({ ...f, tur: v, yarim: v === "evden" ? false : f.yarim, ad: v === "evden" && !f.ad ? "Evden çalışma" : f.ad })}
                  style={{ font: "600 11px var(--font-sans)", padding: "9px 12px", border: "none", cursor: "pointer",
                    background: f.tur === v ? "var(--paper-2)" : "transparent", color: f.tur === v ? "var(--ink)" : "var(--ink-3)" }}>{l}</button>
              ))}
            </div>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ font: "500 10px/1 var(--font-sans)", letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-4)" }}>Tarih</span>
            <input type="date" value={f.gun} onChange={e => setF({ ...f, gun: e.target.value })} style={FIELD}/>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 180 }}>
            <span style={{ font: "500 10px/1 var(--font-sans)", letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-4)" }}>Tatil adı</span>
            <input value={f.ad} onChange={e => setF({ ...f, ad: e.target.value })} placeholder="ör. Kurban Bayramı 1. Gün" style={FIELD}/>
          </label>
          {f.tur === "tatil" && (
            <label style={{ display: "flex", gap: 6, alignItems: "center", font: "400 12px var(--font-sans)", color: "var(--ink-2)", paddingBottom: 9, cursor: "pointer" }}>
              <input type="checkbox" checked={f.yarim} onChange={e => setF({ ...f, yarim: e.target.checked })}/> yarım gün
            </label>
          )}
          <button onClick={ekle} disabled={st === "kaydediliyor"} style={{
            padding: "9px 16px", border: 0, borderRadius: 6, background: "var(--ody)", color: "#fff",
            font: "600 13px/1 var(--font-sans)", cursor: "pointer", opacity: st === "kaydediliyor" ? .5 : 1 }}>Ekle</button>
        </div>
        {st && st !== "kaydediliyor" && <div style={{ marginTop: 8, font: "500 11px var(--font-sans)", color: "var(--prio-red, #c00)" }}>{st}</div>}
      </Card>

      <Card style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ font: "italic 500 16px/1 var(--font-display)", color: "var(--ink)" }}>Tatiller</span>
          {yillar.map(y => (
            <button key={y} onClick={() => setSelYil(y)} style={{
              border: "1px solid " + (selYil === y ? "var(--ody)" : "var(--line)"), background: "transparent",
              color: selYil === y ? "var(--ody)" : "var(--ink-3)", borderRadius: 999, padding: "5px 12px",
              font: "600 11px/1 var(--font-sans)", cursor: "pointer" }}>{y}</button>
          ))}
          <span style={{ width: 10 }}/>
          {[["hepsi", "Tümü"], ["tatil", "🏛 Tatil"], ["evden", "🏠 Evden"]].map(([v, l]) => (
            <button key={v} onClick={() => setTurF(v)} style={{
              border: "1px solid " + (turF === v ? "var(--blue, #24479E)" : "var(--line)"), background: "transparent",
              color: turF === v ? "var(--blue, #24479E)" : "var(--ink-3)", borderRadius: 999, padding: "5px 11px",
              font: "600 10.5px/1 var(--font-sans)", cursor: "pointer" }}>{l}</button>
          ))}
          <span style={{ marginLeft: "auto", font: "400 11px var(--font-sans)", color: "var(--ink-4)" }}>{liste.length} kayıt</span>
        </div>
        {tatiller == null ? (
          <div style={{ font: "400 12px var(--font-sans)", color: "var(--ink-4)" }}>Yükleniyor…</div>
        ) : !liste.length ? (
          <div style={{ font: "400 12px var(--font-sans)", color: "var(--ink-4)" }}>Bu yıl için kayıt yok.</div>
        ) : (
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr><th style={TH}>Tarih</th><th style={TH}>Tatil</th><th style={TH}>Tür</th><th style={{ ...TH, textAlign: "right" }}></th></tr></thead>
            <tbody>
              {liste.map(t => (
                <tr key={t.gun}>
                  <td style={{ ...TD, width: 170, font: "500 12px var(--font-mono)", color: "var(--ink)" }}>{fmt(t.gun)}</td>
                  <td style={TD}>{t.ad}</td>
                  <td style={{ ...TD, width: 130 }}>
                    {(t.tur || "tatil") === "evden" ? (
                      <span style={{ font: "600 9.5px/1 var(--font-sans)", borderRadius: 999, padding: "3px 8px",
                        border: "1px solid var(--blue, #24479E)", color: "var(--blue, #24479E)" }}>🏠 evden</span>
                    ) : (
                      <span style={{ font: "600 9.5px/1 var(--font-sans)", borderRadius: 999, padding: "3px 8px",
                        border: "1px solid " + (t.yarim ? "var(--prio-orange, #c60)" : "var(--line-strong)"),
                        color: t.yarim ? "var(--prio-orange, #c60)" : "var(--ink-3)" }}>{t.yarim ? "🏛 yarım gün" : "🏛 tam gün"}</span>
                    )}
                  </td>
                  <td style={{ ...TD, width: 40, textAlign: "right" }}>
                    <button onClick={() => sil(t.gun)} title="Sil" style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--ink-4)", font: "500 12px var(--font-sans)" }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
