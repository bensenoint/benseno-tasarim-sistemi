#!/usr/bin/env node
'use strict';
/**
 * reconcile-report.js — SALT-OKUNUR. API çökmesi penceresinde (varsayılan 15.06 11:24-12:12 TR)
 * Slack'ten gelen ama DB'ye yazılamamış olabilecek durum değişikliklerini tespit eder.
 *   1) Her aktif brief'in thread reaction'larını okur → ima edilen durum DB'den İLERİDE mi?
 *   2) Çökme penceresinde thread'e düşmüş İNSAN mesajlarını (olası yazılı komut) işaretler.
 * Hiçbir şey YAZMAZ. Çıktı = manuel düzeltme için liste.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DB_URL = fs.readFileSync(path.join(__dirname, '../data/.db-url'), 'utf8').trim();
const TOKEN = fs.readFileSync(path.join(__dirname, '../data/.slack-bot-token'), 'utf8').trim();

// Çökme penceresi (TR = UTC+3). 11:24-12:12 TR → 08:24-09:12 UTC.
const WIN_START = Date.UTC(2026, 5, 15, 8, 24, 0) / 1000;
const WIN_END   = Date.UTC(2026, 5, 15, 9, 12, 0) / 1000;

// slack-bot.js DURUM_MAP + ✅ (white_check_mark ayrı işlenir) — birebir ayna.
const EMOJI_DURUM = {
  art: 'calisiliyor', writing_hand: 'calisiliyor', robot_face: 'calisiliyor',
  arrows_counterclockwise: 'calisiliyor', arrows_clockwise: 'calisiliyor',
  eyes: 'incelemede', double_vertical_bar: 'beklemede',
  pencil2: 'revizyon', pencil: 'revizyon',
  airplane: 'musteride', small_airplane: 'musteride',
  white_check_mark: 'tamamlandi',
};
// "İlerleme" sırası — Slack max > DB ise kaçmış güncelleme şüphesi.
const ORDER = { yeni: 0, calisiliyor: 1, beklemede: 1, blokeli: 1, revizyon: 1, incelemede: 2, musteride: 3, tamamlandi: 4 };

function sql(q) {
  const out = execFileSync('psql', [DB_URL, '-t', '-A', '-F', '\t', '-c', q], { encoding: 'utf8' });
  return out.trim().split('\n').filter(Boolean).map(l => l.split('\t'));
}
async function slack(method, params) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`https://slack.com/api/${method}?${qs}`, { headers: { Authorization: 'Bearer ' + TOKEN } });
  return r.json();
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const rows = sql(`SELECT b.id, b.no, COALESCE(br.name,'?'), b.durum, b.slack_channel, b.slack_ts
                    FROM briefs b LEFT JOIN brands br ON br.id=b.marka_id
                    WHERE b.completed_at IS NULL AND b.deleted_at IS NULL
                      AND b.slack_channel IS NOT NULL AND b.slack_ts IS NOT NULL
                    ORDER BY b.no`);
  console.log(`Aktif + thread'li brief: ${rows.length}\nÇökme penceresi: 15.06 11:24–12:12 TR\n${'─'.repeat(60)}`);

  const driftHits = [], windowHits = [], errors = [];
  for (const [id, no, marka, durum, ch, ts] of rows) {
    try {
      const rg = await slack('reactions.get', { channel: ch, timestamp: ts });
      await sleep(300);
      if (!rg.ok) { errors.push(`#${no} ${marka}: reactions.get ${rg.error}`); continue; }
      const reacts = (rg.message && rg.message.reactions || []).map(r => r.name.split('::')[0]);
      // Slack reaction'larından ima edilen en ileri durum
      let maxStatus = null, maxOrder = -1;
      for (const rn of reacts) {
        const d = EMOJI_DURUM[rn];
        if (d && ORDER[d] > maxOrder) { maxOrder = ORDER[d]; maxStatus = d; }
      }
      if (maxStatus && maxOrder > (ORDER[durum] ?? 0)) {
        driftHits.push(`#${no} ${marka} — DB: "${durum}" · Slack reaction'ları: [${reacts.join(', ')}] → "${maxStatus}" olmalı`);
      }
      // Çökme penceresinde insan mesajı (olası yazılı komut)
      const rep = await slack('conversations.replies', { channel: ch, ts, limit: 50 });
      await sleep(300);
      if (rep.ok) {
        const win = (rep.messages || []).filter(m => !m.bot_id && +m.ts >= WIN_START && +m.ts <= WIN_END && (m.text || '').trim());
        if (win.length) windowHits.push(`#${no} ${marka} — pencerede ${win.length} insan mesajı: ` +
          win.map(m => `"${(m.text || '').slice(0, 60)}"`).join(' | '));
      }
    } catch (e) { errors.push(`#${no} ${marka}: ${e.message}`); }
  }

  console.log(`\n🔴 DURUM SAPMASI (Slack ileri, DB geride — kaçmış güncelleme şüphesi): ${driftHits.length}`);
  driftHits.forEach(h => console.log('  • ' + h));
  console.log(`\n🟡 ÇÖKME PENCERESİNDE THREAD MESAJI (yazılı komut olabilir, gözden geçir): ${windowHits.length}`);
  windowHits.forEach(h => console.log('  • ' + h));
  if (errors.length) { console.log(`\n⚠️ Okunamayan ${errors.length}:`); errors.forEach(e => console.log('  • ' + e)); }
  console.log(`\n${'─'.repeat(60)}\nÖzet: ${driftHits.length} durum sapması, ${windowHits.length} pencere-mesajı, ${errors.length} hata. (Salt-okunur — hiçbir şey değiştirilmedi.)`);
})().catch(e => { console.error('reconcile hata:', e.message); process.exit(1); });
