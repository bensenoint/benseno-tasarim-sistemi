// app/screens/Musteride.jsx — ✈️ Müşteri Onayında bekleyen işler.
// Bu işler Aktif İşler / departman yükü / kapasite hesaplarından hariçtir;
// müşteri revizyonla dönünce (✏️) durum 'çalışılıyor'a geçer ve otomatik
// olarak aktif listelere geri döner — burada yapılacak ek bir şey yoktur.

function MusterideScreen({ data, onOpenBrief }) {
  const rows = (data._allBriefs || data.briefs || [])
    .filter(b => b.durum === "musteride")
    .sort((a, b) => (a.son_gonderim_at || 0) - (b.son_gonderim_at || 0));   // en uzun bekleyen üstte

  const now = Date.now();
  const H = 3600000;
  const bekleyenSa = (b) => b.son_gonderim_at ? Math.round((now - b.son_gonderim_at) / H) : null;
  const beklemeler = rows.map(bekleyenSa).filter(v => v != null);
  const ortBekleme = beklemeler.length ? Math.round(beklemeler.reduce((a, v) => a + v, 0) / beklemeler.length) : null;
  const enUzun = beklemeler.length ? Math.max(...beklemeler) : null;
  const fmtBekleme = (sa) => sa == null ? "—" : sa < 24 ? `${sa} sa` : `${Math.round(sa / 24 * 10) / 10} gün`;
  const fmtAt = (ms) => { try { return new Date(ms).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; } };

  return (
    <div className="bn-tab-in">
      <PageHead
        title="✈️ Müşteri Onayında"
        subtitle={`${rows.length} iş müşteri dönüşü bekliyor · revizyonla dönen iş otomatik aktif listeye geçer`}
      />

      <div className="bns-kpi-4" style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"var(--grid-gap)", marginBottom:"var(--section-gap)" }}>
        <Kpi label="Müşteride" value={rows.length} color="var(--musteride)"/>
        <Kpi label="Ort. bekleme" value={fmtBekleme(ortBekleme)} sub="gönderimden beri"/>
        <Kpi label="En uzun bekleyen" value={fmtBekleme(enUzun)} color={enUzun != null && enUzun >= 72 ? "var(--prio-orange)" : undefined}/>
        <Kpi label="Toplam gönderim" value={rows.reduce((a, b) => a + (b.gonderim_sayisi || 0), 0)} sub="bu işlerde"/>
      </div>

      {rows.length === 0 ? (
        <Card>
          <div style={{ textAlign:"center", padding:"40px 20px", color:"var(--ink-4)", font:"400 14px/1.6 var(--font-sans)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✈️</div>
            Şu an müşteri onayında bekleyen iş yok.<br/>
            <span style={{ fontSize: 12 }}>Bir işi göndermek için Slack thread'ine ✈️ koy ya da "müşteriye yollandı" yaz.</span>
          </div>
        </Card>
      ) : (
        <Card padding={0}>
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%", minWidth:720, borderCollapse:"collapse", font:"400 13px/1.3 var(--font-sans)" }}>
              <thead>
                <tr style={{ background:"var(--paper)" }}>
                  {["#","Marka","İş","Öncelik","Atanan","Gönderim","Bekliyor","Rev (iç/müşt)","Termin"].map((h, i) => (
                    <th key={i} style={{ font:"600 11px/1 var(--font-sans)", color:"var(--ink-3)", letterSpacing:"0.04em", textTransform:"uppercase", padding:"10px 12px", borderBottom:"1px solid var(--line-strong)", textAlign: i === 0 || i >= 5 ? "right" : "left", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((b, idx) => {
                  const sa = bekleyenSa(b);
                  return (
                    <tr key={b.id} onClick={() => onOpenBrief && onOpenBrief(b)} title="Detayı aç"
                      style={{ background: idx % 2 === 1 ? "var(--row-stripe)" : "transparent", cursor:"pointer" }}>
                      <td style={mCs(true, "right")}>{b.no}</td>
                      <td style={mCs()}><BrandChip brand={b.brand} size="sm"/></td>
                      <td style={{ ...mCs(), maxWidth: 260, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.baslik}</td>
                      <td style={mCs()}><PriorityBadge p={b.oncelik || { code: "ylw", label: "NORMAL" }}/></td>
                      <td style={mCs()}>
                        <span style={{ display:"inline-flex", alignItems:"center", gap: 4 }}>
                          {b.lead && <Avatar user={b.lead} size={20}/>}
                          {(b.contributors || []).slice(0, 3).map((c, i) => c && <Avatar key={i} user={c} size={20}/>)}
                        </span>
                      </td>
                      <td style={mCs(true, "right")} title={b.son_gonderim_at ? fmtAt(b.son_gonderim_at) : ""}>
                        ✈️ {b.gonderim_sayisi || 1}.{b.son_gonderim_at ? ` · ${fmtAt(b.son_gonderim_at)}` : ""}
                      </td>
                      <td style={{ ...mCs(true, "right"), color: sa != null && sa >= 72 ? "var(--prio-orange)" : "var(--ink)" , fontWeight: 600 }}>{fmtBekleme(sa)}</td>
                      <td style={mCs(true, "right")}>{b.rev_ic || 0}<span style={{ color:"var(--ink-5)" }}>/</span><span style={{ color:"var(--musteride)" }}>{b.rev_musteri || 0}</span></td>
                      <td style={mCs(true, "right")}>{b.deadline ? fmtAt(b.deadline) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function mCs(mono, align) {
  return {
    padding:"var(--row-pad) 12px", borderBottom:"1px solid var(--line)",
    fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
    fontSize: mono ? 12 : 13, color:"var(--ink)", textAlign: align || "left",
    fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap",
  };
}

window.MusterideScreen = MusterideScreen;
