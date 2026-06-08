# Dashboard Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded-hash client-side gate in `index.html` with per-user JWT authentication backed by a `dashboard_users` PostgreSQL table.

**Architecture:** Login screen (`app/screens/Login.jsx`) calls `POST /api/auth/login`, gets a JWT, stores in `localStorage`. `App.jsx` checks token on load — invalid/missing → render Login instead of dashboard. Server adds `authGuard` middleware to protect new user-management routes; existing brief/write routes are unchanged.

**Tech Stack:** Node.js/Express + `jsonwebtoken` + `bcryptjs` (server), React (createElement, no build step needed — bundled via existing esbuild pipeline), PostgreSQL

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add jsonwebtoken, bcryptjs |
| `server/auth.js` | **Create** | JWT sign/verify, authGuard, adminGuard middleware |
| `server/api.js` | Modify | Mount auth + user routes |
| SQL (run manually) | — | `dashboard_users` table migration |
| `app/screens/Login.jsx` | **Create** | Login form UI + API call |
| `app/App.jsx` | Modify | Auth gate: token check → Login or dashboard |
| `index.html` | Modify | Remove old hash gate |

---

## Task 1: Add server dependencies

**Files:**
- Modify: `package.json`

- [ ] **Add jsonwebtoken and bcryptjs**

```bash
cd /path/to/project
npm install jsonwebtoken bcryptjs
```

Expected: both appear in `package.json` dependencies.

- [ ] **Verify**

```bash
node -e "require('jsonwebtoken'); require('bcryptjs'); console.log('✅ deps OK')"
```

- [ ] **Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: jsonwebtoken + bcryptjs"
```

---

## Task 2: DB migration — dashboard_users table

**Files:**
- Run SQL directly against Railway DB (via `psql $DATABASE_URL`)

- [ ] **Run migration**

```sql
CREATE TABLE IF NOT EXISTS dashboard_users (
  id            SERIAL PRIMARY KEY,
  slack_id      TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);
```

```bash
psql "$DATABASE_URL" -c "
CREATE TABLE IF NOT EXISTS dashboard_users (
  id SERIAL PRIMARY KEY,
  slack_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);"
```

Expected: `CREATE TABLE`

- [ ] **Seed bootstrap admin** (replace `GORKEM_SLACK_ID` and `BOOTSTRAP_PASSWORD`)

```bash
node -e "
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const hash = bcrypt.hashSync(process.env.BNS_BOOTSTRAP_PASSWORD || 'change-me-now', 12);
pool.query(
  \`INSERT INTO dashboard_users (slack_id, name, role, password_hash)
   VALUES (\$1, \$2, 'admin', \$3) ON CONFLICT (slack_id) DO NOTHING\`,
  [process.env.BNS_BOOTSTRAP_SLACK_ID || 'GORKEM_ID', 'Görkem', hash]
).then(() => { console.log('✅ admin eklendi'); pool.end(); })
 .catch(e => { console.error(e.message); pool.end(); });
"
```

Expected: `✅ admin eklendi`

- [ ] **Set Railway env variables**

```
BNS_JWT_SECRET=<32+ karakter rastgele string>
BNS_BOOTSTRAP_SLACK_ID=<Görkem'in Slack User ID>
BNS_BOOTSTRAP_PASSWORD=<geçici güçlü şifre>
```

```bash
# Railway CLI ile:
railway variables set BNS_JWT_SECRET="$(openssl rand -hex 32)"
```

---

## Task 3: server/auth.js — JWT middleware

**Files:**
- Create: `server/auth.js`

- [ ] **Write auth.js**

```js
'use strict';
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = () => {
  if (!process.env.BNS_JWT_SECRET) throw new Error('BNS_JWT_SECRET env eksik');
  return process.env.BNS_JWT_SECRET;
};
const TTL = '7d';

function signToken(payload) {
  return jwt.sign(payload, SECRET(), { expiresIn: TTL });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET()); // throws on invalid/expired
}

function authGuard(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'giriş gerekli' });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'geçersiz veya süresi dolmuş token' });
  }
}

function adminGuard(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'yönetici yetkisi gerekli' });
  next();
}

module.exports = { signToken, verifyToken, authGuard, adminGuard, bcrypt };
```

- [ ] **Verify syntax**

```bash
node --check server/auth.js && echo "✅ OK"
```

- [ ] **Commit**

```bash
git add server/auth.js
git commit -m "feat: server/auth.js — JWT + bcrypt middleware"
```

---

## Task 4: Auth API routes — login + me

**Files:**
- Modify: `server/api.js` (add after the `writeGuard` function, before brief routes)

- [ ] **Add auth routes to api.js**

Add after the existing `handleWrite` helper (~line 73), before `app.post('/api/briefs', ...)`:

```js
// ── Auth ────────────────────────────────────────────────────────────────────
const auth = require('./auth');

// POST /api/auth/login — { slack_id, password } → { token, user }
app.post('/api/auth/login', async (req, res) => {
  const { slack_id, password } = req.body || {};
  if (!slack_id || !password) return res.status(400).json({ error: 'slack_id ve password gerekli' });
  try {
    const r = await pool.query('SELECT * FROM dashboard_users WHERE slack_id=$1', [slack_id]);
    const user = r.rows[0];
    if (!user || !auth.bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'kullanıcı adı veya şifre hatalı' });
    }
    await pool.query('UPDATE dashboard_users SET last_login=NOW() WHERE id=$1', [user.id]);
    const token = auth.signToken({ id: user.id, slack_id: user.slack_id, name: user.name, role: user.role });
    res.json({ token, user: { id: user.id, slack_id: user.slack_id, name: user.name, role: user.role } });
  } catch (e) {
    console.error('[auth] login hata:', e.message);
    res.status(500).json({ error: 'sunucu hatası' });
  }
});

// GET /api/auth/me — token doğrula, user bilgisi döner
app.get('/api/auth/me', auth.authGuard, (req, res) => {
  res.json({ user: req.user });
});
```

- [ ] **Verify syntax**

```bash
node --check server/api.js && echo "✅ OK"
```

- [ ] **Test login endpoint locally (optional, requires DB)**

```bash
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"slack_id":"GORKEM_ID","password":"BOOTSTRAP_PASSWORD"}' | python3 -m json.tool
```

Expected: `{ "token": "eyJ...", "user": { ... } }`

- [ ] **Commit**

```bash
git add server/api.js
git commit -m "feat: POST /api/auth/login + GET /api/auth/me"
```

---

## Task 5: User management routes (admin only)

**Files:**
- Modify: `server/api.js` (add after auth routes)

- [ ] **Add user routes**

```js
// ── Kullanıcı yönetimi (admin only) ─────────────────────────────────────────
// GET /api/users
app.get('/api/users', auth.authGuard, auth.adminGuard, async (req, res) => {
  try {
    const r = await pool.query('SELECT id, slack_id, name, role, created_at, last_login FROM dashboard_users ORDER BY id');
    res.json({ users: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users — { slack_id, name, role, password }
app.post('/api/users', auth.authGuard, auth.adminGuard, async (req, res) => {
  const { slack_id, name, role = 'member', password } = req.body || {};
  if (!slack_id || !name || !password) return res.status(400).json({ error: 'slack_id, name, password gerekli' });
  if (!['admin','member'].includes(role)) return res.status(400).json({ error: 'geçersiz rol' });
  try {
    const hash = auth.bcrypt.hashSync(password, 12);
    const r = await pool.query(
      'INSERT INTO dashboard_users (slack_id, name, role, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, slack_id, name, role',
      [slack_id, name, role, hash]
    );
    res.json({ ok: true, user: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'bu slack_id zaten kayıtlı' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/users/:id — { password?, role? }
app.patch('/api/users/:id', auth.authGuard, auth.adminGuard, async (req, res) => {
  const { password, role } = req.body || {};
  const updates = [], params = [];
  if (password) { updates.push(`password_hash=$${params.push(auth.bcrypt.hashSync(password, 12))}`); }
  if (role) {
    if (!['admin','member'].includes(role)) return res.status(400).json({ error: 'geçersiz rol' });
    updates.push(`role=$${params.push(role)}`);
  }
  if (!updates.length) return res.status(400).json({ error: 'güncellenecek alan yok' });
  params.push(+req.params.id);
  try {
    await pool.query(`UPDATE dashboard_users SET ${updates.join(',')} WHERE id=$${params.length}`, params);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Verify syntax**

```bash
node --check server/api.js && echo "✅ OK"
```

- [ ] **Commit + push → Railway deploy**

```bash
git add server/api.js
git commit -m "feat: /api/users CRUD (admin only)"
git push
```

- [ ] **Smoke test login on production**

```bash
curl -s -X POST https://benseno-api-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"slack_id":"GORKEM_SLACK_ID","password":"BOOTSTRAP_PASSWORD"}' | python3 -m json.tool
```

Expected: JSON with `token` field.

---

## Task 6: Login screen — app/screens/Login.jsx

**Files:**
- Create: `app/screens/Login.jsx`

The app uses `React.createElement` (no JSX transpile in browser). This file exports a function component.

- [ ] **Create Login.jsx**

```jsx
// app/screens/Login.jsx
// Login ekranı — POST /api/auth/login → JWT → localStorage

function LoginScreen({ onLogin }) {
  const [slackId, setSlackId] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const base = (window.bnsResolveApiBase && window.bnsResolveApiBase()) || 'https://benseno-api-production.up.railway.app';
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slack_id: slackId.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Giriş başarısız'); return; }
      localStorage.setItem('bns_token', data.token);
      localStorage.setItem('bns_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError('Sunucuya bağlanılamadı');
    } finally {
      setLoading(false);
    }
  }

  return React.createElement('div', {
    style: {
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--paper-2, #F4F2EC)', fontFamily: 'var(--font-sans, sans-serif)',
    }
  },
    React.createElement('div', {
      style: {
        background: '#fff', border: '1px solid var(--line, #ECEAE3)', borderRadius: 16,
        padding: '40px 36px', width: 340, boxShadow: '0 4px 24px rgba(0,0,0,.07)',
      }
    },
      React.createElement('div', { style: { textAlign: 'center', marginBottom: 28 } },
        React.createElement('div', {
          style: {
            width: 48, height: 48, borderRadius: 12, background: 'var(--navy, #24479E)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, color: '#fff', fontWeight: 800, marginBottom: 12,
          }
        }, 'B'),
        React.createElement('div', { style: { fontSize: 20, fontWeight: 700, color: 'var(--ink, #16161A)' } }, 'benseno'),
        React.createElement('div', { style: { fontSize: 13, color: 'var(--ink-3, #5B5B66)', marginTop: 4 } }, 'Dashboard\'a giriş yap'),
      ),
      React.createElement('form', { onSubmit: handleSubmit },
        React.createElement('div', { style: { marginBottom: 14 } },
          React.createElement('label', { style: { fontSize: 12, fontWeight: 600, color: 'var(--ink-2, #2E2E36)', display: 'block', marginBottom: 5 } }, 'Slack ID'),
          React.createElement('input', {
            type: 'text', value: slackId, onChange: e => setSlackId(e.target.value),
            placeholder: 'U0123ABCDEF', required: true, autoFocus: true,
            style: {
              width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 14,
              border: '1px solid var(--line, #ECEAE3)', outline: 'none', boxSizing: 'border-box',
            },
          })
        ),
        React.createElement('div', { style: { marginBottom: 20 } },
          React.createElement('label', { style: { fontSize: 12, fontWeight: 600, color: 'var(--ink-2, #2E2E36)', display: 'block', marginBottom: 5 } }, 'Şifre'),
          React.createElement('input', {
            type: 'password', value: password, onChange: e => setPassword(e.target.value),
            required: true, autoComplete: 'current-password',
            style: {
              width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 14,
              border: '1px solid var(--line, #ECEAE3)', outline: 'none', boxSizing: 'border-box',
            },
          })
        ),
        error && React.createElement('div', {
          style: { fontSize: 12, color: '#D7263D', background: 'rgba(215,38,61,.08)', borderRadius: 6, padding: '7px 10px', marginBottom: 14 }
        }, error),
        React.createElement('button', {
          type: 'submit', disabled: loading,
          style: {
            width: '100%', padding: '10px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: loading ? 'var(--line, #ECEAE3)' : 'var(--navy, #24479E)',
            color: loading ? 'var(--ink-3)' : '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          }
        }, loading ? 'Giriş yapılıyor…' : 'Giriş Yap'),
      )
    )
  );
}
```

- [ ] **Commit**

```bash
git add app/screens/Login.jsx
git commit -m "feat: Login.jsx — JWT tabanlı giriş ekranı"
```

---

## Task 7: Auth gate in App.jsx

**Files:**
- Modify: `app/App.jsx`

- [ ] **Add token check + Login render at the top of App component**

Find the root render function / component in `App.jsx`. Add these helpers near the top (after imports/constants, before the main component):

```js
// ── Auth helpers ──────────────────────────────────────────────────────────
function bnsGetStoredUser() {
  try {
    const token = localStorage.getItem('bns_token');
    const user  = JSON.parse(localStorage.getItem('bns_user') || 'null');
    if (!token || !user) return null;
    // JWT exp check (decode without verify — server will enforce)
    const [, payload] = token.split('.');
    const decoded = JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')));
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem('bns_token');
      localStorage.removeItem('bns_user');
      return null;
    }
    return user;
  } catch { return null; }
}
function bnsLogout() {
  localStorage.removeItem('bns_token');
  localStorage.removeItem('bns_user');
  location.reload();
}
```

- [ ] **In the root App component's state, add currentUser**

Find where `React.useState` calls are at the top of the main component. Add:

```js
const [currentUser, setCurrentUser] = React.useState(() => bnsGetStoredUser());
```

- [ ] **Add Login gate at the start of the render return**

Find the return statement of the main component. Wrap it so that if `currentUser` is null, `LoginScreen` is rendered instead:

```js
if (!currentUser) {
  return React.createElement(LoginScreen, { onLogin: (user) => setCurrentUser(user) });
}
```

- [ ] **Pass user to Chrome (top bar) so logout button works**

Find where `Chrome` component is rendered. Add `user={currentUser}` and `onLogout={bnsLogout}` props.

- [ ] **Commit**

```bash
git add app/App.jsx
git commit -m "feat: auth gate in App.jsx — JWT check on load, Login screen"
```

---

## Task 8: Remove old hash gate from index.html

**Files:**
- Modify: `index.html`

- [ ] **Remove the client-side gate block**

Find and delete the entire block in `index.html` starting with:
```html
<!-- GİRİŞ GATE (client-side soft gate) …
```
through the closing `</script>` tag. This is approximately 30 lines.

- [ ] **Rebuild bundle**

```bash
npm run build   # or whatever script builds app/bundle.js
```

- [ ] **Verify dashboard loads (no old password prompt)**

Open `index.html` locally — should see new Login screen (or dashboard if already logged in from Task 7 test).

- [ ] **Commit + push**

```bash
git add index.html app/bundle.js
git commit -m "feat: eski hash-gate kaldırıldı, JWT login aktif"
git push
```

---

## Task 9: Logout button in Chrome.jsx

**Files:**
- Modify: `app/Chrome.jsx`

- [ ] **Add logout button to top bar**

Find the user/avatar area in `Chrome.jsx`. Add a logout button that calls `bnsLogout`:

```js
// Chrome.jsx içinde, props'tan user ve onLogout al:
// function Chrome({ ..., user, onLogout }) { ... }

// Avatar + isim göster, yanına küçük çıkış butonu:
React.createElement('div', { style: { display:'flex', alignItems:'center', gap: 8, cursor:'pointer' } },
  React.createElement('div', { 
    style: { width:28, height:28, borderRadius:'50%', background:'var(--navy)', color:'#fff',
             font:'700 11px/28px var(--font-sans)', textAlign:'center' }
  }, (user?.name || '?')[0].toUpperCase()),
  React.createElement('span', { style: { fontSize:13, fontWeight:500 } }, user?.name || ''),
  React.createElement('button', {
    onClick: onLogout,
    title: 'Çıkış yap',
    style: { background:'none', border:'1px solid var(--line)', borderRadius:6, padding:'3px 8px',
             fontSize:11, color:'var(--ink-3)', cursor:'pointer' }
  }, 'Çıkış'),
)
```

- [ ] **Rebuild + commit**

```bash
npm run build
git add app/Chrome.jsx app/bundle.js
git commit -m "feat: logout butonu Chrome'a eklendi"
git push
```

---

## Task 10: Admin users panel — app/screens/Users.jsx

**Files:**
- Create: `app/screens/Users.jsx`

- [ ] **Create Users.jsx**

```jsx
// app/screens/Users.jsx — Kullanıcı yönetimi (sadece admin görür)

function UsersScreen({ currentUser }) {
  const [users, setUsers]     = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [form, setForm]       = React.useState({ slack_id:'', name:'', role:'member', password:'' });
  const [msg, setMsg]         = React.useState('');

  const base = (window.bnsResolveApiBase && window.bnsResolveApiBase()) || 'https://benseno-api-production.up.railway.app';
  const headers = { 'Content-Type':'application/json', 'Authorization': `Bearer ${localStorage.getItem('bns_token')}` };

  async function fetchUsers() {
    setLoading(true);
    const r = await fetch(`${base}/api/users`, { headers });
    const d = await r.json();
    setUsers(d.users || []);
    setLoading(false);
  }
  React.useEffect(() => { fetchUsers(); }, []);

  async function addUser(e) {
    e.preventDefault();
    const r = await fetch(`${base}/api/users`, { method:'POST', headers, body: JSON.stringify(form) });
    const d = await r.json();
    if (d.ok) { setMsg('✅ Kullanıcı eklendi'); setForm({ slack_id:'', name:'', role:'member', password:'' }); fetchUsers(); }
    else setMsg(`❌ ${d.error}`);
  }

  async function resetPassword(id, newPw) {
    if (!newPw) return;
    const r = await fetch(`${base}/api/users/${id}`, { method:'PATCH', headers, body: JSON.stringify({ password: newPw }) });
    const d = await r.json();
    setMsg(d.ok ? '✅ Şifre güncellendi' : `❌ ${d.error}`);
  }

  if (currentUser?.role !== 'admin') return React.createElement('div', { style:{padding:24} }, '⛔ Bu bölüm sadece yöneticilere açık.');

  return React.createElement('div', { style:{padding:'24px 20px', maxWidth:700} },
    React.createElement('h2', { style:{fontSize:18,fontWeight:700,marginBottom:20} }, '👥 Kullanıcılar'),

    loading ? React.createElement('div', null, 'Yükleniyor…') :
    React.createElement('table', { style:{width:'100%',borderCollapse:'collapse',fontSize:13,marginBottom:28} },
      React.createElement('thead', null,
        React.createElement('tr', { style:{textAlign:'left',borderBottom:'2px solid var(--line)'} },
          ['ID','Slack ID','İsim','Rol','Son Giriş','İşlem'].map(h =>
            React.createElement('th', { key:h, style:{padding:'6px 10px',fontWeight:600} }, h))
        )
      ),
      React.createElement('tbody', null,
        users.map(u => React.createElement('tr', { key:u.id, style:{borderBottom:'1px solid var(--line)'} },
          React.createElement('td', { style:{padding:'8px 10px',color:'var(--ink-4)',fontFamily:'var(--font-mono)',fontSize:11} }, u.id),
          React.createElement('td', { style:{padding:'8px 10px',fontFamily:'var(--font-mono)',fontSize:11} }, u.slack_id),
          React.createElement('td', { style:{padding:'8px 10px',fontWeight:500} }, u.name),
          React.createElement('td', { style:{padding:'8px 10px'} }, u.role === 'admin' ? '⭐ Admin' : 'Üye'),
          React.createElement('td', { style:{padding:'8px 10px',color:'var(--ink-4)',fontSize:11} }, u.last_login ? new Date(u.last_login).toLocaleDateString('tr-TR') : '—'),
          React.createElement('td', { style:{padding:'8px 10px'} },
            React.createElement('button', {
              onClick: () => { const pw = prompt('Yeni şifre:'); resetPassword(u.id, pw); },
              style:{fontSize:11,padding:'3px 8px',borderRadius:5,border:'1px solid var(--line)',cursor:'pointer',background:'none'}
            }, 'Şifre Sıfırla')
          )
        ))
      )
    ),

    React.createElement('h3', { style:{fontSize:14,fontWeight:700,marginBottom:12} }, 'Yeni Kullanıcı'),
    msg && React.createElement('div', { style:{marginBottom:10,fontSize:12,color:'var(--ink-2)'} }, msg),
    React.createElement('form', { onSubmit: addUser, style:{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end'} },
      ['slack_id','name','password'].map(field =>
        React.createElement('div', { key:field },
          React.createElement('label', { style:{fontSize:11,fontWeight:600,display:'block',marginBottom:4} }, field),
          React.createElement('input', {
            required:true, value:form[field], type: field==='password'?'password':'text',
            onChange: e => setForm(f => ({...f, [field]:e.target.value})),
            style:{padding:'7px 10px',borderRadius:6,border:'1px solid var(--line)',fontSize:13,width:140}
          })
        )
      ),
      React.createElement('div', null,
        React.createElement('label', { style:{fontSize:11,fontWeight:600,display:'block',marginBottom:4} }, 'rol'),
        React.createElement('select', {
          value:form.role, onChange:e=>setForm(f=>({...f,role:e.target.value})),
          style:{padding:'7px 10px',borderRadius:6,border:'1px solid var(--line)',fontSize:13}
        },
          React.createElement('option',{value:'member'},'Üye'),
          React.createElement('option',{value:'admin'},'Admin'),
        )
      ),
      React.createElement('button', {
        type:'submit',
        style:{padding:'8px 16px',borderRadius:6,background:'var(--navy)',color:'#fff',border:'none',fontWeight:600,fontSize:13,cursor:'pointer'}
      }, 'Ekle')
    )
  );
}
```

- [ ] **Register tab in App.jsx**

In the tab definitions array in `App.jsx`, add entry (visible only to admins):

```js
// Mevcut sekme tanımlarının sonuna ekle — currentUser?.role==='admin' ise göster:
...(currentUser?.role === 'admin' ? [{ id: 'users', label: '👥 Kullanıcılar' }] : []),
```

And in the screen renderer, add:

```js
case 'users': return React.createElement(UsersScreen, { currentUser });
```

- [ ] **Rebuild + commit + push**

```bash
npm run build
git add app/screens/Users.jsx app/App.jsx app/bundle.js
git commit -m "feat: kullanıcı yönetimi ekranı (admin only)"
git push
```

---

## Task 11: Dashboard yardım bölümü

**Files:**
- Create: `app/screens/Help.jsx`
- Modify: `app/App.jsx` (yeni sekme veya modal)

- [ ] **Create Help.jsx**

```jsx
// app/screens/Help.jsx — Komut ve emoji kısayol rehberi

const EMOJI_KISAYOLLAR = [
  { em:'🔄', label:'Devam Ediyor' }, { em:'👀', label:'İncelemede' },
  { em:'⏸️', label:'Beklemede' },   { em:'✅', label:'Tamamlandı' },
  { em:'✏️', label:'Revizyon' },    { em:'🔃', label:'Yeniden Aç' },
];
const KELIME_KISAYOLLAR = [
  { key:'devam et', label:'Devam Ediyor' },     { key:'iş incelemede', label:'İncelemede' },
  { key:'iş beklemede', label:'Beklemede' },    { key:'revizyon var', label:'Revizyon' },
  { key:'iş tamamlandı', label:'Tamamlandı' },  { key:'yeniden aç', label:'Yeniden Açıldı' },
  { key:'bloke et', label:'Blokeli' },
];
const ONCELIK_KISAYOLLAR = [
  { key:'acil öncelik', em:'🔴' }, { key:'yüksek öncelik', em:'🟠' },
  { key:'normal öncelik', em:'🟡' }, { key:'düşük öncelik', em:'🟢' },
];

function HelpScreen() {
  const s = { card: { background:'#fff', border:'1px solid var(--line)', borderRadius:12, padding:'20px 24px', marginBottom:16 } };
  const Tag = ({ children }) => React.createElement('code', {
    style:{ background:'var(--paper-2,#F4F2EC)', padding:'2px 8px', borderRadius:5, fontSize:12, fontFamily:'var(--font-mono)' }
  }, children);

  return React.createElement('div', { style:{padding:'24px 20px', maxWidth:760} },
    React.createElement('h2', { style:{fontSize:20,fontWeight:700,marginBottom:20} }, '📖 Yardım'),

    React.createElement('div', { style: s.card },
      React.createElement('div', { style:{fontSize:12,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'var(--ink-4)',marginBottom:12} }, 'Slack Komutları'),
      [
        ['/yeni-brief', 'Marka kanalında yeni brief açar'],
        ['/brief-durum', 'Sana atanmış aktif brifleri listeler'],
        ['/kapasite', 'Ekip kapasitesini gösterir (Yönetici)'],
        ['/maliyet', 'Brief maliyet/satış bilgisi girer'],
        ['/yardim', 'Bu rehberi Slack\'te gösterir'],
      ].map(([cmd, desc]) => React.createElement('div', { key:cmd, style:{display:'flex',gap:10,marginBottom:7,alignItems:'baseline'} },
        React.createElement(Tag, null, cmd),
        React.createElement('span', { style:{fontSize:13,color:'var(--ink-2)'} }, desc)
      ))
    ),

    React.createElement('div', { style: s.card },
      React.createElement('div', { style:{fontSize:12,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'var(--ink-4)',marginBottom:12} }, 'Brief Thread — Emoji Kısayolları'),
      React.createElement('div', { style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 24px'} },
        EMOJI_KISAYOLLAR.map(({em,label}) => React.createElement('div', { key:em, style:{display:'flex',gap:8,alignItems:'center',fontSize:13} },
          React.createElement('span', { style:{fontSize:17,width:24} }, em),
          React.createElement('span', { style:{color:'var(--ink-3)'} }, '→'),
          React.createElement('span', null, label)
        ))
      )
    ),

    React.createElement('div', { style: s.card },
      React.createElement('div', { style:{fontSize:12,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'var(--ink-4)',marginBottom:12} }, 'Brief Thread — Kelime Kısayolları'),
      React.createElement('div', { style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 24px'} },
        [...KELIME_KISAYOLLAR, ...ONCELIK_KISAYOLLAR].map(({key,label,em}) =>
          React.createElement('div', { key, style:{display:'flex',gap:8,alignItems:'center',fontSize:13} },
            React.createElement(Tag, null, key),
            React.createElement('span', { style:{color:'var(--ink-3)'} }, '→'),
            React.createElement('span', null, label || em)
          )
        )
      )
    ),
  );
}
```

- [ ] **Add "Yardım" tab to App.jsx**

In tab definitions, add:
```js
{ id: 'help', label: '❓ Yardım' },
```

In screen renderer:
```js
case 'help': return React.createElement(HelpScreen, null);
```

- [ ] **Rebuild + commit + push**

```bash
npm run build
git add app/screens/Help.jsx app/App.jsx app/bundle.js
git commit -m "feat: dashboard yardım ekranı"
git push
```

---

## Self-Review

**Spec coverage check:**
- ✅ dashboard_users table — Task 2
- ✅ bcrypt + JWT — Task 1, 3
- ✅ POST /api/auth/login — Task 4
- ✅ GET /api/auth/me — Task 4
- ✅ GET/POST/PATCH /api/users — Task 5
- ✅ Login screen — Task 6
- ✅ Auth gate in App.jsx — Task 7
- ✅ Remove old hash gate — Task 8
- ✅ Logout button — Task 9
- ✅ Admin users panel — Task 10
- ✅ Dashboard help section — Task 11

**Bağımlılık sırası:**
Task 1 → Task 3 (auth.js requires bcryptjs/jsonwebtoken)
Task 3 → Task 4 (api.js requires ./auth)
Task 2 → Task 4 (login endpoint queries dashboard_users)
Task 6 → Task 7 (App.jsx imports LoginScreen)
Task 4+5+deploy → Task 10 smoke test

**Railway env variables (Task 2'den önce ayarlanmalı):**
- `BNS_JWT_SECRET`
- `BNS_BOOTSTRAP_SLACK_ID`
- `BNS_BOOTSTRAP_PASSWORD`
