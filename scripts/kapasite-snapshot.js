'use strict';
/**
 * kapasite-snapshot.js — Kapasite v2 SAATLİK ARŞİVİ (hibrit modelin arşiv ayağı).
 * Ekranlar canlı hesaplar; bu script gerçekleşmiş doluluğu saklar: firma + 4 departman +
 * aktif kişiler → POST /api/kapasite-snapshot (server yalnız saklar; dedup server'da).
 * run-thread-ozet.sh içinden saatlik (hafta içi 09-19) çalışır. LLM yok, deterministik.
 *   node scripts/kapasite-snapshot.js          → hesapla + POST
 *   node scripts/kapasite-snapshot.js --dry     → yalnız yazdır
 */
const { fetchEmbedded } = require('./rapor-lib');
const C = require('../dashboard/app/calc.js');

const API_BASE = (process.env.BNS_API_BASE || 'https://benseno-api-production.up.railway.app').replace(/\/+$/, '');
const DRY = process.argv.includes('--dry');
const DEPTLER = ['tasarim', 'editor', 'ai', 'freelance'];

async function main() {
  const d = await fetchEmbedded();
  const briefs = d.bns_briefs || [];
  const users = (d.bns_users || []).filter((u) => /^U/.test(u.id || '') && u.active !== false);
  const gun = C.bnsGunKey(Date.now());

  const rows = [{ scope: 'firma', pct: C.bnsFirmaGunDoluluk(briefs, users, gun) }];
  DEPTLER.forEach((k) => rows.push({ scope: 'dept:' + k, pct: C.bnsDeptGunDoluluk(briefs, users, k, gun) }));
  users.forEach((u) => rows.push({ scope: 'kisi:' + u.id, pct: C.bnsKisiGunDoluluk(briefs, u, gun) }));

  if (DRY) {
    rows.slice(0, 8).forEach((r) => console.log(' ', r.scope, '%' + r.pct));
    console.log(`kapasite-snapshot DRY — ${rows.length} satır`);
    return;
  }
  const r = await fetch(`${API_BASE}/api/kapasite-snapshot`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-bns-token': process.env.BNS_WRITE_TOKEN || '' },
    body: JSON.stringify({ rows }),
  });
  const j = await r.json().catch(() => ({}));
  console.log(`kapasite-snapshot — ${rows.length} satır → ${r.status} ${JSON.stringify(j)}`);
  if (!r.ok) process.exit(1);
}

main().catch((e) => { console.error('kapasite-snapshot hata:', e.message); process.exit(1); });
