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
  return r.rows[0] || { ogle_dijest: true, tip_termin: true, tip_atama: true, tip_bloke: true, sessiz_bas: 19, sessiz_bit: 8, ody_icgoru: true };
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
  const ins = await pool.query(
    `INSERT INTO notifications (user_id, text, link, tip, aciliyet, brief_id, marka) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [userId, text, link, tip, aciliyet, briefId, marka]);
  const notifId = ins.rows[0] && ins.rows[0].id;
  // 2) Acil + izin → anlık DM (çift-log yok: skipLog=true; kaydı zaten yukarıda yazdık).
  if (aciliyet === 'acil') {
    try {
      const prefs = await getPrefs(userId);
      if (shouldPushNow({ tip, aciliyet }, prefs, new Date())) {
        await slack.dm(userId, text, link, true);
        if (notifId) await pool.query(`UPDATE notifications SET slack_at=now() WHERE id=$1`, [notifId]);
      }
    } catch (e) { console.error('[notify] anlık DM hata:', e.message); }  // satır tabloda güvende
  }
}

module.exports = { notify, shouldPushNow, getPrefs, inQuiet, trParts };
