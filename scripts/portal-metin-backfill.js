'use strict';
/**
 * portal-metin-backfill.js — Mevcut işlerin iç özet/sebep metinlerinden müşteri-uyumlu
 * versiyonları üretir (Haiku). İdempotent: yalnız *_musteri kolonu BOŞ olanları işler.
 *   node scripts/portal-metin-backfill.js [--limit=100] [--dry]
 */
const { pool } = require('../server/db');
const { yumusat } = require('../server/portal');

const DRY = process.argv.includes('--dry');
const LIMIT = parseInt((process.argv.find(a => a.startsWith('--limit=')) || '').slice(8), 10) || 500;

(async () => {
  const r = await pool.query(
    `SELECT id, no, thread_ozet, rating_sebep, thread_ozet_musteri, rating_sebep_musteri
     FROM briefs
     WHERE deleted_at IS NULL AND (
       (thread_ozet IS NOT NULL AND thread_ozet_musteri IS NULL) OR
       (rating_sebep IS NOT NULL AND rating_sebep_musteri IS NULL))
     ORDER BY id DESC LIMIT $1`, [LIMIT]);
  console.log(`backfill: ${r.rows.length} iş işlenecek${DRY ? ' (DRY)' : ''}`);
  let o = 0, s = 0;
  for (const b of r.rows) {
    if (b.thread_ozet && !b.thread_ozet_musteri) {
      if (DRY) { o++; }
      else {
        const m = await yumusat(b.thread_ozet, 'ozet');
        if (m) { await pool.query('UPDATE briefs SET thread_ozet_musteri=$1 WHERE id=$2', [m.slice(0, 2000), b.id]); o++; }
      }
    }
    if (b.rating_sebep && !b.rating_sebep_musteri) {
      if (DRY) { s++; }
      else {
        const m = await yumusat(b.rating_sebep, 'sebep');
        if (m) { await pool.query('UPDATE briefs SET rating_sebep_musteri=$1 WHERE id=$2', [m.slice(0, 600), b.id]); s++; }
      }
    }
    if ((o + s) % 20 === 0) console.log(`  … ${o} özet, ${s} sebep`);
  }
  console.log(`bitti: ${o} özet, ${s} sebep üretildi`);
  await pool.end();
})().catch(e => { console.error('backfill hata:', e.message); process.exit(1); });
