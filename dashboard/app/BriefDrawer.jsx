// app/BriefDrawer.jsx — interactive slide-in panel.

function BriefDrawer({ brief, onClose, onUpdate, allUsers, currentUser }) {
  const [b, setB] = React.useState(brief);
  const [saved, setSaved] = React.useState(false);
  const [assignedMe, setAssignedMe] = React.useState(false);
  const [inlineToast, setInlineToast] = React.useState(null); // ← hook'lar erken return'dan önce
  React.useEffect(() => { setB(brief); setSaved(false); setAssignedMe(false); setInlineToast(null); }, [brief]);
  if (!b) return null;

  function set(patch) { const next = { ...b, ...patch }; setB(next); setSaved(false); }
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
    if (url) { window.open(url, "_blank"); }
    else { alert("Bu brief için Slack linki bulunamadı."); }
  }

  return (
    <>
      <div onClick={onClose} style={{
        position:"fixed", inset: 0, background:"var(--overlay)", zIndex: 80,
        animation: "bn-fade 200ms var(--ease-out-quart)"
      }}/>
      <aside style={{
        position:"fixed", top: 0, right: 0, bottom: 0, width: 480,
        background: "var(--surface)",
        borderLeft: "1px solid var(--line)",
        boxShadow: "var(--shadow-2)",
        zIndex: 81,
        display:"flex", flexDirection:"column",
        animation: "bn-slide-r 240ms var(--ease-out-quart)"
      }}>
        <div style={{padding:"14px 20px", borderBottom:"1px solid var(--line)", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <BrandChip brand={b.brand}/>
            <span style={{font:"500 12px/1 var(--font-mono)", color:"var(--ink-4)"}}>#{b.no}</span>
          </div>
          <button onClick={onClose} style={{
            border:0, background:"transparent", cursor:"pointer", color:"var(--ink-3)",
            padding:4, display:"inline-flex"
          }}><I.X size={16}/></button>
        </div>

        <div style={{padding:"18px 20px", overflowY:"auto", flex: 1}}>
          {/* Title (editable) */}
          <EditableTitle value={b.baslik} onChange={(v) => set({ baslik: v })}/>

          <div style={{marginTop: 12, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
            <PriorityBadge p={b.priority} deltaH={b.deltaH}/>
            <StatusEditor current={b.durum} onPick={changeStatus}/>
            <span style={{font:"500 12px/1 var(--font-sans)", color:"var(--ink-3)"}}>
              rev {String(b.revision).padStart(2,"0")}
            </span>
          </div>

          <Hr/>

          <Eyebrow>Atama</Eyebrow>
          <div style={{display:"flex", flexDirection:"column", gap:8, marginTop:10}}>
            <RoleRow tag="LEAD" user={b.lead} users={allUsers} onChange={(u) => set({ lead: u })}/>
            {b.contributors.map((u, i) => (
              <RoleRow key={u.id} tag="CONTRIB" user={u} users={allUsers}
                onChange={(nu) => {
                  const next = [...b.contributors]; next[i] = nu; set({ contributors: next });
                }}
                onRemove={() => {
                  const next = b.contributors.filter((_, idx) => idx !== i);
                  set({ contributors: next });
                }}/>
            ))}
            {b.reviewer && <RoleRow tag="REV" user={b.reviewer} users={allUsers}
              onChange={(u) => set({ reviewer: u })}
              onRemove={() => set({ reviewer: null })}/>}
            <AddRoleRow
              onAddContrib={(u) => set({ contributors: [...b.contributors, u] })}
              onAddReviewer={(u) => set({ reviewer: u })}
              allUsers={allUsers}
              hasReviewer={!!b.reviewer}/>
          </div>

          <Hr/>

          <Eyebrow>Zaman</Eyebrow>
          <div style={{
            display:"grid", gridTemplateColumns:"100px 1fr", rowGap:8,
            marginTop:10, font:"400 13px/1.4 var(--font-sans)", color:"var(--ink-2)"
          }}>
            <span style={{color:"var(--ink-3)"}}>Açıldı</span><span>{formatFull(b.acilma)}</span>
            <span style={{color:"var(--ink-3)"}}>Deadline</span><span>{formatFull(b.deadline)}</span>
            <span style={{color:"var(--ink-3)"}}>Kalan</span>
            <span style={{color: b.deltaH <= 0 ? "var(--prio-red)" : b.deltaH <= 8 ? "var(--prio-red)" : "var(--ink)"}}>
              {formatDelta(b.deltaH)}
            </span>
            <span style={{color:"var(--ink-3)"}}>Timezone</span>
            <span style={{fontFamily:"var(--font-mono)"}}>Europe/Istanbul (UTC+3)</span>
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

          <Hr/>

          <Eyebrow>Aktivite</Eyebrow>
          <div style={{display:"flex", flexDirection:"column", gap: 0, marginTop: 8}}>
            {buildActivity(b).map((it, i, arr) => (
              <Tick key={i} when={it.when} who={it.who} verb={it.verb} tail={it.tail} last={i === arr.length - 1}/>
            ))}
          </div>

          <Hr/>

          <Eyebrow>Not</Eyebrow>
          <textarea
            value={b.notes || ""}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Brief'le ilgili kısa bir not bırak…"
            style={{
              marginTop: 8, width:"100%", minHeight: 64, resize:"vertical",
              padding: 10, borderRadius: 8, border:"1px solid var(--line)",
              background:"var(--surface-sub)", color:"var(--ink)",
              font:"400 13px/1.5 var(--font-sans)", outline:"none"
            }}/>
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
          <div style={{display:"flex", flexDirection:"column", alignItems:"flex-start", gap:4}}>
            <Button kind="ghost" icon={<I.User size={13}/>} onClick={handleAssignMe}>Bana ata</Button>
            {assignedMe && !saved && (
              <span style={{font:"500 11px/1 var(--font-sans)", color:"var(--ember)", paddingLeft:2, display:"flex", alignItems:"center", gap:4}}>
                <I.ArrowRight size={10}/> Kaydet'e bas
              </span>
            )}
          </div>
          <div style={{display:"flex", gap:8}}>
            <Button kind="secondary" icon={<I.Slack size={13}/>} onClick={handleSlackOpen}>Slack'te aç</Button>
            <Button kind="primary" icon={<I.Check size={13}/>}
              onClick={handleSave}
              style={{
                ...(saved ? {background:"var(--prio-green)", borderColor:"var(--prio-green)"} : {}),
                ...(assignedMe && !saved ? {boxShadow:"0 0 0 2px var(--ember)", animation:"bn-pulse 1s ease infinite"} : {})
              }}>
              {saved ? "Kaydedildi ✓" : "Kaydet"}
            </Button>
          </div>
        </footer>
      </aside>
    </>
  );
}

function Hr() { return <div style={{height: 1, background:"var(--line)", margin:"18px 0"}}/>; }

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
      font:"600 20px/1.25 var(--font-sans)", color:"var(--ink)",
      margin:0, letterSpacing:"-0.005em", cursor:"text",
      padding:"4px 0", borderRadius: 4
    }}>{value}</h2>
  );
}

function StatusEditor({ current, onPick }) {
  const [open, setOpen] = React.useState(false);
  const opts = [
    ["yeni","Yeni"],["calisiliyor","Çalışılıyor"],
    ["incelemede","İncelemede"],["blokeli","Blokeli"],["tamamlandi","Tamamlandı"]
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

function RoleRow({ tag, user, users, onChange, onRemove }) {
  const [open, setOpen] = React.useState(false);
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
        <span style={{font:"500 13px/1 var(--font-sans)", color:"var(--ink)"}}>{user.name}</span>
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
    calisiliyor: "🎨 Çalışılıyor",
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
  if (b.stale) items.push({ when: "", who: "", verb: "🚨 STALE", tail: "uzun süre pasif" });
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
