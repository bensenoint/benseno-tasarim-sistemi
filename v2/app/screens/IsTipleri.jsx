// app/screens/IsTipleri.jsx — İş tipi raporlama (editoryal Card düzeni; diğer rapor sayfalarıyla uyumlu).
// Süre havuzu TÜM tamamlananlardan (medyan güvenilirliği); adet metrikleri seçili tarih aralığından.
// Kapasiteye DOKUNMAZ — "tahmini vs gerçek" tablosu ilerideki geçiş için gözlem biriktirir.

function IsTipleriScreen({ data, currentUser }) {
  const tipler = (window.BNS_DATA && window.BNS_DATA.IS_TIPLERI) || [];
  const briefs = data.briefs || [];
  const comp = data.completed || [];                       // tarih aralığına süzülü
  const compAll = data._allCompleted || data.completed || [];
  const isMgr = currentUser && currentUser.role === "admin";
  const adOf = React.useMemo(() => { const m = {}; tipler.forEach(t => m[t.kod] = t.ad); return m; }, [tipler]);
  const ad = (k) => adOf[k] || (k ? k : "— tipsiz —");

  const M = React.useMemo(() => {
    const m = {};
    const row = (k) => m[k] = m[k] || { tamam: 0, aktif: 0, gec: 0, saat: 0, marka: {}, kisi: {}, ekSatis: 0, tutarsiz: 0 };
    comp.forEach(c => {
      const r = row(c.is_tipi || "");
      r.tamam++;
      if (c.deadline && c.bitis && c.bitis > c.deadline) r.gec++;
      const h = (typeof bnsNetIsSaati === "function") ? bnsNetIsSaati(c.durum_olaylari) : null;
      if (h != null && h >= 0.25) r.saat += h;
      if (c.marka) r.marka[c.marka] = (r.marka[c.marka] || 0) + 1;
      [...(c.workers || []), ...(c.contributors || [])].forEach(w => { if (w && w.name) r.kisi[w.name] = (r.kisi[w.name] || 0) + 1; });
      if (c.ucret_tipi === "ek" && typeof c.satis === "number") r.ekSatis += c.satis;
      if (c.ucret_tipi === "ek" && c.satis == null) r.tutarsiz++;
    });
    briefs.forEach(b => { row(b.is_tipi || "").aktif++; });
    return m;
  }, [briefs, comp]);

  const ist = React.useMemo(() =>
    (typeof bnsTipSureIstatistik === "function") ? bnsTipSureIstatistik(compAll) : {}, [compAll]);

  const kodlar = Object.keys(M).sort((a, b) => (M[b].tamam + M[b].aktif) - (M[a].tamam + M[a].aktif));
  const maxN = Math.max(1, ...kodlar.map(k => M[k].tamam + M[k].aktif));
  const toplamTamam = kodlar.reduce((t, k) => t + M[k].tamam, 0);
  const toplamAktif = kodlar.reduce((t, k) => t + M[k].aktif, 0);
  const olculen = Object.values(ist).reduce((t, s) => t + s.n, 0);

  const trend = React.useMemo(() => {
    const aylar = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      aylar.push({ key: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"),
        ad: d.toLocaleDateString("tr-TR", { month: "short" }) });
    }
    const top = kodlar.slice(0, 6);
    const say = {};
    compAll.forEach(c => {
      if (!c.bitis || !c.is_tipi) return;
      const d = new Date(c.bitis);
      const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      (say[key] = say[key] || {})[c.is_tipi] = (say[key][c.is_tipi] || 0) + 1;
    });
    return { aylar, top, say };
  }, [compAll, kodlar.join(",")]);

  const tvg = React.useMemo(() => {
    if (typeof bnsNetIsSaati !== "function" || typeof bnsTipikSure !== "function") return [];
    return compAll
      .filter(c => c.is_tipi && (c.durum_olaylari || []).some(o => o.durum === "basladi"))
      .sort((a, b) => (b.bitis || 0) - (a.bitis || 0)).slice(0, 10)
      .map(c => {
        const g = bnsNetIsSaati(c.durum_olaylari);
        const t = bnsTipikSure(c.is_tipi, c.marka, compAll.filter(x => x !== c));
        return { no: c.no, baslik: c.baslik, tip: c.is_tipi, gercek: g, tahmin: t.saat, kaynak: t.kaynak };
      }).filter(r => r.gercek != null);
  }, [compAll]);

  // ── ev stili yardımcıları (DeptCompare/Completed ile aynı dil) ──
  const SecTitle = ({ children, sub }) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
      <span style={{ font: "italic 500 16px/1.15 var(--font-display)", color: "var(--ink)" }}>{children}</span>
      {sub && <span style={{ font: "400 11px/1.4 var(--font-sans)", color: "var(--ink-4)" }}>{sub}</span>}
    </div>
  );
  const TH = { font: "600 10px/1 var(--font-sans)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".05em", textAlign: "left", padding: "0 10px 8px 0", borderBottom: "1px solid var(--line)" };
  const TD = { font: "400 12px/1.45 var(--font-sans)", color: "var(--ink-2)", padding: "8px 10px 8px 0", borderBottom: "1px solid var(--paper-2)", verticalAlign: "top" };
  const NUM = { font: "500 12px var(--font-mono)", color: "var(--ink)" };
  const fmtH = (h) => h == null ? "—" : (h >= 10 ? Math.round(h) : Math.round(h * 10) / 10) + " sa";
  const kpi = (label, val, sub) => (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ font: "500 10px/1 var(--font-sans)", letterSpacing: ".07em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 6 }}>{label}</div>
      <div style={{ font: "500 26px/1 var(--font-display)", fontStyle: "italic", color: "var(--ink)" }}>{val}</div>
      {sub && <div style={{ font: "400 10.5px/1.3 var(--font-sans)", color: "var(--ink-4)", marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const sureli = tipler.filter(t => ist[t.kod]);
  const veribekleyen = tipler.filter(t => !ist[t.kod]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--grid-gap)" }}>
      <div>
        <div style={{ font: "italic 500 24px/1.15 var(--font-display)", color: "var(--ink)" }}>İş Tipleri</div>
        <div style={{ font: "400 13px/1.4 var(--font-sans)", color: "var(--ink-3)", marginTop: 4 }}>
          Adet metrikleri seçili tarih aralığından · süreler 🚀 işaretli teslimlerden öğrenilir, her teslimle güncellenir</div>
      </div>

      {/* KPI şeridi */}
      <Card style={{ padding: "16px 18px", display: "flex", gap: 18, flexWrap: "wrap" }}>
        {kpi("Tamamlanan", toplamTamam, "seçili dönem")}
        {kpi("Aktif", toplamAktif, "şu an")}
        {kpi("Kullanılan tip", kodlar.filter(k => k && (M[k].tamam + M[k].aktif)).length + "/" + tipler.length)}
        {kpi("Ölçülen süre örneği", olculen, "medyanlar bundan öğreniyor")}
      </Card>

      {/* Dağılım */}
      <Card style={{ padding: "16px 18px" }}>
        <SecTitle sub="tamamlanan + aktif, seçili dönem">Dağılım</SecTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {kodlar.map(k => {
            const r = M[k]; const n = r.tamam + r.aktif;
            return (
              <div key={k || "_"} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 175, font: "400 12px var(--font-sans)", color: "var(--ink-2)", flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ad(k)}</div>
                <div style={{ flex: 1, height: 10, background: "var(--paper-2)", borderRadius: 999, overflow: "hidden", display: "flex" }}>
                  <div title={r.tamam + " tamamlanan"} style={{ width: (r.tamam / maxN * 100) + "%", background: "var(--blue, #24479E)", opacity: .75 }}/>
                  <div title={r.aktif + " aktif"} style={{ width: (r.aktif / maxN * 100) + "%", background: "var(--ody)", opacity: .65 }}/>
                </div>
                <div style={{ ...NUM, width: 88, flexShrink: 0, textAlign: "right", color: "var(--ink-3)" }}>{r.tamam}<span style={{ color: "var(--line-strong)" }}> / </span><span style={{ color: "var(--ody)" }}>{r.aktif}</span></div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 12, font: "400 10px/1 var(--font-sans)", color: "var(--ink-4)" }}>
          <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "var(--blue, #24479E)", opacity: .75, marginRight: 5, verticalAlign: "-1px" }}/>tamamlanan</span>
          <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "var(--ody)", opacity: .65, marginRight: 5, verticalAlign: "-1px" }}/>aktif</span>
        </div>
      </Card>

      {/* Tipik süreler */}
      <Card style={{ padding: "16px 18px" }}>
        <SecTitle sub="tüm zamanlar · medyan (aralık) · n = ölçülen teslim">Öğrenilen tipik süreler</SecTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
          {sureli.map(t => {
            const s = ist[t.kod];
            return (
              <div key={t.kod} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "11px 13px", background: "var(--paper)" }}>
                <div style={{ font: "600 11.5px/1.3 var(--font-sans)", color: "var(--ink-2)" }}>{t.ad}</div>
                <div style={{ marginTop: 7, display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
                  <span style={{ font: "italic 500 22px/1 var(--font-display)", color: "var(--ink)" }}>{fmtH(s.medyan)}</span>
                  <span style={{ font: "400 10.5px var(--font-sans)", color: "var(--ink-4)" }}>{fmtH(s.min)}–{fmtH(s.max)}</span>
                  <span style={{ font: "500 9.5px var(--font-mono)", color: s.n < 3 ? "var(--prio-orange, #c60)" : "var(--ink-4)", border: "1px solid var(--line)", borderRadius: 999, padding: "2px 7px" }}>n={s.n}{s.n < 3 ? " · birikiyor" : ""}</span>
                </div>
              </div>
            );
          })}
        </div>
        {veribekleyen.length > 0 && (
          <div style={{ marginTop: 12, font: "400 11px/1.7 var(--font-sans)", color: "var(--ink-4)" }}>
            Veri bekleyen tipler: {veribekleyen.map(t => t.ad).join(" · ")}
          </div>
        )}
      </Card>

      {/* Tip kırılımı — tek tablo */}
      <Card style={{ padding: "16px 18px" }}>
        <SecTitle sub="seçili dönem · net saat = ölçülebilen teslim toplamı">Tip kırılımı</SecTitle>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 660 }}>
            <thead><tr>
              <th style={TH}>Tip</th>
              <th style={{ ...TH, textAlign: "right" }}>Tamam</th>
              <th style={{ ...TH, textAlign: "right" }}>Net saat</th>
              <th style={{ ...TH, textAlign: "right" }}>Gecikme</th>
              <th style={{ ...TH, paddingLeft: 14 }}>Markalar</th>
              <th style={{ ...TH, paddingLeft: 14 }}>Kişiler</th>
            </tr></thead>
            <tbody>
              {kodlar.filter(k => M[k].tamam).map(k => {
                const r = M[k];
                const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, n]) => `${m} (${n})`).join(" · ") || "—";
                const gecPct = r.tamam >= 2 ? Math.round(r.gec / r.tamam * 100) : null;
                return (
                  <tr key={k}>
                    <td style={{ ...TD, color: "var(--ink)", fontWeight: 500, whiteSpace: "nowrap" }}>{ad(k)}</td>
                    <td style={{ ...TD, textAlign: "right" }}><span style={NUM}>{r.tamam}</span></td>
                    <td style={{ ...TD, textAlign: "right" }}><span style={NUM}>{r.saat ? fmtH(r.saat) : "—"}</span></td>
                    <td style={{ ...TD, textAlign: "right" }}>{gecPct == null ? <span style={{ color: "var(--ink-4)" }}>—</span> :
                      <span style={{ ...NUM, color: gecPct >= 50 ? "var(--prio-red)" : gecPct >= 25 ? "var(--prio-orange)" : "var(--ink)" }}>%{gecPct}</span>}</td>
                    <td style={{ ...TD, paddingLeft: 14, color: "var(--ink-3)" }}>{top(r.marka)}</td>
                    <td style={{ ...TD, paddingLeft: 14, color: "var(--ink-3)" }}>{top(r.kisi)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Aylık trend */}
      <Card style={{ padding: "16px 18px" }}>
        <SecTitle sub="son 6 ay · en yoğun 6 tip · tamamlanma ayına göre">Aylık trend</SecTitle>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", minWidth: 520, width: "100%" }}>
            <thead><tr><th style={TH}>Tip</th>{trend.aylar.map(a => <th key={a.key} style={{ ...TH, textAlign: "right", paddingLeft: 14 }}>{a.ad}</th>)}</tr></thead>
            <tbody>{trend.top.map(k => (
              <tr key={k}><td style={{ ...TD, whiteSpace: "nowrap", color: "var(--ink)", fontWeight: 500 }}>{ad(k)}</td>
                {trend.aylar.map(a => { const n = (trend.say[a.key] || {})[k] || 0;
                  return <td key={a.key} style={{ ...TD, textAlign: "right", paddingLeft: 14 }}>
                    <span style={{ ...NUM, opacity: n ? 1 : .25 }}>{n || "·"}</span></td>; })}
              </tr>))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Tahmini vs gerçek */}
      <Card style={{ padding: "16px 18px" }}>
        <SecTitle sub="son 10 ölçülebilir teslim · kapasite geçişi için gözlem">Tahmin doğruluğu</SecTitle>
        {tvg.length ? (
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr><th style={TH}>İş</th><th style={TH}>Tip</th><th style={{ ...TH, textAlign: "right" }}>Tahmin</th><th style={{ ...TH, textAlign: "right" }}>Gerçek</th></tr></thead>
            <tbody>{tvg.map(r => (
              <tr key={r.no}>
                <td style={{ ...TD, maxWidth: 340 }}><span style={{ ...NUM, color: "var(--blue, #24479E)" }}>#{r.no}</span> {String(r.baslik).slice(0, 52)}</td>
                <td style={{ ...TD, width: 165, whiteSpace: "nowrap" }}>{ad(r.tip)}</td>
                <td style={{ ...TD, textAlign: "right", width: 100, whiteSpace: "nowrap" }}><span style={NUM}>{fmtH(r.tahmin)}</span> <span style={{ font: "400 9.5px var(--font-sans)", color: "var(--ink-4)" }}>{r.kaynak}</span></td>
                <td style={{ ...TD, textAlign: "right", width: 70 }}><span style={NUM}>{fmtH(r.gercek)}</span></td>
              </tr>))}
            </tbody>
          </table>
        ) : <div style={{ font: "400 12px var(--font-sans)", color: "var(--ink-4)" }}>Henüz ölçülebilir teslim yok — 🚀 işaretli işler tamamlandıkça dolar.</div>}
      </Card>

      {/* Ek-iş satışı (yönetici) */}
      {isMgr && (
        <Card style={{ padding: "16px 18px" }}>
          <SecTitle sub="seçili dönem · yalnız yönetici">Ek-iş satışı</SecTitle>
          {(() => { const n = kodlar.reduce((t, k) => t + M[k].tutarsiz, 0);
            return n > 0 ? <div style={{ font: "400 11.5px var(--font-sans)", color: "var(--prio-orange, #c60)", marginBottom: 10 }}>⚠️ {n} ek işin satış tutarı girilmemiş ("₺ bekliyor") — toplamlar eksik olabilir.</div> : null; })()}
          {kodlar.filter(k => M[k].ekSatis > 0).length ? (
            <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 480 }}><tbody>
              {kodlar.filter(k => M[k].ekSatis > 0).sort((a, b) => M[b].ekSatis - M[a].ekSatis).map(k => (
                <tr key={k}>
                  <td style={{ ...TD, color: "var(--ink)" }}>{ad(k)}</td>
                  <td style={{ ...TD, textAlign: "right" }}><span style={NUM}>{M[k].ekSatis.toLocaleString("tr-TR")} ₺</span></td>
                </tr>))}
            </tbody></table>
          ) : <div style={{ font: "400 12px var(--font-sans)", color: "var(--ink-4)" }}>Bu dönemde satışı girilmiş ek iş yok.</div>}
        </Card>
      )}
    </div>
  );
}
