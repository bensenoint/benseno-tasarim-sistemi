'use strict';
// DB bağlantı + sürüm testi. `npm run db:ping` (server/ içinden) ya da node server/scripts/db-ping.js
const { pool } = require('../db');
(async () => {
  try {
    const r = await pool.query('select version() v, current_database() db, now() ts');
    console.log('✓ Postgres bağlandı');
    console.log('  db :', r.rows[0].db);
    console.log('  ver:', r.rows[0].v.split(',')[0]);
    console.log('  now:', r.rows[0].ts.toISOString());
    const t = await pool.query("select count(*)::int n from information_schema.tables where table_schema='public'");
    console.log('  public tablo sayısı:', t.rows[0].n);
  } catch (e) {
    console.error('✗ bağlantı hatası:', e.message);
    process.exit(1);
  } finally { await pool.end(); }
})();
