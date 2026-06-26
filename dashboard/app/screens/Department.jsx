// app/screens/Department.jsx — reused for Tasarım / Editör / AI tabs.

function DepartmentScreen({ data, role, onOpenBrief, onOpenCompleted, onStatusChange, currentUser, tableMode }) {
  // Dönemsel özet yalnız yöneticilere görünür (giriş yapan kullanıcıya göre).
  const meRec = (data.USERS || []).find(x => x.id === (currentUser && (currentUser.slack_id || currentUser.id)));
  const isManager = !!((currentUser && currentUser.role === "admin") || (meRec && meRec.rol === "yonetici"));
  const roleMap = {
    tasarim:   { name: "Tasarım",   emoji: "🎨", stats: data.deptStats.tasarim,   accent: "var(--bw-1)" },
    editor:    { name: "Editör",    emoji: "✍️", stats: data.deptStats.editor,    accent: "var(--bw-4)" },
    ai:        { name: "AI",        emoji: "🤖", stats: data.deptStats.ai,        accent: "var(--bw-14)" },
    freelance: { name: "Freelance", emoji: "🤝", stats: data.deptStats.freelance, accent: "var(--bw-8)" }
  };
  const r = roleMap[role];
  // rows henüz hesaplanmadı — capPct rows.length ile override edilecek (aşağıda)
  const _capPctFromStats = r.stats ? (r.stats.capacity_pct != null ? r.stats.capacity_pct : bnsCapPct(r.stats)) : 0;
  // dept öncelikli eşleşme: departman yöneticileri (rol='yonetici', dept=ilgili) de ekibin içinde sayılır
  const people = data.USERS.filter(u => (u.dept || u.rol) === role);
  // Department her zaman bu rolün tüm briefler'ini gösterir — viewMode (mine/dept/all) etkilemez.
  const allBriefs = (data._allBriefs || data.briefs).filter(b => b.durum !== "musteride"); // müşteridekiler yük sayılmaz
  // Kapasite/kişi yükü tarihe duyarlı: seçili aralığın SONU geçmişteyse o tarihte açık
  // olan işleri zaman damgalarından geri-hesapla; bugünü kapsıyorsa güncel küme.
  const _now = (window.BNS_DATA && window.BNS_DATA.NOW) || Date.now();
  const _dr = data.dateRange || {};
  const _cutoff = (typeof _dr.to === "number" && _dr.to < _now) ? _dr.to : null;
  const _allCompleted = data._allCompleted || data.completed || [];
  const capBriefs = bnsBriefsAsOf((data._allBriefs || data.briefs), _allCompleted, _cutoff).filter(b => b.durum !== "musteride");
  // TEK KURAL: aktif iş kümesi ve kapasite, Genel bakış'la AYNI bnsDeptActive/bnsDeptCapPct üzerinden hesaplanır.
  // İş LİSTESİ (rows) her zaman güncel; kapasite/yük tarihe duyarlı (capBriefs).
  const rows = bnsDeptActive(allBriefs, role);
  const overdueCount = rows.filter(b => b.deltaH <= 0 && b.durum !== "tamamlandi").length;
  const capPct = (r.stats && r.stats.capacity) ? bnsDeptCapPct(capBriefs, r.stats, role) : _capPctFromStats;
  const reviewCount = rows.filter(b => b.durum === "incelemede").length;
  const thisWeek = rows.filter(b => b.deltaH > 0 && b.deltaH <= 168).length;

  // Load per person — tarihe duyarlı küme (capBriefs) üzerinden.
  const loadByPerson = people.map(p => {
    const my = capBriefs.filter(b => (b.lead && b.lead.id === p.id) || (Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === p.id)));
    const myOverdue = my.filter(b => _cutoff ? (typeof b.deadline === "number" && b.deadline < _cutoff) : (b.deltaH <= 0 && b.durum !== "tamamlandi")).length;
    return {
      user: p,
      active: my.length,
      overdue: myOverdue,
      // Profil ekranıyla AYNI kapasite hesabı — rol ağırlıklı (işçi 5/lead 2/gözlemci 1),
      // işçi-eşdeğerine çevrilip (yük/5) limite bölünür. bnsPersonLoad gözlemcileri de sayar.
      load: Math.max(0, bnsPersonCapPct(p, bnsPersonLoad(capBriefs, p.id) / 5) + (p.isNew ? -10 : 0))
    };
  });

  // ─── Departman performans özeti — üstte seçili GLOBAL tarih aralığına göre (data.completed süzülü) ───
  const RANGE_LABELS = { "7d":"Son 7 gün", "30d":"Son 30 gün", "90d":"Son 90 gün", year:"Bu yıl", all:"Tüm zamanlar", custom:"Özel aralık" };
  const deptRangeLabel = RANGE_LABELS[(data.dateRange && data.dateRange.preset) || "all"] || "seçili aralık";
  const allCompleted = data.completed || data._allCompleted || [];
  const deptDone = allCompleted.filter(b =>
    (b.lead && (b.lead.dept || b.lead.rol) === role) ||
    (b.dept === role) ||
    (Array.isArray(b.contributors) && b.contributors.some(c => c && (c.dept || c.rol) === role))
  );
  const dN = deptDone.length;
  const dBrands = {};
  deptDone.forEach(b => { if (b.marka) dBrands[b.marka] = (dBrands[b.marka] || 0) + 1; });
  const dBrandList = Object.entries(dBrands).sort((a, b) => b[1] - a[1]);
  const dRevTotal = deptDone.reduce((s, b) => s + (parseInt(b.revision) || 0), 0);
  const dAvgRev = dN ? (dRevTotal / dN).toFixed(1) : "—";
  const dSureArr = deptDone.map(b => b.sureH || 0).filter(h => h > 0);
  const dHours = dSureArr.reduce((s, v) => s + v, 0);
  const dAvgSure = dSureArr.length ? (dHours / dSureArr.length).toFixed(1) : "—";
  const dOnTime = deptDone.filter(b => (b.gecikmeH || 0) <= 0).length;
  const dLate = dN - dOnTime;
  const dOnTimePct = dN ? Math.round(dOnTime / dN * 100) : null;
  const dRatingArr = deptDone.filter(b => b.rating > 0).map(b => b.rating);
  const dAvgRating = dRatingArr.length ? (dRatingArr.reduce((s, v) => s + v, 0) / dRatingArr.length).toFixed(1) : "—";
  const doneByPerson = people.map(p => ({
    user: p,
    done: deptDone.filter(b => (b.lead && b.lead.id === p.id) || (Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === p.id))).length
  })).filter(x => x.done > 0).sort((a, b) => b.done - a.done);
  const deptRows = [
    ["Toplam tamamlanan iş", String(dN)],
    ["Teslim edilen iş", String(dN)],
    ["Zamanında teslim", dOnTimePct != null ? `${dOnTime} · %${dOnTimePct}` : "—"],
    ["Gecikmeli teslim", String(dLate)],
    ["Toplam revize", String(dRevTotal)],
    ["Ort. revize / iş", dAvgRev],
    ["Ort. tamamlama süresi", dAvgSure !== "—" ? dAvgSure + " sa" : "—"],
    ["Toplam çalışma süresi", dHours > 0 ? dHours.toFixed(0) + " sa" : "—"],
    ["Çalışılan marka", String(dBrandList.length)],
    ["Departman kişi sayısı", String(people.length)],
    ["Ort. puan", dAvgRating !== "—" ? dAvgRating + " ★" : "—"],
  ];
  const brandColorOf = (name) => (data.BRANDS || []).find(b => b.name === name)?.color
    || (data.BR && data.BR[name] && data.BR[name].color) || "var(--ink-4)";

  return (
    <div className="bn-tab-in">
      <PageHead
        eyebrow={`Departman · ${r.stats.people} kişi`}
        title={`${r.name} departmanı`}
        subtitle={(() => {
          const dr = window.BNS_DATA?.ratings?.dept?.[role];
          const star = dr && dr.cnt ? ` · ⭐ ${dr.avg}/5 (${dr.cnt} iş)` : "";
          return `${rows.length} aktif iş · %${capPct} kapasite · ${overdueCount} geciken${star}`;
        })()}
        actions={null}
      />

      <div style={{display:"flex", flexDirection:"column", gap:"var(--section-gap)"}}>
        {/* 1) İŞ LİSTESİ (Detay bakış) — EN BAŞTA */}
        <div>
          <div style={{font:"italic 500 18px/1.15 var(--font-display)", color:"var(--ink)", margin:"0 0 12px"}}>{r.name} · detay bakış</div>
          <JobsScreen data={data} dept={role} hideHead
            onOpenBrief={onOpenBrief} onOpenCompleted={onOpenCompleted} onStatusChange={onStatusChange} tableMode={tableMode}/>
        </div>

        {/* 2) ⭐ Yıldız karnesi — Departmanlar özet sayfasıyla AYNI bileşen (accordion'lu), tarihe duyarlı */}
        <StarReport data={data} depts={[role]}/>

        {/* 3) Ekip + Dönemsel özet yan yana (mobilde alt alta) — departman özeti */}
        <div className="bn-grid-2" style={{display:"grid", gridTemplateColumns: isManager ? "minmax(0,1fr) minmax(0,1fr)" : "1fr", gap:"var(--section-gap)", alignItems:"start"}}>
        {/* Ekip */}
        <Card padding={0}>
          <div style={{padding:"14px 16px", borderBottom:"1px solid var(--line)"}}>
            <h2 style={{font:"italic 500 18px/1.15 var(--font-display)", color:"var(--ink)", margin:0}}>{r.name} ekibi</h2>
            <div style={{font:"400 12px/1.3 var(--font-sans)", color:"var(--ink-3)", marginTop:4}}>{people.length} kişi · yüke göre sıralı</div>
          </div>
          <div>
            {loadByPerson.sort((a,b) => b.load - a.load).map((p, i) => (
              <div key={p.user.id} style={{
                display:"flex", alignItems:"center", gap: 10, padding:"11px 16px",
                borderBottom: i === loadByPerson.length - 1 ? "0" : "1px solid var(--line-soft)"
              }}>
                <Avatar user={p.user} size={28}/>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{display:"flex", alignItems:"center", gap: 6, font:"500 13px/1 var(--font-sans)", color:"var(--ink)"}}>
                    <span onClick={() => window.bnsOpenUser && window.bnsOpenUser(p.user)} title={`${p.user.name} · profili aç`} style={{whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", cursor:"pointer"}}>{p.user.name}</span>
                    {p.user.isNew && <Tag>onboarding</Tag>}
                  </div>
                  <div style={{font:"400 11px/1.2 var(--font-sans)", color:"var(--ink-3)", marginTop: 3}}>
                    {p.active} aktif{p.overdue > 0 ? <span style={{color:"var(--prio-red)"}}> · {p.overdue} geciken</span> : null}
                  </div>
                </div>
                <div style={{width: 70, display:"flex", flexDirection:"column", alignItems:"flex-end", gap: 3}}>
                  <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--ink-4)"}}>%{p.load}</span>
                  <div style={{width: 70, height: 4, background:"var(--line-soft)", borderRadius:999, overflow:"hidden"}}>
                    <div style={{width: p.load+"%", height:"100%", background: p.load > 85 ? "var(--warning)" : r.accent}}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Dönemsel özet — Ekip ile yan yana (yalnız yöneticilere) */}
        {isManager && (
        <Card padding={0} style={{minWidth:0}}>
          <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:10, padding:"13px 16px", borderBottom:"1px solid var(--line-strong)", flexWrap:"wrap"}}>
            <span style={{font:"italic 500 18px/1.1 var(--font-display)", color:"var(--ink)"}}>Dönemsel özet</span>
            <span style={{font:"600 10px/1 var(--font-sans)", letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--ink-3)", padding:"4px 9px", border:"1px solid var(--line)", borderRadius:999}}>{deptRangeLabel}</span>
          </div>
          {dN === 0 ? (
            <div style={{padding:"20px 16px", font:"400 13px/1.5 var(--font-sans)", color:"var(--ink-4)"}}>
              Seçili aralıkta ({deptRangeLabel.toLowerCase()}) {r.name} departmanı için tamamlanan iş kaydı yok. Üstteki 📅 tarih aralığını genişletmeyi dene.
            </div>
          ) : (
            <>
              <div style={{overflowX:"auto", WebkitOverflowScrolling:"touch"}}>
                <table style={{width:"100%", borderCollapse:"collapse", font:"400 13px/1.3 var(--font-sans)"}}>
                  <tbody>
                    {deptRows.map(([label, val], i) => (
                      <tr key={label} style={{background: i % 2 === 1 ? "var(--row-stripe)" : "transparent"}}>
                        <td style={{padding:"9px 16px", borderBottom:"1px solid var(--line)", color:"var(--ink-3)", whiteSpace:"nowrap"}}>{label}</td>
                        <td style={{padding:"9px 16px", borderBottom:"1px solid var(--line)", textAlign:"right", font:"500 13px/1.3 var(--font-mono)", color:"var(--ink)", fontVariantNumeric:"tabular-nums"}}>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Kişi başına tamamlanan */}
              {doneByPerson.length > 0 && (
                <div style={{padding:"12px 16px", borderTop:"1px solid var(--line-strong)"}}>
                  <div style={{font:"600 10px/1 var(--font-sans)", letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--ink-3)", marginBottom:9}}>Kişi başına tamamlanan</div>
                  <div style={{display:"flex", flexDirection:"column", gap:6}}>
                    {doneByPerson.map(({user, done}) => (
                      <div key={user.id} style={{display:"flex", alignItems:"center", gap:8}}>
                        <Avatar user={user} size={20}/>
                        <span onClick={() => window.bnsOpenUser && window.bnsOpenUser(user)} style={{flex:1, font:"500 12.5px/1 var(--font-sans)", color:"var(--ink-2)", cursor:"pointer", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{user.name}</span>
                        <span style={{font:"600 12px/1 var(--font-mono)", color:"var(--ink)"}}>{done}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Çalışılan markalar */}
              {dBrandList.length > 0 && (
                <div style={{padding:"12px 16px", borderTop:"1px solid var(--line-strong)"}}>
                  <div style={{font:"600 10px/1 var(--font-sans)", letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--ink-3)", marginBottom:9}}>Çalışılan markalar ({dBrandList.length})</div>
                  <div style={{display:"flex", flexWrap:"wrap", gap:7}}>
                    {dBrandList.map(([name, cnt]) => (
                      <span key={name} style={{display:"inline-flex", alignItems:"center", gap:6, padding:"5px 10px", border:"1px solid var(--line)", borderRadius:999, background:"var(--surface)"}}>
                        <span style={{width:8, height:8, borderRadius:999, background:brandColorOf(name), flexShrink:0}}/>
                        <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink-2)"}}>{name}</span>
                        <span style={{font:"600 11px/1 var(--font-mono)", color:"var(--ink-4)"}}>{cnt}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
        )}
        </div>
      </div>
    </div>
  );
}

function Tag({ children }) {
  return (
    <span style={{display:"inline-flex", alignItems:"center", gap:5}}>
      <I.Dot size={6} color="var(--ember)"/>
      <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink-2)"}}>{children}</span>
    </span>
  );
}

window.DepartmentScreen = DepartmentScreen;
