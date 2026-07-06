'use strict';
/**
 * rapor-dijest.js — Kişisel dijest (08:30 sabah / 13:30 öğle). Bekleyen bildirimler + bugünün işleri.
 * Kullanım: node scripts/rapor-dijest.js            → sabah slotu
 *           node scripts/rapor-dijest.js --slot=ogle → öğle slotu (ogle_dijest=false atlanır)
 * Test: BNS_REPORT_LIVE!=1 ise yalnız Görkem'e tek önizleme mesajı.
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

  let skipIds = new Set();
  if (SLOT_OGLE) {
    const pr = await pool.query(`SELECT user_id FROM notify_prefs WHERE ogle_dijest=false`);
    skipIds = new Set(pr.rows.map(r => r.user_id));
  }

  let sent = 0; const previewAll = [];
  for (const u of users) {
    try {
      if (SLOT_OGLE && skipIds.has(u.id)) continue;
      const mine = briefs.filter(b =>
        b.durum !== 'musteride' && b.durum !== 'tamamlandi' &&
        ((b.workers || []).some(w => w && w.id === u.id) || (b.leads || []).some(l => l && l.id === u.id)));
      // Toplam bekleyen sayısı + ilk 40 kayıt (mesaj şişmesin)
      const toplamPend = Number((await pool.query(
        `SELECT count(*) AS c FROM notifications WHERE user_id=$1 AND dijest_at IS NULL`, [u.id])).rows[0].c);
      const pend = (await pool.query(
        `SELECT id, text FROM notifications WHERE user_id=$1 AND dijest_at IS NULL ORDER BY id LIMIT 40`, [u.id])).rows;
      if (!mine.length && !pend.length) continue;

      mine.sort((a, b) => (a.deadline || Infinity) - (b.deadline || Infinity));
      const L = [`🗓️ *Dijest — ${trDate()}${SLOT_OGLE ? ' (öğle)' : ''}*`];
      if (pend.length) {
        L.push('', `*Yeni gelişmeler (${toplamPend})*`, ...pend.map(p => `• ${p.text}`));
        if (toplamPend > pend.length) L.push(`… (+${toplamPend - pend.length} bildirim daha — dashboard'a bak)`);
      }
      if (mine.length) { L.push('', `*Aktif işlerin (${mine.length})*`, ...mine.map(briefLine)); }
      L.push('', `🔗 ${DASHBOARD_URL}`);
      const text = L.join('\n');

      if (live) {
        const ok = await post(tok, u.id, text);
        // Yalnız mesaj gittiyse ve yalnız gönderilen id'leri damgala (SELECT-UPDATE arası yeni bildirim kaybolmasın)
        if (ok && pend.length) {
          await pool.query(`UPDATE notifications SET dijest_at=now() WHERE id = ANY($1)`, [pend.map(p => p.id)]);
        }
      } else { previewAll.push(`### ${u.name}\n${text}`); }
      sent++;
    } catch (e) {
      console.error('[dijest] kullanıcı hata:', u.id, e.message);
      continue;
    }
  }
  if (!live && previewAll.length) await post(tok, GORKEM, `🧪 *Dijest önizleme (${sent} kişi)*\n\n` + previewAll.join('\n\n———\n\n'));
  console.log(`dijest ${live ? 'CANLI' : 'TEST'} — ${sent} kişi${SLOT_OGLE ? ' (öğle)' : ''}`);
  await pool.end();
}
main().catch(e => { console.error('dijest hata:', e.message); process.exit(1); });
