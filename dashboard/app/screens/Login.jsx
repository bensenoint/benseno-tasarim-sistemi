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
        React.createElement('div', { style: { fontSize: 13, color: 'var(--ink-3, #5B5B66)', marginTop: 4 } }, "Dashboard'a giriş yap"),
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
        error ? React.createElement('div', {
          style: { fontSize: 12, color: '#D7263D', background: 'rgba(215,38,61,.08)', borderRadius: 6, padding: '7px 10px', marginBottom: 14 }
        }, error) : null,
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
