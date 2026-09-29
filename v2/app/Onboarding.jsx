// Onboarding.jsx — yeni kullanıcı karşılama: 4 adımlık mini tur + ilk-brief'e-kadar hoş geldin kartı.
// Saf frontend. window.WelcomeTour / window.WelcomeCard. Tur açma: window.bnsOpenTour (App set eder).

const BNS_TOUR_STEPS = [
  { ic: "👋", t: "Hoş geldin", d: "Burası Benseno iş takip paneli. İşlerin, terminlerin ve ekibin tek yerde." },
  { ic: "📋", t: "İşlerin nerede", d: "Sana atanan işler İşler sekmesinde ve profilinde Bugün bölümünde. Bir işe tıkla → detay + aksiyonlar açılır." },
  { ic: "⏭️", t: "Aksiyon al", d: "İş kartında: Başladım · İlerlet · Termini uzat · Hatırlat. Durum güncellemek için Slack'e geçmene gerek yok." },
  { ic: "🔔", t: "Bildirimler & Ody", d: "Rozetten bildirimlerini gör; takıldığında Ody'ye (asistan) sorabilirsin. Hazırsın!" },
];

function WelcomeTour({ open, onClose }) {
  const [i, setI] = React.useState(0);
  React.useEffect(() => { if (open) setI(0); }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const onEsc = (e) => { if (e.key === "Escape") onClose && onClose(); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);
  if (!open) return null;
  const s = BNS_TOUR_STEPS[i];
  const last = i === BNS_TOUR_STEPS.length - 1;
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,0.44)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width:420, maxWidth:"94vw", background:"var(--paper)", border:"1px solid var(--line)", borderRadius:18, boxShadow:"0 18px 48px rgba(0,0,0,0.22)", padding:"22px 22px 16px", position:"relative" }}>
        <button onClick={onClose} title="Atla" style={{ position:"absolute", top:12, right:12, border:0, background:"transparent", color:"var(--ink-4)", cursor:"pointer", font:"500 12px var(--font-sans)" }}>Atla ✕</button>
        <div style={{ fontSize:40, lineHeight:1, marginBottom:12 }}>{s.ic}</div>
        <div style={{ font:"600 19px/1.25 var(--font-sans)", color:"var(--ink)", marginBottom:8 }}>{s.t}</div>
        <div style={{ font:"400 14px/1.5 var(--font-sans)", color:"var(--ink-2)", minHeight:66 }}>{s.d}</div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:18 }}>
          <div style={{ display:"flex", gap:6 }}>
            {BNS_TOUR_STEPS.map((_, k) => (
              <span key={k} style={{ width:7, height:7, borderRadius:99, background: k === i ? "var(--info)" : "var(--line)" }}/>
            ))}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {i > 0 && <button onClick={() => setI(i - 1)} style={tourBtn(false)}>‹ Geri</button>}
            <button onClick={() => last ? (onClose && onClose()) : setI(i + 1)} style={tourBtn(true)}>{last ? "Başla" : "İleri ›"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
function tourBtn(primary) {
  return { border: primary ? 0 : "1px solid var(--line)", background: primary ? "var(--info)" : "transparent", color: primary ? "#fff" : "var(--ink-2)", borderRadius:8, padding:"7px 14px", font:"600 13px var(--font-sans)", cursor:"pointer" };
}

function WelcomeCard({ name }) {
  const openTour = () => { if (typeof window.bnsOpenTour === "function") window.bnsOpenTour(); };
  return (
    <div style={{ marginBottom:"var(--grid-gap)", border:"1px solid var(--line)", borderRadius:14, padding:"16px 18px", background:"color-mix(in srgb, var(--info) 6%, var(--paper))" }}>
      <div style={{ font:"600 15px/1.3 var(--font-sans)", color:"var(--ink)", marginBottom:6 }}>👋 Hoş geldin{name ? ", " + name : ""}!</div>
      <div style={{ font:"400 13px/1.55 var(--font-sans)", color:"var(--ink-2)" }}>
        Henüz sana atanmış bir iş yok. İlk işin atandığında burada ve İşler sekmesinde görünecek.
        Bu arada sistemi tanımak için turu aç. Sorun olursa ekip liderine yaz.
      </div>
      <button onClick={openTour} style={{ marginTop:12, border:0, background:"var(--info)", color:"#fff", borderRadius:8, padding:"8px 14px", font:"600 13px var(--font-sans)", cursor:"pointer" }}>Turu aç</button>
    </div>
  );
}

try { window.WelcomeTour = WelcomeTour; window.WelcomeCard = WelcomeCard; } catch (e) {}
