# Brief Oluşturma Yeniden Tasarımı — İmplementasyon Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (önerilen, batch+checkpoint) or subagent-driven-development. Adımlar checkbox (`- [ ]`).

**Goal:** Brief oluşturmayı 3-rol modeline (işi-yapan/lead/gözlemci) çevir, departmanı işi yapanlardan türet, Slack thread'e dosya yükleme ekle — API + dashboard + Slack + docs tutarlı.

**Architecture:** DB rolleri yeniden kullanılır: `contributor`=işi-yapan, `lead`=lead (çoklu), `gozlemci`=gözlemci; `editor` rolü + `reviewer` kavramı kalkar. Dept worker'ların `users.dept`'inden virgül-join türetilir. Dosyalar base64-JSON ile API'ye gider, API Slack external-upload ile thread'e yükler, `brief_attachments`'a yazılır. DB sıfır-veri → migrasyon yok.

**Tech Stack:** Node/Express (server, zero-new-deps), Postgres (pg), Zod, @slack/bolt (bot), React+esbuild (dashboard), Slack Web API (raw fetch).

**Verification:** Proje test framework'ü yok → her görev `node --check`/`zsh -n` + canlı API curl + build + smoke ile doğrulanır (oturum boyunca kullanılan tarz). Deploy: API stamp-trick, bot git push, dashboard build+push.

**Deploy sırası:** API önce (yeni embedded shape + endpoint), sonra dashboard + bot birlikte.

---

## Faz 1 — API (server/): schema + writes + queries

### Task 1: Zod şemaları — yeni rol alanları

**Files:** Modify `server/writes.js` (briefCreate ~21-39, briefPatch ~41-55)

- [ ] **Step 1:** `briefCreate` şemasında `atanan_ids`/`editor_ids` satırlarını sil, yerine ekle:

```js
  worker_ids: z.array(zUserId).min(1, 'en az bir işi yapan kişi gerekli'),  // = contributor rolü
  lead_ids: z.array(zUserId).optional(),       // = lead rolü (çoklu); boşsa [by]
  gozlemci_ids: z.array(zUserId).optional(),   // = gozlemci rolü (gözlemciler)
```
`dept` alanını `briefCreate`'ten **sil** (türetilecek). `marka,baslik,deadline,priority,akis,maliyet,satis,musteri_notu,tags,no,by,source,slack_ts` kalır.

- [ ] **Step 2:** `briefPatch` şemasında `atanan_ids`/`editor_ids`/`gozlemci_ids` satırlarını şununla değiştir:

```js
  worker_ids: z.array(zUserId).optional(),     // verilirse contributor TAM değiştirilir
  lead_ids: z.array(zUserId).optional(),       // verilirse lead TAM değiştirilir
  gozlemci_ids: z.array(zUserId).optional(),   // verilirse gozlemci TAM değiştirilir
```
`dept` alanını `briefPatch`'ten **sil**.

- [ ] **Step 3:** `node --check server/writes.js` → PASS. Henüz setAssignees uyumsuz (sonraki task). Commit:
```bash
git add server/writes.js && git commit -m "api: brief schema → worker_ids/lead_ids/gozlemci_ids (dept türetilir)"
```

---

### Task 2: setAssignees + dept türetme

**Files:** Modify `server/writes.js` (setAssignees ~95-117, createBrief, patchBrief, briefCreate INSERT)

- [ ] **Step 1:** `setAssignees`'i tamamen değiştir:

```js
async function setAssignees(client, briefId, { worker_ids, lead_ids, gozlemci_ids }) {
  // her verilen rol grubunu TAM değiştir (verilmeyene dokunma)
  const apply = async (ids, role) => {
    if (!Array.isArray(ids)) return;
    await client.query(`DELETE FROM brief_assignees WHERE brief_id=$1 AND role=$2`, [briefId, role]);
    for (let i = 0; i < ids.length; i++) await client.query(
      `INSERT INTO brief_assignees(brief_id,user_id,role,sira) VALUES ($1,$2,$3,$4)
       ON CONFLICT (brief_id,user_id,role) DO NOTHING`, [briefId, ids[i], role, i]);
  };
  if (worker_ids   !== undefined) await apply(worker_ids,   'contributor');
  if (lead_ids     !== undefined) await apply(lead_ids,     'lead');
  if (gozlemci_ids !== undefined) await apply(gozlemci_ids, 'gozlemci');
}

// İşi yapanların dept'lerinden brief dept'i türet (virgül-join, distinct).
async function deriveDept(client, worker_ids) {
  if (!Array.isArray(worker_ids) || !worker_ids.length) return null;
  const r = await client.query(
    `SELECT DISTINCT dept FROM users WHERE id = ANY($1) AND dept IS NOT NULL AND dept <> ''`, [worker_ids]);
  const depts = r.rows.map(x => x.dept).sort();
  return depts.length ? depts.join(',') : null;
}
```

- [ ] **Step 2:** `createBrief` içinde: lead default + dept türetme. `d.atanan_ids` kullanan satırları bul, şununla değiştir. INSERT'ten ÖNCE:
```js
    const leadIds = (d.lead_ids && d.lead_ids.length) ? d.lead_ids : (d.by ? [d.by] : []);
    const dept = await deriveDept(client, d.worker_ids);
```
`briefs` INSERT'inde `dept` parametresini `dept` değişkeniyle ver (eski `d.dept || null` yerine).
`setAssignees(client, id, d)` çağrısını şununla değiştir:
```js
    await setAssignees(client, id, { worker_ids: d.worker_ids, lead_ids: leadIds, gozlemci_ids: d.gozlemci_ids });
```

- [ ] **Step 3:** `createBrief` Slack post bloğunda (`d.atanan_ids` kullanan kısım): lead/işi-yapan isimlerini yeni alanlardan üret:
```js
      const workerIds = (d.worker_ids || []).filter(Boolean);
      const leadIdsForPost = leadIds;
      let leadName = null, contribNames = [];
      const allIds = [...new Set([...leadIdsForPost, ...workerIds])];
      if (allIds.length) {
        const u = await pool.query('SELECT id,name FROM users WHERE id = ANY($1)', [allIds]);
        const byId = Object.fromEntries(u.rows.map(r => [r.id, r.name]));
        leadName = leadIdsForPost.map(i => byId[i]).filter(Boolean).join(', ') || null;
        contribNames = workerIds.map(i => byId[i]).filter(Boolean);
      }
```
(Geri kalan `slack.postBrief({... leadName, contribNames})` çağrısı aynı kalır.)

- [ ] **Step 4:** `patchBrief` içinde: `dept` set eden satır (`if (d.dept !== undefined) put('dept', ...)`) yerine, worker_ids verilmişse dept'i yeniden türet. `setAssignees(client, id, d)` çağrısından SONRA ekle:
```js
    if (d.worker_ids !== undefined) {
      const dept = await deriveDept(client, d.worker_ids);
      await client.query(`UPDATE briefs SET dept=$1 WHERE id=$2`, [dept, id]);
    }
```
`patchBrief` `put('dept',...)` satırını sil. `setAssignees(client, id, d)` çağrısı aynı (d artık worker_ids/lead_ids/gozlemci_ids taşıyor).

- [ ] **Step 5:** `node --check server/writes.js` → PASS. Commit:
```bash
git add server/writes.js && git commit -m "api: setAssignees 3-rol + dept worker'lardan türetilir + lead default=oluşturan"
```

---

### Task 3: getEmbedded yeni shape (workers/leads/observers)

**Files:** Modify `server/queries.js` (allBriefsWithAssignees ~26-32, getEmbedded bns_briefs ~101-108, bns_completed ~110-116)

- [ ] **Step 1:** `allBriefsWithAssignees` map'inde rol türetmeyi güncelle. `lead`/`contributors`/`editors`/`gozlemciler` üreten satırları şununla değiştir:
```js
    const leads        = as.filter(x => x.role === 'lead');
    const workers      = as.filter(x => x.role === 'contributor');
    const observers    = as.filter(x => x.role === 'gozlemci');
```
Dönen objede `lead/contributors/editors/gozlemciler` yerine `leads, workers, observers` ver (diğer alanlar—id,no,marka,baslik,dept,durum,deadline,completed_at,rev,maliyet,satis,fatura,odeme,slack_url,slack_ts—aynı kalır).

- [ ] **Step 2:** `getEmbedded` `bns_briefs` map'ini güncelle (eski `atanan_ids/editor_ids/reviewerId` SİL):
```js
  const bns_briefs = all.filter(b => !b.completed_at).map(b => ({
    id: b.id, no: b.no, marka: b.marka, baslik: b.baslik, dept: b.dept || '',
    workers:   b.workers.map(w => ({ id: w.id, name: w.name, dept: w.dept || '' })),
    leads:     b.leads.map(l => ({ id: l.id, name: l.name })),
    observers: b.observers.map(o => ({ id: o.id, name: o.name })),
    deadline: ms(b.deadline), durum: b.durum, rev: b.rev || 0,
    maliyet: b.maliyet, satis: b.satis, fatura: !!b.fatura, odeme: !!b.odeme,
    slack_url: b.slack_url || '#',
    attachments: (b.attachments || []),
  }));
```
NOT: `as` json_build_object'una `dept` ekle (Step 3'te). `attachments` Task 5'te doldurulur — şimdilik `[]`.

- [ ] **Step 3:** `allBriefsWithAssignees` SQL'inde assignee json_build_object'una user dept ekle. `json_build_object('id',u.id,'name',u.name,'role',a.role,...)` içine `'dept',u.dept` ekle.

- [ ] **Step 4:** `bns_completed` map'inde `leadId/contribIds` yerine:
```js
    leads:   b.leads.map(l => ({ id: l.id, name: l.name })),
    workers: b.workers.map(w => ({ id: w.id, name: w.name })),
```

- [ ] **Step 5:** `node --check server/queries.js` → PASS. Commit:
```bash
git add server/queries.js && git commit -m "api: embedded shape → workers/leads/observers (atanan_ids/reviewerId kaldırıldı)"
```

---

### Task 4: Deploy API + curl doğrulama (workers/leads/observers + dept)

**Files:** yok (deploy + test)

- [ ] **Step 1:** API'yi stamp-trick ile deploy et:
```bash
D=/tmp/bns-api-$(date +%H%M%S); mkdir -p "$D"
rsync -a --exclude=node_modules --exclude=.git ~/benseno-tasarim-sistemi/server/ "$D"/
echo "deploy $(date -u +%H%M%S)" > "$D"/.deploy-stamp
cd "$D"; export RAILWAY_CALLER=skill:use-railway@1.2.2
railway link --project efcd3ff0-863b-472f-8dc9-c4a4fb4786ed --environment production --service benseno-api
railway up --service benseno-api --detach
```

- [ ] **Step 2:** Deploy bitince curl testi (worker dept'inden türeme + roller). Önce iki worker id'sini farklı dept'ten seç (embedded bns_users'tan). Sonra:
```bash
B=https://benseno-api-production.up.railway.app
curl -s -X POST "$B/api/briefs" -H 'content-type: application/json' \
  -d '{"marka":"Bauhaus","baslik":"plan-test","worker_ids":["<TASARIMCI_UID>","<EDITOR_UID>"],"lead_ids":["U030C48PL23"],"gozlemci_ids":["U4XCE3532"],"source":"system"}'
curl -s "$B/api/embedded" | python3 -c "import sys,json;d=json.load(sys.stdin);b=d['bns_briefs'][0];print('dept:',b['dept'],'workers:',[w['name'] for w in b['workers']],'leads:',[l['name'] for l in b['leads']],'observers:',[o['name'] for o in b['observers']])"
```
Expected: `dept: editor,tasarim` (join), workers 2 kişi, leads 1, observers 1.

- [ ] **Step 3:** Test brief'i temizle:
```bash
cd ~/benseno-tasarim-sistemi/server && node -e 'const{pool}=require("./db");(async()=>{await pool.query(`TRUNCATE briefs,brief_assignees,brief_tags,brief_attachments,brief_approvals,events RESTART IDENTITY CASCADE`);await pool.end();console.log("temizlendi")})()'
```

---

### Task 5: Attachments endpoint + Slack external upload

**Files:** Modify `server/slack.js` (uploadFile ekle, exports), `server/api.js` (json limit + route), `server/queries.js` (attachments embedded'a)

- [ ] **Step 1:** `server/slack.js`'e Slack external-upload fonksiyonu ekle (module.exports'tan önce):
```js
// Dosyayı Slack'e yükle + brief thread'ine iliştir (external upload flow). buf: Buffer.
async function uploadFile({ channel, thread_ts, filename, buf, title }) {
  if (!hasToken() || !channel) return { ok: false, skipped: true };
  const tok = process.env.SLACK_BOT_TOKEN;
  // 1) upload URL al
  const g = await fetch('https://slack.com/api/files.getUploadURLExternal', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Bearer ${tok}` },
    body: new URLSearchParams({ filename, length: String(buf.length) }),
  }).then(r => r.json());
  if (!g.ok) return { ok: false, error: g.error };
  // 2) bytes'ı yükle
  const up = await fetch(g.upload_url, { method: 'POST', body: buf });
  if (!up.ok) return { ok: false, error: 'upload_post_' + up.status };
  // 3) tamamla + thread'e paylaş
  const c = await slackCall('files.completeUploadExternal', {
    files: [{ id: g.file_id, title: title || filename }],
    channel_id: channel, thread_ts,
  });
  if (!c.ok) return { ok: false, error: c.error };
  const f = (c.files && c.files[0]) || {};
  return { ok: true, file_id: g.file_id, permalink: f.permalink || null, name: filename };
}
```
`module.exports`'a `uploadFile` ekle.

- [ ] **Step 2:** `server/api.js`: json limit'i yükselt (dosya base64 için). `app.use(express.json());` satırını değiştir:
```js
app.use(express.json({ limit: '25mb' }));
```

- [ ] **Step 3:** `server/api.js`: attachments route ekle (diğer write route'ların yanına). `slack` import gerekiyorsa ekle (`const slack = require('./slack');`), `pool` için `const { pool } = require('./db');`:
```js
// Dosya ekleri — base64 JSON: { files: [{name, mime, b64}], by }. Slack thread'e yükler + DB'ye yazar.
app.post('/api/briefs/:id/attachments', writeGuard, async (req, res) => {
  try {
    const id = +req.params.id;
    const r = await pool.query('SELECT slack_ts, slack_channel FROM briefs WHERE id=$1', [id]);
    const brief = r.rows[0];
    if (!brief) return res.status(404).json({ error: 'brief bulunamadı: ' + id });
    if (!brief.slack_channel || !brief.slack_ts) return res.status(409).json({ error: 'brief Slack thread yok (henüz post edilmedi)' });
    const files = Array.isArray(req.body.files) ? req.body.files : [];
    const out = [];
    for (const f of files) {
      if (!f || !f.b64 || !f.name) continue;
      const buf = Buffer.from(f.b64, 'base64');
      const u = await slack.uploadFile({ channel: brief.slack_channel, thread_ts: brief.slack_ts, filename: f.name, buf });
      if (!u.ok) { out.push({ name: f.name, error: u.error || 'upload_fail' }); continue; }
      await pool.query(
        `INSERT INTO brief_attachments(brief_id,url,filename,mime,uploaded_by,source) VALUES ($1,$2,$3,$4,$5,'slack')`,
        [id, u.permalink || '', f.name, f.mime || null, req.body.by || null]);
      out.push({ name: f.name, permalink: u.permalink });
    }
    res.json({ ok: true, attachments: out });
  } catch (e) { console.error('[api] attachments hata:', e.message); res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 4:** `server/queries.js` getEmbedded: brief'lere attachments doldur. `allBriefsWithAssignees` sonrası veya getEmbedded içinde tek sorgu:
```js
  const att = await pool.query(`SELECT brief_id, filename AS name, url AS permalink FROM brief_attachments ORDER BY id`);
  const attByBrief = {};
  for (const a of att.rows) (attByBrief[a.brief_id] ||= []).push({ name: a.name, permalink: a.permalink });
```
`bns_briefs` map'inde `attachments: (attByBrief[b.id] || [])` yap (Task 3 Step 2'deki `[]` yerine).

- [ ] **Step 5:** `node --check server/api.js server/slack.js server/queries.js` → PASS. Deploy (Task 4 Step 1 stamp-trick). Commit:
```bash
git add server/api.js server/slack.js server/queries.js && git commit -m "api: POST /api/briefs/:id/attachments — Slack thread upload + brief_attachments"
```

- [ ] **Step 6:** Deploy sonrası curl smoke: bir brief oluştur (Slack post'lu, source!=slack → thread açılır), sonra küçük bir txt b64 yükle, embedded'da attachments görün. (BNS_FORCE_CHANNEL test kanalı kullan.) Sonra TRUNCATE ile temizle.

---

## Faz 2 — Dashboard

### Task 6: NewBrief formu — 3 rol + dosya

**Files:** Modify `dashboard/app/NewBrief.jsx` (APIBriefForm: state ~64-67, submit ~77-112, render — dept/lead alanları)

- [ ] **Step 1:** `APIBriefForm` state'ini değiştir:
```js
  const [f, setF] = React.useState({
    marka: "", baslik: "", deadlineDate: "", deadlineTime: "17:00",
    workerIds: [], leadIds: me.id ? [me.id] : [], gozlemciIds: [],
    musteri_notu: "", akis: "sirali", maliyet: "", satis: "",
  });
  const [files, setFiles] = React.useState([]);
```

- [ ] **Step 2:** `submit()`'i değiştir — body yeni alanlar + dosya 2. adımda:
```js
    const atanan = f.workerIds;
    const body = {
      marka: f.marka, baslik: f.baslik.trim(), deadline,
      worker_ids: f.workerIds.length ? f.workerIds : undefined,
      lead_ids: f.leadIds.length ? f.leadIds : undefined,
      gozlemci_ids: f.gozlemciIds.length ? f.gozlemciIds : undefined,
      musteri_notu: f.musteri_notu.trim() || undefined,
      akis: f.akis,
      maliyet: f.maliyet !== "" ? Number(f.maliyet) : undefined,
      satis: f.satis !== "" ? Number(f.satis) : undefined,
      by: me.id || undefined, source: "dashboard",
    };
```
`valid` kontrolünü güncelle: `const valid = f.marka && f.baslik.trim() && f.workerIds.length;`
POST başarı sonrası, dosya varsa yükle:
```js
      if (files.length && j.id) {
        const payloadFiles = await Promise.all(files.map(file => new Promise((resolve) => {
          const rd = new FileReader();
          rd.onload = () => resolve({ name: file.name, mime: file.type, b64: String(rd.result).split(',')[1] });
          rd.readAsDataURL(file);
        })));
        await fetch(apiBase + `/api/briefs/${j.id}/attachments`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ files: payloadFiles, by: me.id || undefined }),
        }).catch(() => {});
      }
```

- [ ] **Step 3:** Render: "Departman" `<label>` bloğunu **sil**. Onun yerine 3 kişi-seçim alanı + dosya ekle. Mevcut lead/contrib alanları neyse onları kaldırıp dept-gruplu worker seçimi koy. Yeni yardımcı bileşen (dosyanın üstüne, APIBriefForm dışına):
```js
function PeoplePicker({ label, users, selected, onChange, grouped }) {
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const groups = grouped
    ? { Tasarım: users.filter(u => u.dept === 'tasarim'), Editör: users.filter(u => u.dept === 'editor'), AI: users.filter(u => u.dept === 'ai'), Diğer: users.filter(u => !['tasarim','editor','ai'].includes(u.dept)) }
    : { "": users };
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={FIELD_LABEL}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 160, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}>
        {Object.entries(groups).map(([g, us]) => (!us.length ? null :
          <div key={g} style={{ width: "100%" }}>
            {g && <div style={{ font: "600 10px/1 var(--font-sans)", color: "var(--ink-4)", textTransform: "uppercase", margin: "4px 0" }}>{g}</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {us.map(u => (
                <button type="button" key={u.id} onClick={() => toggle(u.id)} style={{
                  font: "500 12px/1 var(--font-sans)", padding: "5px 9px", borderRadius: 999, cursor: "pointer",
                  border: "1px solid var(--line)", background: selected.includes(u.id) ? "var(--ember)" : "var(--surface-sub)",
                  color: selected.includes(u.id) ? "#fff" : "var(--ink)",
                }}>{u.name}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </label>
  );
}
```

- [ ] **Step 4:** Render'da (dept yerine) bu alanları ekle:
```jsx
      <PeoplePicker label="İşi yapan(lar) *" users={users} selected={f.workerIds} onChange={ids => set("workerIds", ids)} grouped />
      <PeoplePicker label="Lead(ler) — son kontrol" users={users} selected={f.leadIds} onChange={ids => set("leadIds", ids)} />
      <PeoplePicker label="Gözlemciler" users={users} selected={f.gozlemciIds} onChange={ids => set("gozlemciIds", ids)} />
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={FIELD_LABEL}>Dosyalar (ops.)</span>
        <input type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))} style={{ font: "12px var(--font-sans)" }} />
      </label>
```
Eski `leadId`/`contribIds`/`toggleContrib` referanslarını kaldır.

- [ ] **Step 5:** `node --check`'in JSX karşılığı yok → build ile doğrula:
```bash
cd ~/benseno-tasarim-sistemi && bash scripts/build-dashboard.sh 2>&1 | tail -3
```
Expected: "bundle.js hazır" (esbuild hata vermez). Commit:
```bash
git add dashboard/app/NewBrief.jsx app/NewBrief.jsx app/bundle.js dashboard/app/bundle.js dashboard/index.html index.html && git commit -m "dashboard: brief formu → işi-yapan/lead/gözlemci + dosya (dept kalktı)"
```

---

### Task 7: data.js hydrate + BriefDrawer + display yeni shape

**Files:** Modify `dashboard/app/data.js` (bnsHydrateBrief ~450-478, bnsHydrateCompleted), `dashboard/app/App.jsx` (bnsBriefIds + bnsPersistBriefChange), `dashboard/app/BriefDrawer.jsx` (Atama bölümü), `dashboard/app/Cards.jsx` + `BriefTable.jsx` (atama gösterimi)

- [ ] **Step 1:** `data.js` `bnsHydrateBrief` — yeni embedded alanlarını oku. `leadId/contribIds/editorIds/reviewerId` türeten satırları kaldır, yeni:
```js
  const liveUsers = (window.BNS_DATA && window.BNS_DATA.USERS) || USERS;
  const findU = (x) => liveUsers.find(u => u.id === (x.id || x)) || (x.name ? x : null);
  const workers = (raw.workers || []).map(findU).filter(Boolean);
  const leads   = (raw.leads   || []).map(findU).filter(Boolean);
  const observers = (raw.observers || []).map(findU).filter(Boolean);
```
Dönen objede `lead/contributors/reviewer` yerine (geriye uyum için de): `lead: leads[0] || null, leads, workers, contributors: workers, observers, reviewer: null`. `attachments: raw.attachments || []` ekle.

- [ ] **Step 2:** `App.jsx` `bnsBriefIds` ve `bnsPersistBriefChange` — yeni rollere göre diff. `bnsBriefIds`'i kaldırıp diff'i workers/leads/observers üzerinden yap:
```js
const idsOf = (arr) => (arr || []).map(x => x && x.id).filter(Boolean);
```
`bnsPersistBriefChange` içinde atanan_ids/reviewer diff'lerini şununla değiştir:
```js
  const w0 = idsOf(prev.workers), w1 = idsOf(next.workers);
  if (w0.join(',') !== w1.join(',')) patch.worker_ids = w1;
  const l0 = idsOf(prev.leads), l1 = idsOf(next.leads);
  if (l0.join(',') !== l1.join(',')) patch.lead_ids = l1;
  const o0 = idsOf(prev.observers), o1 = idsOf(next.observers);
  if (o0.join(',') !== o1.join(',')) patch.gozlemci_ids = o1;
```

- [ ] **Step 3:** `BriefDrawer.jsx` "Atama" bölümünü 3 gruba çevir: İşi yapan (dept rozetli) / Lead / Gözlemci. Her grup `RoleRow` + `AddRoleRow` benzeri ekle/çıkar ile `set({workers/leads/observers})` yazar. (Mevcut lead/contributors/reviewer render'ı bununla değiştirilir.)

- [ ] **Step 4:** `Cards.jsx` ve `BriefTable.jsx`: atanan gösteren yerlerde `b.lead`/`b.contributors` yerine `b.workers` (ön planda) + `b.leads` (lead işareti) kullan. Avatar grupları workers'tan.

- [ ] **Step 5:** Build + smoke:
```bash
cd ~/benseno-tasarim-sistemi && bash scripts/build-dashboard.sh 2>&1 | tail -2
```
Commit:
```bash
git add dashboard/app/*.jsx app/*.jsx app/bundle.js dashboard/app/bundle.js dashboard/index.html index.html && git commit -m "dashboard: data/drawer/kartlar → workers/leads/observers + ekler"
```

---

## Faz 3 — Slack modal

### Task 8: /yeni-brief modalı — 3 multi-select + dosya

**Files:** Modify `scripts/slack-bot.js` (modal blocks ~494-516, view_submission ~523-559)

- [ ] **Step 1:** Modal blocks: `dept_b` bloğunu **sil**; `lead_b` (users_select) + `katki_b` (multi) yerine 3 multi + file_input:
```js
          { type: 'input', block_id: 'workers_b', label: { type: 'plain_text', text: 'İşi yapan(lar)' },
            element: { type: 'multi_users_select', action_id: 'workers', placeholder: { type: 'plain_text', text: 'Kişi(ler)' } } },
          { type: 'input', block_id: 'leads_b', optional: true, label: { type: 'plain_text', text: 'Lead(ler) — son kontrol (boş=sen)' },
            element: { type: 'multi_users_select', action_id: 'leads', placeholder: { type: 'plain_text', text: 'Kişi(ler) (ops.)' } } },
          { type: 'input', block_id: 'gozlemci_b', optional: true, label: { type: 'plain_text', text: 'Gözlemciler' },
            element: { type: 'multi_users_select', action_id: 'gozlemci', placeholder: { type: 'plain_text', text: 'Kişi(ler) (ops.)' } } },
          { type: 'input', block_id: 'dosya_b', optional: true, label: { type: 'plain_text', text: 'Dosyalar' },
            element: { type: 'file_input', action_id: 'dosya' } },
```
(deadline_b, baslik_b, marka_b, not_b aynı kalır.)

- [ ] **Step 2:** `view_submission` handler'ında parse'ı güncelle. `dept`/`lead`/`katki`/`atanan_ids` satırlarını şununla değiştir:
```js
  const workers = v.workers_b?.workers?.selected_users || [];
  const leads   = v.leads_b?.leads?.selected_users || [];
  const gozlemci = v.gozlemci_b?.gozlemci?.selected_users || [];
  const fileIds = (v.dosya_b?.dosya?.files || []).map(f => f.id);
  if (!workers.length) { await ack({ response_action: 'errors', errors: { workers_b: 'En az bir işi yapan seç.' } }); return; }
```
NOT: bu `ack` workers kontrolü, mevcut marka/baslik `ack`'lerinden SONRA, `await ack()`'ten ÖNCE olmalı. Sonra `await ack();`.
`payload`'ı güncelle (dept/atanan_ids sil):
```js
  const payload = {
    marka, baslik,
    deadline: dateStr ? `${dateStr}T17:00:00` : null,
    worker_ids: workers,
    lead_ids: leads.length ? leads : undefined,
    gozlemci_ids: gozlemci.length ? gozlemci : undefined,
    musteri_notu: aciklama || undefined,
    by, source: 'dashboard',
  };
```

- [ ] **Step 3:** POST başarı sonrası dosya iliştir (file_input dosyaları zaten Slack'te; brief thread'ine paylaş + DB). `j` alındıktan sonra:
```js
    if (fileIds.length && j.id && j.slack && j.slack.ts) {
      // Slack'teki dosyaları brief thread'ine paylaş + DB'ye kaydet (best-effort)
      for (const fid of fileIds) {
        try {
          const info = await client.files.info({ file: fid });
          const perma = info.file?.permalink || '';
          const fname = info.file?.name || 'dosya';
          await client.chat.postMessage({ channel: j.slack.channel, thread_ts: j.slack.ts, text: `📎 ${perma}` });
          await fetch(`${API_BASE}/api/briefs/${j.id}/attachments-meta`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url: perma, filename: fname, by }),
          }).catch(() => {});
        } catch (e) { log(`dosya iliştir hata: ${e.message}`); }
      }
    }
```
NOT: bu yeni `attachments-meta` endpoint'i (sadece DB kaydı, Slack'e tekrar yüklemez — dosya zaten Slack'te) Task 5'e ek olarak gerekir. **Task 5 Step 3'e ekle:**
```js
app.post('/api/briefs/:id/attachments-meta', writeGuard, async (req, res) => {
  try {
    const id = +req.params.id;
    await pool.query(`INSERT INTO brief_attachments(brief_id,url,filename,mime,uploaded_by,source) VALUES ($1,$2,$3,$4,$5,'slack')`,
      [id, req.body.url || '', req.body.filename || null, null, req.body.by || null]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 4:** `node --check scripts/slack-bot.js` → PASS. Commit:
```bash
git add scripts/slack-bot.js && git commit -m "slack: /yeni-brief → işi-yapan/lead/gözlemci multi-select + dosya (file_input)"
```
NOT: `files:read` scope + (file_input için) Slack app config event/scope gerektirebilir — file_input zaten files:write ile çalışır; gerekirse kullanıcıya scope eklet.

---

## Faz 4 — Deploy + smoke + docs

### Task 9: Hepsini deploy + uçtan uca smoke

- [ ] **Step 1:** API zaten Task 4/5'te deploy edildi. Dashboard + bot push:
```bash
cd ~/benseno-tasarim-sistemi && bash scripts/build-dashboard.sh && git add -A -- ':!*.docx' && git commit -m "build: brief redesign bundle" ; git push origin HEAD
```
- [ ] **Step 2:** Bot redeploy'unu doğrula (railway logs → yeni commit + temiz start).
- [ ] **Step 3:** Uçtan uca smoke: Slack `/yeni-brief` → 3 seçici + dosya doldur → DB'de workers/leads/observers + dept türemiş + thread'de dosya → dashboard'da görün. Sonra TRUNCATE ile temizle.

### Task 10: Docs güncelle

**Files:** Modify `docs/SESSION-HANDOFF.md`, `docs/kullanim-klavuzu.html` (+ `.md`)

- [ ] **Step 1:** `SESSION-HANDOFF.md`'e yeni rol modeli + dosya + embedded shape notu ekle.
- [ ] **Step 2:** `kullanim-klavuzu`: brief açma bölümü → 3 alan + departman-otomatik + dosya. (Bu, daha önce defer edilen "Workflow→/yeni-brief" güncellemesiyle birlikte yapılır.)
- [ ] **Step 3:** Commit + push.

---

## Notlar / riskler
- **Slack file_input scope:** çalışmazsa Event Subscriptions/scope kontrol (Bug 1 dersi).
- **express.json 25mb:** büyük dosyada artar; gerekirse limit ayarla.
- **Geriye uyum:** `data.js` `contributors: workers` + `lead: leads[0]` map'i eski display kodunu kırmadan yaşatır; Task 7 Step 4 tam geçişi yapar.
- **Reviewer kalıntısı:** `queries.js` `reviewerId` + App.jsx reviewer diff'i kaldırılır (Task 3 + Task 7).
