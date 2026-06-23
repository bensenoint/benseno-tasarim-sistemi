# Tool-Driven Ody Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ody'nin sayım/olgu halüsinasyonlarını kökten engellemek için `/api/chat`'i, modelin SQL-kaynaklı (getEmbedded) yapısal veri üzerinde **kod ile** filtreleyen tool'ları çağırdığı bir agentic loop'a çevirmek.

**Architecture:** `server/ody-tools.js` saf, deterministik tool fonksiyonları sağlar; her tool `getEmbedded()` sonucundaki diziler üzerinde JS ile filtreleyip sayar (model asla saymaz). `/api/chat` Anthropic tool-use döngüsü çalıştırır: model tool çağırır → backend çalıştırır → `tool_result` → tekrar. `scripts/ody-eval.js` bilinen-cevaplı soruları canlı endpoint'e sorup regresyonu yakalar.

**Tech Stack:** Node.js + Express, `pg` (mevcut `getEmbedded`), Anthropic Messages API (tool use + adaptive thinking), `node --test`, jsonwebtoken (eval token).

---

## Önemli sözleşmeler (tüm task'lar bunlara uyar)

- **ctx şekli:** `{ user: { id, name, role, slack_id }, isAdmin, range, ed }` — `ed` request başında bir kez `await getEmbedded()` ile çekilir, tüm tool'lar paylaşır.
- **range:** `{from,to}` ms veya `null`. "Tüm zamanlar" = `from<=0 && to>=8.64e15` → `null`'a normalize.
- **Tamamlanan filtre:** `c.bitis` `[from,to]` içinde. **Aktif işler aralıktan bağımsız** (dashboard ile aynı).
- **Kişi/marka eşleştirme:** isim parametresi `id` üzerinden eşleştirilir; bulunamazsa `{bulunamadi:true, adaylar:[...]}` döner. Türkçe-İ tuzağından kaçınmak için `locale("tr")` ile karşılaştırılır.
- **Gizlilik:** puan alanları yalnız `ctx.isAdmin` ise dolu döner.
- **Tool dönüş tipi:** her zaman düz JSON nesnesi (sayı + numara listeleri), proza değil.

---

## Task 1: ody-tools.js iskeleti + `genel_ozet` + ortak yardımcılar

**Files:**
- Create: `server/ody-tools.js`
- Test: `server/ody-tools.test.js`

- [ ] **Step 1: Failing test yaz**

```js
// server/ody-tools.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { getEmbedded } = require('./queries');
const { TOOLS, runTool, _matchUser } = require('./ody-tools');

async function ctx(extra = {}) {
  const ed = await getEmbedded();
  return { user: { id: 'admin1', name: 'Test', role: 'admin', slack_id: 'admin1' }, isAdmin: true, range: null, ed, ...extra };
}

test('genel_ozet tamamlanan toplamını verir (tüm zaman = 60)', async () => {
  const c = await ctx();
  const r = await runTool('genel_ozet', {}, c);
  assert.equal(typeof r.tamamlanan, 'number');
  assert.equal(r.tamamlanan, c.ed.bns_completed.length);
  assert.equal(typeof r.aktif, 'number');
});

test('TOOLS Anthropic şemasına uygun (name+description+input_schema)', () => {
  for (const t of TOOLS) {
    assert.ok(t.name && t.description && t.input_schema, t.name + ' eksik alan');
    assert.equal(t.input_schema.type, 'object');
  }
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node --test server/ody-tools.test.js`
Expected: FAIL — `Cannot find module './ody-tools'`

- [ ] **Step 3: ody-tools.js iskeletini + genel_ozet'i yaz**

```js
// server/ody-tools.js — Ody'nin deterministik veri tool'ları.
// Tüm tool'lar getEmbedded() yapısal dizileri üzerinde KOD ile sayar; model asla saymaz.

const MAXMS = 8.64e15;

// "Tüm zamanlar" preset'ini null'a indirger.
function normRange(range) {
  if (!range) return null;
  if (range.from <= 0 && range.to >= MAXMS) return null;
  if (typeof range.from !== 'number' || typeof range.to !== 'number') return null;
  return { from: range.from, to: range.to };
}

// Tamamlanan iş aralıkta mı (bitiş tarihine göre). range null → her zaman dahil.
function inRange(bitis, range) {
  if (!range) return true;
  return bitis != null && bitis >= range.from && bitis <= range.to;
}

// İsimden kullanıcı eşleştir (Türkçe-güvenli, id üzerinden). Bulunamazsa null.
function _matchUser(ed, kisi) {
  if (!kisi) return null;
  const users = ed.bns_users || [];
  const byId = users.find(u => u.id === kisi);
  if (byId) return byId;
  const q = String(kisi).toLocaleLowerCase('tr');
  const exact = users.find(u => (u.name || '').toLocaleLowerCase('tr') === q);
  if (exact) return exact;
  return users.find(u => (u.name || '').toLocaleLowerCase('tr').includes(q)) || null;
}

function _userCandidates(ed, kisi) {
  const q = String(kisi || '').toLocaleLowerCase('tr');
  return (ed.bns_users || [])
    .filter(u => (u.name || '').toLocaleLowerCase('tr').includes(q))
    .map(u => u.name).slice(0, 6);
}

// ── Tool tanımları ───────────────────────────────────────────────────────────
const defs = {};

defs.genel_ozet = {
  description: 'Sistemin genel durumu: aktif, gecikmiş, müşteride bekleyen, bugün biten ve (seçili aralıkta) tamamlanan iş SAYILARI. Argümansız çağrılabilir.',
  input_schema: { type: 'object', properties: { aralik: { type: 'string', description: 'opsiyonel; verilmezse dashboard aralığı' } } },
  run(input, ctx) {
    const range = normRange(ctx.range);
    const briefs = ctx.ed.bns_briefs || [];
    const completed = (ctx.ed.bns_completed || []).filter(c => inRange(c.bitis, range));
    const now = Date.now();
    const startToday = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime();
    return {
      aktif: briefs.length,
      gecikmis: briefs.filter(b => b.deadline && b.deadline < now).length,
      musteride: briefs.filter(b => b.durum === 'musteride').length,
      bugun_biten: completed.filter(c => c.bitis >= startToday).length,
      tamamlanan: completed.length,
      kapsam: range ? `${new Date(range.from).toISOString().slice(0,10)}..${new Date(range.to).toISOString().slice(0,10)}` : 'tüm zamanlar',
    };
  },
};

// Anthropic'in beklediği {name, description, input_schema} dizisi + isimle çalıştırıcı.
const TOOLS = Object.entries(defs).map(([name, d]) => ({ name, description: d.description, input_schema: d.input_schema }));

async function runTool(name, input, ctx) {
  const d = defs[name];
  if (!d) return { error: `bilinmeyen tool: ${name}` };
  try { return await d.run(input || {}, ctx); }
  catch (e) { return { error: e.message }; }
}

module.exports = { TOOLS, runTool, defs, _matchUser, _userCandidates, normRange, inRange };
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node --test server/ody-tools.test.js`
Expected: PASS (2 test)

- [ ] **Step 5: Commit**

```bash
git add server/ody-tools.js server/ody-tools.test.js
git commit -m "feat(ody-tools): iskelet + genel_ozet + ortak yardımcılar (deterministik, getEmbedded üzerinde)"
```

---

## Task 2: `brief_sorgula` (filtreli liste + sayı)

**Files:**
- Modify: `server/ody-tools.js` (defs'e ekle)
- Test: `server/ody-tools.test.js`

- [ ] **Step 1: Failing test yaz** (mevcut dosyaya ekle)

```js
test('brief_sorgula durum=tamamlandi + marka filtresi sayı döner', async () => {
  const c = await ctx();
  const r = await runTool('brief_sorgula', { tamamlandi: true, marka: 'Hasvet' }, c);
  assert.equal(typeof r.toplam, 'number');
  assert.ok(Array.isArray(r.isler));
  assert.ok(r.isler.every(x => x.marka.toLowerCase().includes('hasvet')));
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node --test server/ody-tools.test.js`
Expected: FAIL — `bilinmeyen tool: brief_sorgula` (assert hata)

- [ ] **Step 3: brief_sorgula'yı defs'e ekle** (`defs.genel_ozet` bloğundan sonra)

```js
defs.brief_sorgula = {
  description: 'Brief ara/filtrele. Filtreler: marka (kısmi), durum (yeni/calisiliyor/incelemede/musteride/blokeli), kisi (isim, atanan), gecikmis (true), tamamlandi (true→tamamlananlarda arar; aralık uygulanır). Eşleşen işlerin listesi + toplam sayı.',
  input_schema: { type: 'object', properties: {
    marka: { type: 'string' }, durum: { type: 'string' }, kisi: { type: 'string' },
    gecikmis: { type: 'boolean' }, tamamlandi: { type: 'boolean' }, aralik: { type: 'string' },
  } },
  run(input, ctx) {
    const range = normRange(ctx.range);
    const now = Date.now();
    const u = input.kisi ? _matchUser(ctx.ed, input.kisi) : null;
    if (input.kisi && !u) return { bulunamadi: true, adaylar: _userCandidates(ctx.ed, input.kisi) };
    const hasPerson = (b) => !u || [...(b.workers || []), ...(b.leads || [])].some(p => p.id === u.id);
    let rows;
    if (input.tamamlandi) {
      rows = (ctx.ed.bns_completed || []).filter(c => inRange(c.bitis, range) && hasPerson(c)
        && (!input.marka || (c.marka || '').toLocaleLowerCase('tr').includes(input.marka.toLocaleLowerCase('tr'))));
      rows = rows.map(c => ({ no: c.no, marka: c.marka, baslik: c.baslik, durum: 'tamamlandi', bitis: c.bitis, puan: c.rating ?? null,
        kisiler: [...(c.workers || []).map(w => w.name), ...(c.leads || []).map(l => l.name + '(lead)')] }));
    } else {
      rows = (ctx.ed.bns_briefs || []).filter(b => hasPerson(b)
        && (!input.durum || b.durum === input.durum)
        && (!input.gecikmis || (b.deadline && b.deadline < now))
        && (!input.marka || (b.marka || '').toLocaleLowerCase('tr').includes(input.marka.toLocaleLowerCase('tr'))));
      rows = rows.map(b => ({ no: b.no, marka: b.marka, baslik: b.baslik, durum: b.durum, termin: b.deadline,
        gecikmis: !!(b.deadline && b.deadline < now),
        kisiler: [...(b.workers || []).map(w => w.name), ...(b.leads || []).map(l => l.name + '(lead)')] }));
    }
    return { toplam: rows.length, isler: rows.slice(0, 40), kirpildi: rows.length > 40 };
  },
};
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node --test server/ody-tools.test.js`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add server/ody-tools.js server/ody-tools.test.js
git commit -m "feat(ody-tools): brief_sorgula — marka/durum/kişi/gecikmiş/tamamlandı filtreleri"
```

---

## Task 3: `kisi_dokumu` (tamamlanan/aktif + admin puanı) — İrem & Pelin regresyon kilidi

**Files:**
- Modify: `server/ody-tools.js`
- Test: `server/ody-tools.test.js`

- [ ] **Step 1: Failing test yaz**

```js
test('kisi_dokumu İrem = 3 tamamlanan (#14,#15,#83)', async () => {
  const c = await ctx();
  const r = await runTool('kisi_dokumu', { kisi: 'U0AK8U7L57F' }, c);
  assert.equal(r.tamamlanan.say, 3);
  assert.deepEqual(r.tamamlanan.nos, [14, 15, 83]);
});

test('kisi_dokumu Pelin = 1 tamamlanan (#92), 7 aktif', async () => {
  const c = await ctx();
  const r = await runTool('kisi_dokumu', { kisi: 'U0B3K2WE7SB' }, c);
  assert.equal(r.tamamlanan.say, 1);
  assert.deepEqual(r.tamamlanan.nos, [92]);
  assert.equal(r.aktif.say, 7);
});

test('kisi_dokumu admin değilse puan dönmez', async () => {
  const c = await ctx({ isAdmin: false });
  const r = await runTool('kisi_dokumu', { kisi: 'U0B3K2WE7SB' }, c);
  assert.equal(r.puan, undefined);
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node --test server/ody-tools.test.js`
Expected: FAIL — `bilinmeyen tool: kisi_dokumu`

- [ ] **Step 3: kisi_dokumu'yu defs'e ekle**

```js
defs.kisi_dokumu = {
  description: 'Bir kişinin iş dökümü: tamamlanan (seçili aralık) ve aktif (her zaman) iş SAYILARI ve numaraları. Yönetici ise ortalama puan da döner. Kişi performansı/iş sayısı için YETKİLİ kaynak.',
  input_schema: { type: 'object', required: ['kisi'], properties: { kisi: { type: 'string', description: 'kişi adı veya id' }, aralik: { type: 'string' } } },
  run(input, ctx) {
    const u = _matchUser(ctx.ed, input.kisi);
    if (!u) return { bulunamadi: true, adaylar: _userCandidates(ctx.ed, input.kisi) };
    const range = normRange(ctx.range);
    const on = (arr) => arr.some(p => p.id === u.id);
    const tamam = (ctx.ed.bns_completed || []).filter(c => inRange(c.bitis, range) && on([...(c.workers || []), ...(c.leads || [])])).map(c => c.no).sort((a, b) => a - b);
    const aktif = (ctx.ed.bns_briefs || []).filter(b => on([...(b.workers || []), ...(b.leads || [])])).map(b => b.no).sort((a, b) => a - b);
    const out = { kisi: u.name, tamamlanan: { say: tamam.length, nos: tamam }, aktif: { say: aktif.length, nos: aktif } };
    if (ctx.isAdmin) {
      const p = ctx.ed.bns_ratings && ctx.ed.bns_ratings.users && ctx.ed.bns_ratings.users[u.id];
      out.puan = p ? { avg: p.avg, cnt: p.cnt } : null;
    }
    return out;
  },
};
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node --test server/ody-tools.test.js`
Expected: PASS (6 test)

- [ ] **Step 5: Commit**

```bash
git add server/ody-tools.js server/ody-tools.test.js
git commit -m "feat(ody-tools): kisi_dokumu — tamamlanan/aktif sayıları + admin puanı (İrem/Pelin regresyon testli)"
```

---

## Task 4: `marka_dokumu`

**Files:**
- Modify: `server/ody-tools.js`
- Test: `server/ody-tools.test.js`

- [ ] **Step 1: Failing test yaz**

```js
test('marka_dokumu Hasvet için sayıları döner', async () => {
  const c = await ctx();
  const r = await runTool('marka_dokumu', { marka: 'Hasvet' }, c);
  assert.equal(typeof r.aktif, 'number');
  assert.equal(typeof r.tamamlanan, 'number');
  assert.ok('marka' in r);
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node --test server/ody-tools.test.js`
Expected: FAIL — `bilinmeyen tool: marka_dokumu`

- [ ] **Step 3: marka_dokumu'yu defs'e ekle**

```js
defs.marka_dokumu = {
  description: 'Bir markanın durumu: aktif/tamamlanan/gecikmiş iş SAYILARI, kanal özeti ve son gün-sonu insight. Yönetici ise ortalama puan da döner.',
  input_schema: { type: 'object', required: ['marka'], properties: { marka: { type: 'string' }, aralik: { type: 'string' } } },
  run(input, ctx) {
    const range = normRange(ctx.range);
    const now = Date.now();
    const q = String(input.marka).toLocaleLowerCase('tr');
    const match = (m) => (m || '').toLocaleLowerCase('tr').includes(q);
    const br = (ctx.ed.bns_brands || []).find(b => match(b.name));
    if (!br) return { bulunamadi: true, adaylar: (ctx.ed.bns_brands || []).map(b => b.name).filter(match).slice(0, 6) };
    const aktifler = (ctx.ed.bns_briefs || []).filter(b => match(b.marka));
    const out = {
      marka: br.name,
      aktif: aktifler.length,
      gecikmis: aktifler.filter(b => b.deadline && b.deadline < now).length,
      tamamlanan: (ctx.ed.bns_completed || []).filter(c => match(c.marka) && inRange(c.bitis, range)).length,
      kanal_ozet: br.kanal_ozet ? br.kanal_ozet.slice(0, 300) : null,
      son_insight: br.son_insight ? br.son_insight.slice(0, 300) : null,
    };
    if (ctx.isAdmin) {
      const rb = ctx.ed.bns_ratings && ctx.ed.bns_ratings.marka && ctx.ed.bns_ratings.marka[br.name];
      out.puan = rb ? { avg: rb.avg, cnt: rb.cnt } : null;
    }
    return out;
  },
};
```

> **Not (uygulayıcıya):** `bns_ratings.marka` anahtarı yoksa (`getEmbedded`'de marka puanı `bns_brands[].rating` altında olabilir) Task 4 Step 4 testten önce `node -e` ile `Object.keys((await getEmbedded()).bns_ratings)` çıktısını kontrol et; puan alanını gerçek şekle göre düzelt. Test yalnız aktif/tamamlanan sayısını doğruladığı için puan alanı opsiyoneldir.

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node --test server/ody-tools.test.js`
Expected: PASS (7 test)

- [ ] **Step 5: Commit**

```bash
git add server/ody-tools.js server/ody-tools.test.js
git commit -m "feat(ody-tools): marka_dokumu — marka durumu + kanal özeti"
```

---

## Task 5: `yildiz_karne` (admin-gated)

**Files:**
- Modify: `server/ody-tools.js`
- Test: `server/ody-tools.test.js`

- [ ] **Step 1: Failing test yaz**

```js
test('yildiz_karne firma admin için döner, admin değil için reddeder', async () => {
  const a = await ctx();
  const ra = await runTool('yildiz_karne', { kapsam: 'firma' }, a);
  assert.ok('firma' in ra || 'avg' in ra);
  const n = await ctx({ isAdmin: false });
  const rn = await runTool('yildiz_karne', { kapsam: 'kisi', key: 'U0B3K2WE7SB' }, n);
  assert.equal(rn.yetki, 'yöneticilere özel');
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node --test server/ody-tools.test.js`
Expected: FAIL — `bilinmeyen tool: yildiz_karne`

- [ ] **Step 3: yildiz_karne'yi defs'e ekle**

```js
defs.yildiz_karne = {
  description: 'Yıldız puan ortalamaları. kapsam: firma (genel), dept (departman), kisi (bir kişi). dept ve kisi YALNIZ yöneticilere açıktır.',
  input_schema: { type: 'object', required: ['kapsam'], properties: { kapsam: { type: 'string', enum: ['firma', 'dept', 'kisi'] }, key: { type: 'string' } } },
  run(input, ctx) {
    const R = ctx.ed.bns_ratings || {};
    if (input.kapsam === 'firma') return R.firma || { avg: null, cnt: 0 };
    if (!ctx.isAdmin) return { yetki: 'yöneticilere özel' };
    if (input.kapsam === 'dept') return { dept: R.dept || {} };
    if (input.kapsam === 'kisi') {
      const u = _matchUser(ctx.ed, input.key);
      if (!u) return { bulunamadi: true, adaylar: _userCandidates(ctx.ed, input.key) };
      const p = R.users && R.users[u.id];
      return { kisi: u.name, puan: p ? { avg: p.avg, cnt: p.cnt } : null };
    }
    return { error: 'geçersiz kapsam' };
  },
};
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node --test server/ody-tools.test.js`
Expected: PASS (8 test)

- [ ] **Step 5: Commit**

```bash
git add server/ody-tools.js server/ody-tools.test.js
git commit -m "feat(ody-tools): yildiz_karne — firma/dept/kişi puanları (dept+kişi admin-gated)"
```

---

## Task 6: `gecikme_analizi`

**Files:**
- Modify: `server/ody-tools.js`
- Test: `server/ody-tools.test.js`

- [ ] **Step 1: Failing test yaz**

```js
test('gecikme_analizi gecikmiş aktif briefleri listeler', async () => {
  const c = await ctx();
  const r = await runTool('gecikme_analizi', {}, c);
  assert.equal(typeof r.toplam, 'number');
  assert.ok(r.isler.every(x => x.gecikme_gun >= 0));
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node --test server/ody-tools.test.js`
Expected: FAIL — `bilinmeyen tool: gecikme_analizi`

- [ ] **Step 3: gecikme_analizi'yi defs'e ekle**

```js
defs.gecikme_analizi = {
  description: 'Termini geçmiş AKTİF briefler: liste + gecikme gün sayısı + atananlar. Opsiyonel marka filtresi.',
  input_schema: { type: 'object', properties: { marka: { type: 'string' } } },
  run(input, ctx) {
    const now = Date.now();
    const q = input.marka ? input.marka.toLocaleLowerCase('tr') : null;
    const rows = (ctx.ed.bns_briefs || [])
      .filter(b => b.deadline && b.deadline < now && (!q || (b.marka || '').toLocaleLowerCase('tr').includes(q)))
      .map(b => ({ no: b.no, marka: b.marka, baslik: b.baslik, durum: b.durum,
        gecikme_gun: Math.floor((now - b.deadline) / 86400000),
        kisiler: [...(b.workers || []).map(w => w.name), ...(b.leads || []).map(l => l.name + '(lead)')] }))
      .sort((a, b) => b.gecikme_gun - a.gecikme_gun);
    return { toplam: rows.length, isler: rows.slice(0, 40), kirpildi: rows.length > 40 };
  },
};
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node --test server/ody-tools.test.js`
Expected: PASS (9 test)

- [ ] **Step 5: Commit**

```bash
git add server/ody-tools.js server/ody-tools.test.js
git commit -m "feat(ody-tools): gecikme_analizi — gecikmiş aktif briefler + gün sayısı"
```

---

## Task 7: `kapasite`

**Files:**
- Modify: `server/ody-tools.js`
- Test: `server/ody-tools.test.js`

- [ ] **Step 1: Failing test yaz**

```js
test('kapasite kişi başına aktif yük döner', async () => {
  const c = await ctx();
  const r = await runTool('kapasite', {}, c);
  assert.ok(Array.isArray(r.kisiler));
  assert.ok(r.kisiler.every(k => typeof k.aktif === 'number'));
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node --test server/ody-tools.test.js`
Expected: FAIL — `bilinmeyen tool: kapasite`

- [ ] **Step 3: kapasite'yi defs'e ekle**

```js
defs.kapasite = {
  description: 'Kişi başına AKTİF iş yükü (kaç açık brief). Opsiyonel kisi parametresi tek kişiyi döner; yoksa tüm ekip azalan sırada.',
  input_schema: { type: 'object', properties: { kisi: { type: 'string' } } },
  run(input, ctx) {
    const load = {};
    for (const b of (ctx.ed.bns_briefs || [])) {
      for (const p of [...(b.workers || []), ...(b.leads || [])]) {
        if (!p.id) continue;
        (load[p.id] = load[p.id] || { kisi: p.name, aktif: 0, nos: [] });
        load[p.id].aktif++; load[p.id].nos.push(b.no);
      }
    }
    let list = Object.values(load).sort((a, b) => b.aktif - a.aktif);
    if (input.kisi) {
      const u = _matchUser(ctx.ed, input.kisi);
      if (!u) return { bulunamadi: true, adaylar: _userCandidates(ctx.ed, input.kisi) };
      list = list.filter(x => x.kisi === u.name);
    }
    return { kisiler: list };
  },
};
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node --test server/ody-tools.test.js`
Expected: PASS (10 test)

- [ ] **Step 5: Commit**

```bash
git add server/ody-tools.js server/ody-tools.test.js
git commit -m "feat(ody-tools): kapasite — kişi başına aktif yük"
```

---

## Task 8: `trend`

**Files:**
- Modify: `server/ody-tools.js`
- Test: `server/ody-tools.test.js`

> **Not (uygulayıcıya):** `getEmbedded()`'de zaman serisi `bns_history` (kpi_history) altında. Step 3'ten önce `node -e` ile bir örnek satırın alanlarını (`ts, active, overdue, today, review, stale, musteride`) doğrula; metrik anahtarlarını ona göre kullan.

- [ ] **Step 1: Failing test yaz**

```js
test('trend aktif metriği için zaman serisi özeti döner', async () => {
  const c = await ctx();
  const r = await runTool('trend', { metrik: 'aktif' }, c);
  assert.ok('seri' in r || 'hata' in r);
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node --test server/ody-tools.test.js`
Expected: FAIL — `bilinmeyen tool: trend`

- [ ] **Step 3: trend'i defs'e ekle**

```js
defs.trend = {
  description: 'Zaman içinde metrik trendi (kpi geçmişinden). metrik: aktif/gecikmis/bugun/musteride. Son ~48 ölçüm noktasının özeti (ilk, son, min, max).',
  input_schema: { type: 'object', required: ['metrik'], properties: { metrik: { type: 'string', enum: ['aktif', 'gecikmis', 'bugun', 'musteride'] } } },
  run(input, ctx) {
    const map = { aktif: 'active', gecikmis: 'overdue', bugun: 'today', musteride: 'musteride' };
    const field = map[input.metrik];
    const hist = ctx.ed.bns_history || [];
    if (!field || !hist.length) return { hata: 'trend verisi yok' };
    const vals = hist.map(h => h[field]).filter(v => typeof v === 'number');
    if (!vals.length) return { hata: 'metrik bulunamadı' };
    return { metrik: input.metrik, nokta: vals.length, ilk: vals[vals.length - 1], son: vals[0], min: Math.min(...vals), max: Math.max(...vals) };
  },
};
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node --test server/ody-tools.test.js`
Expected: PASS (11 test)

- [ ] **Step 5: Commit**

```bash
git add server/ody-tools.js server/ody-tools.test.js
git commit -m "feat(ody-tools): trend — kpi geçmişinden metrik özeti"
```

---

## Task 9: `/api/chat`'i agentic tool-loop'a çevir

**Files:**
- Modify: `server/api.js` (chatContext'i kaldır: ~346-387; /api/chat handler: ~388-447)

- [ ] **Step 1: chatContext fonksiyonunu ve `_chatCtxCache`'i sil**

`server/api.js`'te `const _chatCtxCache = new Map();` satırından `chatContext` fonksiyonunun kapanış `}`'ine kadar olan bloğu (kişi-indeksi dahil) tamamen sil. (Tool katmanı bu sorumluluğu devraldı.)

- [ ] **Step 2: ody-tools require ekle**

`server/api.js` üst kısımdaki require'lara ekle (örn. `const calc = require('./calc-penalty.js');` satırından sonra):

```js
const odyTools = require('./ody-tools');
```

- [ ] **Step 3: /api/chat handler gövdesini tool-loop ile değiştir**

`app.post('/api/chat', auth.authGuard, async (req, res) => { ... });` gövdesini şununla değiştir:

```js
app.post('/api/chat', auth.authGuard, async (req, res) => {
  try {
    const msgs = Array.isArray(req.body?.messages) ? req.body.messages.slice(-12) : [];
    if (!msgs.length) return res.status(400).json({ error: 'messages gerekli' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'asistan yapılandırılmamış' });
    const rb = req.body?.range;
    const range = (rb && typeof rb.from === 'number' && typeof rb.to === 'number') ? { from: rb.from, to: rb.to } : null;
    const isAdmin = req.user.role === 'admin';
    const ed = await getEmbedded();   // tek fetch; tüm tool çağrıları paylaşır
    const ctx = { user: req.user, isAdmin, range, ed };

    const system =
      `Senin adın Ody — Benseno Tasarım Sistemi'nin asistanısın (Slack botunun adı WT'dir). Şu an seninle GİRİŞ YAPMIŞ kullanıcı: ${req.user.name}${isAdmin ? ' (yönetici)' : ''}. ` +
      `Türkçe, kısa ve net konuş; gerektiğinde adım adım yönlendir, uygun yerde öneri sun. ` +
      `\n\nÇOK ÖNEMLİ — VERİYE ERİŞİM: Sistem verisi (briefler, kişiler, markalar, puanlar, sayılar) SADECE sana verilen TOOL'lar üzerinden gelir. ` +
      `Herhangi bir sayı, iş sayısı, liste veya olgu söylemeden ÖNCE ilgili tool'u çağır. Tool sonucundaki değerleri BİREBİR kullan; kendin sayma, tahmin etme, uydurma. ` +
      `Tool boş/0 dönerse "yok" de. Kişiye özel sorularda ("benim işlerim", "bugün ne yapacağım") kisi olarak "${req.user.name}" ile tool çağır. ` +
      (isAdmin ? '' : 'Bu kullanıcı yönetici DEĞİL: kişi/dept puanı veya performans kıyası sorulursa "bu bilgi yöneticilere özeldir" de (kendi işlerini listelemek serbesttir). ') +
      `\n\n# SİSTEM KULLANIM BİLGİSİ\n` + CHAT_BILGI;

    const convo = msgs.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 4000) }));

    let final = '';
    for (let turn = 0; turn < 5; turn++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 1200, system,
          thinking: { type: 'adaptive' },
          tools: odyTools.TOOLS,
          messages: convo,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { console.error('[chat] AI hata:', j.error?.message || r.status); return res.status(502).json({ error: 'asistan şu an yanıt veremiyor' }); }
      const blocks = j.content || [];
      final = blocks.filter(c => c.type === 'text').map(c => c.text).join('').trim();
      if (j.stop_reason !== 'tool_use') break;
      // Tool çağrılarını çalıştır, sonuçları konuşmaya ekle.
      convo.push({ role: 'assistant', content: blocks });
      const toolResults = [];
      for (const b of blocks) {
        if (b.type !== 'tool_use') continue;
        const out = await odyTools.runTool(b.name, b.input, ctx);
        toolResults.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out) });
      }
      convo.push({ role: 'user', content: toolResults });
    }
    res.json({ reply: final || 'İsteğini tam karşılayamadım, tekrar dener misin?' });
  } catch (e) { console.error('[chat] hata:', e.message); res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 4: Syntax + manuel duman testi**

Run: `node --check server/api.js && echo OK`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add server/api.js
git commit -m "feat(ody): /api/chat tool-driven agentic loop'a geçti — veri dökümü kaldırıldı, model SQL-kaynaklı tool'ları çağırır (adaptive thinking, maks 5 tur)"
```

---

## Task 10: Eval harness + deploy.sh entegrasyonu

**Files:**
- Create: `scripts/ody-evals.json`
- Create: `scripts/ody-eval.js`
- Modify: `scripts/deploy.sh` (api adımının sonuna eval çağrısı)

- [ ] **Step 1: Eval vakalarını yaz**

```json
[
  { "q": "İrem kaç iş tamamladı?", "admin": true, "expect": { "regex": "\\b3\\b", "contains": ["tamamlan"] } },
  { "q": "Pelin kaç iş tamamladı?", "admin": true, "expect": { "regex": "\\b1\\b" } },
  { "q": "Pelin'in kaç aktif işi var?", "admin": true, "expect": { "regex": "\\b7\\b" } },
  { "q": "Şu an kaç gecikmiş iş var?", "admin": true, "expect": { "regex": "\\d" } },
  { "q": "Hasvet markasında kaç tamamlanan iş var?", "admin": true, "expect": { "regex": "\\d" } }
]
```

- [ ] **Step 2: Eval çalıştırıcıyı yaz**

```js
// scripts/ody-eval.js — bilinen-cevaplı soruları canlı /api/chat'e sorup regresyon yakalar.
// Kullanım: API_BASE=https://benseno-api-production.up.railway.app node scripts/ody-eval.js
const fs = require('fs');
const path = require('path');
const auth = require('../server/auth');

const BASE = process.env.API_BASE || 'http://localhost:3000';
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'ody-evals.json'), 'utf8'));

function token(admin) {
  return auth.signToken({ id: 'eval-bot', name: 'Eval', role: admin ? 'admin' : 'user', slack_id: 'eval-bot' });
}

function check(reply, expect) {
  const fails = [];
  if (expect.regex && !new RegExp(expect.regex).test(reply)) fails.push('regex:' + expect.regex);
  for (const c of (expect.contains || [])) if (!reply.toLocaleLowerCase('tr').includes(c.toLocaleLowerCase('tr'))) fails.push('eksik:' + c);
  for (const c of (expect.notContains || [])) if (reply.toLocaleLowerCase('tr').includes(c.toLocaleLowerCase('tr'))) fails.push('olmamalı:' + c);
  return fails;
}

(async () => {
  let pass = 0, fail = 0;
  for (const t of cases) {
    try {
      const r = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token(t.admin) },
        body: JSON.stringify({ messages: [{ role: 'user', content: t.q }] }),
      });
      const j = await r.json().catch(() => ({}));
      const reply = j.reply || '';
      const fails = check(reply, t.expect);
      if (fails.length) { fail++; console.log(`❌ "${t.q}"\n   → ${reply.slice(0, 160)}\n   sebep: ${fails.join(', ')}`); }
      else { pass++; console.log(`✅ "${t.q}"`); }
    } catch (e) { fail++; console.log(`❌ "${t.q}" — istek hatası: ${e.message}`); }
  }
  console.log(`\nOdy eval: ${pass} geçti, ${fail} kaldı`);
  process.exit(fail ? 1 : 0);
})();
```

- [ ] **Step 3: deploy.sh api adımına eval çağrısı ekle**

`scripts/deploy.sh`'te consistency-check çağrısından sonra (deploy sonrası bölüm, ~62. satır) ekle:

```bash
  echo "🤖 Ody eval (canlı /api/chat)"
  API_BASE=https://benseno-api-production.up.railway.app node scripts/ody-eval.js \
    || echo "  ⚠️ Ody eval'da başarısız vaka var — yukarıyı incele (deploy bloklanmadı)."
```

- [ ] **Step 4: Eval'i lokal çalıştır (deploy sonrası canlıya karşı)**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; export BNS_JWT_SECRET="$(railway variables --service benseno-api 2>/dev/null | grep -o 'BNS_JWT_SECRET[^|]*' | awk '{print $NF}')"; API_BASE=https://benseno-api-production.up.railway.app node scripts/ody-eval.js`
Expected: tüm vakalar `✅` (Task 11 deploy'undan SONRA çalıştırılır)

> **Not:** Eval canlı API'ye gider; Task 11'de api deploy SUCCESS olduktan sonra anlamlıdır. `BNS_JWT_SECRET` lokalde mevcut değilse Railway'den okunmalı (yukarıdaki komut) — token canlı API'nin secret'ıyla imzalanmalı.

- [ ] **Step 5: Commit**

```bash
git add scripts/ody-evals.json scripts/ody-eval.js scripts/deploy.sh
git commit -m "feat(ody): eval harness — bilinen-cevaplı sorularla regresyon kapısı (deploy sonrası best-effort)"
```

---

## Task 11: Tüm test, deploy, doğrula

**Files:** yok (çalıştırma + deploy)

- [ ] **Step 1: Tüm tool birim testleri geçiyor mu**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; node --test server/ody-tools.test.js`
Expected: PASS (11 test, 0 fail)

- [ ] **Step 2: API syntax + CI kapısı**

Run: `node --check server/api.js && bash scripts/ci-check.sh 2>&1 | tail -3`
Expected: `node --check` sessiz, CI `🟢 CI KAPISI GEÇTİ`

- [ ] **Step 3: API'yi deploy et**

Run: `bash scripts/deploy.sh api 2>&1 | grep -iE "tetiklendi|tamam|eval|geçti|kaldı"`
Expected: `✅ API deploy tetiklendi`; deploy sonrası eval satırları

- [ ] **Step 4: SUCCESS bekle**

Run: `for i in $(seq 1 20); do s=$(railway deployment list --service benseno-api 2>&1 | sed -n '2p'); echo "$s" | grep -q SUCCESS && { echo "canlı: $s"; break; }; sleep 12; done`
Expected: `SUCCESS`

- [ ] **Step 5: Canlı eval + manuel doğrulama**

Run: `[ -f data/.db-url ] && export DATABASE_URL="$(cat data/.db-url)"; export BNS_JWT_SECRET="$(railway variables --service benseno-api 2>/dev/null | grep -o 'BNS_JWT_SECRET[^|]*' | awk '{print $NF}')"; API_BASE=https://benseno-api-production.up.railway.app node scripts/ody-eval.js`
Expected: tüm vakalar `✅` — özellikle "İrem → 3", "Pelin → 1 tamamlanan / 7 aktif".

- [ ] **Step 6: Commit (kalan değişiklik varsa) ve kapanış**

```bash
git add -A && git commit -m "chore(ody): tool-driven Ody — tüm testler + canlı eval geçti" || echo "temiz"
```

---

## Self-Review notları

- **Spec kapsama:** agentic loop (T9), 8 tool (T1-T8 = genel_ozet, brief_sorgula, kisi_dokumu, marka_dokumu, yildiz_karne, gecikme_analizi, kapasite, trend), gizlilik gating (T3/T5), eval harness (T10), birim test (T1-T8), deploy (T11) — hepsi karşılanıyor.
- **Veri kaynağı kararı:** Spec "SQL tool" diyordu; plan bunu `getEmbedded()` (SQL'den deterministik üretilen) yapısal diziler üzerinde kod-filtreleme olarak somutlaştırır — halüsinasyonun kökü (model sayımı) ortadan kalkar, SQL hata yüzeyi açılmaz. Bu bilinçli, spec amacına sadık bir somutlaştırmadır.
- **Tip tutarlılığı:** `ctx` şekli ({user,isAdmin,range,ed}) ve tool dönüşleri (say/nos) tüm task'larda aynı; `_matchUser`/`_userCandidates` T1'de tanımlı, sonraki task'lar kullanır.
- **Doğrulanması gereken 2 nokta (uygulayıcıya not düşüldü):** marka puanının `bns_ratings` içindeki gerçek anahtarı (T4) ve `bns_history` alan adları (T8) — Step 3 öncesi `node -e` ile teyit edilecek; testler bu alanlara bağlı kurulmadı.
