# Profil Kişisel İş Kuyruğu + Otomatik Statü Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profil iş listesini, kişinin `contributor` olduğu işlerden oluşan sürükle-sıralanabilir bir kuyruğa çevirmek; kuyruk başı = aktif iş = `basladi`; tek-aktif/kişi (öncekini `beklemede`ye, çok-kişi koruması), bitince (`tamamlandi`/`musteride`) sıradakini otomatik `basladi` yapmak.

**Architecture:** `brief_assignees.kisi_sira` (kişisel sıra). Backend `setQueue` (sıra yaz + aktif/demote hesapla) ve `setStatus` içine otomatik-ilerleme. Tüm durum yazımları mevcut `setStatus` → `reflectChange` ile Slack'e yansır. Brief tek `durum` (Kanban değişmez). Profil'de masaüstü satır DnD (yalnız worker satırları).

**Tech Stack:** Node+Express+pg, React UMD + esbuild, node --test, ci-check.sh, deploy.sh.

---

## Genel kurallar
- `main`; push öncesi `git pull --rebase origin main`. Backend değişikliği → `deploy.sh api`. Frontend → Pages (build+push). `.nojekyll` mevcut (Pages Jekyll kapalı).
- dashboard/app ↔ v2/app senkron.
- Geçiş tablosu (aktive et): yeni/calisiliyor/beklemede/blokeli → `basladi`; incelemede/musteride → `revizyon`; tamamlandi → `basladi` (setStatus 'basladi' completed_at'i NULL'lar = reopen).
- Kuyruk-uygun durum = `durum NOT IN ('tamamlandi','musteride')`.

---

## Task 1: Migration — `brief_assignees.kisi_sira`

**Files:** Create `server/migrations/0005_brief_assignees_kisi_sira.sql`

- [ ] **Step 1:** Yaz:

```sql
-- Kişisel iş kuyruğu sırası (her atananın kendi sıralaması). brief-içi 'sira'dan farklı.
ALTER TABLE brief_assignees ADD COLUMN IF NOT EXISTS kisi_sira int;
CREATE INDEX IF NOT EXISTS brief_assignees_kisi_sira_idx ON brief_assignees (user_id, kisi_sira);
```

- [ ] **Step 2:** Uygula: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node server/scripts/migrate.js` → `✓ uygulandı: 0005_...`
- [ ] **Step 3:** Commit: `git add server/migrations/0005_brief_assignees_kisi_sira.sql && git commit -m "feat(db): brief_assignees.kisi_sira — kişisel iş kuyruğu sırası (migration 0005)"`

---

## Task 2: queries.js — workers'a kisi_sira ekle

**Files:** Modify `server/queries.js` (workers json_build_object ~satır 20 + workers map ~149)

- [ ] **Step 1:** `json_build_object(... 'sira',a.sira, ...)` içine `'kisi_sira', a.kisi_sira` ekle (her iki SELECT'te aynıysa tek paylaşımlı sorgudur — Task'taki grep ile doğrula: `grep -n "json_build_object" server/queries.js`).

```js
             json_build_object('id',u.id,'name',u.name,'role',a.role,'dept',u.dept,'initials',u.initials,'color',u.color,'sira',a.sira,'kisi_sira',a.kisi_sira,'onay_at',a.onay_at,'onay_by',a.onay_by)
```

- [ ] **Step 2:** workers map'ine `kisi_sira` ekle (satır ~149):

```js
    workers:   b.workers.map(w => ({ id: w.id, name: w.name, dept: w.dept || '', sira: w.sira ?? null, kisi_sira: w.kisi_sira ?? null, onay: !!w.onay_at, onay_by: w.onay_by || null })),
```

- [ ] **Step 3:** Doğrula: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node -e 'require("./server/queries").getEmbedded().then(e=>{console.log("ok", (e.bns_briefs[0].workers||[]).length>=0); process.exit(0)})'` → `ok true`
- [ ] **Step 4:** Commit: `git add server/queries.js && git commit -m "feat(api): workers payload'ına kisi_sira ekle"`

---

## Task 3: writes.js — setQueue + aktif/demote + otomatik-ilerleme

**Files:** Modify `server/writes.js` (yeni `setQueue`; `setStatus` sonuna auto-advance; exports)
**Test:** `server/queue.test.js`

- [ ] **Step 1: Failing test yaz** (`server/queue.test.js`)

```js
const { test } = require('node:test');
const assert = require('node:assert');
const w = require('./writes');

test('writes setQueue + queue yardımcıları export ediliyor', () => {
  assert.equal(typeof w.setQueue, 'function');
});
```

Run: `node --test server/queue.test.js` → FAIL (setQueue yok).

- [ ] **Step 2: setQueue + yardımcıları yaz** (`server/writes.js`'e ekle, `setStatus`'tan sonra)

```js
// Bir kullanıcının AKTİF brief'i = contributor olduğu, durumu kuyruk-uygun (tamamlandi/musteride
// DEĞİL) briefler içinde en küçük kisi_sira'lı olan. Yoksa null.
async function userActiveBriefId(client, uid) {
  const r = await client.query(
    `SELECT b.id FROM brief_assignees a JOIN briefs b ON b.id = a.brief_id
     WHERE a.user_id = $1 AND a.role = 'contributor' AND b.deleted_at IS NULL
       AND b.durum NOT IN ('tamamlandi','musteride')
     ORDER BY a.kisi_sira NULLS LAST, b.id LIMIT 1`, [uid]);
  return r.rows[0] ? r.rows[0].id : null;
}

// briefId, exceptUid DIŞINDA bir contributor için aktif (kuyruk başı) mı?
async function briefHasOtherActive(client, briefId, exceptUid) {
  const r = await client.query(
    `SELECT a.user_id FROM brief_assignees a
     WHERE a.brief_id = $1 AND a.role = 'contributor' AND a.user_id <> $2`, [briefId, exceptUid]);
  for (const row of r.rows) {
    if (await userActiveBriefId(client, row.user_id) === briefId) return true;
  }
  return false;
}

// Aktive etme: mevcut duruma göre hedef durum (geçiş tablosu) ve setStatus ile uygula.
function activateTarget(durum) {
  if (durum === 'incelemede' || durum === 'musteride') return 'revizyon';
  return 'basladi'; // yeni/calisiliyor/beklemede/blokeli/tamamlandi → basladi (tamamlandi reopen)
}

// Bir kullanıcının kuyruğunu yeniden sırala + aktif/demote hesapla.
// order: briefId dizisi (yalnız uid'in contributor olduğu işler dikkate alınır). by: işlemi yapan.
async function setQueue(uid, raw) {
  const order = Array.isArray(raw.order) ? raw.order.map(Number).filter(Boolean) : [];
  const by = raw.by || null;
  return await tx(async (client) => {
    // uid'in contributor olduğu (silinmemiş) brief'ler — yalnız bunları sırala.
    const owned = await client.query(
      `SELECT a.brief_id, b.durum FROM brief_assignees a JOIN briefs b ON b.id = a.brief_id
       WHERE a.user_id = $1 AND a.role = 'contributor' AND b.deleted_at IS NULL`, [uid]);
    const ownedIds = new Set(owned.rows.map(r => r.brief_id));
    const oldActive = await userActiveBriefId(client, uid);
    // kisi_sira yaz: order'daki worker-işleri index sırasıyla; order dışındakiler sona.
    let i = 0;
    for (const bid of order) {
      if (!ownedIds.has(bid)) continue;
      await client.query(
        `UPDATE brief_assignees SET kisi_sira = $1 WHERE user_id = $2 AND brief_id = $3 AND role = 'contributor'`,
        [i++, uid, bid]);
    }
    const newActive = await userActiveBriefId(client, uid);
    return { uid, oldActive, newActive };
  });
}
```

> **Not (uygulayıcıya):** `tx` (transaction sarmalayıcı) writes.js'te zaten kullanılıyor (`return await tx(async client => {...})` kalıbı; `createBrief`/`setStatus`'a bak). Aynı `tx`/`pool` helper'ını kullan. Yoksa `pool.connect()` + BEGIN/COMMIT ile sar.

- [ ] **Step 3: setQueue'yu durum geçişlerini de yapacak şekilde tamamla**

`setQueue`'nun `tx` bloğu içinde `newActive` hesaplandıktan SONRA, transaction DIŞINDA (tx döndükten sonra) durum geçişlerini `setStatus` ile uygula (setStatus kendi tx'ini + reflectChange'ini yönetir):

```js
async function setQueue(uid, raw) {
  const order = Array.isArray(raw.order) ? raw.order.map(Number).filter(Boolean) : [];
  const by = raw.by || null;
  const { oldActive, newActive } = await tx(async (client) => {
    const owned = await client.query(
      `SELECT a.brief_id FROM brief_assignees a JOIN briefs b ON b.id = a.brief_id
       WHERE a.user_id = $1 AND a.role = 'contributor' AND b.deleted_at IS NULL`, [uid]);
    const ownedIds = new Set(owned.rows.map(r => r.brief_id));
    const oldActive = await userActiveBriefId(client, uid);
    let i = 0;
    for (const bid of order) {
      if (!ownedIds.has(bid)) continue;
      await client.query(
        `UPDATE brief_assignees SET kisi_sira = $1 WHERE user_id = $2 AND brief_id = $3 AND role = 'contributor'`,
        [i++, uid, bid]);
    }
    const newActive = await userActiveBriefId(client, uid);
    return { oldActive, newActive };
  });
  if (newActive && newActive !== oldActive) {
    // Yeni aktif işi aktive et (geçiş tablosu)
    const cur = await pool.query('SELECT durum FROM briefs WHERE id=$1', [newActive]);
    if (cur.rows[0]) await setStatus(newActive, { durum: activateTarget(cur.rows[0].durum), by, source: 'dashboard' });
    // Önceki aktif → başka aktif contributor yoksa beklemede
    if (oldActive) {
      const o = await pool.query('SELECT durum FROM briefs WHERE id=$1', [oldActive]);
      if (o.rows[0] && o.rows[0].durum === 'basladi') {
        const hasOther = await (async () => { const c = await pool.connect(); try { return await briefHasOtherActive(c, oldActive, uid); } finally { c.release(); } })();
        if (!hasOther) await setStatus(oldActive, { durum: 'beklemede', by, source: 'system' });
      }
    }
  }
  return { ok: true, oldActive, newActive };
}
```

> **Not:** `tx` ve `pool` writes.js'te tanımlı/erişilebilir olmalı. `briefHasOtherActive` bir client gerektirir; yukarıda kısa bir connect ile sarıldı. Daha temizse `briefHasOtherActive`'i `pool` kullanan bir sürümle yaz.

- [ ] **Step 4: Otomatik ilerleme — setStatus tamamlandi/musteride olunca**

`setStatus`'un sonunda (return'den ÖNCE, `reflectChange`'ten sonra), brief `tamamlandi` veya `musteride` olduysa, o brief'in contributor'larından aktifini kaybedenler için sıradakini aktive et:

```js
  // Otomatik ilerleme: bu brief tamamlandi/musteride olduysa, onu aktif işi yapan
  // contributor'lar için sıradaki kuyruk işini aktive et. source:'system' → echo/loop koruması.
  if ((d.durum === 'tamamlandi' || d.durum === 'musteride') && d.source !== 'system') {
    const cont = await pool.query(
      `SELECT user_id FROM brief_assignees WHERE brief_id=$1 AND role='contributor'`, [id]);
    for (const row of cont.rows) {
      const nextId = await (async () => { const c = await pool.connect(); try { return await userActiveBriefId(c, row.user_id); } finally { c.release(); } })();
      if (nextId && nextId !== id) {
        const nb = await pool.query('SELECT durum FROM briefs WHERE id=$1', [nextId]);
        if (nb.rows[0] && nb.rows[0].durum !== 'basladi') {
          await setStatus(nextId, { durum: activateTarget(nb.rows[0].durum), by: d.by, source: 'system' });
        }
      }
    }
  }
```

> **Not:** Bu blok `setStatus` fonksiyonunun İÇİNDE, ana `tx` döndükten ve `reflectChange` çağrıldıktan sonra olmalı (setStatus'un `res` döndürmesinden hemen önce). `source:'system'` özyinelemeyi keser.

- [ ] **Step 5: exports'a setQueue ekle**

`module.exports = { ... }` satırına `setQueue` ekle.

- [ ] **Step 6: Test geç + syntax**

`node --test server/queue.test.js` → PASS; `node --check server/writes.js` → sessiz.

- [ ] **Step 7: Commit**

```bash
git add server/writes.js server/queue.test.js
git commit -m "feat(api): setQueue + aktif/demote (çok-kişi korumalı) + setStatus otomatik-ilerleme (tamamlandi/musteride→sıradaki basladi)"
```

---

## Task 4: api.js — POST /api/users/:uid/queue

**Files:** Modify `server/api.js` (route ekle, /api/briefs route'larının yanına ~213)

- [ ] **Step 1: Route ekle**

```js
// Kişisel iş kuyruğu sırası — yalnız kişinin kendisi veya admin. Body: { order: [briefId,...] }.
app.post('/api/users/:uid/queue', auth.authGuard, handleWrite(async req => {
  const uid = req.params.uid;
  const isSelf = req.user && (req.user.id === uid || req.user.slack_id === uid);
  const isAdmin = req.user && req.user.role === 'admin';
  if (!isSelf && !isAdmin) { const e = new Error('yetkisiz: yalnız kişinin kendisi veya yönetici'); e.name = 'ZodError'; e.issues = [{ path: ['yetki'] }]; throw e; }
  return writes.setQueue(uid, { order: req.body?.order, by: req.user.id });
}));
```

> **Not:** Yetki reddini 400/403'e çevirmek için `handleWrite`'ın hata→kod mantığına bak; gerekiyorsa düz `res.status(403)` ile ayrı yaz. `auth.adminGuard` yalnız-admin; burada self VEYA admin gerektiği için authGuard + elle kontrol kullanılır.

- [ ] **Step 2: Syntax + manuel**

`node --check server/api.js` → sessiz.

- [ ] **Step 3: Commit**

```bash
git add server/api.js
git commit -m "feat(api): POST /api/users/:uid/queue — kişisel kuyruk sırası (self/admin yetki)"
```

---

## Task 5: Profil — satır sürükle-sırala (worker-only) + aktif vurgusu

**Files:** Modify `dashboard/app/screens/Profile.jsx`

- [ ] **Step 1: İş tablosu satırlarını DnD yap (yalnız 'aktif' görünüm + worker satırları, masaüstü)**

Profil ana iş tablosu `displayRows`'u BriefTable ile render ediyor. Kuyruk DnD'si için `jobView === "aktif"` görünümünde, viewedUser'ın `contributor` olduğu satırları sürüklenebilir yap. Worker olup olmadığı: `b.workers?.some(w => w.id === u.id)` (lead/gözlemci → false → kilitli).

`displayRows` BriefTable yerine, `jobView==="aktif"` iken kuyruk-DnD listesi render et (mevcut tablo dışında basit sıralı liste). Pragmatik: `jobView==="aktif"` görünümünde satırları kendi DnD listesiyle göster; diğer görünümlerde mevcut BriefTable kalsın.

```jsx
  const isWorker = (b) => Array.isArray(b.workers) && b.workers.some(w => w.id === u.id);
  const canReorder = (currentUser?.role === "admin") || (currentUser && (currentUser.slack_id === u.id || currentUser.id === u.id));
  const [qDragId, setQDragId] = React.useState(null);
  const reorderQueue = (fromId, toId) => {
    // displayRows içinde fromId'yi toId'nin önüne taşı → yeni order → API
    const ids = displayRows.map(b => b.id);
    const fi = ids.indexOf(fromId), ti = ids.indexOf(toId);
    if (fi < 0 || ti < 0 || fi === ti) return;
    ids.splice(ti, 0, ids.splice(fi, 1)[0]);
    const API = window.BNS_API_BASE || "https://benseno-api-production.up.railway.app";
    const tok = (typeof localStorage !== "undefined" && localStorage.getItem("bns_token")) || "";
    fetch(`${API}/api/users/${u.id}/queue`, {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + tok },
      body: JSON.stringify({ order: ids }),
    }).then(r => { if (r.ok && window.bnsRefresh) window.bnsRefresh(); }).catch(() => {});
  };
```

> **Not (uygulayıcıya):** Profil iş tablosunun TAM render yapısını oku (`displayRows`, `curView.completed`, BriefTable kullanımı). `jobView==="aktif"` görünümünde sürükle-bırak satır listesi uygula: her satır `draggable={!isMobile && canReorder && isWorker(b)}`, `onDragStart`→setQDragId(b.id), kolon yerine satır hedefi: `onDragOver` preventDefault, `onDrop`→`reorderQueue(qDragId, b.id)`. En üstteki worker-aktif satıra "● şu an" rozeti. Lead/gözlemci satırları sürüklenemez (draggable=false). Diğer görünümler (lead/aldığım/gözlemci/tamamlanan) DOKUNULMAZ.

- [ ] **Step 2: Aktif (kuyruk başı) vurgusu**

`jobView==="aktif"` listesinde ilk worker satırına görsel rozet ekle: `{idx === 0 && isWorker(b) && <span style={{font:"600 10px/1 var(--font-sans)", color:"var(--ok,#2E8F66)"}}>● şu an</span>}`.

- [ ] **Step 3: CI**

`bash scripts/ci-check.sh 2>&1 | tail -1` → `🟢 CI KAPISI GEÇTİ`

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/screens/Profile.jsx
git commit -m "feat(profile): kişisel iş kuyruğu — aktif görünümde worker satırları sürükle-sırala (lead/gözlemci kilitli), aktif vurgusu, /queue endpoint"
```

---

## Task 6: v2 senkron + build + deploy + doğrulama

- [ ] **Step 1:** Migration prod'a uygulandı mı doğrula (Task 1). v2 Profile senkronla: `cp dashboard/app/screens/Profile.jsx v2/app/screens/Profile.jsx`
- [ ] **Step 2:** `bash scripts/ci-check.sh 2>&1 | tail -1 && bash scripts/build-dashboard.sh 2>&1 | tail -1 && bash scripts/build-v2.sh 2>&1 | tail -1`
- [ ] **Step 3:** `git add -A && git commit -m "chore: kişisel iş kuyruğu — v2 senkron + build" && git pull --rebase origin main && git push`
- [ ] **Step 4:** API deploy: `bash scripts/deploy.sh api 2>&1 | grep -iE "tetiklendi|GEÇTİ|geçti, |kaldı|tamam"` → tutarlılık + eval temiz. SUCCESS bekle: `until railway deployment list --service benseno-api 2>/dev/null | sed -n '2p' | grep -q SUCCESS; do sleep 10; done`
- [ ] **Step 5: Manuel doğrulama (canlı)**
  - Bir kişinin profilinde "Aktif işler" görünümünde worker olduğu bir işi en üste sürükle → durum `basladi` olmalı; Kanban'da `İşe başlandı`; Slack thread'ine durum notu.
  - Önceki aktif iş `beklemede`ye düşmeli (o işte başka aktif contributor yoksa).
  - Aktif işi `tamamlandi`/`musteride` yap → kişinin sıradaki worker-işi otomatik `basladi` olmalı.
  - Lead/gözlemci olduğu satır sürüklenememeli.

---

## Self-Review notları

- **Spec kapsama:** kisi_sira (T1), payload (T2), setQueue+aktif/demote+çok-kişi+otomatik-ilerleme (T3), route+yetki (T4), Profil DnD worker-only+aktif vurgusu (T5), deploy/doğrulama (T6) — hepsi karşılanıyor.
- **Geçiş tablosu:** `activateTarget` tek kaynak; tamamlandi→basladi reopen'u setStatus'un `completed_at = CASE ... ELSE NULL` davranışıyla sağlanır (basladi seçilince NULL).
- **Echo/loop koruması:** otomatik geçişler `source:'system'`; setStatus auto-advance bloğu `d.source !== 'system'` ile korunur.
- **Kanban/Slack:** değişmez (brief.durum + reflectChange yeniden kullanımı).
- **Riskli/uygulamada doğrulanacak:** `tx`/`pool` helper adları (writes.js'teki gerçek kalıba uय), queries tek-paylaşımlı SELECT (T2 grep), handleWrite yetki-reddi kodu (T4), Profil iş tablosunun gerçek render yapısı (T5 notu). Bunlar uygulayıcı tarafından dosya okunarak teyit edilecek.
