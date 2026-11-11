#!/usr/bin/env node
'use strict';
/**
 * backup-db.js — Günlük DB yedeği. pg_dump → gzip → db_backups tablosuna saklar.
 * En YENİ 2 yedek tutulur (rolling); eskiler silinir → "öncekilerin üzerine yazma" etkisi.
 * pg_dump --clean --if-exists ile alınır → restore-db.js drop+recreate ederek temiz geri yükler.
 * Bağımlılık: postgresql-client (Dockerfile'da kurulu), DATABASE_URL / data/.db-url.
 *
 * DIŞA-YEDEK (2026-11-11): Aynı gzip, private GitHub deposuna da yüklenir (rolling 7 gün,
 * haftanın gününe göre dosya adı). 10 Kasım Railway donanım arızasının dersi: yedek aynı
 * DB'nin içindeyse DB kapalıyken yedeğe de erişilemez. Best-effort — GitHub hatası DB
 * yedeğini BOZMAZ. Env: BENSENO_GITHUB_PAT (contents:write), BNS_YEDEK_REPO (vars. bensenoint/benseno-db-yedek).
 */
const { spawnSync } = require('child_process');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const db = require('../server/db.js');

const DB_URL = process.env.DATABASE_URL ||
  (() => { try { return fs.readFileSync(path.join(__dirname, '../data/.db-url'), 'utf8').trim(); } catch { return ''; } })();

// gzip yedeği GitHub Contents API ile private depoya yükler (günün adına göre rolling 7).
// Var olan dosyayı güncellemek için sha gerekir; dosya >1MB olduğundan tekil GET yerine
// dizin listelemesinden (boyut sınırı yok) okunur.
async function githubYedek(gz) {
  const pat = process.env.BENSENO_GITHUB_PAT;
  if (!pat) { console.log('(dışa-yedek atlandı: BENSENO_GITHUB_PAT yok)'); return; }
  const repo = process.env.BNS_YEDEK_REPO || 'bensenoint/benseno-db-yedek';
  const gun = ['paz', 'pzt', 'sal', 'car', 'per', 'cum', 'cmt'][new Date().getUTCDay()];
  const dosya = `yedek-${gun}.sql.gz`;
  const hdr = { authorization: `Bearer ${pat}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' };
  const list = await fetch(`https://api.github.com/repos/${repo}/contents/`, { headers: hdr }).then(r => r.ok ? r.json() : []);
  const sha = (Array.isArray(list) ? list : []).find(f => f.name === dosya)?.sha;
  const r = await fetch(`https://api.github.com/repos/${repo}/contents/${dosya}`, {
    method: 'PUT', headers: hdr,
    body: JSON.stringify({ message: `yedek ${new Date().toISOString().slice(0, 16)}`, content: gz.toString('base64'), ...(sha ? { sha } : {}) }),
  });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 200)}`);
  console.log(`✓ Dışa-yedek: ${repo}/${dosya} güncellendi.`);
}

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
  // Best-effort dışa-yedek: hata DB yedeğini bozmaz, sadece loglanır.
  try { await githubYedek(gz); } catch (e) { console.error('dışa-yedek hata:', e.message); }
  await db.pool.end();
})().catch(e => { console.error('yedek hata:', e.message); process.exit(1); });
