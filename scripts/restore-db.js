#!/usr/bin/env node
'use strict';
/**
 * restore-db.js — db_backups'tan geri yükler (MANUEL, dikkatli kullan).
 * Kullanım:
 *   node scripts/restore-db.js --list        → mevcut yedekleri listeler
 *   node scripts/restore-db.js                → EN YENİ yedeği geri yükler
 *   node scripts/restore-db.js <id>           → belirli yedeği geri yükler
 * pg_dump --clean ile alındığı için psql restore mevcut nesneleri drop+recreate eder.
 * UYARI: geri yükleme mevcut veriyi yedekteki haline EZER.
 */
const { spawnSync } = require('child_process');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const db = require('../server/db.js');

const DB_URL = process.env.DATABASE_URL ||
  (() => { try { return fs.readFileSync(path.join(__dirname, '../data/.db-url'), 'utf8').trim(); } catch { return ''; } })();

(async () => {
  if (!DB_URL) { console.error('DATABASE_URL/data/.db-url yok'); process.exit(1); }
  const arg = process.argv[2];
  if (arg === '--list') {
    const r = await db.query('SELECT id, created_at, size_bytes, note FROM db_backups ORDER BY id DESC');
    console.log('Mevcut yedekler (en yeni üstte):');
    r.rows.forEach(b => console.log(`  id=${b.id} · ${new Date(b.created_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} · ${(b.size_bytes / 1024).toFixed(0)}KB · ${b.note || ''}`));
    await db.pool.end(); return;
  }
  const q = arg ? await db.query('SELECT id,gz,created_at FROM db_backups WHERE id=$1', [+arg])
                : await db.query('SELECT id,gz,created_at FROM db_backups ORDER BY id DESC LIMIT 1');
  if (!q.rows.length) { console.error('Yedek bulunamadı'); process.exit(1); }
  const row = q.rows[0];
  const sql = zlib.gunzipSync(row.gz);
  console.log(`Geri yükleniyor: id=${row.id} · ${new Date(row.created_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} · ${(sql.length / 1024).toFixed(0)}KB`);
  const res = spawnSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=0'], { input: sql, encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 });
  if (res.status !== 0) { console.error('psql hata:', (res.stderr || '').toString().slice(0, 1000)); process.exit(1); }
  console.log('✓ Geri yükleme tamam.');
  await db.pool.end();
})().catch(e => { console.error('restore hata:', e.message); process.exit(1); });
