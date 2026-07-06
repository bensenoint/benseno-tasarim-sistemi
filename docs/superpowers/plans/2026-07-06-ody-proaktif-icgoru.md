# P2-B · Ody Proaktif — Günlük Tek-Satır İçgörü — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ody'nin, kayda değer durumda günde bir kez kişiye özel tek satır içgörü üretip Slack DM + dashboard balonunda göstermesi.

**Architecture:** Yeni `scripts/ody-icgoru.js` sabah cron'da çalışır: her kullanıcı için deterministik sinyal hesaplar (LLM'siz, test edilebilir saf fonksiyon), sinyal yoksa susar; varsa Anthropic Sonnet ile tek cümle ürettir, `notifications`'a `tip='ody_icgoru'` yazar (dashboard otomatik gösterir) + tercih açıksa Slack DM gönderir. Tercih `notify_prefs.ody_icgoru` ile yönetilir.

**Tech Stack:** Node + pg (pool), Anthropic Messages API (fetch), node-cron scheduler, `scripts/rapor-lib` (token/post/fetchEmbedded), React UMD dashboard.

**Spec:** `docs/superpowers/specs/2026-07-06-ody-proaktif-icgoru-design.md`

---

## Dosya haritası

- **Create:** `server/migrations/0011_ody_icgoru_pref.sql` — `notify_prefs.ody_icgoru` sütunu.
- **Create:** `scripts/ody-icgoru.js` — saf `computeSignal` (dışa verilir + test) + LLM + notif yaz + DM; `--dry` bayrağı.
- **Create:** `scripts/ody-icgoru.test.js` — `computeSignal` birim testleri.
- **Create:** `scripts/run-ody-icgoru.sh` — cron sarmalayıcı.
- **Modify:** `server/notify.js` — `getPrefs` varsayılanına `ody_icgoru: true`.
- **Modify:** `server/api.js` — `/api/notify-prefs` GET varsayılanı + POST persist alanı.
- **Modify:** `scripts/scheduler.js` — 08:15 cron girişi.
- **Modify:** `dashboard/app/screens/Profile.jsx` — NotifPrefsCard'a "Ody günlük içgörü" Row.
- **Modify:** `dashboard/app/Chrome.jsx` — `ody_icgoru → 💡` ikon eşlemesi.

Migration'ı çalıştırma yolunu değiştirme; deploy ile prod'a gider (mevcut kalıp).

---

### Task 1: Migration + backend tercih plumbing

**Files:**
- Create: `server/migrations/0011_ody_icgoru_pref.sql`
- Modify: `server/notify.js`, `server/api.js`

- [ ] **Step 1: Migration dosyası**

`server/migrations/0011_ody_icgoru_pref.sql`:
```sql
-- P2-B: Ody günlük proaktif içgörü DM tercihi (varsayılan açık)
ALTER TABLE notify_prefs ADD COLUMN IF NOT EXISTS ody_icgoru BOOLEAN DEFAULT true;
```

- [ ] **Step 2: notify.js varsayılanı** — `server/notify.js`, `getPrefs` içindeki fallback objesine `ody_icgoru: true` ekle:
```js
  return r.rows[0] || { ogle_dijest: true, tip_termin: true, tip_atama: true, tip_bloke: true, sessiz_bas: 19, sessiz_bit: 8, ody_icgoru: true };
```

- [ ] **Step 3: api.js GET varsayılanı** — `server/api.js`, `app.get('/api/notify-prefs'...)` içindeki fallback'e `ody_icgoru: true` ekle:
```js
    res.json(r.rows[0] || { ogle_dijest: true, tip_termin: true, tip_atama: true, tip_bloke: true, sessiz_bas: 19, sessiz_bit: 8, ody_icgoru: true });
```

- [ ] **Step 4: api.js POST persist** — `app.post('/api/notify-prefs'...)` içindeki INSERT/UPDATE'i `ody_icgoru` kolonunu içerecek şekilde güncelle:
```js
    await pool.query(
      `INSERT INTO notify_prefs (user_id, ogle_dijest, tip_termin, tip_atama, tip_bloke, sessiz_bas, sessiz_bit, ody_icgoru)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id) DO UPDATE SET ogle_dijest=$2, tip_termin=$3, tip_atama=$4, tip_bloke=$5, sessiz_bas=$6, sessiz_bit=$7, ody_icgoru=$8`,
      [req.user.slack_id, bool(b.ogle_dijest, true), bool(b.tip_termin, true), bool(b.tip_atama, true), bool(b.tip_bloke, true), hour(b.sessiz_bas, 19), hour(b.sessiz_bit, 8), bool(b.ody_icgoru, true)]);
```

- [ ] **Step 5: Syntax kontrolü** — Run: `node --check server/api.js && node --check server/notify.js`
Expected: hata yok.

- [ ] **Step 6: Commit**
```bash
git add server/migrations/0011_ody_icgoru_pref.sql server/notify.js server/api.js
git commit -m "feat(P2-B): notify_prefs.ody_icgoru tercihi (migration + api + notify default)"
```

---

### Task 2: `ody-icgoru.js` — sinyal (TDD) + LLM + notif + DM

**Files:**
- Create: `scripts/ody-icgoru.js`
- Create: `scripts/ody-icgoru.test.js`
- Create: `scripts/run-ody-icgoru.sh`

- [ ] **Step 1: Başarısız test yaz** — `scripts/ody-icgoru.test.js`:
```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { computeSignal } = require('./ody-icgoru');

const H = 3600000;
const now = new Date('2026-07-06T09:00:00+03:00').getTime();
const u = { id: 'U1', name: 'Serra' };
// deadline ms yardımcıları
const mk = (no, marka, dhHours) => ({ no, marka, baslik: marka + ' işi', durum: 'basladi',
  deadline: now + dhHours * H, workers: [{ id: 'U1' }], leads: [] });

test('sinyal yoksa null (kapı)', () => {
  const briefs = [mk(1, 'A', 100), { ...mk(2, 'B', 5), workers: [{ id: 'U9' }] }];
  assert.equal(computeSignal(u, briefs, now), null);   // U1'in tek işi 100sa uzakta → kayda değer değil
});
test('geciken/riskli/bugün doğru sınıflanır + odak en çok geciken', () => {
  const briefs = [
    mk(1, 'Splenda', -30),   // geciken (30sa önce)
    mk(2, 'Acme', -5),       // geciken (5sa önce) — daha az geciken
    mk(3, 'Beta', 6),        // bugün (aynı gün, dh>0)
    mk(4, 'Gamma', 20),      // riskli (24sa içi, yarın)
    mk(5, 'Delta', 200),     // uzak → hiçbir kategoride değil
  ];
  const s = computeSignal(u, briefs, now);
  assert.ok(s);
  assert.equal(s.ad, 'Serra');
  assert.deepEqual(s.geciken.map(b => b.no).sort(), [1, 2]);
  assert.deepEqual(s.bugun.map(b => b.no), [3]);
  assert.deepEqual(s.riskli.map(b => b.no), [4]);
  assert.equal(s.focus.no, 1);   // en çok geciken → odak
});
test('yalnız bugün deadline → sinyal var, odak bugünden', () => {
  const s = computeSignal(u, [mk(7, 'Tek', 3)], now);
  assert.ok(s);
  assert.equal(s.focus.no, 7);
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör** — Run: `node --test scripts/ody-icgoru.test.js`
Expected: FAIL (`Cannot find module './ody-icgoru'` veya `computeSignal is not a function`).

- [ ] **Step 3: `ody-icgoru.js` yaz** — `scripts/ody-icgoru.js`:
```js
'use strict';
/**
 * ody-icgoru.js — Ody proaktif günlük tek-satır içgörü (sabah cron, dijest'ten önce).
 * Kayda değer durumda (geciken/riskli/bugün) LLM ile tek cümle üretir; notifications'a
 * tip='ody_icgoru' yazar (dashboard gösterir) + tercih açıksa Slack DM gönderir.
 * Kullanım: node scripts/ody-icgoru.js         → canlı (BNS_REPORT_LIVE=1 gerektirir)
 *           node scripts/ody-icgoru.js --dry    → LLM/DM/DB yok; sinyal + prompt yazdır
 */
const { token, post, fetchEmbedded, GORKEM, DASHBOARD_URL } = require('./rapor-lib');
const { pool } = require('../server/db');

const H = 3600000;
const DRY = process.argv.includes('--dry');

// SAF FONKSİYON (test edilir): kişinin brief'lerinden sinyal çıkar. Kayda değer yoksa null.
function computeSignal(user, briefs, now) {
  const uid = user.id;
  const related = (briefs || []).filter(b =>
    b.durum !== 'musteride' && b.durum !== 'tamamlandi' &&
    ((b.workers || []).some(w => w && w.id === uid) || (b.leads || []).some(l => l && l.id === uid)));
  const dh = (b) => b.deadline == null ? null : (b.deadline - now) / H;
  const sameDay = (ms) => new Date(ms).toDateString() === new Date(now).toDateString();
  const geciken = [], riskli = [], bugun = [];
  for (const b of related) {
    const d = dh(b);
    if (d == null) continue;
    if (d <= 0) geciken.push(b);
    else if (sameDay(b.deadline)) bugun.push(b);
    else if (d <= 24) riskli.push(b);
  }
  if (geciken.length + riskli.length + bugun.length === 0) return null;   // KAPI: sus
  geciken.sort((a, b) => (a.deadline || 0) - (b.deadline || 0));   // en çok geciken önce
  const focus = geciken[0] || bugun[0] || riskli[0];
  const slim = (b) => ({ no: b.no, marka: b.marka, baslik: b.baslik,
    gun: b.deadline ? Math.round((now - b.deadline) / 86400000) : null });
  return { ad: (user.name || '').split(' ')[0] || user.name || '',
    geciken: geciken.map(slim), riskli: riskli.map(slim), bugun: bugun.map(slim), focus };
}

const SYS = "Sen Ody, Benseno iş asistanısın. Verilen GERÇEK sinyallere dayanarak kişiye TEK CÜMLE, sıcak ve eyleme yönelik bir içgörü yaz. YALNIZ verilen verileri kullan — sayı uydurma, veri ekleme. En fazla 140 karakter. Türkçe. En kritik işe somut atıf ver (#no marka). Selamlama/emoji/markdown ekleme, düz tek cümle.";

async function generateLine(signal) {
  const body = {
    model: 'claude-sonnet-4-6', max_tokens: 80, system: SYS,
    messages: [{ role: 'user', content: JSON.stringify({ ad: signal.ad, geciken: signal.geciken, riskli: signal.riskli, bugun: signal.bugun }) }],
  };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  if (!r.ok) return null;
  const j = await r.json();
  const raw = (j.content && j.content[0] && j.content[0].text) || '';
  const line = raw.split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
  return line ? line.slice(0, 140) : null;
}

async function main() {
  const tok = token();
  if (!tok) { console.error('SLACK token yok'); process.exit(1); }
  if (!DRY && !process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY yok'); process.exit(1); }
  const live = process.env.BNS_REPORT_LIVE === '1';
  const now = Date.now();
  const d = await fetchEmbedded();
  const briefs = d.bns_briefs || [];
  const users = (d.bns_users || []).filter(u => /^U/.test(u.id));

  // DM tercihi kapalı olanlar (dashboard bildirimi yine yazılır; yalnız DM atlanır)
  const off = new Set((await pool.query(`SELECT user_id FROM notify_prefs WHERE ody_icgoru=false`)).rows.map(r => r.user_id));

  let sent = 0; const preview = [];
  for (const u of users) {
    const signal = computeSignal(u, briefs, now);
    if (!signal) continue;

    if (DRY) { preview.push(`### ${u.name}\n${JSON.stringify(signal, null, 2)}`); continue; }

    // İdempotenlik: bugün zaten üretildiyse atla
    const dup = await pool.query(
      `SELECT 1 FROM notifications WHERE user_id=$1 AND tip='ody_icgoru' AND created_at::date = now()::date LIMIT 1`, [u.id]);
    if (dup.rowCount) continue;

    const line = await generateLine(signal);
    if (!line) continue;   // LLM boş/başarısız → çöp gönderme

    if (live) {
      // Dashboard her zaman görür; DM tercihe tabi. dijest_at=now() → 08:30 dijesti tekrar toplamaz.
      await pool.query(
        `INSERT INTO notifications (user_id, tip, aciliyet, text, brief_id, dijest_at)
         VALUES ($1,'ody_icgoru','normal',$2,$3, now())`,
        [u.id, line, signal.focus && signal.focus.no ? null : null]);   // brief_id no≠id olduğundan null bırakılır (aşağı not)
      if (!off.has(u.id)) await post(tok, u.id, `💡 ${line}\n🔗 ${DASHBOARD_URL}`);
    } else {
      preview.push(`### ${u.name}\n💡 ${line}`);
    }
    sent++;
  }

  if (DRY) { console.log(`ody-icgoru DRY — ${preview.length} kişi sinyalli\n\n` + preview.join('\n\n———\n\n')); }
  else if (!live && preview.length) { await post(tok, GORKEM, `🧪 *Ody içgörü önizleme (${sent} kişi)*\n\n` + preview.join('\n\n———\n\n')); }
  console.log(`ody-icgoru ${DRY ? 'DRY' : live ? 'CANLI' : 'TEST'} — ${sent} kişi`);
  await pool.end();
}

if (require.main === module) main().catch(e => { console.error('ody-icgoru hata:', e.message); process.exit(1); });
module.exports = { computeSignal, generateLine };
```
NOT (brief_id): `notifications.brief_id` iç `id` bekler; embedded brief'te güvenilir iç id her zaman olmayabilir ve `no` ≠ `id`. Bu ilk sürümde `brief_id` null bırakılır (cümlede zaten #no geçiyor). İleride embedded'a `id` eklenirse doldurulur.

- [ ] **Step 4: Test geçsin** — Run: `node --test scripts/ody-icgoru.test.js`
Expected: 3/3 PASS.

- [ ] **Step 5: run script** — `scripts/run-ody-icgoru.sh`:
```sh
#!/bin/zsh
# Ody proaktif günlük içgörü — hft içi 08:15 (dijest'ten önce).
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/ody-icgoru.js >> logs/ody-icgoru.log 2>&1
```
Sonra: `chmod +x scripts/run-ody-icgoru.sh`

- [ ] **Step 6: Kuru çalıştırma dumanı** — Run: `node scripts/ody-icgoru.js --dry 2>&1 | head -20`
Expected: DB'den kullanıcı/brief çekip sinyalli kişileri + JSON yazdırır, LLM/DM yok. (DB erişimi yoksa bu adım prod'da doğrulanır; lokal hata verirse not düş, engelleme.)

- [ ] **Step 7: Commit**
```bash
git add scripts/ody-icgoru.js scripts/ody-icgoru.test.js scripts/run-ody-icgoru.sh
git commit -m "feat(P2-B): ody-icgoru.js — deterministik sinyal (TDD) + LLM tek cümle + notif + DM"
```

---

### Task 3: Scheduler cron

**Files:**
- Modify: `scripts/scheduler.js`

- [ ] **Step 1: Cron girişi ekle** — `scripts/scheduler.js`, dijest cron'unun (`cron.schedule('30 8 * * 1-5', () => run('run-dijest.sh'), opts);`) HEMEN ÜSTÜNE (08:15, dijest'ten önce), aynı NOTIFY_V2 koşul bloğu içindeyse onun içine ekle:
```js
  cron.schedule('15 8 * * 1-5', () => run('run-ody-icgoru.sh'), opts);
```
Eğer dijest satırı bir `if (NOTIFY_V2) { ... }` bloğunun içindeyse, bu satırı da AYNI bloğun içine koy (Ody içgörü de V2 özelliği).

- [ ] **Step 2: Syntax** — Run: `node --check scripts/scheduler.js` → hata yok.

- [ ] **Step 3: Commit**
```bash
git add scripts/scheduler.js
git commit -m "feat(P2-B): scheduler — ody-icgoru 08:15 cron"
```

---

### Task 4: Frontend — tercih anahtarı + 💡 ikon

**Files:**
- Modify: `dashboard/app/screens/Profile.jsx`
- Modify: `dashboard/app/Chrome.jsx`

- [ ] **Step 1: NotifPrefsCard'a Row ekle** — `dashboard/app/screens/Profile.jsx`, NotifPrefsCard içinde `<Row k="tip_bloke" ... />` satırından sonra:
```jsx
      <Row k="ody_icgoru" label="Ody günlük içgörü"/>
```
(Row zaten `checked={p[k] !== false}` ile varsayılan-açık ve `save` tüm objeyi POST'luyor → ekstra kablolama gerekmez.)

- [ ] **Step 2: Chrome.jsx ikon eşlemesi** — `dashboard/app/Chrome.jsx`'te bildirim `tip`→emoji eşlemesi yapan yeri bul (örn. `termin:"⏰"` içeren nesne; NotifDot'taki `icon` haritasına da bakılabilir ama Chrome kendi eşlemesini kullanıyorsa oraya). O haritaya `ody_icgoru: "💡"` ekle. Eşleme yoksa ve Chrome bildirimleri sabit ikonla gösteriyorsa, bu adımı atla ve raporda belirt (dashboard yine `text`'i gösterir).

- [ ] **Step 3: CI** — Run: `bash scripts/ci-check.sh` → "🟢 CI KAPISI GEÇTİ".

- [ ] **Step 4: Commit**
```bash
git add dashboard/app/screens/Profile.jsx dashboard/app/Chrome.jsx
git commit -m "feat(P2-B): tercih anahtarı 'Ody günlük içgörü' + 💡 ikon eşlemesi"
```

---

### Task 5: Build + deploy + doğrulama

**Files:** (yok)

- [ ] **Step 1: Build + CI** — Run: `bash scripts/ci-check.sh && bash scripts/build-dashboard.sh` → CI 🟢, bundle derlenir.

- [ ] **Step 2: Migration'ı prod DB'ye UYGULA** — Migration OTOMATİK DEĞİL (Railway'de release hook yok; `node server/scripts/migrate.js` ile elle uygulanır, `server/migrations/`'tan okur). API deploy'dan ÖNCE (ya da hemen sonra, ama POST /notify-prefs ody_icgoru'yu yazmadan önce) prod DATABASE_URL ile çalıştır:
  `node server/scripts/migrate.js status`  → 0011 `[ ]` (bekliyor) görünmeli
  `node server/scripts/migrate.js`         → 0011 uygulanır (`✓`)
Not: prod DATABASE_URL yerelde yoksa, Railway container'ında/`railway run` ile çalıştır. Doğrulama: `migrate.js status` → `[✓] 0011_ody_icgoru_pref.sql`.

- [ ] **Step 3: Deploy** — Run: `bash scripts/deploy.sh api && bash scripts/deploy.sh dashboard`
Expected: her ikisi `🟢 deploy.sh tamam`. Pages job success + canlı bundle güncellenir; geçici Pages hatasında boş commit ile yeniden tetikle.

- [ ] **Step 4: Prod kuru-çalıştırma doğrulama** — Migration + API deploy sonrası, prod DB erişimiyle:
  `node scripts/ody-icgoru.js --dry` → sinyalli kişilerin listesi + JSON görünür, LLM/DM yok. Beklenti: yalnız geciken/riskli/bugün işi olanlar listelenir; kimsenin sinyali yoksa "0 kişi".

- [ ] **Step 5: Tercih doğrulama (preview)** — Profil → ⚙️ Bildirim tercihleri'nde "Ody günlük içgörü" anahtarı görünür ve kaydedilir (POST /api/notify-prefs 200; migration uygulanmadıysa 400 döner → Step 2'yi kontrol et).

---

## Self-Review Notları

- **Spec kapsamı:** üretim=LLM (Task 2 generateLine), zaman=sabah cron (Task 3), yer=DM+dashboard notif (Task 2 INSERT + post), kapı=computeSignal null (Task 2, testli), tercih=ody_icgoru (Task 1+4), 💡 ikon (Task 4) → tümü karşılandı.
- **İsim tutarlılığı:** `ody_icgoru` (pref kolonu + tip değeri farklı bağlamlar: kolon=pref, `tip='ody_icgoru'`=notification türü) — bilerek aynı ad, çakışma yok (biri notify_prefs sütunu, diğeri notifications.tip değeri).
- **Kapı testi:** `computeSignal` saf ve testli (Task 2 Step 1-4) — aşırı-tetik riskinin kalbi burada, LLM'siz doğrulanır.
- **brief_id null kararı:** embedded brief `no`≠iç `id` olduğundan brief_id null; cümlede #no geçtiği için işlevsel kayıp yok. Spec "brief_id=<tek odak iş varsa>" diyordu; bu sapma NOT olarak plana yazıldı (bilinçli).
- **Riskli/bugün ayrımı:** disjoint tanım (geciken: dh≤0; bugun: aynı gün & dh>0; riskli: dh≤24 & farklı gün) — çift sayım yok; testte doğrulanıyor.
