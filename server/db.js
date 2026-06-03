'use strict';

/**
 * Benseno DB bağlantısı (Postgres / Railway).
 * - Railway'de: process.env.DATABASE_URL (internal private network).
 * - Lokalde:    data/.db-url (DATABASE_PUBLIC_URL, gitignored) fallback.
 * Tek paylaşımlı pg Pool.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function resolveConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Lokal geliştirme: gitignored dosyadan public URL
  const f = path.join(process.env.HOME, 'benseno-tasarim-sistemi', 'data', '.db-url');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch { /* yok */ }
  throw new Error('DATABASE_URL yok ve data/.db-url okunamadı');
}

const connectionString = resolveConnectionString();
// Railway public proxy TLS ister; internal private network istemez. İkisinde de çalışsın:
const ssl = /proxy\.rlwy\.net|\.rlwy\.net/.test(connectionString) ? { rejectUnauthorized: false } : false;

const pool = new Pool({ connectionString, ssl, max: 8, idleTimeoutMillis: 30000 });

pool.on('error', (err) => { console.error('[db] pool error:', err.message); });

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  async tx(fn) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const r = await fn(client); await client.query('COMMIT'); return r; }
    catch (e) { try { await client.query('ROLLBACK'); } catch {} throw e; }
    finally { client.release(); }
  },
};
