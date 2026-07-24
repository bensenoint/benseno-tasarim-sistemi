'use strict';
// Basit idempotent migration koşucusu (server/scripts/migrate ile aynı desen).
const fs = require('fs'), path = require('path');
const { pool } = require('./db');

async function up() {
  await pool.query(`CREATE TABLE IF NOT EXISTS _migrations (ad TEXT PRIMARY KEY, at TIMESTAMPTZ DEFAULT now())`);
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    const done = await pool.query('SELECT 1 FROM _migrations WHERE ad=$1', [f]);
    if (done.rows.length) continue;
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations(ad) VALUES ($1)', [f]);
      await pool.query('COMMIT');
      console.log('[migrate] uygulandı:', f);
    } catch (e) { await pool.query('ROLLBACK'); throw e; }
  }
}
module.exports = { up };
if (require.main === module) up().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
