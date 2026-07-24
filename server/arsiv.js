'use strict';

/**
 * Arşiv servisi köprüsü (F3) — brief oluşunca Drive klasörü açtırır,
 * 'proje: <ad>' komutuyla klasörü üst işe taşır.
 * Best-effort: hata brief akışını ASLA bozmaz (çağıran try/catch'ler, burada null döner).
 * Env: ARSIV_API_BASE + ARSIV_BOT_TOKEN (Railway'de tanımlı; yoksa sessiz geç).
 */

const BASE = () => (process.env.ARSIV_API_BASE || '').replace(/\/+$/, '');
const TOKEN = () => process.env.ARSIV_BOT_TOKEN;

async function arsivCall(path, body) {
  if (!BASE() || !TOKEN()) return null;   // yapılandırılmamışsa sessiz geç
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(BASE() + path, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-token': TOKEN() },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.error('[arsiv]', path, r.status, j.error || ''); return null; }
    return j;
  } catch (e) { console.error('[arsiv]', path, e.message); return null; }
  finally { clearTimeout(t); }
}

// POST /folders/auto — brief için klasör aç (no ile idempotent).
async function autoFolder(b) { return arsivCall('/folders/auto', b); }

// POST /folders/{workId}/reassign — klasörü üst işe taşı (projectName=null → bağımsız).
async function reassign(workId, projectName) {
  return arsivCall(`/folders/${workId}/reassign`, { projectName });
}

module.exports = { autoFolder, reassign };
