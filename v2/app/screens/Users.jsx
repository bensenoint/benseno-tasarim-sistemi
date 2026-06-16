// app/screens/Users.jsx — Admin: kullanıcı yönetimi (JWT token ile API çağrısı)
function UsersScreen({ currentUser }) {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({ slack_id: '', name: '', role: 'member', password: '' });
  const [formError, setFormError] = React.useState('');
  const [formLoading, setFormLoading] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState('');
  const [patchTarget, setPatchTarget] = React.useState(null); // { id, field: 'password'|'role' }
  const [patchVal, setPatchVal] = React.useState('');

  const base = 'https://benseno-api-production.up.railway.app';
  const authHeader = () => ({ 'Authorization': 'Bearer ' + localStorage.getItem('bns_token'), 'Content-Type': 'application/json' });

  async function loadUsers() {
    setLoading(true); setError('');
    try {
      const r = await fetch(`${base}/api/users`, { headers: authHeader() });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Yüklenemedi'); return; }
      setUsers(d.users);
    } catch { setError('Sunucuya bağlanılamadı'); }
    finally { setLoading(false); }
  }

  React.useEffect(() => { loadUsers(); }, []);

  async function handleCreate(e) {
    e.preventDefault(); setFormError(''); setFormLoading(true);
    try {
      const r = await fetch(`${base}/api/users`, { method: 'POST', headers: authHeader(), body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) { setFormError(d.error || 'Hata'); return; }
      setSuccessMsg(`${form.name} eklendi`); setShowForm(false);
      setForm({ slack_id: '', name: '', role: 'member', password: '' });
      loadUsers();
    } catch { setFormError('Sunucu hatası'); }
    finally { setFormLoading(false); }
  }

  async function handlePatch(id) {
    if (!patchVal) return;
    const body = patchTarget.field === 'password' ? { password: patchVal } : { role: patchVal };
    try {
      const r = await fetch(`${base}/api/users/${id}`, { method: 'PATCH', headers: authHeader(), body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Güncelleme başarısız'); return; }
      setSuccessMsg('Güncellendi'); setPatchTarget(null); setPatchVal('');
      loadUsers();
    } catch { setError('Sunucu hatası'); }
  }

  const cellSt = { padding: '10px 12px', borderBottom: '1px solid var(--line)', font: '400 13px/1 var(--font-sans)', color: 'var(--ink-2)' };
  const headSt = { padding: '8px 12px', font: '600 11px/1 var(--font-sans)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--paper-2)', borderBottom: '1px solid var(--line)' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ font: '700 20px/1 var(--font-sans)', color: 'var(--ink)' }}>Kullanıcılar</div>
          <div style={{ font: '400 13px/1 var(--font-sans)', color: 'var(--ink-3)', marginTop: 4 }}>Dashboard erişim yönetimi</div>
        </div>
        <button onClick={() => { setShowForm(v => !v); setFormError(''); }}
          style={{ padding: '8px 14px', border: '1.5px solid var(--ember)', borderRadius: 8, background: 'transparent', color: 'var(--ember)', font: '600 13px/1 var(--font-sans)', cursor: 'pointer' }}>
          {showForm ? 'İptal' : '+ Kullanıcı ekle'}
        </button>
      </div>

      {successMsg && (
        <div onClick={() => setSuccessMsg('')} style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--prio-green-bg, #EDFCEF)', color: 'var(--prio-green, #1B7A37)', font: '500 13px/1 var(--font-sans)', cursor: 'pointer' }}>
          ✓ {successMsg}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} style={{ marginBottom: 24, padding: 20, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surface)' }}>
          <div style={{ font: '600 14px/1 var(--font-sans)', color: 'var(--ink)', marginBottom: 16 }}>Yeni kullanıcı</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {[['slack_id', 'Slack ID', 'U0123…', 'text'], ['name', 'İsim', 'Görkem K.', 'text'], ['password', 'Geçici şifre', '', 'password']].map(([key, label, ph, type]) => (
              <div key={key}>
                <div style={{ font: '600 11px/1 var(--font-sans)', color: 'var(--ink-3)', marginBottom: 5 }}>{label}</div>
                <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={ph} required
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', background: 'var(--paper)', color: 'var(--ink)' }}/>
              </div>
            ))}
            <div>
              <div style={{ font: '600 11px/1 var(--font-sans)', color: 'var(--ink-3)', marginBottom: 5 }}>Rol</div>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13, background: 'var(--paper)', color: 'var(--ink)' }}>
                <option value="member">Üye</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {formError && <div style={{ color: '#D7263D', font: '500 12px/1 var(--font-sans)', marginBottom: 10 }}>{formError}</div>}
          <button type="submit" disabled={formLoading}
            style={{ padding: '9px 18px', border: 0, borderRadius: 8, background: formLoading ? 'var(--line)' : 'var(--navy, #24479E)', color: '#fff', font: '600 13px/1 var(--font-sans)', cursor: 'pointer' }}>
            {formLoading ? 'Ekleniyor…' : 'Ekle'}
          </button>
        </form>
      )}

      {error && <div style={{ color: '#D7263D', marginBottom: 16, font: '500 13px/1 var(--font-sans)' }}>{error}</div>}

      {loading ? (
        <div style={{ color: 'var(--ink-4)', font: '400 13px/1 var(--font-sans)' }}>Yükleniyor…</div>
      ) : (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['İsim', 'Slack ID', 'Rol', 'Son giriş', 'İşlem'].map(h => (
                  <th key={h} style={headSt}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ background: patchTarget?.id === u.id ? 'var(--paper-2)' : 'transparent' }}>
                  <td style={cellSt}><span style={{ fontWeight: 500 }}>{u.name}</span></td>
                  <td style={{ ...cellSt, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{u.slack_id}</td>
                  <td style={cellSt}>
                    {patchTarget?.id === u.id && patchTarget.field === 'role' ? (
                      <span style={{ display: 'flex', gap: 6 }}>
                        <select value={patchVal} onChange={e => setPatchVal(e.target.value)}
                          style={{ padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, background: 'var(--paper)', color: 'var(--ink)' }}>
                          <option value="member">Üye</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button onClick={() => handlePatch(u.id)} style={{ padding: '4px 10px', border: 0, borderRadius: 6, background: 'var(--ember)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Kaydet</button>
                        <button onClick={() => setPatchTarget(null)} style={{ padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 6, background: 'transparent', fontSize: 12, cursor: 'pointer', color: 'var(--ink-3)' }}>İptal</button>
                      </span>
                    ) : (
                      <span style={{ padding: '3px 8px', borderRadius: 5, background: u.role === 'admin' ? 'rgba(36,71,158,0.10)' : 'var(--paper-2)', color: u.role === 'admin' ? 'var(--navy, #24479E)' : 'var(--ink-3)', font: '600 11px/1 var(--font-sans)' }}>
                        {u.role === 'admin' ? 'Admin' : 'Üye'}
                      </span>
                    )}
                  </td>
                  <td style={{ ...cellSt, color: 'var(--ink-4)', fontSize: 12 }}>
                    {u.last_login ? new Date(u.last_login).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ ...cellSt, padding: '8px 12px' }}>
                    {u.id !== currentUser?.id && (
                      <span style={{ display: 'flex', gap: 6 }}>
                        {patchTarget?.id === u.id && patchTarget.field === 'password' ? (
                          <>
                            <input type="password" value={patchVal} onChange={e => setPatchVal(e.target.value)}
                              placeholder="Yeni şifre" autoFocus
                              style={{ padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, width: 120, background: 'var(--paper)', color: 'var(--ink)' }}/>
                            <button onClick={() => handlePatch(u.id)} style={{ padding: '4px 10px', border: 0, borderRadius: 6, background: 'var(--ember)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Kaydet</button>
                            <button onClick={() => setPatchTarget(null)} style={{ padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 6, background: 'transparent', fontSize: 12, cursor: 'pointer', color: 'var(--ink-3)' }}>İptal</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setPatchTarget({ id: u.id, field: 'password' }); setPatchVal(''); }}
                              style={{ padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 6, background: 'transparent', fontSize: 12, cursor: 'pointer', color: 'var(--ink-3)' }}>
                              Şifre sıfırla
                            </button>
                            <button onClick={() => { setPatchTarget({ id: u.id, field: 'role' }); setPatchVal(u.role); }}
                              style={{ padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 6, background: 'transparent', fontSize: 12, cursor: 'pointer', color: 'var(--ink-3)' }}>
                              Rol değiştir
                            </button>
                          </>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
