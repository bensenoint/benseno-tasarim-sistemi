// app/screens/IsTipleri.jsx — İş tipi raporlama: adet/marka/kişi/süre/gecikme/trend.
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

  // Tip başına: dönem tamamlanan, aktif, gecikmiş-teslim, net saat toplamı, markalar, kişiler
  const M = React.useMemo(() => {
    const m = {};
    const row = (k) => m[k] = m[k] || { tamam: 0, aktif: 0, gec: 0, saat: 0, marka: {}, kisi: {}, ekSatis: 0 };
    comp.forEach(c => {
      const r = row(c.is_tipi || "");
      r.tamam++;
      if (c.deadline && c.bitis && c.bitis > c.deadline) r.gec++;
      const h = (typeof bnsNetIsSaati === "function") ? bnsNetIsSaati(c.durum_olaylari) : null;
      if (h != null && h >= 0.25) r.saat += h;
      if (c.marka) r.marka[c.marka] = (r.marka[c.marka] || 0) + 1;
      [...(c.workers || []), ...(c.contributors || [])].forEach(w => { if (w && w.name) r.kisi[w.name] = (r.kisi[w.name] || 0) + 1; });
      if (c.ucret_tipi === "ek" && typeof c.satis === "number") r.ekSatis += c.satis;
    });
    briefs.forEach(b => { row(b.is_tipi || "").aktif++; });
    return m;
  }, [briefs, comp]);

  const ist = React.useMemo(() =>
    (typeof bnsTipSureIstatistik === "function") ? bnsTipSureIstatistik(compAll) : {}, [compAll]);

  const kodlar = Object.keys(M).sort((a, b) => (M[b].tamam + M[b].aktif) - (M[a].tamam + M[a].aktif));
  const maxN = Math.max(1, ...kodlar.map(k => M[k].tamam + M[k].aktif));

  // Aylık trend: son 6 ay × ilk 6 tip (tamamlanma ayına göre, tüm veriden)
  const trend = React.useMemo(() => {
    const aylar = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      aylar.push({ key: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"),
        ad: d.toLocaleDateString("tr-TR", { month: "short" }) });
    }
    const top = kodlar.slice(0, 6);
    const say = {}; // ay → tip → n
    compAll.forEach(c => {
      if (!c.bitis || !c.is_tipi) return;
      const d = new Date(c.bitis);
      const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      (say[key] = say[key] || {})[c.is_tipi] = (say[key][c.is_tipi] || 0) + 1;
    });
    return { aylar, top, say };
  }, [compAll, kodlar.join(",")]);

  // Tahmini vs gerçek: basladi olayı olan son 15 teslim
  const tvg = React.useMemo(() => {
    if (typeof bnsNetIsSaati !== "function" || typeof bnsTipikSure !== "function") return [];
    return compAll
      .filter(c => c.is_tipi && (c.durum_olaylari || []).some(o => o.durum === "basladi"))
      .sort((a, b) => (b.bitis || 0) - (a.bitis || 0)).slice(0, 15)
      .map(c => {
        const g = bnsNetIsSaati(c.durum_olaylari);
        const digerleri = compAll.filter(x => x !== c);
        const t = bnsTipikSure(c.is_tipi, c.marka, digerleri);
        return { no: c.no, baslik: c.baslik, tip: c.is_tipi, gercek: g, tahmin: t.saat, kaynak: t.kaynak };
      }).filter(r => r.gercek != null);
  }, [compAll]);

  const S = {
    h: { font: "italic 500 18px/1.15 var(--font-display)", color: "var(--ink)", margin: "28px 0 12px", paddingBottom: 10, borderBottom: "1px solid var(--line)" },
    th: { font: "600 10px/1 var(--font-sans)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", padding: "6px 10px 6px 0" },
    td: { font: "400 12px/1.4 var(--font-sans)", color: "var(--ink-2)", padding: "7px 10px 7px 0", borderTop: "1px solid var(--paper-2)", verticalAlign: "top" },
    num: { font: "500 12px var(--font-mono)", color: "var(--ink)" },
  };
  const fmtH = (h) => h == null ? "—" : (h >= 10 ? Math.round(h) : Math.round(h * 10) / 10) + " sa";

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ marginBottom: 6 }}>
        <div style={{ font: "italic 500 24px/1.15 var(--font-display)", color: "var(--ink)" }}>İş Tipleri</div>
        <div style={{ font: "400 13px/1.4 var(--font-sans)", color: "var(--ink-3)", marginTop: 4 }}>
          Adet metrikleri seçili tarih aralığından; süre istatistikleri tüm "işe başlandı" işaretli teslimlerden öğrenilir ve her yeni teslimle güncellenir.</div>
      </div>

      <div style={S.h}>📊 Dağılım — adet (dönem)</div>
      {kodlar.map(k => {
        const r = M[k]; const n = r.tamam + r.aktif;
        return (
          <div key={k || "_"} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
            <div style={{ width: 190, font: "400 12px var(--font-sans)", color: "var(--ink-2)", flexShrink: 0 }}>{ad(k)}</div>
            <div style={{ flex: 1, height: 14, background: "var(--paper-2)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: (n / maxN * 100) + "%", height: "100%", background: "var(--ink-4)", opacity: 0.55 }} />
            </div>
            <div style={{ ...S.num, width: 120, flexShrink: 0 }}>{r.tamam} tamam · {r.aktif} aktif</div>
          </div>
        );
      })}

      <div style={S.h}>⏱️ Tipik süre (öğrenilen — tüm zamanlar)</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 10 }}>
        {tipler.map(t => {
          const s = ist[t.kod];
          return (
            <div key={t.kod} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ font: "600 12px/1.3 var(--font-sans)", color: "var(--ink)" }}>{t.ad}</div>
              {s ? (
                <div style={{ marginTop: 6 }}>
                  <span style={{ font: "500 18px var(--font-mono)", color: "var(--ink)" }}>{fmtH(s.medyan)}</span>
                  <span style={{ font: "400 11px var(--font-sans)", color: "var(--ink-4)", marginLeft: 8 }}>
                    {fmtH(s.min)}–{fmtH(s.max)} · n={s.n}{s.n < 3 ? " · veri birikiyor" : ""}</span>
                </div>
              ) : <div style={{ font: "400 11px var(--font-sans)", color: "var(--ink-4)", marginTop: 6 }}>veri birikiyor</div>}
            </div>
          );
        })}
      </div>

      <div style={S.h}>🏢 Tip × Marka (dönem, ilk 3 marka)</div>
      <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
        {kodlar.filter(k => M[k].tamam).map(k => (
          <tr key={k}>
            <td style={{ ...S.td, width: 190, color: "var(--ink)" }}>{ad(k)}</td>
            <td style={S.td}>{Object.entries(M[k].marka).sort((a, b) => b[1] - a[1]).slice(0, 3)
              .map(([m, n]) => `${m} (${n})`).join(" · ") || "—"}</td>
          </tr>
        ))}
      </tbody></table>

      <div style={S.h}>👥 Tip × Kişi (dönem, ilk 3 kişi + toplam net saat)</div>
      <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
        {kodlar.filter(k => M[k].tamam).map(k => (
          <tr key={k}>
            <td style={{ ...S.td, width: 190, color: "var(--ink)" }}>{ad(k)}</td>
            <td style={S.td}>{Object.entries(M[k].kisi).sort((a, b) => b[1] - a[1]).slice(0, 3)
              .map(([m, n]) => `${m} (${n})`).join(" · ") || "—"}</td>
            <td style={{ ...S.td, width: 110, textAlign: "right" }}><span style={S.num}>{M[k].saat ? fmtH(M[k].saat) : "—"}</span></td>
          </tr>
        ))}
      </tbody></table>

      <div style={S.h}>⏰ Gecikme oranı (dönem)</div>
      <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
        {kodlar.filter(k => M[k].tamam >= 2).map(k => {
          const r = M[k]; const pct = Math.round(r.gec / r.tamam * 100);
          return (<tr key={k}>
            <td style={{ ...S.td, width: 190, color: "var(--ink)" }}>{ad(k)}</td>
            <td style={S.td}><span style={S.num}>%{pct}</span> <span style={{ color: "var(--ink-4)" }}>({r.gec}/{r.tamam} geç teslim)</span></td>
          </tr>);
        })}
      </tbody></table>

      <div style={S.h}>📈 Aylık trend (son 6 ay, ilk 6 tip)</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: 560 }}>
          <thead><tr><th style={S.th}>Tip</th>{trend.aylar.map(a => <th key={a.key} style={{ ...S.th, textAlign: "right", paddingLeft: 14 }}>{a.ad}</th>)}</tr></thead>
          <tbody>{trend.top.map(k => (
            <tr key={k}><td style={{ ...S.td, width: 190, color: "var(--ink)" }}>{ad(k)}</td>
              {trend.aylar.map(a => <td key={a.key} style={{ ...S.td, textAlign: "right", paddingLeft: 14 }}>
                <span style={S.num}>{(trend.say[a.key] || {})[k] || "·"}</span></td>)}
            </tr>))}
          </tbody>
        </table>
      </div>

      <div style={S.h}>🎯 Tahmini vs gerçek (son 15 ölçülebilir teslim — kapasite geçişi için gözlem)</div>
      {tvg.length ? (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><th style={S.th}>İş</th><th style={S.th}>Tip</th><th style={{ ...S.th, textAlign: "right" }}>Tahmin</th><th style={{ ...S.th, textAlign: "right" }}>Gerçek</th></tr></thead>
          <tbody>{tvg.map(r => (
            <tr key={r.no}>
              <td style={{ ...S.td, maxWidth: 340 }}>#{r.no} {String(r.baslik).slice(0, 55)}</td>
              <td style={{ ...S.td, width: 160 }}>{ad(r.tip)}</td>
              <td style={{ ...S.td, textAlign: "right", width: 90 }}><span style={S.num}>{fmtH(r.tahmin)}</span> <span style={{ font: "400 10px var(--font-sans)", color: "var(--ink-4)" }}>({r.kaynak})</span></td>
              <td style={{ ...S.td, textAlign: "right", width: 70 }}><span style={S.num}>{fmtH(r.gercek)}</span></td>
            </tr>))}
          </tbody>
        </table>
      ) : <div style={{ font: "400 12px var(--font-sans)", color: "var(--ink-4)" }}>Henüz ölçülebilir teslim yok — "işe başlandı" (🚀) işaretli işler tamamlandıkça dolar.</div>}

      {isMgr && (
        <React.Fragment>
          <div style={S.h}>💰 Tip × Ek-iş satışı (dönem, yönetici)</div>
          <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
            {kodlar.filter(k => M[k].ekSatis > 0).sort((a, b) => M[b].ekSatis - M[a].ekSatis).map(k => (
              <tr key={k}>
                <td style={{ ...S.td, width: 190, color: "var(--ink)" }}>{ad(k)}</td>
                <td style={S.td}><span style={S.num}>{M[k].ekSatis.toLocaleString("tr-TR")} ₺</span></td>
              </tr>))}
          </tbody></table>
        </React.Fragment>
      )}
    </div>
  );
}
