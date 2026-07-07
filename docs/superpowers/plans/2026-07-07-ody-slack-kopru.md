# Ody × Slack Canlı Bilgi Köprüsü — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ody'nin gerektiğinde Slack'ten canlı bilgi (kanal mesajı, brief thread, arama, kişi durumu) çekip yorumlaması ve TTL'li DB önbelleğinde saklaması; kullanıcı-başına kanal-üyeliği erişim filtresi + Görkem bypass ile.

**Architecture:** Yeni `server/ody-slack.js` doğrudan Slack Web API'yi çağırır (SLACK_BOT_TOKEN + arama için SLACK_USER_TOKEN — ikisi de benseno-api'de mevcut). `ody-tools.js`'e `slack_sorgu` tool'u eklenir, `ctx.user.slack_id` ile erişim filtrelenir. Sonuçlar `ody_slack_cache` (migration 0013) tablosunda 6sa TTL ile tutulur.

**Tech Stack:** Node + pg (pool), Slack Web API (fetch), mevcut `/api/chat` tool döngüsü.

**Spec:** `docs/superpowers/specs/2026-07-07-ody-slack-kopru-design.md`

**Bağlam (doğrulandı):**
- `server/api.js:16` `const odyTools = require('./ody-tools')`; `:568` `const ctx = { user: req.user, isAdmin, range, ed }`; `:637` `tools: odyTools.TOOLS`; `:663` `odyTools.runTool(b.name, b.input, ctx)`. Sistem promptu ~`:598`.
- `ody-tools.js`: `defs.X = { description, input_schema, run(input, ctx) }`; `runTool` `defs[name].run(input, ctx)` çağırır; `TOOLS` = defs'ten türetilir.
- `server/slack.js`: `channelForBrand(marka)`, `hasToken()`, `CHANNELS` dışa verili; workspace `process.env.BNS_SLACK_WORKSPACE || 'benseno'`.
- briefler: `slack_channel` (C… id) + `slack_ts` DB'de (queries/writes'ta kullanılıyor).
- Görkem slack_id: `U030C48PL23`.

---

### Task 1: Migration 0013 — ody_slack_cache

**Files:** Create `server/migrations/0013_ody_slack_cache.sql`

- [ ] **Step 1: Migration dosyası**
```sql
-- Ody × Slack köprüsü: çekilen Slack bilgisinin TTL'li önbelleği (6sa kod tarafında).
CREATE TABLE IF NOT EXISTS ody_slack_cache (
  id BIGSERIAL PRIMARY KEY,
  sorgu_tipi TEXT NOT NULL,            -- kanal_mesaj|thread|arama|kisi_durum
  anahtar    TEXT NOT NULL,            -- channel id / #no / arama kelimesi / kisi slack_id
  user_scope TEXT NOT NULL,            -- 'gorkem' | askerin slack_id'si
  ham_ozet   TEXT,
  yorum      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ody_slack_cache_lookup
  ON ody_slack_cache (sorgu_tipi, anahtar, user_scope, created_at DESC);
```

- [ ] **Step 2: Commit** (migration çalıştırma — deploy fazında)
```bash
git add server/migrations/0013_ody_slack_cache.sql
git commit -m "feat(ody-slack): migration 0013 — ody_slack_cache tablosu"
```

---

### Task 2: `server/ody-slack.js` — Slack API sarmalayıcı + saf yardımcılar (TDD)

**Files:** Create `server/ody-slack.js`, `server/ody-slack.test.js`

- [ ] **Step 1: Başarısız test yaz** — `server/ody-slack.test.js`:
```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const s = require('./ody-slack');

test('erisebilirMi: üye kanal geçer, üye olmayan elenir', () => {
  const uch = new Set(['C1', 'C2']);
  assert.equal(s.erisebilirMi(uch, 'C1', 'U1'), true);
  assert.equal(s.erisebilirMi(uch, 'C9', 'U1'), false);
});
test('erisebilirMi: Görkem her kanalı geçer (üye olmasa da)', () => {
  const uch = new Set([]);
  assert.equal(s.erisebilirMi(uch, 'C9', 'U030C48PL23'), true);
});
test('erisebilirMi: DM (D…/G…) her zaman elenir, Görkem dahil', () => {
  assert.equal(s.erisebilirMi(new Set(['D1']), 'D1', 'U030C48PL23'), false);
});
test('cacheTaze: 6sa içi taze, dışı bayat', () => {
  const now = Date.parse('2026-07-07T12:00:00Z');
  assert.equal(s.cacheTaze({ created_at: '2026-07-07T09:00:00Z' }, now), true);   // 3sa
  assert.equal(s.cacheTaze({ created_at: '2026-07-07T05:00:00Z' }, now), false);  // 7sa
  assert.equal(s.cacheTaze(null, now), false);
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör** — `node --test server/ody-slack.test.js` → FAIL (modül yok).

- [ ] **Step 3: `server/ody-slack.js` yaz**
```js
'use strict';
// Ody × Slack köprüsü — doğrudan Slack Web API. SLACK_BOT_TOKEN (history/replies/presence/
// users.conversations) + SLACK_USER_TOKEN (search; yoksa arama kapalı). Erişim: kullanıcı-başı
// kanal üyeliği; Görkem (GORKEM) bypass; DM'ler her zaman hariç.
const { pool } = require('./db');

const GORKEM = 'U030C48PL23';
const TTL_MS = 6 * 3600 * 1000;
const BOT = () => process.env.SLACK_BOT_TOKEN;
const USER = () => process.env.SLACK_USER_TOKEN;

// ── Saf yardımcılar (test edilir) ────────────────────────────────
function erisebilirMi(userChannels, channelId, askerSlackId) {
  if (!channelId || /^[DG]/.test(channelId)) return false;   // DM/group-DM her zaman hariç
  if (askerSlackId === GORKEM) return true;                   // Görkem bypass
  return !!userChannels && userChannels.has(channelId);
}
function cacheTaze(row, now) {
  if (!row || !row.created_at) return false;
  return (now - Date.parse(row.created_at)) < TTL_MS;
}

// ── Slack Web API (best-effort; hata → null) ─────────────────────
async function slackGet(method, params, token) {
  if (!token) return null;
  try {
    const qs = new URLSearchParams(params).toString();
    const r = await fetch(`https://slack.com/api/${method}?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (!j.ok) { console.error('[ody-slack]', method, j.error); return null; }
    return j;
  } catch (e) { console.error('[ody-slack]', method, e.message); return null; }
}

async function userKanallari(slackUserId) {
  const j = await slackGet('users.conversations',
    { user: slackUserId, types: 'public_channel,private_channel', limit: 1000, exclude_archived: true }, BOT());
  return new Set((j && j.channels || []).map(c => c.id));
}
async function kanalMesajlari(channelId, limit = 50) {
  const j = await slackGet('conversations.history', { channel: channelId, limit }, BOT());
  return j && j.messages || null;
}
async function threadDokumu(channelId, ts, limit = 50) {
  const j = await slackGet('conversations.replies', { channel: channelId, ts, limit }, BOT());
  return j && j.messages || null;
}
async function slackArama(query, limit = 20) {
  if (!USER()) return { disabled: true };   // user token yok → arama kapalı
  const j = await slackGet('search.messages', { query, count: limit }, USER());
  return j && j.messages && j.messages.matches || null;
}
async function kisiDurumu(slackUserId) {
  const pres = await slackGet('users.getPresence', { user: slackUserId }, BOT());
  const prof = await slackGet('users.profile.get', { user: slackUserId }, BOT());
  if (!pres && !prof) return null;
  const p = (prof && prof.profile) || {};
  return { presence: pres && pres.presence || 'unknown', status_text: p.status_text || '', status_emoji: p.status_emoji || '' };
}

// ── Önbellek ──────────────────────────────────────────────────────
async function cacheOku(tip, anahtar, scope) {
  const r = await pool.query(
    `SELECT ham_ozet, created_at FROM ody_slack_cache WHERE sorgu_tipi=$1 AND anahtar=$2 AND user_scope=$3 ORDER BY created_at DESC LIMIT 1`,
    [tip, anahtar, scope]);
  return r.rows[0] || null;
}
async function cacheYaz(tip, anahtar, scope, ham) {
  await pool.query(`INSERT INTO ody_slack_cache (sorgu_tipi, anahtar, user_scope, ham_ozet) VALUES ($1,$2,$3,$4)`,
    [tip, anahtar, scope, String(ham).slice(0, 8000)]);
}

module.exports = { GORKEM, TTL_MS, erisebilirMi, cacheTaze, userKanallari,
  kanalMesajlari, threadDokumu, slackArama, kisiDurumu, cacheOku, cacheYaz };
```

- [ ] **Step 4: Test geçsin** — `node --test server/ody-slack.test.js` → 4/4 PASS.

- [ ] **Step 5: Commit**
```bash
git add server/ody-slack.js server/ody-slack.test.js
git commit -m "feat(ody-slack): ody-slack.js — Slack API sarmalayıcı + erişim/cache yardımcıları (TDD)"
```

---

### Task 3: `ody-tools.js` — `slack_sorgu` tool'u

**Files:** Modify `server/ody-tools.js`

- [ ] **Step 1: Modülü require et** — dosya başındaki require'lara ekle:
```js
const odySlack = require('./ody-slack');
```

- [ ] **Step 2: Tool tanımını ekle** (diğer `defs.X` tanımlarının yanına, `const TOOLS = ...`'tan ÖNCE):
```js
defs.slack_sorgu = {
  description: "Slack'ten CANLI bilgi çek (DB'de olmayan taze veri gerektiğinde). mod: " +
    "kanal_mesaj (bir markanın kanalındaki son mesajlar; marka gerekir) | " +
    "thread (bir brief'in #no Slack thread'i ham; no gerekir) | " +
    "arama (anahtar kelimeyle tüm kanallar; SLACK_USER_TOKEN yoksa kapalı) | " +
    "kisi_durum (kişinin tatil/izin/çevrimiçi durumu; kisi gerekir). " +
    "Dönen ham veriyi YORUMLA. Kullanıcı yalnız ERİŞTİĞİ kanalların bilgisini görür.",
  input_schema: { type: 'object', required: ['mod'], properties: {
    mod: { type: 'string', enum: ['kanal_mesaj', 'thread', 'arama', 'kisi_durum'] },
    marka: { type: 'string' }, no: { type: 'number' }, kelime: { type: 'string' }, kisi: { type: 'string' },
  } },
  run: async (input, ctx) => {
    const asker = (ctx && ctx.user && ctx.user.slack_id) || '';
    const scope = asker === odySlack.GORKEM ? 'gorkem' : (asker || 'anon');
    const now = Date.now();
    const mod = input.mod;

    // kişi durumu: erişim-filtresiz (gizli değil)
    if (mod === 'kisi_durum') {
      const person = resolvePerson(ctx.ed, input.kisi);   // mevcut yardımcı: isim/id → {id,...}
      if (!person || person.belirsiz) return { hata: 'kişi bulunamadı/belirsiz', adaylar: person && person.adaylar };
      const key = person.id;
      const cached = await odySlack.cacheOku('kisi_durum', key, 'genel');
      if (odySlack.cacheTaze(cached, now)) return { kaynak: 'cache', durum: JSON.parse(cached.ham_ozet) };
      const d = await odySlack.kisiDurumu(person.id);
      if (!d) return { hata: 'Slack durum alınamadı' };
      await odySlack.cacheYaz('kisi_durum', key, 'genel', JSON.stringify(d));
      return { kaynak: 'slack', kisi: person.name || person.id, durum: d };
    }

    // Diğer modlar erişim-filtreli — kullanıcının kanalları
    const userCh = asker === odySlack.GORKEM ? null : await odySlack.userKanallari(asker);

    if (mod === 'kanal_mesaj') {
      // marka → kanal id: markanın en güncel brief'inin slack_channel'ı (gerçek C… id)
      const q = await pool.query(
        `SELECT b.slack_channel FROM briefs b LEFT JOIN brands br ON br.id=b.marka_id
         WHERE br.name ILIKE $1 AND b.slack_channel IS NOT NULL ORDER BY b.id DESC LIMIT 1`, [`%${input.marka || ''}%`]);
      const ch = q.rows[0] && q.rows[0].slack_channel;
      if (!ch) return { hata: 'marka kanalı bulunamadı' };
      if (!odySlack.erisebilirMi(userCh, ch, asker)) return { hata: 'bu kanala erişimin yok' };
      const cached = await odySlack.cacheOku('kanal_mesaj', ch, scope);
      if (odySlack.cacheTaze(cached, now)) return { kaynak: 'cache', mesajlar: JSON.parse(cached.ham_ozet) };
      const msgs = await odySlack.kanalMesajlari(ch);
      if (!msgs) return { hata: 'kanal mesajları alınamadı' };
      const slim = msgs.slice(0, 50).map(m => ({ user: m.user, text: (m.text || '').slice(0, 500), ts: m.ts }));
      await odySlack.cacheYaz('kanal_mesaj', ch, scope, JSON.stringify(slim));
      return { kaynak: 'slack', kanal: ch, mesajlar: slim };
    }

    if (mod === 'thread') {
      const q = await pool.query('SELECT slack_channel, slack_ts, no FROM briefs WHERE no=$1', [input.no]);
      const b = q.rows[0];
      if (!b || !b.slack_channel || !b.slack_ts) return { hata: 'brief thread bulunamadı' };
      if (!odySlack.erisebilirMi(userCh, b.slack_channel, asker)) return { hata: 'bu iş kanalına erişimin yok' };
      const cached = await odySlack.cacheOku('thread', String(input.no), scope);
      if (odySlack.cacheTaze(cached, now)) return { kaynak: 'cache', mesajlar: JSON.parse(cached.ham_ozet) };
      const msgs = await odySlack.threadDokumu(b.slack_channel, b.slack_ts);
      if (!msgs) return { hata: 'thread alınamadı' };
      const slim = msgs.slice(0, 50).map(m => ({ user: m.user, text: (m.text || '').slice(0, 500), ts: m.ts }));
      await odySlack.cacheYaz('thread', String(input.no), scope, JSON.stringify(slim));
      return { kaynak: 'slack', no: input.no, mesajlar: slim };
    }

    if (mod === 'arama') {
      const matches = await odySlack.slackArama(input.kelime || '');
      if (matches && matches.disabled) return { hata: 'Slack araması şu an kapalı (SLACK_USER_TOKEN yok)' };
      if (!matches) return { hata: 'arama yapılamadı' };
      // erişim filtresi: yalnız kullanıcının eriştiği kanaldaki eşleşmeler (Görkem hepsi)
      const filt = matches.filter(m => odySlack.erisebilirMi(userCh, m.channel && m.channel.id, asker))
        .slice(0, 20).map(m => ({ kanal: m.channel && m.channel.name, user: m.username, text: (m.text || '').slice(0, 400), ts: m.ts }));
      const key = (input.kelime || '').slice(0, 120);
      await odySlack.cacheYaz('arama', key, scope, JSON.stringify(filt));
      return { kaynak: 'slack', kelime: input.kelime, sonuc: filt };
    }

    return { hata: 'bilinmeyen mod' };
  },
};
```
NOT: `resolvePerson`, `pool` bu dosyada zaten mevcut (diğer tool'lar kullanıyor) — teyit et; değilse üstteki require'lara `pool` ekle (`const { pool } = require('./db')`).

- [ ] **Step 3: Syntax** — `node --check server/ody-tools.js` → temiz. Mevcut ody-tools testi: `node --test server/ody-tools.test.js` → yeşil kalmalı.

- [ ] **Step 4: Commit**
```bash
git add server/ody-tools.js
git commit -m "feat(ody-slack): slack_sorgu tool'u (kanal/thread/arama/kişi durum) + erişim filtresi + cache"
```

---

### Task 4: `/api/chat` sistem promptu yönergesi

**Files:** Modify `server/api.js`

- [ ] **Step 1: Prompt satırına ekle** — sistem promptu birleştirmesine (~`:598` civarı, nitel-tool yönergesinin yanına) kısa cümle:
```js
      `Slack'te olan TAZE bilgi gerektiğinde (kanalda bugün ne konuşuldu, bir işin ham thread'i, bir konuyu arama, kişinin tatil/izin durumu) slack_sorgu tool'unu çağır ve dönen ham veriyi yorumla. Kullanıcı yalnız eriştiği kanalların bilgisini görür — erişim yoksa bunu kibarca belirt. ` +
```
(Mevcut string-birleştirme desenine uy; ctx zaten `slack_sorgu`'yu `req.user.slack_id` ile besliyor — ek kod gerekmez.)

- [ ] **Step 2: Syntax** — `node --check server/api.js` → temiz.

- [ ] **Step 3: Commit**
```bash
git add server/api.js
git commit -m "feat(ody-slack): Ody sistem promptuna slack_sorgu yönergesi"
```

---

### Task 5: Deploy + prod migration + doğrulama

**Files:** (yok)

- [ ] **Step 1: CI** — `bash scripts/ci-check.sh` → 🟢; `node --test server/ody-slack.test.js` → 4/4.

- [ ] **Step 2: Deploy API** — `bash scripts/deploy.sh api` → 🟢.

- [ ] **Step 3: Prod migration 0013** — yeni image geldikten sonra:
  `railway ssh --service benseno-api "node scripts/migrate.js status"` → 0013 `[ ]`
  `railway ssh --service benseno-api "node scripts/migrate.js"` → 0013 uygulanır
  (0009-0012 zaten `[✓]` — yalnız 0013 çalışır.)

- [ ] **Step 4: Prod dry doğrulama** — Ody chat'ten (giriş yapmış kullanıcıyla):
  - "Bir markanın kanalında bugün ne konuşuldu?" → erişimi olan kanal döner; olmayan kullanıcıda "erişimin yok"; Görkem'de her kanal.
  - "X kişisi tatilde mi?" → Slack durum döner.
  - "arama: müşteri şikayeti" → SLACK_USER_TOKEN varsa sonuç (yeni eklendi), yoksa "kapalı".
  - İkinci aynı sorgu <6sa içinde → `kaynak: cache`.

---

## Self-Review Notları
- **Spec kapsamı:** 4 mod (Task 3), doğrudan Slack API (Task 2), cache+TTL (Task 1+2), erişim filtresi+Görkem bypass+DM hariç (Task 2 `erisebilirMi` + Task 3 kullanımı), arama SLACK_USER_TOKEN'a bağlı (Task 2 `slackArama`) → tümü karşılandı.
- **İsim tutarlılığı:** `erisebilirMi`, `cacheTaze`, `cacheOku/Yaz`, `userKanallari` ody-slack.js'te tanımlı, ody-tools.js'te aynı adla çağrılıyor. `GORKEM='U030C48PL23'` tek yerde.
- **Erişim testi:** `erisebilirMi` saf ve testli (üye/üye-değil/Görkem/DM) — gizlilik kuralının kalbi.
- **Şüpheli/teyit:** ody-tools.js'te `pool` ve `resolvePerson` erişilebilir olmalı (diğer tool'lar kullanıyor — uygulamada teyit; değilse require ekle). `users.conversations(user=...)` bot token'ın kapsamına bağlı; özel kanallarda bot üye değilse o kanal kullanıcının listesinde görünmeyebilir — bu güvenli tarafta (daha kısıtlı) kalır.
