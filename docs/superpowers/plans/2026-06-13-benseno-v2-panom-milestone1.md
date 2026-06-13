# Benseno v2 "Panom" — 1. Kilometre Taşı · Uygulama Planı

> **Agentic worker için:** GEREKLİ ALT-BECERİ: superpowers:subagent-driven-development (önerilen)
> veya superpowers:executing-plans ile bu planı görev-görev uygula. Adımlar `- [ ]` ile izlenir.

**Goal:** Prod'a dokunmadan `/v2`'de, mevcut canlı veriyle çalışan, kişiye özel sürükle-bırak
widget panosu ("Panom") + sürüklenebilir Ody avatarı — 1. kilometre taşı (kabuk + ızgara + 5 widget + kalıcılık).

**Architecture:** Yeni `v2/` klasörü GitHub Pages'te `/v2/` olarak yayınlanır. Mevcut `app/calc.js`
(saf formüller) + `app/data.js` (hidrasyon helper'ları) yeniden kullanılır; v2 kendi JWT'li poll'unu
yapar (`/api/embedded`). gridstack.js (CDN UMD) ızgara motoru; her widget bir **React component**
olup grid hücresine `ReactDOM.createRoot` ile mount edilir (innerHTML YOK — XSS riski yok, mevcut
React kod tabanıyla tutarlı). Layout `dashboard_layouts` tablosunda kişiye özel (`/api/layout`, authGuard).

**Tech Stack:** React 18 (UMD), esbuild (concat+minify), gridstack.js (CDN), Express (mevcut API),
Postgres (mevcut), JWT auth (mevcut `server/auth.js`).

**Doğrulama notu:** Bu repo'da UI birim-test çatısı YOK. Saf JS modülleri (layout.js) node ile test
edilir (formula-test.js deseni). API curl ile, UI build+Pages+tarayıcı ile doğrulanır. `bash scripts/ci-check.sh`
her commit öncesi çalışır.

---

## Dosya Yapısı (1. kilometre taşı)

**Yeni:**
- `v2/index.html` — v2 kabuğu (React+gridstack CDN, ../app/calc.js, ../app/data.js, v2/app/bundle.js)
- `v2/app/layout.js` — SAF: varsayılan layout + serialize + validate (node-testable)
- `v2/app/widgets.jsx` — widget kayıt defteri (type → {title,minW,minH,Component})
- `v2/app/ody.jsx` — sürüklenebilir Ody avatar buton + proaktif brief (React)
- `v2/app/panom.jsx` — kabuk: nav + gridstack ızgara + düzenle modu + poll + layout yükle/kaydet
- `scripts/build-v2.sh` — v2 bundle derleyici (build-dashboard.sh deseni)
- `scripts/v2-layout-test.js` — layout.js node testi

**Değişen:**
- `server/api.js` — `GET/PUT /api/layout` (authGuard) ekle
- `dashboard/app/data.js` — `window.bnsApplyEmbedded(ed)` köprüsünü dışa aç
- `scripts/ci-check.sh` — v2 layout testini ekle
- DB — `dashboard_layouts` tablosu (CREATE TABLE)

---

## Task 1: dashboard_layouts tablosu + /api/layout endpoint'leri

**Files:**
- Modify: `server/api.js` (`/api/auth/me` bloğundan sonra)
- DB: `dashboard_layouts` tablosu

- [ ] **Step 1: Tabloyu oluştur**

```bash
psql "$(cat data/.db-url)" -c "CREATE TABLE IF NOT EXISTS dashboard_layouts (user_id text PRIMARY KEY, layout jsonb NOT NULL, updated_at timestamptz DEFAULT now());"
psql "$(cat data/.db-url)" -t -c "SELECT to_regclass('public.dashboard_layouts');"
```
Expected: `dashboard_layouts`

- [ ] **Step 2: GET/PUT /api/layout endpoint'lerini ekle**

`server/api.js` içinde `app.get('/api/auth/me', ...)` bloğundan SONRA:

```javascript
// Kişiye özel pano düzeni (v2 Panom). authGuard → kişinin slack_id'sinden okur/yazar.
app.get('/api/layout', auth.authGuard, async (req, res) => {
  try {
    const r = await pool.query('SELECT layout FROM dashboard_layouts WHERE user_id=$1', [req.user.slack_id]);
    res.json({ layout: r.rows[0] ? r.rows[0].layout : null });
  } catch (e) { console.error('[api] layout get hata:', e.message); res.status(500).json({ error: e.message }); }
});
app.put('/api/layout', auth.authGuard, async (req, res) => {
  try {
    const layout = req.body && req.body.layout;
    if (!Array.isArray(layout)) return res.status(400).json({ error: 'layout dizi olmalı' });
    if (layout.length > 50) return res.status(400).json({ error: 'çok fazla widget' });
    await pool.query(
      `INSERT INTO dashboard_layouts(user_id, layout, updated_at) VALUES ($1,$2,now())
       ON CONFLICT (user_id) DO UPDATE SET layout=$2, updated_at=now()`,
      [req.user.slack_id, JSON.stringify(layout)]);
    res.json({ ok: true });
  } catch (e) { console.error('[api] layout put hata:', e.message); res.status(500).json({ error: e.message }); }
});
```

NOT: `req.user.slack_id` alanının auth payload'ında bulunduğunu doğrula. `server/auth.js`'te
authGuard'ın req.user'a koyduğu alan adı farklıysa (`id`/`uid`) ona göre düzelt — Step 3 öncesi `grep -n "req.user" server/api.js` ile mevcut kullanımı kontrol et.

- [ ] **Step 3: Sözdizimi + CI kapısı**

Run: `node --check server/api.js && bash scripts/ci-check.sh`
Expected: `🟢 CI KAPISI GEÇTİ`

- [ ] **Step 4: Commit + API deploy**

```bash
git add server/api.js && git commit -m "feat(v2): dashboard_layouts + /api/layout endpoint'leri (kişiye özel pano)"
npm run deploy api
```

- [ ] **Step 5: Canlı doğrula (token'sız 401)**

```bash
API="https://benseno-api-production.up.railway.app"
until [ "$(curl -s -o /dev/null -w '%{http_code}' "$API/api/layout")" = "401" ]; do :; done
echo "✅ /api/layout authGuard arkasında (401)"
```
Expected: `✅ /api/layout authGuard arkasında (401)`

---

## Task 2: layout.js — saf layout modülü + node testi

**Files:**
- Create: `v2/app/layout.js`
- Create: `scripts/v2-layout-test.js`
- Modify: `scripts/ci-check.sh`

- [ ] **Step 1: layout.js yaz (saf, node + tarayıcı)**

`v2/app/layout.js`:
```javascript
// Saf layout yardımcıları — DOM yok; node'da test edilir, tarayıcıda global.
// Widget örneği: { type, x, y, w, h }. gridstack 12-kolon ızgara varsayar.
var BNS_V2_WIDGETS = ["riskli-islerim", "kapasitem", "kart-akisi", "musteride", "bugun-yarin",
  "marka-yogunlugu", "cikti-hizi", "son-teslimler", "departman-ozeti"];

function bnsV2DefaultLayout() {
  return [
    { type: "riskli-islerim", x: 0, y: 0, w: 7, h: 3 },
    { type: "kapasitem",      x: 7, y: 0, w: 5, h: 3 },
    { type: "kart-akisi",     x: 0, y: 3, w: 7, h: 4 },
    { type: "musteride",      x: 7, y: 3, w: 5, h: 2 },
    { type: "bugun-yarin",    x: 7, y: 5, w: 5, h: 2 },
  ];
}

// gridstack save() çıktısı → kalıcı şekil (yalnız tip+konum). Bilinmeyen tip atılır.
function bnsV2Serialize(nodes) {
  return (nodes || [])
    .map(function (n) {
      var type = (n.el && n.el.getAttribute) ? n.el.getAttribute("data-w") : n.type;
      return { type: type, x: n.x | 0, y: n.y | 0, w: n.w | 0, h: n.h | 0 };
    })
    .filter(function (n) { return BNS_V2_WIDGETS.indexOf(n.type) !== -1; });
}

// API'den gelen layout'u doğrula; geçersizse varsayılana düş.
function bnsV2Validate(layout) {
  if (!Array.isArray(layout) || !layout.length) return bnsV2DefaultLayout();
  var ok = layout.filter(function (w) {
    return w && BNS_V2_WIDGETS.indexOf(w.type) !== -1 &&
      [w.x, w.y, w.w, w.h].every(function (v) { return typeof v === "number" && v >= 0; });
  });
  return ok.length ? ok : bnsV2DefaultLayout();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BNS_V2_WIDGETS: BNS_V2_WIDGETS, bnsV2DefaultLayout: bnsV2DefaultLayout, bnsV2Serialize: bnsV2Serialize, bnsV2Validate: bnsV2Validate };
}
```

- [ ] **Step 2: node testi yaz**

`scripts/v2-layout-test.js`:
```javascript
'use strict';
const L = require('../v2/app/layout.js');
let FAIL = 0, PASS = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { PASS++; console.log('  ✅ ' + name); }
  else { FAIL++; console.log('  ❌ ' + name + ' — beklenen ' + JSON.stringify(want) + ', gelen ' + JSON.stringify(got)); }
}
console.log('\n🧪 v2 layout testi\n');
t('varsayılan 5 widget', L.bnsV2DefaultLayout().length, 5);
t('boş layout → varsayılan', L.bnsV2Validate([]).length, 5);
t('null → varsayılan', L.bnsV2Validate(null).length, 5);
t('bilinmeyen tip atılır', L.bnsV2Validate([{type:'sahte',x:0,y:0,w:1,h:1}]).length, 5);
t('geçerli korunur', L.bnsV2Validate([{type:'kapasitem',x:0,y:0,w:4,h:2}]).length, 1);
t('negatif boyut → varsayılan', L.bnsV2Validate([{type:'kapasitem',x:0,y:-1,w:4,h:2}]).length, 5);
t('serialize tip+konum', L.bnsV2Serialize([{type:'kapasitem',x:1,y:2,w:3,h:4}]), [{type:'kapasitem',x:1,y:2,w:3,h:4}]);
console.log('\n' + (FAIL === 0 ? '🟢 GEÇTİ' : '🔴 KALDI') + ' — ' + PASS + ' geçti, ' + FAIL + ' kaldı\n');
process.exit(FAIL === 0 ? 0 : 1);
```

- [ ] **Step 3: Testi çalıştır**

Run: `node scripts/v2-layout-test.js`
Expected: `🟢 GEÇTİ — 7 geçti, 0 kaldı`

- [ ] **Step 4: ci-check'e v2 layout testini ekle**

`scripts/ci-check.sh` içinde formül kilidi (③) bloğundan SONRA (FAIL değişkenini kullanan mevcut deseni izle):
```bash
echo "⑤ v2 layout testi"
if node scripts/v2-layout-test.js >/tmp/ci-v2 2>&1; then echo "  ✅ $(grep -o '[0-9]* geçti' /tmp/ci-v2 | tail -1)"; else cat /tmp/ci-v2; FAIL=1; fi
```

- [ ] **Step 5: Commit**

```bash
git add v2/app/layout.js scripts/v2-layout-test.js scripts/ci-check.sh
git commit -m "feat(v2): saf layout modülü + node testi + ci-check entegrasyonu"
```

---

## Task 3: data.js köprüsü + v2 kabuğu (index.html) + build-v2.sh

**Files:**
- Modify: `dashboard/app/data.js` (en sona ekle)
- Create: `v2/index.html`
- Create: `scripts/build-v2.sh`
- Create: `v2/app/panom.jsx` (iskelet — Task 5'te genişler)

- [ ] **Step 1: data.js bridge'ini yeniden kullanılabilir yap (bnsApplyEmbedded)**

`dashboard/app/data.js` EN SONA ekle (mevcut bridge'i bozma):
```javascript
// v2 poll'u için: EMBEDDED_DATA'yı BNS_DATA'ya uygulayan minimal köprü.
// Hidrasyon helper'ları (bnsHydrateBrief vb.) global; varsa kullan, yoksa ham bırak.
window.bnsApplyEmbedded = function (ed) {
  if (!ed || typeof ed !== "object") return;
  window.EMBEDDED_DATA = ed;
  try {
    var D = window.BNS_DATA = window.BNS_DATA || {};
    if (Array.isArray(ed.bns_briefs))
      D.briefs = window.bnsHydrateBrief ? ed.bns_briefs.map(window.bnsHydrateBrief) : ed.bns_briefs;
    if (Array.isArray(ed.bns_completed))
      D.completed = window.bnsHydrateCompleted ? ed.bns_completed.map(window.bnsHydrateCompleted) : ed.bns_completed;
    if (ed.bns_dept_stats) D.deptStats = window.bnsNormDeptStats ? window.bnsNormDeptStats(ed.bns_dept_stats) : ed.bns_dept_stats;
    if (Array.isArray(ed.bns_brands)) D.BRANDS = ed.bns_brands;
    if (Array.isArray(ed.bns_users)) D.USERS = window.bnsMergeUser ? ed.bns_users.map(window.bnsMergeUser) : ed.bns_users;
    D.__source = "live_briefs";
  } catch (e) { console.warn("[v2] applyEmbedded hata:", e.message); }
};
```

NOT: `bnsHydrateBrief`/`bnsHydrateCompleted`/`bnsNormDeptStats`/`bnsMergeUser` adlarını uygulamadan
önce `grep -n "function bnsHydrate\|bnsNormDept\|bnsMergeUser" dashboard/app/*.js*` ile doğrula;
mevcut ad farklıysa düzelt. Helper yoksa ham veriyle çalışır (guard zaten var).

- [ ] **Step 2: v2/app/panom.jsx iskelet**

`v2/app/panom.jsx`:
```jsx
// Panom kabuğu (iskelet). Task 5'te gridstack + layout + düzenle eklenecek.
function PanomApp() {
  return React.createElement("div", { style: { padding: 16 } },
    React.createElement("h1", { style: { font: "500 22px var(--font-sans)", margin: 0 } }, "Panom"),
    React.createElement("div", { id: "bns-grid", className: "grid-stack" }));
}
window.PanomApp = PanomApp;
```

- [ ] **Step 3: v2/index.html yaz**

`v2/index.html`:
```html
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Benseno · Panom (v2)</title>
<link rel="stylesheet" href="../app/tokens.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gridstack@10/dist/gridstack.min.css">
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://cdn.jsdelivr.net/npm/gridstack@10/dist/gridstack-all.js"></script>
</head>
<body>
<div id="root"></div>
<script src="../app/calc.js?v=0"></script>
<script src="../app/data.js?v=0"></script>
<script src="app/bundle.js?v=0"></script>
<script>
  (function () {
    if (!localStorage.getItem("bns_token")) { location.href = "../dashboard/"; return; }
    ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(window.PanomApp));
  })();
</script>
</body>
</html>
```

NOT: `../app/tokens.css` yolunun gerçek CSS değişken dosyası olduğunu doğrula
(`ls dashboard/app/*.css` veya prod index.html'in `<link>`'ine bak). Ad farklıysa (`styles.css`) düzelt.
gridstack CDN'lerinin CSP allowlist'te olduğunu spec belirtti — prod `Content-Security-Policy`
header'ında `cdn.jsdelivr.net` + `unpkg.com` script-src/style-src'de mi kontrol et (`grep -ni "Content-Security" server/api.js`).

- [ ] **Step 4: scripts/build-v2.sh yaz**

`scripts/build-v2.sh`:
```bash
#!/usr/bin/env bash
set -e
PROJ="$HOME/benseno-tasarim-sistemi"; APP="$PROJ/v2/app"
echo "🔨 v2 bundle derleniyor..."
cat "$APP/layout.js" "$APP/widgets.jsx" "$APP/ody.jsx" "$APP/panom.jsx" \
  | npx esbuild --loader=jsx --jsx=transform --jsx-factory=React.createElement --jsx-fragment=React.Fragment --minify \
  > "$APP/bundle.js"
TS=$(date +%s)
sed -i '' -e "s|app/bundle\.js?v=[0-9]*|app/bundle.js?v=${TS}|g" "$PROJ/v2/index.html"
sed -i '' -e "s|app/calc\.js?v=[0-9]*|app/calc.js?v=${TS}|g" -e "s|app/data\.js?v=[0-9]*|app/data.js?v=${TS}|g" "$PROJ/v2/index.html"
echo "✅ v2/app/bundle.js hazır"
```

NOT: build-v2.sh widgets.jsx + ody.jsx'i bekler — Task 4 ve 6'da oluşturulur. Bu task'ta build
ÇALIŞTIRMA. İlk derleme Task 5 Step 2'de.

- [ ] **Step 5: chmod + commit**

```bash
chmod +x scripts/build-v2.sh
git add v2/index.html v2/app/panom.jsx dashboard/app/data.js scripts/build-v2.sh
git commit -m "feat(v2): kabuk index.html + panom iskeleti + build-v2.sh + data.js bnsApplyEmbedded köprüsü"
```

---

## Task 4: widget kayıt defteri + 5 çekirdek widget (React)

**Files:**
- Create: `v2/app/widgets.jsx`

- [ ] **Step 1: widgets.jsx — kayıt defteri + 5 React widget**

`v2/app/widgets.jsx`:
```jsx
// Widget kayıt defteri. Her tip: { title, minW, minH, Component }.
// Component, BNS_DATA'dan okuyan bir React fonksiyon bileşenidir. Hesaplar calc.js
// global'lerinden (bnsIsRisk, bnsPersonCapPct) gelir — yeni hesap TANIMLANMAZ (magic-guard).
function v2Me() { try { return (window.bnsGetStoredUser && window.bnsGetStoredUser()) || null; } catch (e) { return null; } }
function v2Briefs() { return (window.BNS_DATA && window.BNS_DATA.briefs) || []; }
function v2Mine(b, uid) {
  return (b.lead && b.lead.id === uid) || (Array.isArray(b.contributors) && b.contributors.some(c => c && c.id === uid));
}
function WCard({ title, children }) {
  return React.createElement("div", { style: { height: "100%", display: "flex", flexDirection: "column" } },
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8 } },
      React.createElement("span", { className: "bns-grip", style: { cursor: "move", color: "var(--ink-4)" } }, "⋮"),
      React.createElement("span", { style: { font: "500 12px/1 var(--font-sans)", color: "var(--ink-3)" } }, title)),
    React.createElement("div", { style: { flex: 1, overflow: "auto" } }, children));
}
function WEmpty(t) { return React.createElement("div", { style: { color: "var(--ink-4)", fontSize: 12 } }, t); }

function RiskliIslerim() {
  const me = v2Me(), uid = me && me.id;
  const rows = v2Briefs().filter(b => v2Mine(b, uid) && window.bnsIsRisk && window.bnsIsRisk(b.durum, b.deltaH));
  return React.createElement(WCard, { title: "Riskli işlerim" },
    rows.length ? rows.map(b => React.createElement("div", { key: b.no,
      style: { borderLeft: "3px solid var(--prio-red)", padding: "4px 8px", marginBottom: 4, fontSize: 12 } },
      `#${b.no} ${b.baslik || b.is || ""} · ${b.deltaH <= 0 ? Math.abs(Math.round(b.deltaH)) + "sa↑" : Math.round(b.deltaH) + "sa"}`))
      : WEmpty("risk yok 👍"));
}
function Kapasitem() {
  const me = v2Me(), uid = me && me.id;
  const aktif = v2Briefs().filter(b => v2Mine(b, uid) && b.durum !== "musteride").length;
  const pct = (window.bnsPersonCapPct && me) ? window.bnsPersonCapPct(me, aktif) : 0;
  return React.createElement(WCard, { title: "Kapasitem" },
    React.createElement("div", { style: { font: "500 28px/1 var(--font-sans)" } }, "%" + pct),
    React.createElement("div", { style: { fontSize: 11, color: "var(--ink-4)", marginTop: 4 } }, aktif + " aktif iş"));
}
function KartAkisi() {
  const rows = v2Briefs().filter(b => b.durum === "calisiliyor").slice(0, 8);
  return React.createElement(WCard, { title: "Çalışılıyor" },
    rows.length ? rows.map(b => React.createElement("div", { key: b.no,
      style: { border: "0.5px solid var(--line)", borderRadius: 6, padding: "6px 9px", marginBottom: 5, fontSize: 12 } },
      (b.baslik || b.is || ""), React.createElement("div", { style: { fontSize: 10, color: "var(--ink-4)" } }, b.marka || "")))
      : WEmpty("—"));
}
function Musteride() {
  const m = v2Briefs().filter(b => b.durum === "musteride");
  return React.createElement(WCard, { title: "Müşteride" },
    React.createElement("div", { style: { font: "500 28px/1 var(--font-sans)", color: "#7c5cff" } }, m.length),
    React.createElement("div", { style: { fontSize: 11, color: "var(--ink-4)", marginTop: 4 } }, "dönüş bekliyor"));
}
function BugunYarin() {
  const rows = v2Briefs().filter(b => b.deltaH != null && b.deltaH <= 48 && b.durum !== "tamamlandi")
    .sort((a, b) => a.deltaH - b.deltaH).slice(0, 8);
  return React.createElement(WCard, { title: "Bugün ve yarın" },
    rows.length ? rows.map(b => React.createElement("div", { key: b.no, style: { fontSize: 12, padding: "3px 0" } },
      `#${b.no} ${b.baslik || b.is || ""} · ${Math.round(b.deltaH)}sa`)) : WEmpty("—"));
}

window.BNS_V2_REGISTRY = {
  "riskli-islerim": { title: "Riskli işlerim", minW: 4, minH: 2, Component: RiskliIslerim },
  "kapasitem":      { title: "Kapasitem",      minW: 3, minH: 2, Component: Kapasitem },
  "kart-akisi":     { title: "Çalışılıyor",    minW: 5, minH: 3, Component: KartAkisi },
  "musteride":      { title: "Müşteride",      minW: 3, minH: 2, Component: Musteride },
  "bugun-yarin":    { title: "Bugün ve yarın", minW: 4, minH: 2, Component: BugunYarin },
};
```

NOT: `bnsGetStoredUser` ve brief alan adları (`b.durum`, `b.deltaH`, `b.lead.id`, `b.contributors`,
`b.baslik`/`b.is`, `b.marka`) prod `data.js`/App.jsx'teki gerçek hidratlanmış brief şekliyle eşleşmeli.
Uygulamadan önce `grep -n "bnsGetStoredUser\|deltaH\|contributors" dashboard/app/*.js*` ile doğrula;
ad farklıysa düzelt (örn. `durumKey`, `assignees`).

- [ ] **Step 2: Sözdizimi (esbuild parse)**

Run: `npx --yes esbuild --loader=jsx --jsx=transform v2/app/widgets.jsx --outfile=/tmp/w.js && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add v2/app/widgets.jsx && git commit -m "feat(v2): widget kayıt defteri + 5 çekirdek widget (React)"
```

---

## Task 5: gridstack entegrasyonu + düzenle modu + layout kalıcılık

**Files:**
- Modify: `v2/app/panom.jsx` (tam sürüm)

- [ ] **Step 1: panom.jsx — gridstack + React-mount + düzenle + kaydet/yükle**

`v2/app/panom.jsx` içeriğini ŞUNUNLA DEĞİŞTİR:
```jsx
const API_V2 = window.BNS_API_BASE || "https://benseno-api-production.up.railway.app";
const tokV2 = () => (typeof localStorage !== "undefined" && localStorage.getItem("bns_token")) || "";
const btnV2 = { padding: "6px 11px", border: "0.5px solid var(--line)", borderRadius: 6, background: "var(--surface)", color: "var(--ink)", font: "400 12px/1 var(--font-sans)", cursor: "pointer" };

function PanomApp() {
  const [edit, setEdit] = React.useState(false);
  const [picker, setPicker] = React.useState(false);
  const [tick, setTick] = React.useState(0); // eklenebilir listesi yeniden hesaplansın
  const gridRef = React.useRef(null);
  const layoutRef = React.useRef([]);
  const roots = React.useRef({}); // grid-item el → ReactDOM root

  function mountWidget(node) {
    const el = node.querySelector(".grid-stack-item-content");
    const type = node.getAttribute("data-w");
    const def = window.BNS_V2_REGISTRY[type];
    if (!def || !el) return;
    const root = ReactDOM.createRoot(el);
    roots.current[type + ":" + (node.gridstackNode && node.gridstackNode.id || type)] = root;
    root.render(React.createElement(def.Component));
  }
  function addWidget(grid, item) {
    const node = grid.addWidget({ x: item.x, y: item.y, w: item.w, h: item.h,
      content: '<div class="grid-stack-item-content" style="background:var(--surface);border:0.5px solid var(--line);border-radius:12px;padding:10px 12px"></div>' });
    node.setAttribute("data-w", item.type);
    mountWidget(node);
  }
  function save(grid) {
    const layout = window.bnsV2Serialize(grid.save(false));
    layoutRef.current = layout;
    setTick(t => t + 1);
    fetch(API_V2 + "/api/layout", { method: "PUT",
      headers: { "content-type": "application/json", Authorization: "Bearer " + tokV2() },
      body: JSON.stringify({ layout }) }).catch(() => {});
  }

  React.useEffect(() => {
    (async () => {
      // 1) canlı veri (JWT). 401 → login.
      try {
        const r = await fetch(API_V2 + "/api/embedded?t=" + Date.now(), {
          cache: "no-store", headers: { Authorization: "Bearer " + tokV2() } });
        if (r.status === 401) { localStorage.removeItem("bns_token"); location.href = "../dashboard/"; return; }
        if (r.ok && window.bnsApplyEmbedded) window.bnsApplyEmbedded(await r.json());
      } catch (e) {}
      // 2) layout
      let layout = window.bnsV2DefaultLayout();
      try {
        const lr = await fetch(API_V2 + "/api/layout", { headers: { Authorization: "Bearer " + tokV2() } });
        if (lr.ok) layout = window.bnsV2Validate((await lr.json()).layout);
      } catch (e) {}
      layoutRef.current = layout; setTick(t => t + 1);
      // 3) gridstack
      const grid = window.GridStack.init({ column: 12, cellHeight: 70, margin: 8, disableDrag: true, disableResize: true,
        columnOpts: { breakpoints: [{ w: 700, c: 1 }] } }, "#bns-grid");
      gridRef.current = grid;
      layout.forEach(item => addWidget(grid, item));
      grid.on("change", () => save(grid));
      grid.on("removed", () => save(grid));
    })();
  }, []);

  React.useEffect(() => {
    const g = gridRef.current; if (!g) return;
    g.enableMove(edit); g.enableResize(edit);
  }, [edit]);

  const eklenebilir = window.BNS_V2_WIDGETS.filter(t => !layoutRef.current.some(w => w.type === t));
  return React.createElement(React.Fragment, null,
    React.createElement(window.OdyV2),
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" } },
      React.createElement("h1", { style: { font: "500 20px/1 var(--font-sans)", margin: 0, flex: 1 } }, "Panom"),
      edit && React.createElement("button", { onClick: () => setPicker(p => !p), style: btnV2 }, "+ alan ekle"),
      React.createElement("button", { onClick: () => setEdit(e => !e),
        style: { ...btnV2, background: edit ? "var(--ember)" : "var(--surface)", color: edit ? "#fff" : "var(--ink-3)" } },
        edit ? "✓ bitti" : "düzenle")),
    picker && edit && React.createElement("div", { style: { padding: "0 16px 12px", display: "flex", gap: 8, flexWrap: "wrap" } },
      eklenebilir.length ? eklenebilir.map(t => React.createElement("button", { key: t, style: btnV2,
        onClick: () => { const g = gridRef.current; addWidget(g, { type: t, x: 0, y: 100, w: 4, h: 2 }); save(g); setPicker(false); } },
        (window.BNS_V2_REGISTRY[t] && window.BNS_V2_REGISTRY[t].title) || t))
        : React.createElement("span", { style: { fontSize: 12, color: "var(--ink-4)" } }, "tüm alanlar ekli")),
    React.createElement("div", { id: "bns-grid", className: "grid-stack", style: { padding: "0 8px" } }));
}
window.PanomApp = PanomApp;
```

- [ ] **Step 2: İlk v2 build**

Run: `bash scripts/build-v2.sh`
Expected: `✅ v2/app/bundle.js hazır`

NOT: Bu adımda `OdyV2` henüz yok (Task 6) — `React.createElement(window.OdyV2)` undefined olur ve
React hata verir. İki seçenek: (a) Task 6'yı bu task'tan önce yap, ya da (b) panom.jsx'te
`window.OdyV2 ? React.createElement(window.OdyV2) : null` guard'ı kullan. **Guard kullan** (önerilen):
`React.createElement(window.OdyV2)` → `window.OdyV2 ? React.createElement(window.OdyV2) : null`.

- [ ] **Step 3: ci-check + commit + push (Pages /v2 yayınlar)**

```bash
bash scripts/ci-check.sh
git add v2/ scripts/build-v2.sh && git commit -m "feat(v2): gridstack ızgara + düzenle modu + layout kaydet/yükle"
git push
```

- [ ] **Step 4: Pages'te /v2 canlı doğrula**

```bash
until curl -s -o /dev/null -w "%{http_code}" "https://bensenoint.github.io/benseno-tasarim-sistemi/v2/" | grep -q 200; do :; done
echo "✅ /v2 yayında"
```
Expected: `✅ /v2 yayında`

- [ ] **Step 5: Tarayıcı doğrulaması (manuel)**

`/v2/`'yi aç (giriş yapılmış). Beklenen: 5 widget gerçek veriyle dizili; "düzenle" → sürükle/boyutlandır;
"+ alan ekle" kalan widget'ları listeler; taşıyınca/silince layout PUT edilir; yenileyince korunur;
mobilde tek kolon. Konsolda hata yok (özellikle ReactDOM mount + gridstack init).

---

## Task 6: Ody sürüklenebilir avatar buton (kimlik)

**Files:**
- Create: `v2/app/ody.jsx`
- Modify: `v2/app/panom.jsx` (OdyV2 guard — Task 5 Step 2 notu zaten ekledi)

- [ ] **Step 1: ody.jsx — sürüklenebilir avatar + proaktif brief**

`v2/app/ody.jsx`:
```jsx
// Ody — sürüklenebilir avatar buton (sistem kimliği). Konum localStorage'da (bns_v2_ody_pos).
// Tıkla → proaktif brief paneli. Prod ChatBot brief deseninin v2 sürümü.
function OdyV2() {
  const [open, setOpen] = React.useState(false);
  const [brief, setBrief] = React.useState("");
  const [pos, setPos] = React.useState(() => {
    try { const p = JSON.parse(localStorage.getItem("bns_v2_ody_pos") || "null"); if (p) return p; } catch (e) {}
    return { x: 20, y: (typeof window !== "undefined" ? window.innerHeight - 80 : 600) };
  });
  const drag = React.useRef(null);
  const start = (e) => {
    const s = { mx: e.clientX, my: e.clientY, x: pos.x, y: pos.y, moved: false }; drag.current = s;
    const mv = (ev) => {
      const dx = ev.clientX - s.mx, dy = ev.clientY - s.my;
      if (Math.abs(dx) + Math.abs(dy) > 4) s.moved = true;
      setPos({ x: Math.min(Math.max(4, s.x + dx), innerWidth - 60), y: Math.min(Math.max(4, s.y + dy), innerHeight - 60) });
    };
    const up = () => {
      removeEventListener("pointermove", mv); removeEventListener("pointerup", up);
      setPos(p => { try { localStorage.setItem("bns_v2_ody_pos", JSON.stringify(p)); } catch (e) {} return p; });
    };
    addEventListener("pointermove", mv); addEventListener("pointerup", up);
  };
  React.useEffect(() => {
    const API = window.BNS_API_BASE || "https://benseno-api-production.up.railway.app";
    const tk = localStorage.getItem("bns_token") || "";
    fetch(API + "/api/chat", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + tk },
      body: JSON.stringify({ messages: [{ role: "user", content: "Bugünkü kısa kişisel özetim: aktif iş, riskli/gecikmiş, müşteride, kapasite. 3 madde, selamla." }] }) })
      .then(r => r.ok ? r.json() : null).then(j => { if (j && j.reply) setBrief(j.reply); }).catch(() => {});
  }, []);
  return React.createElement(React.Fragment, null,
    !open && React.createElement("button", {
      onPointerDown: start,
      onClick: () => { if (drag.current && drag.current.moved) { drag.current = null; return; } setOpen(true); },
      title: "Ody", style: { position: "fixed", left: pos.x, top: pos.y, zIndex: 90, width: 54, height: 54, borderRadius: "50%",
        border: 0, cursor: "grab", touchAction: "none", background: "var(--ember)", color: "#fff", fontSize: 24,
        display: "flex", alignItems: "center", justifyContent: "center" } }, "🐾"),
    open && React.createElement("div", { style: { position: "fixed", left: Math.min(pos.x, innerWidth - 340), top: Math.max(8, pos.y - 360),
        width: 320, maxHeight: 440, background: "var(--surface)", border: "0.5px solid var(--line)", borderRadius: 14,
        zIndex: 91, display: "flex", flexDirection: "column", overflow: "hidden" } },
      React.createElement("div", { style: { padding: "10px 12px", borderBottom: "0.5px solid var(--line)", display: "flex", alignItems: "center" } },
        React.createElement("span", { style: { font: "500 14px/1 var(--font-sans)" } }, "Ody"),
        React.createElement("button", { onClick: () => setOpen(false),
          style: { marginLeft: "auto", border: 0, background: "transparent", cursor: "pointer", color: "var(--ink-4)" } }, "✕")),
      React.createElement("div", { style: { padding: 12, overflow: "auto", font: "400 13px/1.5 var(--font-sans)", whiteSpace: "pre-wrap" } },
        brief || "Günaydın 👋")));
}
window.OdyV2 = OdyV2;
```

NOT: `/api/chat` endpoint'inin gerçek istek/yanıt şeklini prod ChatBot'tan doğrula
(`grep -n "/api/chat" server/api.js dashboard/app/*.jsx`). Beklenen alan `j.reply` değilse
(`j.text`/`j.message`) ona göre düzelt. authGuard'lıysa Bearer zaten gönderiliyor.

- [ ] **Step 2: panom.jsx OdyV2 guard'ını doğrula**

`v2/app/panom.jsx` içinde Ody satırı şu olmalı (Task 5 Step 2 notu uygulandıysa zaten budur):
```jsx
    window.OdyV2 ? React.createElement(window.OdyV2) : null,
```
Değilse düzelt.

- [ ] **Step 3: build + ci-check + commit + push**

```bash
bash scripts/build-v2.sh && bash scripts/ci-check.sh
git add v2/ && git commit -m "feat(v2): sürüklenebilir Ody avatar buton + proaktif brief (sistem kimliği)"
git push
```

- [ ] **Step 4: Pages doğrula + tarayıcı**

```bash
V=$(grep -o 'bundle.js?v=[0-9]*' v2/index.html | head -1)
until curl -s "https://bensenoint.github.io/benseno-tasarim-sistemi/v2/index.html" | grep -q "$V"; do :; done
echo "✅ /v2 güncel ($V)"
```
Beklenen: Ody avatarı sağ altta; sürüklenip taşınır (yenilemede konum korunur); tıklayınca brief açılır.

---

## Task 7: Uçtan uca doğrulama + dokümantasyon

**Files:**
- Modify: `docs/SISTEM-SEMASI.md`, `~/.claude/memory/MEMORY.md` (veya proje MEMORY)

- [ ] **Step 1: Tam doğrulama**

```bash
API="https://benseno-api-production.up.railway.app"
echo "layout token'sız: $(curl -s -o /dev/null -w '%{http_code}' "$API/api/layout") (401 beklenir)"
node scripts/v2-layout-test.js | tail -1
bash scripts/ci-check.sh | tail -1
node scripts/consistency-check.js | tail -1
```
Beklenen: 401 · layout testi geçti · CI geçti · consistency tüm checkler yeşil.

- [ ] **Step 2: SISTEM-SEMASI.md'ye v2 bölümü ekle**

`docs/SISTEM-SEMASI.md` sonuna yeni bölüm (mevcut başlık deseniyle): `/v2` Panom mimarisi —
gridstack widget panosu, widget kayıt defteri, `dashboard_layouts` + `/api/layout` (authGuard),
sürüklenebilir Ody, deploy: `npm run deploy api` + `bash scripts/build-v2.sh` + `git push`.
Sonra: `git add docs/SISTEM-SEMASI.md && git commit -m "docs(v2): Panom mimarisi şemaya eklendi" && git push`

- [ ] **Step 3: MEMORY notu**

MEMORY'ye kısa not: v2 Panom 1. KT canlı (/v2); deploy = API + build-v2.sh + push; gridstack;
/api/layout kişiye özel; widget'lar React, calc.js'ten okur.

---

## Self-Review (spec kapsamı)

- Spec §Mimari (`/v2`, calc.js/auth/embedded reuse, gridstack, JWT) → Task 1,3,5 ✅
- Spec §Widget Modeli (kayıt defteri, 5 çekirdek widget) → Task 4 ✅
- Spec §Düzenleme Modu (toggle, sürükle/boyutlandır, alan ekle) → Task 5 ✅
- Spec §Kalıcılık (`dashboard_layouts`, GET/PUT /api/layout, varsayılan) → Task 1,2,5 ✅
- Spec §Mobil (column(1) breakpoint) → Task 5 Step 1 (columnOpts breakpoints) ✅
- Spec §Ody (sürüklenebilir avatar, localStorage pos, proaktif brief) → Task 6 ✅
- Spec §Güvenlik (authGuard, calc.js tek kaynak, mock koruması) → Task 1 (authGuard), Task 4 (calc.js), data.js `__source=live_briefs` ✅
- Spec §Kapsam Dışı (prod'a dokunma, v2 yazma, rol bazlı) → korunuyor: yalnız yeni v2/ + additive API/data.js ✅

Tip tutarlılığı: `bnsV2DefaultLayout/Serialize/Validate/WIDGETS` (layout.js) ↔ panom.jsx kullanımları;
`BNS_V2_REGISTRY[type].Component` (widgets.jsx) ↔ panom.jsx `def.Component`; `window.OdyV2` (ody.jsx)
↔ panom.jsx guard. Eşleşiyor.

Doğrulanmamış varsayımlar (her ilgili task'ta NOT olarak işaretli, uygulama öncesi grep ile teyit edilecek):
auth payload alanı (`req.user.slack_id`), brief alan adları (`deltaH`/`durum`/`contributors`),
helper adları (`bnsHydrateBrief` vb.), `/api/chat` yanıt alanı (`j.reply`), tokens.css adı, CSP allowlist.
