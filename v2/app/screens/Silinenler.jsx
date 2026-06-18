// app/screens/Silinenler.jsx — Soft-deleted briefs with restore action.

function SilinenlerScreen({ data, currentUser }) {
  const items = data.deleted || [];
  const canRestore = currentUser?.role === 'admin';

  async function handleRestore(id) {
    try {
      const apiBase = (window.bnsResolveApiBase && window.bnsResolveApiBase()) || 'https://benseno-api-production.up.railway.app';
      const tok = localStorage.getItem('bns_token');
      const res = await fetch(`${apiBase}/api/briefs/${id}/restore`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
        body: JSON.stringify({ by: currentUser?.slack_id }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const j = await res.json().catch(() => ({}));
        alert('Geri alma başarısız: ' + (j.error || res.status));
      }
    } catch (e) { alert('Hata: ' + e.message); }
  }

  async function handlePermanentDelete(id, baslik, no) {
    const label = baslik || ('#' + no);
    if (!window.confirm(`"${label}" briefi kalıcı olarak silmek istediğine emin misin?\n\nBu işlem geri alınamaz.`)) return;
    try {
      const apiBase = (window.bnsResolveApiBase && window.bnsResolveApiBase()) || 'https://benseno-api-production.up.railway.app';
      const tok = localStorage.getItem('bns_token');
      const res = await fetch(`${apiBase}/api/briefs/${id}/permanent`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
        body: JSON.stringify({ by: currentUser?.slack_id }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const j = await res.json().catch(() => ({}));
        alert('Kalıcı silme başarısız: ' + (j.error || res.status));
      }
    } catch (e) { alert('Hata: ' + e.message); }
  }

  return (
    <div className="bn-tab-in">
      <PageHead
        title="Silinenler"
        subtitle={`${items.length} silinen brief · geri alınabilir`}
      />

      {items.length === 0 ? (
        <div style={{
          padding: '64px 0', textAlign: 'center',
          color: 'var(--ink-4)', font: '400 14px/1.6 var(--font-sans)'
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🗑️</div>
          Silinmiş brief yok.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(b => {
            const brandColor = b.marka_color || '#888';
            const deletedDate = b.deleted_at
              ? new Date(b.deleted_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—';
            return (
              <div key={b.id} style={{
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 0, padding: '14px 16px',
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, rowGap: 10,
                opacity: 0.85,
              }}>
                {/* Brief no */}
                <span style={{
                  font: '600 11px var(--font-mono)', color: 'var(--ink-4)',
                  background: 'var(--paper-2)', padding: '3px 7px', borderRadius: 4,
                  flexShrink: 0,
                }}>#{b.no}</span>

                {/* Brand dot */}
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: brandColor, flexShrink: 0,
                }}/>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    font: '500 13px/1.3 var(--font-sans)', color: 'var(--ink)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{b.baslik || '(başlıksız)'}</div>
                  <div style={{ font: '400 11px/1.4 var(--font-sans)', color: 'var(--ink-4)', marginTop: 2 }}>
                    {b.marka || '—'}
                    {(() => {
                      if (!b.deleted_by) return '';
                      if (b.deleted_by === 'slack:deleted') return " · Slack'te thread silindi";
                      const u = (data.USERS || []).find(x => x.id === b.deleted_by);
                      return ` · ${u ? u.name : b.deleted_by} tarafından silindi`;
                    })()}
                    {' · '}{deletedDate}
                  </div>
                </div>

                {/* Durum chip */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                }}>
                  <I.Dot size={6} color="var(--ink-4)"/>
                  <span style={{ font: '500 12px/1 var(--font-sans)', color: 'var(--ink-2)' }}>{b.durum || '—'}</span>
                </span>

                {/* Aksiyon butonları — sadece admin */}
                {canRestore && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleRestore(b.id)}
                      style={{
                        padding: '6px 12px', borderRadius: 6, border: '1px solid var(--line-strong)',
                        background: 'var(--surface)', color: 'var(--ink-2)',
                        font: '500 12px/1 var(--font-sans)', cursor: 'pointer',
                        transition: 'background 120ms',
                      }}
                      onMouseEnter={e => e.target.style.background = 'var(--paper-2)'}
                      onMouseLeave={e => e.target.style.background = 'var(--surface)'}
                    >
                      ↩ Geri al
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(b.id, b.baslik, b.no)}
                      style={{
                        padding: '6px 12px', borderRadius: 6,
                        border: '1px solid var(--prio-red, #e54d2e)',
                        background: 'transparent', color: 'var(--prio-red, #e54d2e)',
                        font: '500 12px/1 var(--font-sans)', cursor: 'pointer',
                      }}
                    >
                      🗑️ Kalıcı sil
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!canRestore && items.length > 0 && (
        <div style={{
          marginTop: 20, padding: '10px 14px', borderRadius: 0,
          border: '1px solid var(--line)',
          background: 'var(--paper-2)', color: 'var(--ink-4)',
          font: '400 12px/1.4 var(--font-sans)',
        }}>
          Geri alma yetkisi sadece adminlerde. Yöneticinize başvurun.
        </div>
      )}
    </div>
  );
}

window.SilinenlerScreen = SilinenlerScreen;
