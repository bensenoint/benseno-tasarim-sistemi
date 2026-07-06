# P2-A · Onboarding & Boş Durumlar — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yeni kullanıcıyı kaybetmemek için ilk-giriş mini turu, "hoş geldin" kartı ve boş durumlara "ne yapmalısın" yönlendirmeleri eklemek.

**Architecture:** Saf frontend. Yeni izole `Onboarding.jsx` (WelcomeTour + WelcomeCard) window.* olarak dışa verilir. Tur açma tek bir global ile tetiklenir (`window.bnsOpenTour`) → prop threading minimum. `hasWork` = kullanıcının lead/contributor/reviewer olduğu aktif brief var mı. Otomatik-açılış localStorage `bns_tour_seen` bayrağıyla bir kez.

**Tech Stack:** React UMD + esbuild JSX bundle. localStorage. Mevcut atomlar (Card, Button, I ikonları). Yeni API/DB yok.

**Spec:** `docs/superpowers/specs/2026-07-06-onboarding-bos-durumlar-design.md`

---

## Dosya haritası

- **Create:** `dashboard/app/Onboarding.jsx` — `WelcomeTour` (4 adımlık merkezi carousel overlay) + `WelcomeCard` (profil üstü, ilk brief'e kadar). `window.WelcomeTour`, `window.WelcomeCard`.
- **Modify:** `scripts/build-dashboard.sh` — cat listesine `Onboarding.jsx` (Chrome.jsx'ten önce).
- **Modify:** `dashboard/app/App.jsx` — `hasWork`, `tourOpen` state, `bns_tour_seen` sticky, otomatik-açılış effect, `window.bnsOpenTour`, `<WelcomeTour>` overlay render.
- **Modify:** `dashboard/app/Chrome.jsx` — Header sağ kümesine "?" butonu (`window.bnsOpenTour()`).
- **Modify:** `dashboard/app/screens/Profile.jsx` — kendi profili + iş yoksa en üste `<WelcomeCard>`.
- **Modify:** `dashboard/app/screens/Jobs.jsx`, `dashboard/app/screens/Kanban.jsx`, `dashboard/app/BriefTable.jsx`, `dashboard/app/screens/Profile.jsx` — boş-durum cümleleri.

Test: Saf-UI, birim test yok. Her task sonunda `bash scripts/ci-check.sh` (esbuild parse + tek-tanım güvencesi). Son task'ta preview manuel doğrulama.

---

### Task 1: `Onboarding.jsx` — WelcomeTour + WelcomeCard

**Files:**
- Create: `dashboard/app/Onboarding.jsx`
- Modify: `scripts/build-dashboard.sh`

- [ ] **Step 1: Bileşen dosyasını oluştur**

`dashboard/app/Onboarding.jsx`:

```jsx
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
```

- [ ] **Step 2: Build listesine ekle** — `scripts/build-dashboard.sh`, `"$APP/screens/Help.jsx" \` satırından sonra, `"$APP/Chrome.jsx" \`'ten önce:

```bash
  "$APP/screens/Help.jsx" \
  "$APP/Onboarding.jsx" \
  "$APP/Chrome.jsx" \
```

- [ ] **Step 3: CI (parse)** — Run: `bash scripts/ci-check.sh`
Expected: `🟢 CI KAPISI GEÇTİ` (Onboarding.jsx JSX olarak parse eder).

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/Onboarding.jsx scripts/build-dashboard.sh
git commit -m "feat(P2-A): WelcomeTour + WelcomeCard bileşenleri (Onboarding.jsx) + build listesi"
```

---

### Task 2: App.jsx wiring — hasWork, tur state, otomatik-açılış, global tetik, overlay

**Files:**
- Modify: `dashboard/app/App.jsx`

- [ ] **Step 1: State + hasWork + sticky bayrak** — `App` bileşeni içinde, diğer `useState`/`useStickyState` tanımlarının yanına (örn. `const [openBrief, setOpenBrief] = React.useState(null);` yakınına):

```jsx
  const [tourOpen, setTourOpen] = React.useState(false);
  const [tourSeen, setTourSeen] = useStickyState("tour_seen", false);
  const _tourUid = currentUser && (currentUser.slack_id || currentUser.id);
  const hasWork = !!_tourUid && (data.briefs || []).some(b =>
    window.bnsIsLead(b, _tourUid) ||
    (Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === _tourUid)) ||
    (b.reviewer && b.reviewer.id === _tourUid));
```

- [ ] **Step 2: Global tetik + otomatik-açılış effect** — mevcut global-access effect'in (`window.bnsOpenBriefById` vb. atandığı yer) içine `window.bnsOpenTour` ekle; ayrı bir effect ile otomatik aç:

```jsx
  // WelcomeCard / Chrome "?" turu bu global ile açar.
  React.useEffect(() => { window.bnsOpenTour = () => setTourOpen(true); }, []);
  // İlk giriş: iş yok + daha önce görülmemiş → turu bir kez otomatik aç.
  React.useEffect(() => {
    if (!hasWork && !tourSeen) setTourOpen(true);
  }, [hasWork, tourSeen]);
```

- [ ] **Step 3: Kapanışta bayrağı set et + overlay render** — `<Header ... />`'ın hemen üstüne (döndürülen JSX içinde, en dış fragment/■ kapsayıcı içinde) overlay ekle:

```jsx
      {window.WelcomeTour && (
        <window.WelcomeTour open={tourOpen} onClose={() => { setTourOpen(false); setTourSeen(true); }}/>
      )}
```

- [ ] **Step 4: Profile'a ad geçir (WelcomeCard için)** — `ProfileScreen` render satırında zaten `currentUser` var; ek prop gerekmez (WelcomeCard adı currentUser'dan Profile içinde okunacak — Task 4). Değişiklik yok; bu adımı atla.

- [ ] **Step 5: CI** — Run: `bash scripts/ci-check.sh` → `🟢 CI KAPISI GEÇTİ`.

- [ ] **Step 6: Commit**

```bash
git add dashboard/app/App.jsx
git commit -m "feat(P2-A): App wiring — hasWork, tur otomatik-açılış (bns_tour_seen), window.bnsOpenTour, overlay"
```

---

### Task 3: Chrome.jsx — Header "?" butonu

**Files:**
- Modify: `dashboard/app/Chrome.jsx`

- [ ] **Step 1: "?" butonunu ekle** — `Header` render'ında sağ küme (`<div style={{marginLeft: "auto", ...}}>`, ~satır 1326) içine, Sync pill'den sonra ekle:

```jsx
        <button onClick={() => window.bnsOpenTour && window.bnsOpenTour()} title="Sistem turunu aç" aria-label="Yardım / tur" style={{
          width: isMobile ? 34 : 32, height: isMobile ? 34 : 32, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid var(--line)", borderRadius: 8,
          background: "var(--surface)", color: "var(--ink-3)", cursor: "pointer",
          font: "600 14px/1 var(--font-sans)",
        }}>?</button>
```

- [ ] **Step 2: CI** — Run: `bash scripts/ci-check.sh` → `🟢 CI KAPISI GEÇTİ`.

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/Chrome.jsx
git commit -m "feat(P2-A): Header'a '?' turu-aç butonu"
```

---

### Task 4: Profile.jsx — WelcomeCard (kendi profili + iş yoksa)

**Files:**
- Modify: `dashboard/app/screens/Profile.jsx`

- [ ] **Step 1: WelcomeCard'ı en üste ekle** — `ProfileScreen` döndürülen JSX'inde, kişisel içerik başlamadan hemen önce (ilk `<Card>`/başlık bloğunun üstüne). `_isSelf` ve `myAll` zaten tanımlı (satır ~101, ~243). Ekle:

```jsx
      {_isSelf && myAll.length === 0 && window.WelcomeCard && (
        <window.WelcomeCard name={(u && (u.first_name || (u.name || "").split(" ")[0])) || ""}/>
      )}
```

Yerleşim: `ProfileScreen`'in `return (`'inden sonraki en dış kapsayıcının ilk çocuğu olacak. (⚙️ Ayarlar / Bugün akordiyonundan ÖNCE.)

- [ ] **Step 2: CI** — Run: `bash scripts/ci-check.sh` → `🟢 CI KAPISI GEÇTİ`.

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/screens/Profile.jsx
git commit -m "feat(P2-A): kendi profili + iş yokken WelcomeCard"
```

---

### Task 5: Boş-durum tek cümleleri

**Files:**
- Modify: `dashboard/app/screens/Profile.jsx` (Bugün akordiyonu)
- Modify: `dashboard/app/screens/Jobs.jsx`
- Modify: `dashboard/app/screens/Kanban.jsx`
- Modify: `dashboard/app/BriefTable.jsx`

- [ ] **Step 1: Profile→Bugün boş cümlesi** — `dashboard/app/screens/Profile.jsx`, mevcut satır:

```jsx
<div style={{font:"400 12px/1.4 var(--font-sans)", color:"var(--ink-4)", padding:"8px 0"}}>Bugün deadline'ı olan iş yok.</div>
```

şununla değiştir:

```jsx
<div style={{font:"400 12px/1.4 var(--font-sans)", color:"var(--ink-4)", padding:"8px 0"}}>Bugün deadline'ı olan iş yok — rahatça nefes al ya da İşler'den sıradakine bak.</div>
```

- [ ] **Step 2: BriefTable filtre-boş cümlesi** — `dashboard/app/BriefTable.jsx`, mevcut `Bu filtreyle eşleşen brief yok.` metnini bul ve şununla değiştir: `Bu filtreyle eşleşen brief yok — filtreyi temizlemeyi dene.`

- [ ] **Step 3: Jobs kişisel-boş cümlesi** — `dashboard/app/screens/Jobs.jsx` içinde liste boşken gösterilen metni bul (ör. "brief yok" / boş liste dalı). Boş liste render'ının olduğu yere, kişisel scope'ta anlamlı tek cümleyi ekle/mevcut metni değiştir:

```jsx
Sana atanmış aktif iş yok. Lider sana iş atadığında burada görünür.
```

(Jobs'ta ayrı bir "boş" metni yoksa, listenin `.length === 0` dalına yukarıdaki metni içeren bir `<div style={{font:"400 13px/1.5 var(--font-sans)", color:"var(--ink-4)", padding:"16px 4px"}}>…</div>` ekle.)

- [ ] **Step 4: Kanban boş cümlesi** — `dashboard/app/screens/Kanban.jsx` içinde tüm kolonlar boşken (filtre sonrası hiç kart yok) gösterilecek tek cümle. Kanban'da genel boş-durum metni yoksa, kart toplamı 0 iken board üstüne şu satırı ekle:

```jsx
{visibleCount === 0 && (
  <div style={{font:"400 13px/1.5 var(--font-sans)", color:"var(--ink-4)", padding:"16px 4px"}}>Bu görünümde iş yok. Filtreyi temizlemeyi ya da İşler'e bakmayı dene.</div>
)}
```

(`visibleCount` = filtre sonrası kart sayısı; dosyadaki mevcut filtrelenmiş liste uzunluğunu kullan. Uygun değişken adı dosyada neyse ona bağla.)

- [ ] **Step 5: CI** — Run: `bash scripts/ci-check.sh` → `🟢 CI KAPISI GEÇTİ`.

- [ ] **Step 6: Commit**

```bash
git add dashboard/app/screens/Profile.jsx dashboard/app/screens/Jobs.jsx dashboard/app/screens/Kanban.jsx dashboard/app/BriefTable.jsx
git commit -m "feat(P2-A): boş durumlara 'ne yapmalısın' tek cümle yönlendirmeleri"
```

---

### Task 6: Build + preview doğrulama + deploy

**Files:** (yok — build/deploy)

- [ ] **Step 1: Build + CI** — Run: `bash scripts/ci-check.sh && bash scripts/build-dashboard.sh`
Expected: CI 🟢, bundle derlenir (dashboard/app/ + app/ senkron), `bundle.js?v=` epoch güncellenir.

- [ ] **Step 2: Preview doğrulama** — dev server + preview:
  - (a) İşi 0 olan kullanıcı görünümünde tur otomatik açılır; **Atla** → sayfa yenilenince tekrar otomatik açılmaz (localStorage `bns_tour_seen`).
  - (b) Header'daki **"?"** turu tekrar açar.
  - (c) İş atanmış kullanıcıda WelcomeCard görünmez; iş yok senaryosunda Profile üstünde görünür.
  - (d) Boş-durum cümleleri (Bugün / filtre-boş / Jobs / Kanban) görünür.
  - (e) Tur kartı mobil (375px) genişlikte taşmaz.

- [ ] **Step 3: Deploy** — Run: `bash scripts/deploy.sh dashboard`
Expected: `🟢 deploy.sh tamam (dashboard)`. Pages job success + canlı `bundle.js?v=` güncellenir (bugünkü geçici Pages hatasında boş commit ile yeniden tetikle).

- [ ] **Step 4: Commit** (build çıktısı zaten commitlenir; deploy sonrası ek commit gerekmez)

---

## Self-Review Notları

- **Spec kapsamı:** WelcomeTour (Task 1), WelcomeCard (Task 1+4), otomatik-açılış+`bns_tour_seen` (Task 2), "?" tekrar (Task 3), boş-durum cümleleri (Task 5) → tümü karşılandı.
- **Tetik tutarlılığı:** Tek global `window.bnsOpenTour` — Chrome "?" (Task 3), WelcomeCard (Task 1) aynı fonksiyonu çağırır; App set eder (Task 2). Ad tutarlı.
- **hasWork tanımı:** App (Task 2) ve Profile WelcomeCard gate'i (Task 4, `myAll.length===0`) aynı "ilişkili brief" mantığını kullanır (lead/contributor/reviewer). Profile'da `myAll` zaten bu mantıkla hesaplı.
- **Kırılganlık:** Task 5 Step 3/4 mevcut boş-durum dallarının dosyada tam yerini gerektirir; uygulayıcı ilgili `.length === 0` dalını bulup metni oraya yerleştirmeli (değişken adları dosyaya göre).
