#!/usr/bin/env node
'use strict';
/**
 * backfill-deliverables.js — TEK SEFERLİK. Final teslimi OLMAYAN tamamlanan işlerin
 * Slack thread'ini tarar, EN SON dosya içeren mesajın dosyalarını (resim+diğer) en-iyi-tahmin
 * final teslim olarak kaydeder. Kullanıcı sonradan 📎 ile düzeltebilir.
 *
 * Çalıştırma:  node scripts/backfill-deliverables.js [--dry]
 * Gerektirir:  data/.db-url, data/.slack-bot-token, data/.write-token (hepsi gitignored)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const DB = fs.readFileSync(path.join(root, 'data/.db-url'), 'utf8').trim();
const SLACK = fs.readFileSync(path.join(root, 'data/.slack-bot-token'), 'utf8').trim();
const WT = (() => { try { return fs.readFileSync(path.join(root, 'data/.write-token'), 'utf8').trim(); } catch { return process.env.BNS_WRITE_TOKEN || ''; } })();
const API = process.env.BNS_API || 'https://benseno-api-production.up.railway.app';
const DRY = process.argv.includes('--dry');

function sql(q) {
  return execFileSync('psql', [DB, '-t', '-A', '-F', '|', '-c', q], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean).map(l => l.split('|'));
}

(async () => {
  // Final teslimi olmayan, slack_ts'i olan tamamlanan işler
  const rows = sql(`
    SELECT b.no, b.slack_ts, b.slack_channel
    FROM briefs b
    WHERE b.completed_at IS NOT NULL AND b.deleted_at IS NULL
      AND b.slack_ts IS NOT NULL AND b.slack_channel IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM brief_attachments a WHERE a.brief_id=b.id AND a.is_final=true)
    ORDER BY b.no`);
  console.log(`\n📎 ${rows.length} tamamlanan iş final teslim için taranacak${DRY ? ' (DRY)' : ''}\n`);

  let filled = 0, empty = 0;
  for (const [no, ts, channel] of rows) {
    const r = await fetch(`https://slack.com/api/conversations.replies?channel=${channel}&ts=${ts}&limit=200`,
      { headers: { authorization: `Bearer ${SLACK}` } });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) { console.log(`  #${no}: thread okunamadı (${j.error})`); continue; }
    // EN SON dosya içeren mesaj (eski→yeni; sonu tutar)
    let last = null;
    for (const m of (j.messages || [])) if (m.files && m.files.length) last = m;
    const items = last ? last.files.map(f => ({ url: f.url_private, filename: f.name || 'dosya', mime: f.mimetype || '' })).filter(x => x.url) : [];
    if (!items.length) { empty++; console.log(`  #${no}: dosya yok — atlandı`); continue; }
    if (DRY) { filled++; console.log(`  [DRY] #${no}: ${items.length} dosya → ${items.map(i => i.filename).join(', ')}`); continue; }
    const wr = await fetch(`${API}/api/briefs/by-ts/${ts}/final-deliverables`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bns-token': WT },
      body: JSON.stringify({ items, by: 'backfill' }),
    });
    if (wr.ok) { filled++; console.log(`  #${no}: ${items.length} teslim kaydedildi`); }
    else { console.log(`  #${no}: kayıt hatası HTTP ${wr.status}`); }
  }
  console.log(`\n🟢 ${filled} işe teslim eklendi, ${empty} işte dosya yok${DRY ? ' (DRY)' : ''}\n`);
})().catch(e => { console.error('backfill hata:', e.message); process.exit(1); });
