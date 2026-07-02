# Bildirim Reformu v1 — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anlık-bildirim spam'ini günde 2 kişisel dijeste (08:30/13:30) indirgeyen, yalnız termin+atama'yı anlık push eden, iş/marka sayfalarında bağlamsal bildirim rozetleri gösteren merkezi bir bildirim sistemi kurmak.

**Architecture:** Tek `notify()` kapısı tüm üreticilerden geçer; mevcut `notifications` tablosu hem uygulama-içi zil hem dijest tamponu olarak kullanılır (tip/aciliyet/brief_id/marka/dijest_at/slack_at kolonları eklenir). Acil olanlar (pref + sessiz saat izniyle) anında Slack DM; gerisi 08:30/13:30 dijestinde toplanır. `BNS_NOTIFY_V2` bayrağı ile kademeli açılır.

**Tech Stack:** Node.js (server + scripts), PostgreSQL (psql migration), Slack Web API, React UMD dashboard, `node --test` birim testleri.

**Spec:** `docs/superpowers/specs/2026-07-02-bildirim-reformu-design.md`

---

## Dosya haritası

| Dosya | Sorumluluk | İşlem |
|---|---|---|
| `server/migrations/0010_bildirim_reformu.sql` | notifications kolonları + notify_prefs + brief_notif_seen | Create |
| `server/notify.js` | Merkezi `notify()` kapısı + pref/sessiz-saat mantığı | Create |
| `server/notify.test.js` | notify birim testleri | Create |
| `server/slack.js` | `dm()`e `skipLog` param (çift-log önleme) | Modify |
| `server/writes.js` | atama/lead → acil notify; blokeli/müşteri → normal notify | Modify |
| `scripts/termin-risk.js` | thread uyarısı yerine kişiye acil notify (bayrağa bağlı) | Modify |
| `scripts/rapor-dijest.js` | 08:30/13:30 kişisel dijest (rapor-kisisel içeriği + bekleyen bildirimler) | Create |
| `scripts/run-dijest.sh` | dijest cron wrapper | Create |
| `scripts/scheduler.js` | cron: kisisel/thread-ozet/kanal-ozet kaldır, dijest ekle (bayrağa bağlı) | Modify |
| `server/api.js` | `/api/notify-prefs` GET/POST; `/api/briefs/:id/notifications`; `/api/briefs/:id/notif-seen`; `/api/embedded`'a bns_notif | Modify |
| `server/queries.js` | `bns_notif` gruplu sayım sorgusu | Modify |
| `dashboard/app/screens/Profile.jsx` | Bildirim tercihleri kartı | Modify |
| `dashboard/app/BriefDrawer.jsx` | "Bildirimler" bölümü + seen POST | Modify |
| `dashboard/app/BriefTable.jsx` + `screens/Kanban.jsx` | satır/kart bildirim rozeti | Modify |
| `dashboard/app/screens/Brand.jsx` | marka bildirim accordion'u | Modify |

**Uygulama sırası mantığı:** Önce veri modeli + `notify()` çekirdeği (Faz A), sonra üreticiler (Faz B), sonra dijest + scheduler (Faz C), sonra tercih API+UI (Faz D), en son iş/marka rozetleri (Faz E). Her faz kendi başına test edilebilir ve `BNS_NOTIFY_V2` kapalıyken canlıyı etkilemez.

---

## FAZ A — Veri modeli + notify() çekirdeği

### Task A1: Migration — kolonlar + tablolar

**Files:**
- Create: `server/migrations/0010_bildirim_reformu.sql`

- [ ] **Step 1: Migration dosyasını yaz**

```sql
-- 0010_bildirim_reformu.sql — bildirim reformu v1
-- notifications tablosu: zil + dijest tamponu olarak genişletilir.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS tip TEXT DEFAULT 'genel',        -- termin|atama|bloke|musteri|statu|genel
  ADD COLUMN IF NOT EXISTS aciliyet TEXT DEFAULT 'normal',  -- acil|normal
  ADD COLUMN IF NOT EXISTS dijest_at TIMESTAMPTZ,           -- NULL = dijest bekliyor
  ADD COLUMN IF NOT EXISTS slack_at TIMESTAMPTZ,            -- anlık DM zamanı
  ADD COLUMN IF NOT EXISTS brief_id INTEGER,                -- ilgili iş (NULL = genel)
  ADD COLUMN IF NOT EXISTS marka TEXT;                      -- brief'ten türetilir

CREATE INDEX IF NOT EXISTS idx_notif_user_dijest ON notifications (user_id, dijest_at);
CREATE INDEX IF NOT EXISTS idx_notif_brief ON notifications (brief_id);

CREATE TABLE IF NOT EXISTS notify_prefs (
  user_id TEXT PRIMARY KEY,
  ogle_dijest BOOLEAN NOT NULL DEFAULT true,
  tip_termin BOOLEAN NOT NULL DEFAULT true,
  tip_atama  BOOLEAN NOT NULL DEFAULT true,
  tip_bloke  BOOLEAN NOT NULL DEFAULT true,
  sessiz_bas SMALLINT NOT NULL DEFAULT 19,   -- TR saati; [sessiz_bas, sessiz_bit) push yok
  sessiz_bit SMALLINT NOT NULL DEFAULT 8
);

CREATE TABLE IF NOT EXISTS brief_notif_seen (
  user_id TEXT NOT NULL,
  brief_id INTEGER NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, brief_id)
);
```

- [ ] **Step 2: Migration'ı canlı DB'ye uygula**

Run:
```bash
cd ~/benseno-tasarim-sistemi
psql "$(cat data/.db-url)" -f server/migrations/0010_bildirim_reformu.sql
```
Expected: `ALTER TABLE` + `CREATE INDEX` + `CREATE TABLE` çıktıları, hata yok.

- [ ] **Step 3: Şemayı doğrula**

Run:
```bash
psql "$(cat data/.db-url)" -c "\d notifications" -c "\d notify_prefs" -c "\d brief_notif_seen"
```
Expected: notifications'ta tip/aciliyet/dijest_at/slack_at/brief_id/marka kolonları görünür; iki yeni tablo listelenir.

- [ ] **Step 4: Commit**

```bash
git add server/migrations/0010_bildirim_reformu.sql
git commit -m "feat(bildirim): 0010 migration — notifications kolonları + notify_prefs + brief_notif_seen"
```

---

### Task A2: `slack.dm`'e skipLog parametresi (çift-log önleme)

**Files:**
- Modify: `server/slack.js:127-133`

`notify()` satırı kendisi INSERT edeceği için, acil DM'de `slack.dm`'in tekrar `logNotification` çağırması çift kayıt yaratır. `dm()`e opsiyonel `skipLog` eklenir.

- [ ] **Step 1: dm() imzasını güncelle**

`server/slack.js` içinde mevcut:
```js
async function dm(userId, text, link) {
  if (!hasToken() || !userId) return { ok: false, skipped: true };
  if (!/^U/.test(userId)) return { ok: false, skipped: true };
  const res = await slackCall("chat.postMessage", { channel: userId, text, username: BOT_NAME, unfurl_links: false });
  if (res.ok) logNotification(userId, text, link);   // await yok — DM akışını geciktirmesin
  return res.ok ? { ok: true } : { ok: false, error: res.error };
```
Şununla değiştir:
```js
async function dm(userId, text, link, skipLog = false) {
  if (!hasToken() || !userId) return { ok: false, skipped: true };
  if (!/^U/.test(userId)) return { ok: false, skipped: true };
  const res = await slackCall("chat.postMessage", { channel: userId, text, username: BOT_NAME, unfurl_links: false });
  if (res.ok && !skipLog) logNotification(userId, text, link);   // notify() kendi kaydını yazarsa skipLog=true
  return res.ok ? { ok: true } : { ok: false, error: res.error };
```

- [ ] **Step 2: Parse doğrula**

Run: `node --check server/slack.js`
Expected: çıktı yok (başarılı).

- [ ] **Step 3: Commit**

```bash
git add server/slack.js
git commit -m "feat(bildirim): slack.dm skipLog parametresi — notify() çift-log önleme"
```

---

### Task A3: `server/notify.js` — merkezi kapı (TDD)

**Files:**
- Create: `server/notify.js`
- Create: `server/notify.test.js`

`notify()` saf-test edilebilir olması için karar mantığı (`shouldPushNow`) DB'den ayrılır.

- [ ] **Step 1: Başarısız testi yaz**

`server/notify.test.js`:
```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { shouldPushNow } = require('./notify');

const prefs = { ogle_dijest: true, tip_termin: true, tip_atama: true, tip_bloke: true, sessiz_bas: 19, sessiz_bit: 8 };

test('normal aciliyet asla anlık push edilmez', () => {
  assert.equal(shouldPushNow({ tip: 'bloke', aciliyet: 'normal' }, prefs, new Date('2026-07-02T10:00:00+03:00')), false);
});
test('acil + mesai içi + pref açık → push', () => {
  assert.equal(shouldPushNow({ tip: 'termin', aciliyet: 'acil' }, prefs, new Date('2026-07-02T10:00:00+03:00')), true);
});
test('acil ama kategori kapalı → push yok', () => {
  const p = { ...prefs, tip_termin: false };
  assert.equal(shouldPushNow({ tip: 'termin', aciliyet: 'acil' }, p, new Date('2026-07-02T10:00:00+03:00')), false);
});
test('acil ama sessiz saatte (20:00) → push yok', () => {
  assert.equal(shouldPushNow({ tip: 'termin', aciliyet: 'acil' }, prefs, new Date('2026-07-02T20:00:00+03:00')), false);
});
test('acil ama hafta sonu → push yok', () => {
  // 2026-07-04 Cumartesi
  assert.equal(shouldPushNow({ tip: 'atama', aciliyet: 'acil' }, prefs, new Date('2026-07-04T10:00:00+03:00')), false);
});
test('sessiz saat sınırı: tam 08:00 mesai içi sayılır, 07:59 sayılmaz', () => {
  assert.equal(shouldPushNow({ tip: 'termin', aciliyet: 'acil' }, prefs, new Date('2026-07-02T08:00:00+03:00')), true);
  assert.equal(shouldPushNow({ tip: 'termin', aciliyet: 'acil' }, prefs, new Date('2026-07-02T07:59:00+03:00')), false);
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `cd server && node --test notify.test.js`
Expected: FAIL — `Cannot find module './notify'`.

- [ ] **Step 3: notify.js'i yaz**

`server/notify.js`:
```js
'use strict';
const { pool } = require('./db');
const slack = require('./slack');

const TZ = 'Europe/Istanbul';

// TR saatini (0-23) ve haftaiçi olup olmadığını bir Date'ten çıkarır.
function trParts(now) {
  // Intl ile TR saat dilimine çevir (sunucu UTC olsa da doğru).
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false, weekday: 'short' });
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
  const hour = parseInt(parts.hour, 10) % 24;
  const wk = { Sat: 6, Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 }[parts.weekday];
  return { hour, isWeekday: wk >= 1 && wk <= 5 };
}

// Sessiz aralık [bas, bit): bas>bit ise gece boyu sarar (19→8).
function inQuiet(hour, bas, bit) {
  return bas <= bit ? (hour >= bas && hour < bit) : (hour >= bas || hour < bit);
}

// SAF KARAR — DB yok, test edilebilir. Anlık Slack push edilsin mi?
function shouldPushNow(ev, prefs, now) {
  if (ev.aciliyet !== 'acil') return false;
  const p = prefs || {};
  const catKey = { termin: 'tip_termin', atama: 'tip_atama', bloke: 'tip_bloke' }[ev.tip];
  if (catKey && p[catKey] === false) return false;
  const { hour, isWeekday } = trParts(now);
  if (!isWeekday) return false;
  const bas = p.sessiz_bas ?? 19, bit = p.sessiz_bit ?? 8;
  if (inQuiet(hour, bas, bit)) return false;
  return true;
}

async function getPrefs(userId) {
  const r = await pool.query('SELECT * FROM notify_prefs WHERE user_id=$1', [userId]);
  return r.rows[0] || { ogle_dijest: true, tip_termin: true, tip_atama: true, tip_bloke: true, sessiz_bas: 19, sessiz_bit: 8 };
}

// Ana giriş: her zaman notifications'a yazar; acil+izinliyse anlık DM.
async function notify(userId, { tip = 'genel', aciliyet = 'normal', text, link = null, briefId = null } = {}) {
  if (!userId || !text) return;
  let marka = null;
  if (briefId) {
    try {
      const b = await pool.query(`SELECT br.name AS marka FROM briefs b LEFT JOIN brands br ON br.id=b.marka_id WHERE b.id=$1`, [briefId]);
      marka = b.rows[0] ? b.rows[0].marka : null;
    } catch (e) { /* marka best-effort */ }
  }
  // 1) Zil kaydı — GARANTİ (koşulsuz).
  await pool.query(
    `INSERT INTO notifications (user_id, text, link, tip, aciliyet, brief_id, marka) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, text, link, tip, aciliyet, briefId, marka]);
  // 2) Acil + izin → anlık DM (çift-log yok: skipLog=true; kaydı zaten yukarıda yazdık).
  if (aciliyet === 'acil') {
    try {
      const prefs = await getPrefs(userId);
      if (shouldPushNow({ tip, aciliyet }, prefs, new Date())) {
        await slack.dm(userId, text, link, true);
        await pool.query(`UPDATE notifications SET slack_at=now() WHERE id=(SELECT id FROM notifications WHERE user_id=$1 AND text=$2 ORDER BY id DESC LIMIT 1)`, [userId, text]);
      }
    } catch (e) { console.error('[notify] anlık DM hata:', e.message); }  // satır tabloda güvende
  }
}

module.exports = { notify, shouldPushNow, getPrefs, inQuiet, trParts };
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `cd server && node --test notify.test.js`
Expected: PASS — 6 test geçer.

- [ ] **Step 5: Commit**

```bash
git add server/notify.js server/notify.test.js
git commit -m "feat(bildirim): notify() merkezi kapı + shouldPushNow saf karar (TDD, 6 test)"
```

---

## FAZ B — Üreticiler (BNS_NOTIFY_V2 bayrağına bağlı)

### Task B1: writes.js — atama/lead → acil, blokeli/müşteri → normal notify

**Files:**
- Modify: `server/writes.js` (require ekle; setStatus blokeli/müşteri kancası; assignee ekleme kancası)

- [ ] **Step 1: notify require ekle**

`server/writes.js` başında `const { pool, tx } = require('./db');` satırının altına:
```js
const { notify } = require('./notify');
const NOTIFY_V2 = process.env.BNS_NOTIFY_V2 === '1';
```

- [ ] **Step 2: Statü blokeli/müşteri → normal notify**

`setStatus` içinde, `await reflectChange(id, note, d.source, { by: d.by });` (yaklaşık satır 527) çağrısından SONRA ekle:
```js
  // Bildirim reformu: blokeli / müşteri dönüşü → dijeste girecek NORMAL bildirim (anlık değil).
  if (NOTIFY_V2 && (d.durum === 'blokeli' || (['beklemede','musteride'].includes(prevDurum) && RESUME_ACTIVE.includes(d.durum)))) {
    try {
      const bi = (await pool.query(`SELECT no, baslik, slack_url FROM briefs WHERE id=$1`, [id])).rows[0] || {};
      const tip = d.durum === 'blokeli' ? 'bloke' : 'musteri';
      const txt = d.durum === 'blokeli'
        ? `⛔ #${bi.no} ${bi.baslik || ''} bloke edildi`
        : `↩️ #${bi.no} ${bi.baslik || ''} müşteriden döndü — akış devam ediyor`;
      const a = await pool.query(`SELECT DISTINCT user_id FROM brief_assignees WHERE brief_id=$1 AND role IN ('contributor','lead')`, [id]);
      for (const row of a.rows) if (/^U/.test(row.user_id || '')) await notify(row.user_id, { tip, aciliyet: 'normal', text: txt, link: bi.slack_url, briefId: id });
    } catch (e) { console.error('[setStatus] bloke/müşteri bildirimi:', e.message); }
  }
```
Not: `prevDurum` ve `RESUME_ACTIVE` bu fonksiyonda zaten tanımlı (satır ~499). Değilse en yakın kapsamdan al.

- [ ] **Step 3: Atama/lead ekleme → acil notify**

`createBrief` ve `patchBrief`'te yeni assignee eklendiği yerde (lead_ids/worker_ids birleşimi işlendikten sonra), yeni eklenen her `U*` kişi için:
```js
  // Bildirim reformu: yeni atanan/lead → ACİL (anlık DM hakkı).
  if (NOTIFY_V2) {
    try {
      const bi = (await pool.query(`SELECT no, baslik, slack_url FROM briefs WHERE id=$1`, [briefId])).rows[0] || {};
      for (const uid of yeniAtananlar) if (/^U/.test(uid)) await notify(uid, { tip: 'atama', aciliyet: 'acil', text: `📌 #${bi.no} ${bi.baslik || ''} işine atandın`, link: bi.slack_url, briefId });
    } catch (e) { console.error('[writes] atama bildirimi:', e.message); }
  }
```
`yeniAtananlar`: mevcut atama diff mantığından gelen "bu işlemde eklenen" kullanıcı id listesi. Diff yoksa, INSERT edilen assignee id'lerini bir diziye toplayıp kullan. (createBrief'te tüm lead+worker'lar yenidir; patchBrief'te yalnız fark.)

- [ ] **Step 4: Parse + mevcut testler**

Run: `node --check server/writes.js && cd server && node --test writes-durum.test.js queue.test.js`
Expected: parse OK; 2 test paketi PASS (regresyon yok).

- [ ] **Step 5: Commit**

```bash
git add server/writes.js
git commit -m "feat(bildirim): writes.js üreticileri — atama/lead acil, blokeli/müşteri normal notify (BNS_NOTIFY_V2)"
```

---

### Task B2: termin-risk.js — thread yarısı yerine kişiye acil notify

**Files:**
- Modify: `scripts/termin-risk.js`

- [ ] **Step 1: notify + bayrak + kişi hedefleme ekle**

`scripts/termin-risk.js` başına:
```js
const { notify } = require('../server/notify');
const NOTIFY_V2 = process.env.BNS_NOTIFY_V2 === '1';
```
Ana döngüde, riskli brief için (mevcut `postThread(...)` çağrısının bulunduğu blok), V2 açıkken thread mesajı yerine kişilere acil notify:
```js
    if (NOTIFY_V2) {
      // 20sa tekrar-bastırma: aynı işe son 'termin' bildirimi 20 saatten yeniyse atla.
      const tazeMi = await notifTazeMi(b.id);   // aşağıda tanımlı
      if (!tazeMi) {
        const alicilar = [...(b.leads || []), ...(b.workers || [])].map(p => p && p.id).filter(id => /^U/.test(id || ''));
        for (const uid of new Set(alicilar)) await notify(uid, { tip: 'termin', aciliyet: 'acil', text: `⏰ #${b.no} ${b.marka || ''} — ${durumStr}`, link: b.slack_url, briefId: b.id });
        warned++;
      }
      continue;   // V2'de thread'e yazma
    }
```
`notifTazeMi` yardımcı fonksiyonu (dosya sonuna, DB erişimi için `pg` ya da mevcut fetch yerine doğrudan psql/pool — termin-risk şu an API'den okuyor; en basiti son 'termin' kaydını API yerine küçük bir kontrol tablosuyla değil, `notifications`tan sorgulamak. termin-risk node script'i pool'a erişebilir: `const { pool } = require('../server/db');`):
```js
const { pool } = require('../server/db');
async function notifTazeMi(briefId) {
  const r = await pool.query(`SELECT created_at FROM notifications WHERE brief_id=$1 AND tip='termin' ORDER BY id DESC LIMIT 1`, [briefId]);
  if (!r.rows[0]) return false;
  return (Date.now() - new Date(r.rows[0].created_at).getTime()) < 20 * 3600 * 1000;
}
```

- [ ] **Step 2: Parse + dry-run**

Run: `node --check scripts/termin-risk.js && BNS_NOTIFY_V2=1 node scripts/termin-risk.js --dry`
Expected: parse OK; dry çıktısı riskli işleri listeler, hata yok. (V2 kapalıyken eski davranış korunur — ayrıca `node scripts/termin-risk.js --dry` ile kontrol et.)

- [ ] **Step 3: Commit**

```bash
git add scripts/termin-risk.js
git commit -m "feat(bildirim): termin-risk V2'de kişiye acil notify (thread spam yerine), 20sa tekrar-bastırma"
```

---

## FAZ C — Dijest + scheduler

### Task C1: scripts/rapor-dijest.js — kişisel dijest

**Files:**
- Create: `scripts/rapor-dijest.js`
- Create: `scripts/run-dijest.sh`

- [ ] **Step 1: rapor-dijest.js'i yaz**

Mevcut `rapor-kisisel.js` içeriği (bugünün işleri: aktif/geciken satırları) korunur; ek olarak bekleyen `dijest_at IS NULL` bildirimleri eklenir. Argüman: `--slot=ogle` öğlen dijesti (ogle_dijest=false olanları atla).

```js
'use strict';
/**
 * rapor-dijest.js — Kişisel dijest (08:30 sabah / 13:30 öğle). Bekleyen bildirimler + bugünün işleri.
 * Kullanım: node scripts/rapor-dijest.js            → sabah slotu
 *           node scripts/rapor-dijest.js --slot=ogle → öğle slotu (ogle_dijest=false atlanır)
 * Test: BNS_REPORT_LIVE!=1 ise yalnız Görkem'e tek mesaj.
 */
const { trDate, deltaLabel, token, post, fetchEmbedded, GORKEM, DASHBOARD_URL, H } = require('./rapor-lib');
const { pool } = require('../server/db');

const SLOT_OGLE = process.argv.includes('--slot=ogle');

function briefLine(b) {
  const dh = b.deadline ? (b.deadline - Date.now()) / H : null;
  const dl = dh == null ? 'termin yok' : deltaLabel(dh);
  const gec = dh != null && dh <= 0 ? ' ⚠️' : '';
  return `• *#${b.no}* ${b.marka} — ${b.baslik} · ${b.durum}${b.priority ? ' ' + b.priority : ''} · ${dl}${gec}`;
}

async function main() {
  const tok = token();
  if (!tok) { console.error('SLACK token yok'); process.exit(1); }
  const live = process.env.BNS_REPORT_LIVE === '1';
  const d = await fetchEmbedded();
  const briefs = d.bns_briefs || [];
  const users = (d.bns_users || []).filter(u => /^U/.test(u.id));

  // Öğle slotunda ogle_dijest=false olanları çıkar.
  let skipIds = new Set();
  if (SLOT_OGLE) {
    const pr = await pool.query(`SELECT user_id FROM notify_prefs WHERE ogle_dijest=false`);
    skipIds = new Set(pr.rows.map(r => r.user_id));
  }

  let sent = 0; const previewAll = [];
  for (const u of users) {
    if (SLOT_OGLE && skipIds.has(u.id)) continue;
    // Bugünün işleri (müşteride hariç — calc.js aktif tanımı).
    const mine = briefs.filter(b =>
      b.durum !== 'musteride' && b.durum !== 'tamamlandi' &&
      ((b.workers || []).some(w => w && w.id === u.id) || (b.leads || []).some(l => l && l.id === u.id)));
    // Bekleyen bildirimler.
    const pend = (await pool.query(
      `SELECT id, text FROM notifications WHERE user_id=$1 AND dijest_at IS NULL ORDER BY id`, [u.id])).rows;
    if (!mine.length && !pend.length) continue;   // boşsa DM yok

    mine.sort((a, b) => (a.deadline || Infinity) - (b.deadline || Infinity));
    const L = [`🗓️ *Dijest — ${trDate()}${SLOT_OGLE ? ' (öğle)' : ''}*`];
    if (pend.length) { L.push('', `*Yeni gelişmeler (${pend.length})*`, ...pend.map(p => `• ${p.text}`)); }
    if (mine.length) { L.push('', `*Aktif işlerin (${mine.length})*`, ...mine.map(briefLine)); }
    L.push('', `🔗 ${DASHBOARD_URL}`);
    const text = L.join('\n');

    if (live) { await post(tok, u.id, text); }
    else { previewAll.push(`### ${u.name}\n${text}`); }
    // İşlenen bildirimleri işaretle.
    if (pend.length) await pool.query(`UPDATE notifications SET dijest_at=now() WHERE user_id=$1 AND dijest_at IS NULL`, [u.id]);
    sent++;
  }
  if (!live && previewAll.length) await post(tok, GORKEM, `🧪 *Dijest önizleme (${sent} kişi)*\n\n` + previewAll.join('\n\n———\n\n'));
  console.log(`dijest ${live ? 'CANLI' : 'TEST'} — ${sent} kişi${SLOT_OGLE ? ' (öğle)' : ''}`);
  await pool.end();
}
main().catch(e => { console.error('dijest hata:', e.message); process.exit(1); });
```

- [ ] **Step 2: run-dijest.sh'i yaz**

```sh
#!/bin/zsh
# Kişisel dijest — hft içi 08:30 (sabah) / 13:30 (öğle, --slot=ogle).
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/rapor-dijest.js "$@" >> logs/dijest.log 2>&1
```
Run: `chmod +x scripts/run-dijest.sh`

- [ ] **Step 3: Parse + test-modu koşum**

Run: `node --check scripts/rapor-dijest.js && node scripts/rapor-dijest.js`
Expected: parse OK; test modunda Görkem'e önizleme (canlı değil), "dijest TEST — N kişi" log'u, hata yok.

- [ ] **Step 4: Commit**

```bash
git add scripts/rapor-dijest.js scripts/run-dijest.sh
git commit -m "feat(bildirim): rapor-dijest.js — bekleyen bildirimler + bugünün işleri; sabah/öğle slotu; boşsa sessiz"
```

---

### Task C2: scheduler.js — cron değişiklikleri (bayrağa bağlı)

**Files:**
- Modify: `scripts/scheduler.js:68-88`

- [ ] **Step 1: Bayrak + cron düzenlemesi**

`scripts/scheduler.js`'te cron tanımlarının başına:
```js
const NOTIFY_V2 = process.env.BNS_NOTIFY_V2 === '1';
```
Mevcut satırları şöyle koşullandır:
```js
// Kişisel: V2'de dijest (08:30 + 13:30), eski sistemde 07:55 kisisel rapor.
if (NOTIFY_V2) {
  cron.schedule('30 8 * * 1-5', () => run('run-dijest.sh'), opts);
  cron.schedule('30 13 * * 1-5', () => run('run-dijest.sh --slot=ogle'), opts);
} else {
  cron.schedule('55 7 * * 1-5', () => run('run-kisisel-rapor.sh'), opts);
}
// Saatlik kanal/thread özetleri: V2'de KAPALI (gürültü kaynağı).
if (!NOTIFY_V2) {
  cron.schedule('0 9-19 * * 1-5', () => run('run-thread-ozet.sh'), opts);
  cron.schedule('30 9-19 * * 1-5', () => run('run-kanal-ozet.sh'), opts);
}
```
Not: `run()`'ın argümanlı script'i desteklediğini doğrula — desteklemiyorsa `run('run-dijest.sh', ['--slot=ogle'])` imzasına uyarlanmış ayrı bir wrapper `run-dijest-ogle.sh` yaz (tek satır: `node scripts/rapor-dijest.js --slot=ogle`). Basit yol: iki wrapper.

Eğer `run()` argüman geçemiyorsa, `scripts/run-dijest-ogle.sh` oluştur:
```sh
#!/bin/zsh
cd ~/benseno-tasarim-sistemi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; source ~/.zshrc 2>/dev/null
node scripts/rapor-dijest.js --slot=ogle >> logs/dijest.log 2>&1
```
ve cron: `cron.schedule('30 13 * * 1-5', () => run('run-dijest-ogle.sh'), opts);`

- [ ] **Step 2: Parse doğrula**

Run: `node --check scripts/scheduler.js`
Expected: çıktı yok.

- [ ] **Step 3: Commit**

```bash
git add scripts/scheduler.js scripts/run-dijest-ogle.sh
git commit -m "feat(bildirim): scheduler V2 — 08:30/13:30 dijest, saatlik thread/kanal özet kapalı (bayrağa bağlı)"
```

---

## FAZ D — Tercih paneli (API + UI)

### Task D1: /api/notify-prefs GET/POST

**Files:**
- Modify: `server/api.js` (yeni iki route)

- [ ] **Step 1: Route'ları ekle**

`server/api.js`'te diğer authGuard route'ların yanına:
```js
app.get('/api/notify-prefs', auth.authGuard, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM notify_prefs WHERE user_id=$1', [req.user.slack_id]);
    res.json(r.rows[0] || { ogle_dijest: true, tip_termin: true, tip_atama: true, tip_bloke: true, sessiz_bas: 19, sessiz_bit: 8 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notify-prefs', auth.authGuard, async (req, res) => {
  try {
    const b = req.body || {};
    const bool = (v, d) => typeof v === 'boolean' ? v : d;
    const hour = (v, d) => (Number.isInteger(v) && v >= 0 && v <= 23) ? v : d;
    await pool.query(
      `INSERT INTO notify_prefs (user_id, ogle_dijest, tip_termin, tip_atama, tip_bloke, sessiz_bas, sessiz_bit)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id) DO UPDATE SET ogle_dijest=$2, tip_termin=$3, tip_atama=$4, tip_bloke=$5, sessiz_bas=$6, sessiz_bit=$7`,
      [req.user.slack_id, bool(b.ogle_dijest, true), bool(b.tip_termin, true), bool(b.tip_atama, true), bool(b.tip_bloke, true), hour(b.sessiz_bas, 19), hour(b.sessiz_bit, 8)]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 2: Parse doğrula**

Run: `node --check server/api.js`
Expected: çıktı yok.

- [ ] **Step 3: Commit**

```bash
git add server/api.js
git commit -m "feat(bildirim): /api/notify-prefs GET/POST (authGuard, kişi kendi satırı)"
```

---

### Task D2: Profil'de bildirim tercihleri kartı

**Files:**
- Modify: `dashboard/app/screens/Profile.jsx`

- [ ] **Step 1: Tercih kartı bileşenini ekle**

Profil ekranında (yalnız kişi kendi profiline bakıyorsa: `u.id === currentUser?.slack_id`), mevcut kartların yanına:
```jsx
function NotifPrefsCard() {
  const [p, setP] = React.useState(null);
  React.useEffect(() => {
    if (typeof window.bnsApiGet === "function")
      window.bnsApiGet("/api/notify-prefs").then(setP).catch(() => setP({}));
  }, []);
  if (!p) return null;
  const save = (patch) => {
    const next = { ...p, ...patch }; setP(next);
    window.bnsApiPost && window.bnsApiPost("/api/notify-prefs", next);
  };
  const Row = ({ k, label }) => (
    <label style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",cursor:"pointer"}}>
      <span style={{font:"400 13px/1.4 var(--font-sans)",color:"var(--ink-2)"}}>{label}</span>
      <input type="checkbox" checked={p[k] !== false} onChange={e => save({ [k]: e.target.checked })}/>
    </label>
  );
  return (
    <div className="bns-card" style={{padding:16}}>
      <div style={{font:"600 13px/1 var(--font-sans)",marginBottom:10}}>Bildirim tercihleri</div>
      <Row k="ogle_dijest" label="Öğle dijesti (13:30)"/>
      <Row k="tip_termin" label="Termin uyarısı — anlık"/>
      <Row k="tip_atama" label="Atama/lead — anlık"/>
      <Row k="tip_bloke" label="Bloke/müşteri — anlık"/>
      <div style={{display:"flex",gap:8,alignItems:"center",marginTop:10}}>
        <span style={{font:"400 13px var(--font-sans)",color:"var(--ink-2)"}}>Sessiz saat</span>
        <select value={p.sessiz_bas ?? 19} onChange={e => save({ sessiz_bas: +e.target.value })}>
          {Array.from({length:24},(_,i)=><option key={i} value={i}>{String(i).padStart(2,"0")}:00</option>)}
        </select>
        <span>–</span>
        <select value={p.sessiz_bit ?? 8} onChange={e => save({ sessiz_bit: +e.target.value })}>
          {Array.from({length:24},(_,i)=><option key={i} value={i}>{String(i).padStart(2,"0")}:00</option>)}
        </select>
      </div>
    </div>
  );
}
```
Kartı yalnız kendi profilinde render et: `{u.id === (currentUser && currentUser.slack_id) && <NotifPrefsCard/>}`.

- [ ] **Step 2: bnsApiPost yardımcısı var mı doğrula**

Run: `grep -n "bnsApiPost\|bnsApiGet" dashboard/app/App.jsx`
Expected: `bnsApiGet` tanımlı. `bnsApiPost` yoksa, App.jsx'te `bnsApiGet` yanına ekle:
```js
window.bnsApiPost = async (path, body) => {
  const tok = localStorage.getItem(BNS_TOKEN_KEY);
  const r = await fetch((window.BNS_API || DEFAULT_API) + path, { method: "POST",
    headers: { "content-type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) },
    body: JSON.stringify(body) });
  return r.json();
};
```
(Anahtar adları App.jsx'teki mevcut isimlerle eşleşmeli — `BNS_TOKEN_KEY`/`DEFAULT_API` neyse onu kullan.)

- [ ] **Step 3: CI + bundle**

Run: `bash scripts/ci-check.sh`
Expected: 🟢 CI KAPISI GEÇTİ (JSX derlenir).

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/screens/Profile.jsx dashboard/app/App.jsx
git commit -m "feat(bildirim): Profil'de bildirim tercihleri kartı + bnsApiPost yardımcısı"
```

---

## FAZ E — İş & marka bildirim rozetleri

### Task E1: bns_notif gruplu sayım + seen API

**Files:**
- Modify: `server/queries.js` (getEmbedded'e bns_notif ekle — kişiye özel olmadığı için dikkat: aşağıya bak)
- Modify: `server/api.js` (per-user rozet: /api/embedded kişiye özel değil → ayrı uç)

**Önemli:** `/api/embedded` tüm kullanıcılar için ortak (kişiye özel değil, önbelleğe alınıyor). Rozet kişiye özel (`brief_notif_seen`) olduğundan bns_notif'i embedded'e KOYMAYIZ; ayrı kişisel uç kullanırız.

- [ ] **Step 1: Kişisel rozet ucu ekle**

`server/api.js`:
```js
// İşe/markaya göre TEKİL bildirim sayıları — kişinin seen zamanından sonrası.
app.get('/api/notif-counts', auth.authGuard, async (req, res) => {
  try {
    const uid = req.user.slack_id;
    // Tekilleştirme: (brief_id, tip, text) aynı olayın çok-alıcılı kopyalarını 1 sayar.
    const r = await pool.query(`
      WITH tekil AS (
        SELECT DISTINCT ON (n.brief_id, n.tip, n.text) n.brief_id, n.marka, n.created_at
        FROM notifications n
        WHERE n.brief_id IS NOT NULL
        ORDER BY n.brief_id, n.tip, n.text, n.created_at DESC
      )
      SELECT t.brief_id, t.marka, count(*) AS cnt, max(t.created_at) AS last_at
      FROM tekil t
      LEFT JOIN brief_notif_seen s ON s.user_id=$1 AND s.brief_id=t.brief_id
      WHERE t.created_at > COALESCE(s.seen_at, now() - interval '7 days')
      GROUP BY t.brief_id, t.marka`, [uid]);
    const briefs = {}, markalar = {};
    for (const row of r.rows) {
      briefs[row.brief_id] = { count: +row.cnt, last_at: row.last_at };
      if (row.marka) { markalar[row.marka] = markalar[row.marka] || { count: 0, last_at: null };
        markalar[row.marka].count += +row.cnt;
        if (!markalar[row.marka].last_at || row.last_at > markalar[row.marka].last_at) markalar[row.marka].last_at = row.last_at; }
    }
    res.json({ briefs, markalar });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bir işin tekil bildirim listesi (son 30).
app.get('/api/briefs/:id/notifications', auth.authGuard, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT DISTINCT ON (tip, text) tip, text, link, created_at
      FROM notifications WHERE brief_id=$1
      ORDER BY tip, text, created_at DESC LIMIT 30`, [+req.params.id]);
    res.json({ notifications: r.rows.sort((a,b)=> new Date(b.created_at)-new Date(a.created_at)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Görüldü işaretle (rozet söner).
app.post('/api/briefs/:id/notif-seen', auth.authGuard, async (req, res) => {
  try {
    await pool.query(`INSERT INTO brief_notif_seen (user_id, brief_id, seen_at) VALUES ($1,$2,now())
      ON CONFLICT (user_id, brief_id) DO UPDATE SET seen_at=now()`, [req.user.slack_id, +req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 2: Parse doğrula**

Run: `node --check server/api.js`
Expected: çıktı yok.

- [ ] **Step 3: Commit**

```bash
git add server/api.js
git commit -m "feat(bildirim): /api/notif-counts (tekilleştirilmiş iş/marka rozet sayıları) + iş bildirim listesi + notif-seen"
```

---

### Task E2: Dashboard rozetleri + drawer bölümü + marka accordion

**Files:**
- Modify: `dashboard/app/App.jsx` (notif-counts fetch → window.BNS_NOTIF)
- Modify: `dashboard/app/BriefTable.jsx`, `dashboard/app/screens/Kanban.jsx` (rozet)
- Modify: `dashboard/app/BriefDrawer.jsx` (Bildirimler bölümü)
- Modify: `dashboard/app/screens/Brand.jsx` (marka accordion)

- [ ] **Step 1: App.jsx — notif sayımlarını yükle**

App.jsx'te veri yüklemeye ek: giriş yapılıysa `/api/notif-counts` çekilir ve `window.BNS_NOTIF = { briefs, markalar }` set edilir; poll'a dahil edilir (mevcut embedded poll periyoduyla).
```js
const loadNotifCounts = async () => {
  try { if (typeof window.bnsApiGet === "function") window.BNS_NOTIF = await window.bnsApiGet("/api/notif-counts"); } catch (e) {}
};
```
İlk yüklemede + poll'da çağır; state'e (`notifCounts`) koyup prop olarak da geçilebilir. En basiti global + bir `notifTick` state ile yeniden render tetiklemek.

- [ ] **Step 2: Rozet bileşeni (Atoms.jsx veya inline)**

```jsx
function NotifDot({ n }) {
  if (!n || !n.count) return null;
  return <span title={`${n.count} yeni bildirim`} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
    minWidth:16,height:16,padding:"0 4px",borderRadius:8,background:"var(--info)",color:"#fff",
    font:"600 10px/1 var(--font-mono)",marginLeft:6}}>{n.count}</span>;
}
```
BriefTable satırında iş adının yanına ve Kanban kartında `<NotifDot n={(window.BNS_NOTIF && window.BNS_NOTIF.briefs || {})[b.id]}/>`.

- [ ] **Step 3: BriefDrawer — Bildirimler bölümü**

BriefDrawer'da (b mevcut), yeni bir bölüm:
```jsx
function BriefNotifs({ briefId }) {
  const [items, setItems] = React.useState(null);
  React.useEffect(() => {
    if (typeof window.bnsApiGet === "function")
      window.bnsApiGet(`/api/briefs/${briefId}/notifications`).then(r => setItems(r.notifications || [])).catch(() => setItems([]));
    // Açılınca görüldü işaretle (rozet söner).
    window.bnsApiPost && window.bnsApiPost(`/api/briefs/${briefId}/notif-seen`, {});
  }, [briefId]);
  if (!items || !items.length) return null;
  const icon = { termin:"⏰", atama:"📌", bloke:"⛔", musteri:"↩️", statu:"🔄", genel:"🔔" };
  return (
    <div style={{marginTop:14}}>
      <div style={{font:"600 12px/1 var(--font-sans)",color:"var(--ink-3)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Bildirimler</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {items.map((n,i)=>(
          <div key={i} style={{display:"flex",gap:8,font:"400 13px/1.4 var(--font-sans)",color:"var(--ink-2)"}}>
            <span>{icon[n.tip]||"🔔"}</span><span style={{flex:1}}>{n.text}</span>
            <span style={{font:"400 11px var(--font-mono)",color:"var(--ink-4)"}}>{new Date(n.created_at).toLocaleDateString("tr-TR")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```
Drawer gövdesine `<BriefNotifs briefId={b.id}/>` eklenir.

- [ ] **Step 4: Brand.jsx — marka bildirim accordion'u**

Brand sayfası üstüne, `window.BNS_NOTIF.markalar[brand]` varsa bir accordion başlığı (`🔔 {count} yeni bildirim`), açılınca o markanın işlerinin bildirimleri (her iş için `/api/briefs/:id/notifications` ya da tek toplu uç — v1'de mevcut per-brief uç yeterli; işleri gezip ilk N'i göster). Satıra tıklayınca ilgili işin drawer'ı açılır (`onOpenBrief`).

- [ ] **Step 5: CI + bundle build**

Run: `bash scripts/ci-check.sh && bash scripts/build-dashboard.sh && bash scripts/build-v2.sh`
Expected: 🟢 CI; bundle'lar derlenir.

- [ ] **Step 6: Commit**

```bash
git add dashboard/app/App.jsx dashboard/app/BriefTable.jsx dashboard/app/screens/Kanban.jsx dashboard/app/BriefDrawer.jsx dashboard/app/screens/Brand.jsx dashboard/app/Atoms.jsx
git commit -m "feat(bildirim): iş/marka bildirim rozetleri + BriefDrawer Bildirimler bölümü + marka accordion"
```

---

## FAZ F — Doğrulama & kademeli açılış

### Task F1: Uçtan uca doğrulama (V2 kapalı → açık)

- [ ] **Step 1: Tüm testler + CI + consistency**

Run:
```bash
cd ~/benseno-tasarim-sistemi
bash scripts/ci-check.sh
cd server && node --test notify.test.js writes-durum.test.js queue.test.js ody-tools.test.js && cd ..
node scripts/consistency-check.js
```
Expected: CI 🟢; tüm test paketleri PASS; consistency 26/26.

- [ ] **Step 2: V2 kapalı deploy (davranış değişmez)**

Run: `bash scripts/deploy.sh api && bash scripts/deploy.sh dashboard`
Expected: deploy başarılı; `BNS_NOTIFY_V2` Railway'de set DEĞİL → eski davranış aynen sürer. Migration zaten uygulandı (Task A1).

- [ ] **Step 3: Sınırlı canlı test**

Railway'de geçici olarak yalnız test için: `BNS_NOTIFY_V2=1` ayarla; `BNS_REPORT_LIVE=1` OLMADAN `node scripts/rapor-dijest.js` (Görkem'e önizleme). termin-risk `--dry` ile kişi-notify üretimini gör. Doğrulanınca tam açılış.

- [ ] **Step 4: Tam açılış**

Railway env: `BNS_NOTIFY_V2=1` kalıcı. İzle: bir gün sonra dijest DM'leri 08:30/13:30'da gitti mi, saatlik kanal/thread özetleri durdu mu, iş rozetleri görünüyor mu.

- [ ] **Step 5: İzleme notu**

Geri dönüş: sorun olursa Railway'de `BNS_NOTIFY_V2` sil → eski davranış döner (kod silinmez). Kalıcılaşınca ayrı bir temizlik PR'ında `rapor-kisisel.js`, `thread-ozet.js`, `kanal-ozet.js` ve bayrak dalları kaldırılabilir (v1 kapsamı DIŞI).

---

## Self-Review Notları

- **Spec kapsamı:** §1 veri modeli→A1; §2 notify→A3; §3 üreticiler→B1/B2; §4 dijest→C1; §5 scheduler→C2; §6 tercih→D1/D2; §7 rozetler→E1/E2; §8 kademeli→F1; §9 test→A3/C1/F1. Tümü karşılandı.
- **Bilinen belirsizlikler (uygulayıcı doğrulasın):** `run()` argüman geçebiliyor mu (C2'de iki-wrapper alternatifi verildi); `yeniAtananlar` diff kaynağı (B1'de createBrief=hepsi, patchBrief=fark kuralı verildi); App.jsx token/anahtar adları (D2'de mevcut isme uyarlanacak). Bunlar plana gömülü fallback'lerle çözülür.
- **YAGNI:** yönetici tüm-ekip görünümü, Ody proaktif, bildirim arama v2'ye ertelendi (spec §kapsam-dışı ile tutarlı).
