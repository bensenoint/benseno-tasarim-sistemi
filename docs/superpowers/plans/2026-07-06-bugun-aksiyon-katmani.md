# "Bugün" Ekranı + Aksiyon Katmanı — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard'u pasiflikten çıkar — brief satırlarına 4 aksiyon (Başladım/İlerlet/Termin öner/Hatırlat) ekle ve Panom'dan ulaşılan kurulumsuz bağımsız bir "Bugün" ekranı sun.

**Architecture:** Tek paylaşılan `BriefActions` bileşeni hem Panom widget'larında hem yeni `Bugun` ekranında kullanılır. Yetki kararı saf `bnsBriefActionPerms` fonksiyonuyla verilir (test edilebilir). Statü/termin aksiyonları mevcut altyapıyı (App `onStatusChange`, `/termin-oneri-uzat`) çağırır; yalnız "Hatırlat" için 1 yeni endpoint (`/api/briefs/:id/remind`). Yeni DB tablosu/kolon yok.

**Tech Stack:** React (UMD + esbuild, no TS), Node/Express, PostgreSQL, `node --test`. Mevcut global'ler: `window.bnsIsLead`, `window.bnsApiPost`, `window.bnsToast`, `window.bnsRefresh`, App `onStatusChange(b,s)`.

**Spec:** `docs/superpowers/specs/2026-07-06-bugun-aksiyon-katmani-design.md`

---

## Dosya haritası

| Dosya | Sorumluluk | İşlem |
|---|---|---|
| `dashboard/app/calc.js` | `bnsBriefActionPerms(brief,user)` saf yetki fonksiyonu + NEXT_STATUS | Modify |
| `scripts/bugun-perms.test.js` | perms + next-status birim testleri | Create |
| `server/api.js` | `POST /api/briefs/:id/remind` | Modify |
| `dashboard/app/Cards.jsx` | `BriefActions` paylaşılan bileşeni | Modify |
| `dashboard/app/screens/Bugun.jsx` | bağımsız "Bugün" ekranı | Create |
| `dashboard/app/Panom.jsx` | widget satırlarına BriefActions + "Bugün" butonu | Modify |
| `dashboard/app/App.jsx` | `bugun` view, `onRemind` helper, Panom prop'ları | Modify |
| `scripts/build-dashboard.sh` | cat listesine Bugun.jsx ekle | Modify |

**Sıra:** T1 saf perms (temel) → T2 remind endpoint → T3 BriefActions bileşeni → T4 Bugun ekranı → T5 Panom entegrasyonu + buton → T6 App wiring + build + deploy.

---

### Task 1: `bnsBriefActionPerms` + NEXT_STATUS (calc.js, TDD)

**Files:**
- Modify: `dashboard/app/calc.js` (module.exports'a ekle)
- Create: `scripts/bugun-perms.test.js`

- [ ] **Step 1: Başarısız testi yaz** — `scripts/bugun-perms.test.js`

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const c = require('../dashboard/app/calc.js');

const worker = { id: 'U1' }, lead = { id: 'U2' }, mgr = { id: 'U3', yetki: 'yonetici' }, outsider = { id: 'U9' };
const brief = (durum, extra = {}) => ({ durum, deltaH: 100, leads: [lead], workers: [worker], contributors: [worker], created_by: 'U2', ...extra });

test('atanan yeni işte başla+ilerlet var, dışarıdaki yok', () => {
  const p = c.bnsBriefActionPerms(brief('yeni'), worker);
  assert.equal(p.basla, true); assert.equal(p.ilerlet, true);
  const o = c.bnsBriefActionPerms(brief('yeni'), outsider);
  assert.equal(o.basla, false); assert.equal(o.ilerlet, false);
});
test('başla yalnız yeni/calisiliyor durumunda', () => {
  assert.equal(c.bnsBriefActionPerms(brief('incelemede'), worker).basla, false);
  assert.equal(c.bnsBriefActionPerms(brief('calisiliyor'), worker).basla, true);
});
test('tamamlandi/musteride → ilerlet yok', () => {
  assert.equal(c.bnsBriefActionPerms(brief('tamamlandi'), worker).ilerlet, false);
  assert.equal(c.bnsBriefActionPerms(brief('musteride'), worker).ilerlet, false);
});
test('termin: riskli+lead/açan/yönetici; değilse yok', () => {
  const risky = brief('basladi', { deltaH: -5 });
  assert.equal(c.bnsBriefActionPerms(risky, lead).termin, true);
  assert.equal(c.bnsBriefActionPerms(risky, mgr).termin, true);
  assert.equal(c.bnsBriefActionPerms(risky, worker).termin, false); // worker lead/açan/yönetici değil
  assert.equal(c.bnsBriefActionPerms(brief('basladi', { deltaH: 100 }), lead).termin, false); // riskli değil
});
test('hatırlat: lead veya yönetici', () => {
  assert.equal(c.bnsBriefActionPerms(brief('basladi'), lead).hatirlat, true);
  assert.equal(c.bnsBriefActionPerms(brief('basladi'), mgr).hatirlat, true);
  assert.equal(c.bnsBriefActionPerms(brief('basladi'), worker).hatirlat, false);
});
test('NEXT_STATUS ileri akış', () => {
  assert.equal(c.BNS_NEXT_STATUS['basladi'], 'incelemede');
  assert.equal(c.BNS_NEXT_STATUS['incelemede'], 'tamamlandi');
  assert.equal(c.BNS_NEXT_STATUS['tamamlandi'], undefined);
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör** — `node --test scripts/bugun-perms.test.js` → FAIL (`bnsBriefActionPerms is not a function`).

- [ ] **Step 3: calc.js'e ekle** (mevcut fonksiyonların yanına, `module.exports`'tan önce):

```js
// ── "Bugün"/aksiyon katmanı — ileri statü haritası + yetki kararı (saf, UI için) ──
var BNS_NEXT_STATUS = {
  yeni: 'calisiliyor', calisiliyor: 'basladi', basladi: 'incelemede',
  incelemede: 'tamamlandi', revizyon: 'incelemede', beklemede: 'basladi', blokeli: 'basladi'
};
// Brief satırında hangi aksiyonlar gösterilsin? Salt-veri (window bağımlılığı yok → node'da test edilir).
function bnsBriefActionPerms(b, u) {
  var out = { basla: false, ilerlet: false, termin: false, hatirlat: false };
  if (!b || !u || !u.id) return out;
  var uid = u.id;
  var leads = Array.isArray(b.leads) ? b.leads : (b.lead ? [b.lead] : []);
  var isLead = leads.some(function (l) { return l && l.id === uid; });
  var workers = Array.isArray(b.workers) ? b.workers : (Array.isArray(b.contributors) ? b.contributors : []);
  var isWorker = workers.some(function (w) { return w && w.id === uid; });
  var isAssignee = isLead || isWorker;
  var isMgr = u.yetki === 'yonetici' || u.rol === 'yonetici';
  var isCreator = b.created_by === uid;
  var durum = b.durum;
  out.basla = isAssignee && (durum === 'yeni' || durum === 'calisiliyor');
  out.ilerlet = isAssignee && !!BNS_NEXT_STATUS[durum] && durum !== 'tamamlandi' && durum !== 'musteride';
  var riskli = (typeof b.deltaH === 'number' && b.deltaH <= 24) || (typeof bnsIsRisk === 'function' && bnsIsRisk(durum, b.deltaH));
  out.termin = riskli && (isLead || isCreator || isMgr);
  out.hatirlat = isLead || isMgr;
  return out;
}
```
`module.exports` satırına `bnsBriefActionPerms, BNS_NEXT_STATUS` ekle. (calc.js tarayıcıda global; node'da export.)

- [ ] **Step 4: Testler geçsin** — `node --test scripts/bugun-perms.test.js` → 6/6 PASS. Ayrıca `node scripts/formula-test.js` hâlâ 59 geçmeli (regresyon yok).

- [ ] **Step 5: Commit**
```bash
git add dashboard/app/calc.js scripts/bugun-perms.test.js
git commit -m "feat(bugun): bnsBriefActionPerms saf yetki fonksiyonu + BNS_NEXT_STATUS (TDD)"
```

---

### Task 2: `POST /api/briefs/:id/remind` (Hatırlat endpoint)

**Files:**
- Modify: `server/api.js`

- [ ] **Step 1: Route'u ekle** (diğer authGuard brief route'larının yanına). notify zaten `require` edilmiş değilse ekle: `const { notify } = require('./notify');`

```js
// Hatırlat/dürt — işin lead+worker'larına (isteği yapan hariç) bildirim.
app.post('/api/briefs/:id/remind', auth.authGuard, async (req, res) => {
  try {
    const id = +req.params.id;
    const actor = req.user.slack_id;
    const bi = (await pool.query(`SELECT no, baslik, slack_url FROM briefs WHERE id=$1`, [id])).rows[0];
    if (!bi) return res.status(404).json({ error: 'brief bulunamadı' });
    const who = (await pool.query(`SELECT name FROM users WHERE id=$1`, [actor])).rows[0];
    const adi = who ? who.name : 'Biri';
    const a = await pool.query(`SELECT DISTINCT user_id FROM brief_assignees WHERE brief_id=$1 AND role IN ('contributor','lead')`, [id]);
    let sent = 0;
    for (const row of a.rows) {
      if (!/^U/.test(row.user_id || '') || row.user_id === actor) continue;   // kendine gönderme
      await notify(row.user_id, { tip: 'genel', aciliyet: 'acil', text: `🔔 ${adi} hatırlattı: #${bi.no} ${bi.baslik || ''}`, link: bi.slack_url || null, briefId: id });
      sent++;
    }
    res.json({ ok: true, sent });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 2: Parse** — `node --check server/api.js` → temiz.

- [ ] **Step 3: Commit**
```bash
git add server/api.js
git commit -m "feat(bugun): POST /api/briefs/:id/remind — hatırlat, lead+worker'lara notify (kendisi hariç)"
```

---

### Task 3: `BriefActions` paylaşılan bileşeni

**Files:**
- Modify: `dashboard/app/Cards.jsx` (dosya sonuna bileşen + `window.BriefActions = BriefActions;`)

- [ ] **Step 1: Bileşeni yaz**

```jsx
function BriefActions({ brief, currentUser, onStatusChange, onRemind, compact }) {
  const p = (typeof bnsBriefActionPerms === "function")
    ? bnsBriefActionPerms(brief, currentUser || {}) : { basla:false, ilerlet:false, termin:false, hatirlat:false };
  if (!p.basla && !p.ilerlet && !p.termin && !p.hatirlat) return null;
  const [busy, setBusy] = React.useState(false);
  const apiBase = (typeof window.BNS_API_BASE === "string" && window.BNS_API_BASE) ? window.BNS_API_BASE.replace(/\/+$/, "") : "https://benseno-api-production.up.railway.app";
  const tok = (typeof localStorage !== "undefined" && localStorage.getItem("bns_token")) || "";
  const Btn = ({ on, label, ic }) => (
    <button disabled={busy} onClick={(e) => { e.stopPropagation(); on(); }}
      style={{ display:"inline-flex", alignItems:"center", gap:4, font:"600 11px/1 var(--font-sans)",
        padding: compact ? "4px 7px" : "6px 10px", border:"1px solid var(--line)", borderRadius:6,
        background:"var(--paper-2)", color:"var(--ink-2)", cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1 }}>
      {ic}{label}
    </button>
  );
  const advance = (s) => { if (typeof onStatusChange === "function") onStatusChange(brief, s); };
  const termin = async () => {
    setBusy(true);
    try {
      await fetch(`${apiBase}/api/briefs/${brief.id}/termin-oneri-uzat`, { method:"POST",
        headers:{ "content-type":"application/json", ...(tok?{Authorization:"Bearer "+tok}:{}) },
        body: JSON.stringify({ by: currentUser && currentUser.slack_id }) });
      window.bnsToast && window.bnsToast("⏱️ Termin önerisi uygulandı"); window.bnsRefresh && window.bnsRefresh();
    } catch (e) { window.bnsToast && window.bnsToast("⚠ Termin uygulanamadı"); }
    setBusy(false);
  };
  const remind = async () => {
    setBusy(true);
    try { if (typeof onRemind === "function") await onRemind(brief); } finally { setBusy(false); }
  };
  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
      {p.basla    && <Btn on={() => advance("basladi")} label="Başladım" ic="🚀"/>}
      {p.ilerlet  && <Btn on={() => advance(BNS_NEXT_STATUS[brief.durum])} label="İlerlet" ic="⏭️"/>}
      {p.termin   && <Btn on={termin} label="Termin öner" ic="⏱️"/>}
      {p.hatirlat && <Btn on={remind} label="Hatırlat" ic="🔔"/>}
    </div>
  );
}
window.BriefActions = BriefActions;
```
Not: `bnsBriefActionPerms` ve `BNS_NEXT_STATUS` calc.js'ten global gelir (index.html'de bundle'dan önce yüklenir). `stopPropagation` — satır tıklaması drawer açarken buton çakışmasın.

- [ ] **Step 2: CI** — `bash scripts/ci-check.sh` → "🟢 CI KAPISI GEÇTİ" (Cards.jsx parse eder).

- [ ] **Step 3: Commit**
```bash
git add dashboard/app/Cards.jsx
git commit -m "feat(bugun): BriefActions paylaşılan bileşeni (başla/ilerlet/termin/hatırlat, yetki-gated)"
```

---

### Task 4: `screens/Bugun.jsx` bağımsız ekran

**Files:**
- Create: `dashboard/app/screens/Bugun.jsx`

- [ ] **Step 1: Ekranı yaz**

```jsx
// app/screens/Bugun.jsx — kişisel "Bugün" bakışı: sıradaki iş + bugün deadline + geciken + kapasite.
function BugunScreen({ data, user, currentUser, onOpenBrief, onStatusChange, onRemind, onBack }) {
  const u = user || currentUser || {};
  const now = (window.BNS_DATA && window.BNS_DATA.NOW) || Date.now();
  const briefs = (data._allBriefs || data.briefs || []);
  const mine = briefs.filter(b => b.durum !== "tamamlandi" &&
    (window.bnsIsLead(b, u.id) || (Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === u.id))));
  const aktif = mine.filter(b => b.durum !== "musteride");
  // Sıradaki iş: kisi_sira en küçük; yoksa en yakın deadline.
  const myKisiSira = (b) => { const c = (b.contributors||[]).find(x => x && x.id === u.id); return (c && c.kisi_sira != null) ? c.kisi_sira : Infinity; };
  const sirada = [...aktif].sort((a,b) => (myKisiSira(a)-myKisiSira(b)) || ((a.deadline||Infinity)-(b.deadline||Infinity)))[0] || null;
  const isToday = (ms) => { if (!ms) return false; const d = new Date(ms), n = new Date(now); return d.toDateString() === n.toDateString(); };
  const bugunDl = aktif.filter(b => isToday(b.deadline));
  const geciken = aktif.filter(b => b.deltaH <= 0);
  // Kapasite (tarih-duyarlı, Profile ile aynı as-of).
  const dr = data.dateRange || {}; const cutoff = (typeof dr.to === "number" && dr.to < now) ? dr.to : null;
  const capBriefs = bnsBriefsAsOf(briefs, (data._allCompleted || data.completed || []), cutoff).filter(b => b.durum !== "musteride");
  const capPct = bnsPersonCapPct(u, bnsPersonLoad(capBriefs, u.id) / 5);

  const Row = (b) => (
    <div key={b.id} onClick={() => onOpenBrief && onOpenBrief(b)} style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid var(--line-soft)", cursor:"pointer" }}>
      <span style={{ font:"500 13px/1.3 var(--font-sans)", color:"var(--ink)" }}>#{b.no} {b.marka} — {b.baslik || b.is}</span>
      <BriefActions brief={b} currentUser={currentUser} onStatusChange={onStatusChange} onRemind={onRemind} compact/>
    </div>
  );
  const Section = ({ title, rows, empty }) => (
    <Card style={{ padding:16, marginBottom:"var(--section-gap)" }}>
      <div style={{ font:"600 13px/1 var(--font-sans)", color:"var(--ink)", marginBottom:8 }}>{title} <span style={{ color:"var(--ink-4)", font:"400 12px var(--font-mono)" }}>{rows.length}</span></div>
      {rows.length ? rows.map(Row) : <div style={{ font:"400 13px var(--font-sans)", color:"var(--ink-4)" }}>{empty}</div>}
    </Card>
  );

  return (
    <div className="bn-tab-in">
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"var(--section-gap)" }}>
        <button onClick={() => onBack && onBack()} style={{ font:"600 12px/1 var(--font-sans)", padding:"6px 10px", border:"1px solid var(--line)", borderRadius:6, background:"var(--paper-2)", color:"var(--ink-2)", cursor:"pointer" }}>← Panom</button>
        <h2 style={{ font:"600 18px/1 var(--font-sans)", color:"var(--ink)", margin:0 }}>🗓️ Bugün</h2>
        <span style={{ marginLeft:"auto", font:"600 12px/1 var(--font-mono)", color: capPct > 85 ? "var(--warning)" : "var(--ink-3)" }}>Kapasiten %{capPct}</span>
      </div>
      {sirada && (
        <Card style={{ padding:16, marginBottom:"var(--section-gap)", borderLeft:"3px solid var(--ember)" }}>
          <div style={{ font:"600 11px/1 var(--font-sans)", color:"var(--ember)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:6 }}>Sıradaki iş</div>
          <div onClick={() => onOpenBrief && onOpenBrief(sirada)} style={{ font:"600 15px/1.3 var(--font-sans)", color:"var(--ink)", marginBottom:10, cursor:"pointer" }}>#{sirada.no} {sirada.marka} — {sirada.baslik || sirada.is}</div>
          <BriefActions brief={sirada} currentUser={currentUser} onStatusChange={onStatusChange} onRemind={onRemind}/>
        </Card>
      )}
      <Section title="Bugün deadline" rows={bugunDl} empty="Bugün teslimi olan işin yok."/>
      <Section title="Geciken" rows={geciken} empty="Geciken işin yok 🎉"/>
    </div>
  );
}
```
`bnsBriefsAsOf`, `bnsPersonLoad`, `bnsPersonCapPct`, `window.bnsIsLead`, `Card`, `BriefActions` global olarak mevcut.

- [ ] **Step 2: build listesine ekle** — `scripts/build-dashboard.sh` cat listesinde `"$APP/screens/Help.jsx" \` satırından sonra ekle:
```
  "$APP/screens/Bugun.jsx" \
```
Ve varsa `scripts/ci-check.sh` zaten `dashboard/app/screens/*.jsx` glob'u ile Bugun.jsx'i otomatik parse eder (ek değişiklik yok).

- [ ] **Step 3: CI** — `bash scripts/ci-check.sh` → 🟢.

- [ ] **Step 4: Commit**
```bash
git add dashboard/app/screens/Bugun.jsx scripts/build-dashboard.sh
git commit -m "feat(bugun): bağımsız Bugün ekranı — sıradaki iş + bugün deadline + geciken + kapasite (aksiyonlu)"
```

---

### Task 5: Panom entegrasyonu — widget aksiyonları + "Bugün" butonu

**Files:**
- Modify: `dashboard/app/Panom.jsx`

- [ ] **Step 1: "Bugün" butonunu ekle** — Panom başlık/araç çubuğunda (mevcut düzenle/ekle butonlarının yanına). Panom'un aldığı prop'lara `onGoBugun` eklenecek (App'ten). Buton:
```jsx
<button onClick={() => props.onGoBugun && props.onGoBugun()} title="Kişisel Bugün bakışı"
  style={{ display:"inline-flex", alignItems:"center", gap:5, font:"600 12px/1 var(--font-sans)", padding:"6px 11px", border:"1px solid var(--line)", borderRadius:6, background:"var(--paper-2)", color:"var(--ink)", cursor:"pointer" }}>
  🗓️ Bugün
</button>
```
(Panom fonksiyon imzasına `onGoBugun`, `onStatusChange`, `onRemind` prop'larını ekle; Panom ES5 stilinde — mevcut prop erişim biçimini takip et.)

- [ ] **Step 2: Widget satırlarına BriefActions** — `risk`, `mine`, `today` widget'larının brief satırını üreten render bölümünde (Panom.jsx içindeki ilgili `type` dalları), her satırın sonuna:
```jsx
<BriefActions brief={b} currentUser={window.BNS_CURRENT_USER || me} onStatusChange={onStatusChange} onRemind={onRemind} compact/>
```
`me` Panom'da mevcut current user; `onStatusChange`/`onRemind` prop olarak gelir. Satır tıklaması drawer açıyorsa `BriefActions` içindeki `stopPropagation` çakışmayı önler.

- [ ] **Step 3: CI** — `bash scripts/ci-check.sh` → 🟢.

- [ ] **Step 4: Commit**
```bash
git add dashboard/app/Panom.jsx
git commit -m "feat(bugun): Panom widget satırlarına BriefActions + '🗓️ Bugün' butonu"
```

---

### Task 6: App.jsx wiring + build + deploy

**Files:**
- Modify: `dashboard/app/App.jsx`

- [ ] **Step 1: `onRemind` helper** — `onStatusChange` tanımının yanına:
```js
const onRemind = async (b) => {
  try {
    const r = await window.bnsApiPost(`/api/briefs/${b.id}/remind`, {});
    setToast(r && r.ok ? `🔔 Hatırlatıldı (${r.sent||0} kişi)` : "⚠ Hatırlatma gönderilemedi");
  } catch (e) { setToast("⚠ Hatırlatma gönderilemedi"); }
};
```

- [ ] **Step 2: `bugun` view** — screen seçim zincirine ekle (Panom/`panom` dalının yanına):
```js
else if (tab === "bugun") Screen = <BugunScreen data={liveData} user={user} currentUser={currentUser} onOpenBrief={onOpenBrief} onStatusChange={onStatusChange} onRemind={onRemind} onBack={() => setTab("panom")}/>;
```

- [ ] **Step 3: Panom'a prop'ları geçir** — Panom render satırına `onGoBugun={() => setTab("bugun")} onStatusChange={onStatusChange} onRemind={onRemind}` ekle. (Panom'un render edildiği `tab === "panom"` dalını bul; prop adları Panom Step 1/2'dekiyle bire bir eşleşmeli.)

- [ ] **Step 4: Build + CI** — `bash scripts/ci-check.sh && bash scripts/build-dashboard.sh` → CI 🟢, bundle derlenir (dashboard/app/ + app/ senkron).

- [ ] **Step 5: Commit**
```bash
git add dashboard/app/App.jsx dashboard/app/bundle.js dashboard/app/screens/Bugun.jsx dashboard/index.html app/ index.html
git commit -m "feat(bugun): App wiring — bugun view + onRemind + Panom prop'ları; bundle build"
```

- [ ] **Step 6: Deploy** — `bash scripts/deploy.sh api && bash scripts/deploy.sh dashboard`
Beklenen: api 🟢 (remind endpoint canlı), dashboard 🟢 (Pages). Doğrulama: canlı preview'da Panom→"Bugün" butonu → ekran açılır; bir işte "Başladım" statüyü değiştirir; "Hatırlat" DM gönderir.

---

## Self-Review Notları

- **Spec kapsamı:** aksiyon katmanı→T3+T5; 4 aksiyon→T1(perms)+T3(davranış); Bugün ekranı→T4; Panom butonu→T5; remind endpoint→T2; App wiring→T6; test→T1(perms birim)+CI. Tümü karşılandı.
- **Tip tutarlılığı:** `bnsBriefActionPerms(b,u)→{basla,ilerlet,termin,hatirlat}` ve `BNS_NEXT_STATUS` T1'de tanımlı, T3/T4'te aynı isimlerle kullanılıyor. `onStatusChange(b,s)`, `onRemind(b)`, `onGoBugun()` prop adları T3–T6 arasında tutarlı.
- **Bilinen küçük belirsizlik (uygulayıcı doğrulasın):** Panom ES5 iç yapısında `risk/mine/today` satır render'ının tam yeri (T5 Step 2) — implementer ilgili `type` dalını okuyup satır sonuna ekler. Panom current-user değişkeni `me`; onStatusChange/onRemind prop olarak geçer.
- **YAGNI:** aksiyonların Jobs/Kanban/Department'a yayılması, Bugün'ün nav sekmesi olması, toplu aksiyon → kapsam dışı (spec ile tutarlı).
