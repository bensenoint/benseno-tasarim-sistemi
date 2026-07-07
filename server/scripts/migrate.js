'use strict';

/**
 * Basit, şeffaf migration runner — numaralı .sql dosyaları, tracking tablosu, transaction.
 * Üçüncü-parti araç yok (Node sürüm uyum riski yok). "Versiyonlu migration" ilkesi (#5).
 *
 * Kullanım:  node server/scripts/migrate.js        (uygulanmamışları sırayla çalıştır)
 *            node server/scripts/migrate.js status  (durum)
 * migrations/*.sql ad sırasıyla (0001_, 0002_, ...) çalışır; her biri TEK transaction.
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

const DIR = path.join(__dirname, '..', 'migrations');

async function ensureTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS _migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
}

function allFiles() {
  return fs.readdirSync(DIR).filter(f => f.endsWith('.sql')).sort();
}

async function applied() {
  const r = await pool.query('SELECT name FROM _migrations ORDER BY name');
  return new Set(r.rows.map(x => x.name));
}

async function status() {
  await ensureTable();
  const done = await applied();
  console.log('Migration durumu:');
  for (const f of allFiles()) console.log(`  [${done.has(f) ? '✓' : ' '}] ${f}`);
}

async function up() {
  await ensureTable();
  const done = await applied();
  const pending = allFiles().filter(f => !done.has(f));
  if (!pending.length) { console.log('✓ Tüm migration\'lar uygulanmış (değişiklik yok)'); return; }
  for (const f of pending) {
    const sql = fs.readFileSync(path.join(DIR, f), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations(name) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log(`✓ uygulandı: ${f}`);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`✗ HATA ${f}: ${e.message}`);
      throw e;
    } finally { client.release(); }
  }
}

// CLI olarak çalıştırıldığında (node scripts/migrate.js [status]) kendi pool'unu kapatır.
// require() ile (api.js boot auto-migrate) IIFE ÇALIŞMAZ + pool AÇIK kalır (paylaşılan pool'u
// kapatmaz). up/status dışa verilir → api.js açılışta bekleyen migration'ları uygular.
if (require.main === module) {
  (async () => {
    try {
      if (process.argv[2] === 'status') await status();
      else await up();
    } catch (e) { process.exitCode = 1; }
    finally { await pool.end(); }
  })();
}

module.exports = { up, status };
