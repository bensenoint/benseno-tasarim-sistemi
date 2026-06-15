#!/usr/bin/env node
'use strict';
/**
 * backup-db.js — Günlük DB yedeği. pg_dump → gzip → db_backups tablosuna saklar.
 * En YENİ 2 yedek tutulur (rolling); eskiler silinir → "öncekilerin üzerine yazma" etkisi.
 * pg_dump --clean --if-exists ile alınır → restore-db.js drop+recreate ederek temiz geri yükler.
 * Bağımlılık: postgresql-client (Dockerfile'da kurulu), DATABASE_URL / data/.db-url.
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
  // db_backups + bot_write_queue dışlanır: yedeğin içine yedek gömülüp özyinelemeli şişmesin.
  const dump = spawnSync('pg_dump', [DB_URL, '--no-owner', '--no-privileges', '--clean', '--if-exists',
    '--exclude-table=db_backups', '--exclude-table=bot_write_queue'],
    { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 });
  if (dump.status !== 0) { console.error('pg_dump hata:', (dump.stderr || '').toString().slice(0, 600)); process.exit(1); }
  const gz = zlib.gzipSync(dump.stdout);
  await db.query('INSERT INTO db_backups(gz, size_bytes, note) VALUES($1,$2,$3)', [gz, dump.stdout.length, 'gunluk']);
  // Rolling 2: en yeni 2 yedek kalsın, gerisi silinsin.
  const del = await db.query('DELETE FROM db_backups WHERE id NOT IN (SELECT id FROM db_backups ORDER BY id DESC LIMIT 2)');
  const c = await db.query('SELECT count(*)::int n FROM db_backups');
  console.log(`✓ Yedek: ${(dump.stdout.length / 1024).toFixed(0)}KB → gz ${(gz.length / 1024).toFixed(0)}KB. Tutulan: ${c.rows[0].n}, silinen: ${del.rowCount}.`);
  await db.pool.end();
})().catch(e => { console.error('yedek hata:', e.message); process.exit(1); });
