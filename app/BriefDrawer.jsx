// app/BriefDrawer.jsx — interactive slide-in panel.

function BriefDrawer({ brief, onClose, onUpdate, allUsers, currentUser }) {
  const [b, setB] = React.useState(brief);
  const [saved, setSaved] = React.useState(false);
  const [assignedMe, setAssignedMe] = React.useState(false);
  const [inlineToast, setInlineToast] = React.useState(null); // ← hook'lar erken return'dan önce
  const isMobile = typeof useIsMobile === "function" ? useIsMobile() : false;
  const [dragY, setDragY] = React.useState(0);            // mobil bottom-sheet sürükleme ofseti
  const [dragging, setDragging] = React.useState(false);
  const dragStartY = React.useRef(null);
  React.useEffect(() => { setB(brief); setSaved(false); setAssignedMe(false); setInlineToast(null); setDragY(0); }, [brief]);
  if (!b) return null;

  // Bottom-sheet aşağı sürükle-kapat (yalnız mobil, handle/başlık bölgesinden)
  const sheetDrag = isMobile ? {
    onTouchStart: (e) => { dragStartY.current = e.touches[0].clientY; setDragging(true); },
    onTouchMove: (e) => { if (dragStartY.current == null) return; const dy = e.touches[0].clientY - dragStartY.current; if (dy > 0) setDragY(dy); },
    onTouchEnd: () => { setDragging(false); if (dragY > 110) { onClose && onClose(); } else { setDragY(0); } dragStartY.current = null; },
  } : {};
  const ro = !!b._readOnly;   // tamamlanan iş: akış görünür, güncelleme kapalı

  function set(patch) { if (ro) return; const next = { ...b, ...patch }; setB(next); setSaved(false); }
  function changeStatus(s) { set({ durum: s }); }

  function showToast(msg, duration) {
    setInlineToast(msg);
    setTimeout(() => setInlineToast(null), duration || 3500);
  }

  function handleSave() {
    onUpdate && onUpdate(b);
    setSaved(true);
    setAssignedMe(false);
    setTimeout(() => setSaved(false), 2500);
    if (assignedMe) {
      const hasSlack = b.slack_url && b.slack_url !== "#";
      showToast(
        hasSlack
          ? "✓ Atandın · Slack thread'inde teyit etmeyi unutma"
          : "✓ Atandın · Kayıt güncellendi",
        3500
      );
    }
  }

  function handleAssignMe() {
    if (!currentUser) return;
    set({ lead: currentUser });
    setAssignedMe(true);
  }

  function handleSlackOpen() {
    const url = b.slack_url && b.slack_url !== "#" ? b.slack_url : null;
    if (url) {
      // Sekme yalnız desktop'a köprü: yönlendirme sonrası otomatik kapanır (Chrome.jsx anchor hook'u ile aynı)
      const w = window.open(url, "_blank");
      if (w) setTimeout(() => { try { w.close(); } catch (e) {} }, 3500);
    }
    else { alert("Bu brief için Slack linki bulunamadı."); }
  }

  async function handleDelete() {
    if (!window.confirm(`"${b.baslik || '#' + b.no}" briefi silmek istediğine emin misin?`)) return;
    try {
      const apiBase = (window.bnsResolveApiBase && window.bnsResolveApiBase()) || 'https://benseno-api-production.up.railway.app';
      const tok = localStorage.getItem('bns_token');
      const res = await fetch(`${apiBase}/api/briefs/${b.id}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
        body: JSON.stringify({ by: currentUser?.slack_id }),
      });
      if (res.ok) {
        onClose && onClose();
        window.location.reload();
      } else {
        const j = await res.json().catch(() => ({}));
        alert('Silme başarısız: ' + (j.error || res.status));
      }
    } catch (e) { alert('Hata: ' + e.message); }
  }

  return (
    <>
      <div onClick={onClose} style={{
        position:"fixed", inset: 0, background:"var(--overlay)", zIndex: 80,
        animation: "bn-fade 200ms var(--ease-out-quart)"
      }}/>
      <div role="dialog" aria-modal="true" style={isMobile ? {
        position:"fixed", left: 0, right: 0, bottom: 0,
        maxHeight: "92vh", height: "92vh",
        background: "var(--surface)",
        borderTop: "1px solid var(--line)",
        borderRadius: "18px 18px 0 0",
        boxShadow: "var(--shadow-lg)",
        zIndex: 81,
        display:"flex", flexDirection:"column",
        transform: `translateY(${dragY}px)`,
        transition: dragging ? "none" : "transform 240ms var(--ease-out-quart)",
        animation: dragY === 0 && !dragging ? "bn-slide-up 260ms var(--ease-out-quart)" : "none",
        overflow: "hidden",
      } : {
        position:"fixed", top: 0, right: 0, bottom: 0, width: 480,
        background: "var(--surface)",
        borderLeft: "1px solid var(--line)",
        boxShadow: "var(--shadow-lg)",
        zIndex: 81,
        display:"flex", flexDirection:"column",
        animation: "bn-slide-r 220ms var(--ease-out-quart)"
      }}>
        {isMobile && (
          <div {...sheetDrag} style={{padding:"10px 0 4px", display:"flex", justifyContent:"center", flexShrink:0, cursor:"grab", touchAction:"none"}}>
            <div style={{width:40, height:4, borderRadius:2, background:"var(--line-strong)"}}/>
          </div>
        )}
        <div {...(isMobile ? sheetDrag : {})} style={{padding: isMobile ? "6px 16px 14px" : "14px 20px", borderBottom:"1px solid var(--line)", display:"flex", alignItems:"center", justifyContent:"space-between", touchAction: isMobile ? "none" : "auto"}}>
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <BrandChip brand={b.brand}/>
            <span style={{font:"500 12px/1 var(--font-mono)", color:"var(--ink-4)"}}>#{b.no}</span>
          </div>
          <button onClick={onClose} style={{
            border:0, background:"transparent", cursor:"pointer", color:"var(--ink-3)",
            padding:4, display:"inline-flex", borderRadius:6,
            transition:"background 120ms cubic-bezier(0.2,0,0,1), transform 120ms cubic-bezier(0.2,0,0,1)",
          }}
          onMouseDown={e => e.currentTarget.style.transform="scale(0.9)"}
          onMouseUp={e => e.currentTarget.style.transform=""}
          onMouseLeave={e => e.currentTarget.style.transform=""}
          ><I.X size={16}/></button>
        </div>

        <div style={{padding:"18px 20px", overflowY:"auto", flex: 1}}>
          {/* Title (editable — tamamlananlarda salt-okunur) */}
          {ro
            ? <h2 style={{font:"italic 500 23px/1.2 var(--font-display)", color:"var(--ink)", margin:0, letterSpacing:"-0.005em", padding:"4px 0"}}>{b.baslik}</h2>
            : <EditableTitle value={b.baslik} onChange={(v) => set({ baslik: v })}/>}

          <div style={{marginTop: 12, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
            {!ro && <PriorityBadge p={b.oncelik || { code: "ylw", label: "NORMAL" }}/>}
            {ro
              ? <span style={{font:"600 11px/1 var(--font-sans)", letterSpacing:"0.05em", textTransform:"uppercase", color:"var(--prio-green)", background:"var(--prio-green-bg, var(--paper-2))", padding:"5px 9px", borderRadius:999}}>✅ Tamamlandı</span>
              : <StatusEditor current={b.durum} onPick={changeStatus}/>}
            <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink-3)"}}
              title="İç revizyon: ✈️ öncesi düzeltmeler · Müşteri revizyonu: ✈️ sonrası ilk ✏️">
              rev {String(b.revision).padStart(2,"0")}
              {(b.rev_ic > 0 || b.rev_musteri > 0) && ` · ${b.rev_ic||0} iç / ${b.rev_musteri||0} müşteri`}
            </span>
            {b.musteri_bekliyor && !ro && (
              <span style={{font:"600 10px/1 var(--font-sans)", letterSpacing:"0.04em", textTransform:"uppercase",
                color:"var(--musteride)", background:"rgba(124,92,255,0.1)", padding:"4px 8px", borderRadius:999}}>
                ✈️ müşteri dönüşü bekleniyor
              </span>
            )}
          </div>

          {/* Sıralı onay zinciri — her halka ✅ ile kapanır, son halka işi tamamlar */}
          {b.akis === "sirali" && (b.zincir || []).length > 1 && (
            <div style={{marginTop: 10, display:"flex", alignItems:"center", gap: 6, flexWrap:"wrap"}}
              title="Sıralı iş: ✅ yalnızca sıradaki halkayı onaylar; herkes onaylamadan iş kapanmaz. ✏️ zinciri geri sarar.">
              <span style={{font:"600 10px/1 var(--font-sans)", letterSpacing:"0.05em", textTransform:"uppercase", color:"var(--ink-4)"}}>⛓️ zincir</span>
              {(b.zincir || []).map((h, i) => {
                const aktif = !h.onay && h.id === b.aktif_halka;
                return (
                  <span key={h.id || i} style={{display:"inline-flex", alignItems:"center", gap: 4,
                    font:"500 11px/1 var(--font-sans)", padding:"4px 8px", borderRadius: 999,
                    color: h.onay ? "var(--prio-green)" : aktif ? "var(--ink)" : "var(--ink-4)",
                    background: aktif ? "var(--paper-2)" : "transparent",
                    border: "1px solid " + (aktif ? "var(--line-strong)" : "var(--line)")}}>
                    {h.onay ? "✓" : aktif ? "▶" : (i + 1) + "."} {h.name}
                  </span>
                );
              })}
            </div>
          )}

          <Hr/>

          <Eyebrow>Atama</Eyebrow>
          <div style={{display:"flex", flexDirection:"column", gap:8, marginTop:10}}>
            <RoleGroup tag="İŞİ YAPAN" list={b.workers} allUsers={allUsers}
              onChange={ro ? null : (arr) => set({ workers: arr })} showDept/>
            <RoleGroup tag="LEAD" list={b.leads} allUsers={allUsers}
              onChange={ro ? null : (arr) => set({ leads: arr })}/>
            <RoleGroup tag="GÖZLEMCİ" list={b.observers} allUsers={allUsers}
              onChange={ro ? null : (arr) => set({ observers: arr })}/>
          </div>

          <Hr/>

          <Eyebrow>Zaman</Eyebrow>
          <div style={{
            display:"grid", gridTemplateColumns:"100px 1fr", rowGap:8,
            marginTop:10, font:"400 13px/1.4 var(--font-sans)", color:"var(--ink-2)"
          }}>
            <span style={{color:"var(--ink-3)"}}>Açıldı</span><span>{formatFull(b.acilma)}</span>
            <span style={{color:"var(--ink-3)"}}>Deadline</span>
            {ro ? <span>{formatFull(b.deadline)}</span>
                : <DeadlineField value={b.deadline} onChange={(ms) => set({ deadline: ms })}/>}
            {ro ? <>
              <span style={{color:"var(--ink-3)"}}>Bitiş</span>
              <span style={{color:"var(--prio-green)"}}>{formatFull(b.bitis)}</span>
            </> : <>
              <span style={{color:"var(--ink-3)"}}>Kalan</span>
              <span style={{color: b.deltaH <= 0 ? "var(--prio-red)" : b.deltaH <= 8 ? "var(--prio-red)" : "var(--ink)"}}>
                {formatDelta(b.deltaH)}
              </span>
            </>}
            {b.gonderim_sayisi > 0 && <>
              <span style={{color:"var(--ink-3)"}}>Müşteriye</span>
              <span>✈️ {b.gonderim_sayisi} kez gönderildi{b.son_gonderim_at ? ` · son: ${formatFull(b.son_gonderim_at)}` : ""}</span>
            </>}
            <span style={{color:"var(--ink-3)"}}>Timezone</span>
            <span style={{fontFamily:"var(--font-mono)"}}>Europe/Istanbul (UTC+3)</span>
            {Array.isArray(b.deadline_history) && b.deadline_history.length > 0 ? (() => {
              const f = (x) => { try { return new Date(x).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return "—"; } };
              return <>
                <span style={{color:"var(--ink-3)"}}>Önceki deadline{b.deadline_history.length > 1 ? "'lar" : ""}</span>
                <span style={{display:"flex", flexDirection:"column", gap:3}}>
                  {b.deadline_history.map((h, i) => (
                    <span key={i} style={{font:"400 12px/1.4 var(--font-sans)", color:"var(--ink-3)"}}>
                      <span style={{textDecoration:"line-through", color:"var(--ink-4)"}}>{f(h.eski)}</span> → {f(h.yeni)}
                      <span style={{color: h.ileri ? "var(--prio-orange)" : "var(--ink-4)", marginLeft:6, fontSize:11}}>
                        {h.ileri ? "uzatıldı" : "öne çekildi"}{h.at ? " · " + f(h.at) : ""}
                      </span>
                    </span>
                  ))}
                </span>
              </>;
            })() : (b.deadline_orig && b.deadline_orig !== b.deadline && <>
              <span style={{color:"var(--ink-3)"}}>İlk deadline</span>
              <span style={{color:"var(--ink-3)"}}>
                <span style={{textDecoration:"line-through", color:"var(--ink-4)"}}>{formatFull(b.deadline_orig)}</span>
                {b.uzatma_sayisi > 0 ? ` · ${b.uzatma_sayisi} kez değişti` : ""}
              </span>
            </>)}
          </div>

          <Hr/>

          <Eyebrow>Slack thread</Eyebrow>
          <div style={{
            marginTop:10, padding:"10px 12px", background:"var(--paper-2)", borderRadius:8,
            display:"flex", alignItems:"center", gap:10,
            font:"500 12px/1.3 var(--font-mono)", color:"var(--ink-2)"
          }}>
            <I.Slack size={14}/>
            #{b.brand && b.brand.name.toLowerCase().replace(/\s+/g,"-").substring(0,20)}
            <span style={{color:"var(--ink-4)"}}>· 22 mesaj</span>
            <span style={{marginLeft:"auto", color:"var(--ink-4)"}}>↗</span>
          </div>

          {b.thread_ozet && (
            <>
              <Hr/>
              <Eyebrow>💬 Thread Özeti</Eyebrow>
              <div style={{
                marginTop:10, padding:"12px 14px", background:"var(--paper-2)", borderRadius:8,
                font:"400 13px/1.6 var(--font-sans)", color:"var(--ink-2)", whiteSpace:"pre-wrap"
              }}>
                <Linkify text={b.thread_ozet}/>
              </div>
              {b.thread_ozet_at && (
                <div style={{marginTop:6, font:"400 10px/1 var(--font-sans)", color:"var(--ink-4)"}}>
                  AI özeti · {new Date(b.thread_ozet_at).toLocaleString("tr-TR", {timeZone:"Europe/Istanbul", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"})} itibarıyla
                </div>
              )}
            </>
          )}

          {/* İş insight'ı — tamamlanma sonrası AI değerlendirmesi (süreç, revize, öğrenimler) */}
          {b.insight && (
            <>
              <Hr/>
              {!isMobile && <Eyebrow>🔍 İş Insight</Eyebrow>}
              <MobileAccordion title="🔍 İş Insight">
              <div style={{
                marginTop:10, padding:"12px 14px", background:"var(--paper-2)", borderRadius:8,
                border:"1px solid var(--line)",
                font:"400 13px/1.6 var(--font-sans)", color:"var(--ink-2)", whiteSpace:"pre-wrap"
              }}>
                <Linkify text={b.insight}/>
              </div>
              </MobileAccordion>
              <div style={{marginTop:6, font:"400 10px/1 var(--font-sans)", color:"var(--ink-4)"}}>
                Tamamlanma değerlendirmesi · marka/iş analizleri için arşivlenir
              </div>
            </>
          )}

          <Hr/>

          <Eyebrow>Aktivite</Eyebrow>
          <div style={{display:"flex", flexDirection:"column", gap: 0, marginTop: 8}}>
            {buildActivity(b).map((it, i, arr) => (
              <Tick key={i} when={it.when} who={it.who} verb={it.verb} tail={it.tail} last={i === arr.length - 1}/>
            ))}
          </div>

          <Hr/>

          <Eyebrow>Not</Eyebrow>
          <NotesField value={b.notes || ""} readOnly={ro} onChange={(v) => set({ notes: v })}/>
        </div>

        {inlineToast && (
          <div style={{
            padding:"10px 20px", background:"var(--ink)", color:"#fff",
            font:"500 13px/1.4 var(--font-sans)", display:"flex", alignItems:"center", gap:8,
            animation:"bn-slide-up 180ms var(--ease-out-quart)"
          }}>
            {inlineToast}
            {b.slack_url && b.slack_url !== "#" && assignedMe === false && (
              <button onClick={handleSlackOpen} style={{
                marginLeft:"auto", font:"500 12px/1 var(--font-sans)",
                color:"var(--ember)", background:"transparent", border:"none", cursor:"pointer"
              }}>Slack'te aç →</button>
            )}
          </div>
        )}
        <footer style={{padding:"12px 20px", borderTop:"1px solid var(--line)",
          display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <div>
            {!ro && currentUser?.role === 'admin' && (
              <button onClick={handleDelete} style={{
                padding:'6px 12px', borderRadius:6,
                border:'1px solid var(--prio-red, #e54d2e)',
                background:'transparent', color:'var(--prio-red, #e54d2e)',
                font:'500 12px/1 var(--font-sans)', cursor:'pointer',
              }}>🗑️ Sil</button>
            )}
          </div>
          <div style={{display:"flex", gap:8}}>
            <Button kind="secondary" icon={<I.Slack size={13}/>} onClick={handleSlackOpen}>Slack'te aç</Button>
            {!ro && <Button kind="primary" icon={<I.Check size={13}/>}
              onClick={handleSave}
              style={{
                ...(saved ? {background:"var(--prio-green)", borderColor:"var(--prio-green)"} : {}),
                ...(assignedMe && !saved ? {boxShadow:"0 0 0 2px var(--ember)", animation:"bn-pulse 1s ease infinite"} : {})
              }}>
              {saved ? "Kaydedildi ✓" : "Kaydet"}
            </Button>}
          </div>
        </footer>
      </div>
    </>
  );
}

function Hr() { return <div style={{height: 1, background:"var(--line)", margin:"18px 0"}}/>; }

// Not alanı: görünümde linkler METNİN İÇİNDE tıklanabilir; metne tıklayınca düzenleme
// moduna (textarea) geçer, odak çıkınca görünüme döner. (textarea link render edemez —
// bu yüzden EditableTitle ile aynı tıkla-düzenle deseni kullanılır.)
function NotesField({ value, readOnly, onChange }) {
  const [edit, setEdit] = React.useState(false);
  const boxStyle = {
    marginTop: 8, width:"100%", minHeight: 64, padding: 10, borderRadius: 8,
    border:"1px solid var(--line)", background:"var(--surface-sub)", color:"var(--ink)",
    font:"400 13px/1.5 var(--font-sans)", boxSizing:"border-box",
  };
  if (!readOnly && edit) return (
    <textarea autoFocus value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => setEdit(false)}
      placeholder="Brief'le ilgili kısa bir not bırak…"
      style={{ ...boxStyle, resize:"vertical", outline:"none" }}/>
  );
  return (
    <div onClick={readOnly ? undefined : () => setEdit(true)}
      title={readOnly ? undefined : "Düzenlemek için tıkla"}
      style={{ ...boxStyle, cursor: readOnly ? "default" : "text", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
      {value
        ? <Linkify text={value}/>
        : <span style={{color:"var(--ink-4)"}}>{readOnly ? "—" : "Brief'le ilgili kısa bir not bırak…"}</span>}
    </div>
  );
}

function EditableTitle({ value, onChange }) {
  const [edit, setEdit] = React.useState(false);
  return edit ? (
    <input autoFocus value={value} onChange={(e) => onChange(e.target.value)}
      onBlur={() => setEdit(false)} onKeyDown={(e) => { if (e.key === "Enter") setEdit(false); }}
      style={{
        font:"600 20px/1.25 var(--font-sans)", color:"var(--ink)",
        background: "var(--surface-sub)", border:"1px solid var(--line)",
        borderRadius: 6, padding:"4px 8px", width:"100%", outline:"none"
      }}/>
  ) : (
    <h2 onClick={() => setEdit(true)} style={{
      font:"italic 500 23px/1.2 var(--font-display)", color:"var(--ink)",
      margin:0, letterSpacing:"-0.005em", cursor:"text",
      padding:"4px 0", borderRadius: 4
    }}>{value}</h2>
  );
}

function StatusEditor({ current, onPick }) {
  const [open, setOpen] = React.useState(false);
  const opts = [
    ["yeni","Yeni"],["calisiliyor","İş planında"],["basladi","🚀 İşe başlandı"],
    ["incelemede","İncelemede"],["beklemede","Beklemede"],["revizyon","Revizyon"],
    ["musteride","✈️ Müşteri Onayında"],["blokeli","Blokeli"],["tamamlandi","Tamamlandı"]
  ];
  return (
    <span style={{position:"relative"}}>
      <button onClick={() => setOpen(v => !v)} style={{
        display:"inline-flex", alignItems:"center", gap:6, padding:"3px 8px",
        borderRadius: 999, border:"1px solid var(--line)", background:"var(--surface)", cursor:"pointer"
      }}>
        <StatusPill status={current}/>
        <I.ChevronDown size={11}/>
      </button>
      {open && (
        <div onMouseLeave={() => setOpen(false)} style={{
          position:"absolute", top: 32, left: 0, zIndex: 90,
          background:"var(--surface)", border:"1px solid var(--line)",
          borderRadius: 8, padding: 4, minWidth: 170, boxShadow:"var(--shadow-1)"
        }}>
          {opts.map(([k]) => (
            <button key={k} onClick={() => { onPick(k); setOpen(false); }} style={{
              display:"flex", alignItems:"center", gap:8, width:"100%", textAlign:"left",
              padding:"7px 8px", border:0, background: current === k ? "var(--paper-2)" : "transparent",
              borderRadius: 6, cursor:"pointer"
            }}>
              <StatusPill status={k}/>
              {current === k && <span style={{marginLeft:"auto", color:"var(--ember)"}}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

// Bir rol grubu (işi yapan / lead / gözlemci) — liste + ekle/çıkar. onChange(yeniDizi).
function RoleGroup({ tag, list, allUsers, onChange }) {
  const [adding, setAdding] = React.useState(false);
  const arr = (list || []).filter(Boolean);
  // Salt-okunur (tamamlanan iş): statik çipler, ekle/değiştir/kaldır yok
  if (!onChange) return (
    <div style={{display:"flex", flexDirection:"column", gap:6}}>
      {arr.length === 0 && <div style={{font:"500 11px/1 var(--font-sans)", color:"var(--ink-4)", padding:"2px 0"}}>{tag}: —</div>}
      {arr.map((u, i) => (
        <div key={u.id || i} style={{display:"flex", alignItems:"center", gap:10, padding:"4px 0"}}>
          <span style={{font:"600 10px/1 var(--font-sans)", letterSpacing:"0.06em", color:"var(--ink-3)", padding:"3px 6px", borderRadius:4, background:"var(--paper-2)", minWidth:64, textAlign:"center"}}>{tag}</span>
          <span style={{display:"inline-flex", alignItems:"center", gap:8, padding:"3px 8px 3px 3px", borderRadius:999, border:"1px solid var(--line)"}}>
            <Avatar user={u} size={22}/>
            <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink)"}}>{u.name || "—"}</span>
          </span>
        </div>
      ))}
    </div>
  );
  return (
    <div style={{display:"flex", flexDirection:"column", gap:6}}>
      {arr.length === 0 && (
        <div style={{font:"500 11px/1 var(--font-sans)", color:"var(--ink-4)", padding:"2px 0"}}>{tag}: —</div>
      )}
      {arr.map((u, i) => (
        <RoleRow key={u.id || i} tag={tag} user={u} users={allUsers}
          onChange={(nu) => { const n = [...arr]; n[i] = nu; onChange(n); }}
          onRemove={() => onChange(arr.filter((_, idx) => idx !== i))}/>
      ))}
      <div style={{position:"relative"}}>
        <button onClick={() => setAdding(v => !v)} style={ghostBtn}><I.Plus size={12}/> {tag} ekle</button>
        {adding && <UserPicker users={allUsers || []}
          onPick={(u) => { if (!arr.some(x => x.id === u.id)) onChange([...arr, u]); setAdding(false); }}
          onClose={() => setAdding(false)}/>}
      </div>
    </div>
  );
}

function RoleRow({ tag, user, users, onChange, onRemove }) {
  const [open, setOpen] = React.useState(false);
  if (!user) return null;
  return (
    <div style={{display:"flex", alignItems:"center", gap:10, padding:"4px 0", position:"relative"}}>
      <span style={{
        font:"600 10px/1 var(--font-sans)", letterSpacing:"0.06em",
        color:"var(--ink-3)", padding:"3px 6px", borderRadius:4, background:"var(--paper-2)",
        minWidth: 64, textAlign:"center"
      }}>{tag}</span>
      <button onClick={() => setOpen(v => !v)} style={{
        display:"inline-flex", alignItems:"center", gap:8, padding:"3px 8px 3px 3px",
        borderRadius: 999, border:"1px solid var(--line)", background:"var(--surface)", cursor:"pointer"
      }}>
        <Avatar user={user} size={22}/>
        <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink)"}}>{user.name || "—"}</span>
        <I.ChevronDown size={11} style={{color:"var(--ink-4)"}}/>
      </button>
      {onRemove && (
        <button onClick={onRemove} title="Rolü kaldır" style={{
          marginLeft: 4, border:0, background:"transparent", color:"var(--ink-4)",
          cursor:"pointer", padding:4, display:"inline-flex"
        }}><I.X size={12}/></button>
      )}
      {open && <UserPicker users={users || []} onPick={(u) => { onChange(u); setOpen(false); }} onClose={() => setOpen(false)}/>}
    </div>
  );
}

function AddRoleRow({ onAddContrib, onAddReviewer, allUsers, hasReviewer }) {
  const [mode, setMode] = React.useState(null); // contrib | reviewer
  return (
    <div style={{position:"relative", display:"flex", gap: 8, marginTop: 4}}>
      <button onClick={() => setMode(mode === "contrib" ? null : "contrib")} style={ghostBtn}>
        <I.Plus size={12}/> Atanan ekle
      </button>
      {!hasReviewer && (
        <button onClick={() => setMode(mode === "reviewer" ? null : "reviewer")} style={ghostBtn}>
          <I.Plus size={12}/> Reviewer ekle
        </button>
      )}
      {mode && (
        <UserPicker users={allUsers || []}
          onPick={(u) => { (mode === "contrib" ? onAddContrib : onAddReviewer)(u); setMode(null); }}
          onClose={() => setMode(null)}/>
      )}
    </div>
  );
}

const ghostBtn = {
  display:"inline-flex", alignItems:"center", gap:6,
  font:"500 12px/1 var(--font-sans)", color:"var(--ink-3)",
  background:"transparent", border:"1px dashed var(--line-strong)",
  borderRadius: 6, padding:"6px 10px", cursor:"pointer"
};

function UserPicker({ users, onPick, onClose }) {
  const [q, setQ] = React.useState("");
  const filtered = users.filter(u => u.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div onMouseLeave={onClose} style={{
      position:"absolute", top: 32, left: 0, zIndex: 95, marginTop: 4,
      background:"var(--surface)", border:"1px solid var(--line)",
      borderRadius: 8, padding: 4, minWidth: 240, boxShadow:"var(--shadow-1)",
      maxHeight: 280, overflow:"auto"
    }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Kişi ara…"
        style={{
          width:"100%", border:"1px solid var(--line)", background:"var(--surface-sub)",
          color:"var(--ink)", borderRadius:6, padding:"6px 8px",
          font:"500 12px/1.2 var(--font-sans)", outline:"none", marginBottom: 4
        }}/>
      {filtered.map(u => (
        <button key={u.id} onClick={() => onPick(u)} style={{
          display:"flex", alignItems:"center", gap:8, width:"100%", textAlign:"left",
          padding:"6px 8px", border:0, background:"transparent", cursor:"pointer", borderRadius: 6
        }}>
          <Avatar user={u} size={20}/>
          <span style={{font:"500 12px/1 var(--font-sans)"}}>{u.name}</span>
          <span style={{marginLeft:"auto", font:"500 10px/1 var(--font-mono)", color:"var(--ink-4)"}}>{u.rol}</span>
        </button>
      ))}
    </div>
  );
}

function Tick({ when, who, verb, tail, last }) {
  return (
    <div style={{
      display:"flex", alignItems:"baseline", gap:10, padding:"8px 0",
      borderBottom: last ? "0" : "1px solid var(--line-soft)"
    }}>
      <span style={{font:"500 11px/1.3 var(--font-mono)", color:"var(--ink-4)", minWidth: 40}}>{when}</span>
      <span style={{font:"400 13px/1.4 var(--font-sans)", color:"var(--ink-2)"}}>
        <b style={{color:"var(--ink)"}}>{who}</b> {verb}{tail ? <span style={{color:"var(--ink-3)"}}> · {tail}</span> : null}
      </span>
    </div>
  );
}

function formatFull(ts) {
  if (!ts || isNaN(ts)) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} · ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

// Bir zaman damgasını "5dk önce" / "dün 14:30" / "12 May" gibi göreceli format'a çevirir.
function formatRel(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH   = Math.floor(diffMs / 3600000);
  const diffD   = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "şimdi";
  if (diffMin < 60) return `${diffMin}dk`;
  if (diffH < 24) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  if (diffD === 1) return "dün";
  if (diffD < 7) return `${diffD}g önce`;
  const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// Canvas Geçmiş kolonu emoji → human-readable etiket
const GECMIS_LABELS = {
  '⏳': 'sıraya alındı',
  '🎨': 'tasarımcı başladı',
  '✍️': 'editör başladı',
  '🤖': 'AI başladı',
  '👀': 'incelemeye gönderildi',
  '👌': 'onaylandı',
  '✅': 'tamamlandı',
  '🔴': '🔴 acil yapıldı',
  '🟠': '🟠 yüksek yapıldı',
  '🟡': '🟡 normal yapıldı',
  '🟢': '🟢 düşük yapıldı',
  '📈': 'öncelik yükseldi',
  '📉': 'öncelik düştü',
  '🚨': 'kritik uyarı',
  '⚠️': 'uyarı',
  '🔁': 'revize edildi',
  '⛔': 'engellendi',
  '⏰': 'deadline geçti',
};
const TR_MONTHS_SHORT = { Oca: 0, Ock: 0, Şub: 1, Sub: 1, Mar: 2, Nis: 3, May: 4, Haz: 5, Tem: 6, Ağu: 7, Agu: 7, Eyl: 8, Eki: 9, Ekm: 9, Kas: 10, Ara: 11 };

/**
 * Canvas Geçmiş kolonu string'ini parse eder.
 * Örnek: "⏳18May13:16→🎨18May13:22→👀18May16:48→🎨18May16:49→👀18May17:22"
 * Veya:  "⏳19May08:14 (Görkem GM açtı) / 🔴Yön19May08:26 / ⚠️STALE🔴 19May~10:00"
 *
 * Döner: [{ ts, emoji, label, context, day, month, time }]
 */
function parseGecmisString(gecmis) {
  if (!gecmis) return [];
  const parts = gecmis.split(/\s*[→\/]\s*/).map(s => s.trim()).filter(Boolean);
  const events = [];
  const now = new Date();
  const year = now.getFullYear();

  for (const p of parts) {
    // Emoji'leri parse — Türkçe karakter ve emoji çoklu kod noktası destekli
    const emojiMatch = p.match(/([\p{Extended_Pictographic}]+(?:️)?)/u);
    if (!emojiMatch) continue;
    const emoji = emojiMatch[1];

    // Tarih + saat: "18May13:16" veya "19May~10:00"
    const dm = p.match(/(\d{1,2})([A-Za-zŞşĞğÜüÇçÖöİı]+)\s*~?\s*(\d{1,2}:\d{2})/);
    if (!dm) continue;
    const day = parseInt(dm[1], 10);
    const monAbbr = dm[2].slice(0, 3);
    const mon = TR_MONTHS_SHORT[monAbbr];
    if (mon == null) continue;
    const [hh, mm] = dm[3].split(':').map(n => parseInt(n, 10));

    // Açıklama (parantez içi veya emoji+date sonrası kalan text)
    let context = p
      .replace(emojiMatch[0], '')
      .replace(dm[0], '')
      .replace(/[()]/g, '')
      .trim();

    // TR timezone (UTC+3) varsayım — local Date constructor TR ortamında çalışacak
    const ts = new Date(year, mon, day, hh, mm, 0).getTime();
    const label = GECMIS_LABELS[emoji] || emoji;
    events.push({ ts, emoji, label, context, day, mon, time: dm[3] });
  }
  return events;
}

/**
 * Brief'in kendi verisinden gerçek aktivite akışı üretir.
 * En yeni en üstte (descending), brief açılışı en altta.
 *
 * Canvas brief'lerinde `b.gecmis` Canvas Geçmiş kolonu ham string'i içerir —
 * bu gerçek event timeline'ı sağlar (timestamps dahil).
 */
function buildActivity(b) {
  const items = [];

  // ─── Mevcut durum (en yeni, üstte) ───
  const durumLabel = {
    yeni:        "⏳ Sırada",
    calisiliyor: "🎨 İş planında",
    incelemede:  "👀 İncelemede",
    blokeli:     "⛔ Blokeli",
    tamamlandi:  "✅ Tamamlandı",
  };
  if (durumLabel[b.durum]) {
    const tail = b.notes && b.notes.length < 120 ? b.notes : '';
    items.push({
      when: b.durum === "tamamlandi" && b.bitis ? formatRel(b.bitis) : "şimdi",
      who:  "",
      verb: durumLabel[b.durum],
      tail,
    });
  }

  // ─── Acil uyarılar ───
  if (b.stale) items.push({ when: "", who: "", verb: "🚨 Hareketsiz", tail: "3+ gün güncelleme yok" });
  if (b.deltaH !== undefined && b.deltaH <= 0) {
    items.push({ when: "", who: "", verb: "⏰ Deadline geçti", tail: "" });
  }

  // ─── Canvas Geçmiş kolonu (Görkem'in skill'inin yazdığı timeline) ───
  // Bu en zengin event kaynağı: gerçek timestamp + her durum değişimi
  const gecmisEvents = parseGecmisString(b.gecmis);
  if (gecmisEvents.length > 0) {
    // En yeni en üstte sırala
    gecmisEvents.sort((a, b) => b.ts - a.ts);
    for (const ev of gecmisEvents) {
      items.push({
        when: `${ev.day} ${["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"][ev.mon]} ${ev.time}`,
        who:  "",
        verb: ev.label,
        tail: ev.context && ev.context.length < 80 ? ev.context : "",
      });
    }
  } else {
    // ─── Geçmiş yoksa fallback — brief field'larından çıkarım ───
    if (b.revision && b.revision > 0) {
      items.push({ when: "", who: "", verb: `🔁 Revize ×${b.revision}`, tail: "" });
    }
    if (b.reviewer) {
      items.push({
        when: "", who: b.lead?.name?.split(" ")[0] || "",
        verb: "inceleyici atadı",
        tail: b.reviewer.name,
      });
    }
    const contribs = (b.contributors || []).filter(Boolean);
    if (contribs.length > 0) {
      items.push({
        when: "",
        who:  b.lead?.name?.split(" ")[0] || "",
        verb: "atadı",
        tail: contribs.map(c => c.name?.split(" ")[0] || c.name).join(", "),
      });
    }
  }

  // ─── Brief açıldı (en eski, altta) — her zaman gösterilir ───
  items.push({
    when: formatRel(b.acilma),
    who:  b.lead?.name?.split(" ")[0] || "Bilinmiyor",
    verb: "açtı",
    tail: "brief oluşturuldu",
  });

  return items;
}

window.BriefDrawer = BriefDrawer;


// Termin: tıkla-düzenle — görünümde formatlı tarih, tıklayınca datetime-local; değişiklik
// Kaydet ile PATCH'e gider (App.jsx persist diff'i deadline'ı ISO'ya çevirir).
function DeadlineField({ value, onChange }) {
  const [editing, setEditing] = React.useState(false);
  const toLocal = (ms) => {
    if (!ms) return "";
    const d = new Date(ms), p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  if (!editing) return (
    <span onClick={() => setEditing(true)} title="Değiştirmek için tıkla"
      style={{cursor:"pointer", borderBottom:"1px dashed var(--line-strong)"}}>
      {formatFull(value)} ✎
    </span>
  );
  return (
    <input type="datetime-local" autoFocus defaultValue={toLocal(value)}
      onBlur={(e) => { setEditing(false); const v = e.target.value; if (v) { const ms = new Date(v).getTime(); if (ms && ms !== value) onChange(ms); } }}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditing(false); }}
      style={{font:"400 13px/1.4 var(--font-sans)", color:"var(--ink)", background:"var(--surface)",
        border:"1px solid var(--line-strong)", borderRadius: 6, padding:"2px 6px", colorScheme:"light dark"}}/>
  );
}
