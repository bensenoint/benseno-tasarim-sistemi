'use strict';
// Ody × Slack köprüsü — doğrudan Slack Web API. SLACK_BOT_TOKEN (history/replies/presence/
// users.conversations) + SLACK_USER_TOKEN (search; yoksa arama kapalı). Erişim: kullanıcı-başı
// kanal üyeliği; Görkem (GORKEM) bypass; DM'ler her zaman hariç.
const { pool } = require('./db');

const GORKEM = 'U030C48PL23';
const TTL_MS = 6 * 3600 * 1000;
const BOT = () => process.env.SLACK_BOT_TOKEN;
const USER = () => process.env.SLACK_USER_TOKEN;

function erisebilirMi(userChannels, channelId, askerSlackId) {
  if (!channelId || /^[DG]/.test(channelId)) return false;
  if (askerSlackId === GORKEM) return true;
  return !!userChannels && userChannels.has(channelId);
}
function cacheTaze(row, now) {
  if (!row || !row.created_at) return false;
  return (now - Date.parse(row.created_at)) < TTL_MS;
}

async function slackGet(method, params, token) {
  if (!token) return null;
  try {
    const qs = new URLSearchParams(params).toString();
    const r = await fetch(`https://slack.com/api/${method}?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (!j.ok) { console.error('[ody-slack]', method, j.error); return { __err: j.error }; }
    return j;
  } catch (e) { console.error('[ody-slack]', method, e.message); return { __err: 'network' }; }
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
  if (!USER()) return { disabled: true };   // user token yok
  const j = await slackGet('search.messages', { query, count: limit }, USER());
  // Token var ama search:read izni yoksa (missing_scope) → arama fiilen kapalı; zarifçe belirt.
  if (j && j.__err) return (j.__err === 'missing_scope' || j.__err === 'not_allowed_token_type') ? { disabled: true } : null;
  return (j && j.messages && j.messages.matches) || null;
}
async function kisiDurumu(slackUserId) {
  const pres = await slackGet('users.getPresence', { user: slackUserId }, BOT());
  const prof = await slackGet('users.profile.get', { user: slackUserId }, BOT());
  if (!pres && !prof) return null;
  const p = (prof && prof.profile) || {};
  return { presence: pres && pres.presence || 'unknown', status_text: p.status_text || '', status_emoji: p.status_emoji || '' };
}

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

// marka adından o markanın Slack kanal id'si (en güncel brief'in slack_channel'ı — gerçek C… id)
async function markaKanalId(marka) {
  const q = await pool.query(
    `SELECT b.slack_channel FROM briefs b LEFT JOIN brands br ON br.id=b.marka_id
     WHERE br.name ILIKE $1 AND b.slack_channel IS NOT NULL ORDER BY b.id DESC LIMIT 1`, [`%${marka || ''}%`]);
  return (q.rows[0] && q.rows[0].slack_channel) || null;
}
// brief #no → { slack_channel, slack_ts, no }
async function briefThreadRef(no) {
  const q = await pool.query('SELECT slack_channel, slack_ts, no FROM briefs WHERE no=$1', [no]);
  return q.rows[0] || null;
}

module.exports = { GORKEM, TTL_MS, erisebilirMi, cacheTaze, userKanallari,
  kanalMesajlari, threadDokumu, slackArama, kisiDurumu, cacheOku, cacheYaz,
  markaKanalId, briefThreadRef };
