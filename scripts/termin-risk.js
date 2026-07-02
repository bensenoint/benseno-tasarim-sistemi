'use strict';
/**
 * termin-risk.js — Aktif brieflerden TERMİN RİSKİ taşıyanları bulur ve briefin Slack
 * thread'ine bir uyarı düşer (briefteki herkes görür + thread özetine girer = sistem
 * hafızası + Ody okur). Dashboard 'risk' rozetiyle AYNI kuralı (calc.js bnsIsRisk) kullanır.
 *
 * Saat başı (scheduler) tüm aktif briefleri tarar. Idempotent: aynı thread'e son 20
 * saatte uyarı atıldıysa tekrar atmaz → her saat kontrol eder ama spam'lemez.
 * Çalıştırma:
 *   node scripts/termin-risk.js          → gerçek uyarı (scheduler kullanır)
 *   node scripts/termin-risk.js --dry    → POST etmeden ne yapacağını yazdırır (test)
 *
 * GÜVENLİK: --dry test için; gerçek mod sadece scheduler'da (prod) çalışmalı.
 */
const { token, fetchEmbedded, H } = require('./rapor-lib');
const { bnsIsRisk } = require('../dashboard/app/calc.js');
const { notify } = require('../server/notify');
const { pool } = require('../server/db');
const NOTIFY_V2 = process.env.BNS_NOTIFY_V2 === '1';

// V2: son 20 saatte bu briefe termin bildirimi gitmişse tekrar bastır.
async function notifTazeMi(briefId) {
  const r = await pool.query(`SELECT created_at FROM notifications WHERE brief_id=$1 AND tip='termin' ORDER BY id DESC LIMIT 1`, [briefId]);
  if (!r.rows[0]) return false;
  return (Date.now() - new Date(r.rows[0].created_at).getTime()) < 20 * 3600 * 1000;
}

const DRY = process.argv.includes('--dry');
const MARKER = 'Termin riski';
const WINDOW_MS = 20 * 3600 * 1000; // 20 saat içinde aynı thread'e tekrar uyarı yok

async function threadReplies(tok, channel, ts) {
  const r = await fetch(`https://slack.com/api/conversations.replies?channel=${channel}&ts=${ts}&limit=50`,
    { headers: { authorization: `Bearer ${tok}` } });
  const j = await r.json().catch(() => ({}));
  return j.ok ? (j.messages || []) : null;
}

async function postThread(tok, channel, thread_ts, text) {
  const r = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${tok}` },
    body: JSON.stringify({ channel, thread_ts, text, username: 'WT', unfurl_links: false }),
  });
  return r.json().catch(() => ({}));
}

(async () => {
  const tok = token();
  if (!tok) { console.error('SLACK_BOT_TOKEN yok — çıkılıyor'); process.exit(1); }
  const emb = await fetchEmbedded();
  const nowMs = Date.parse(emb.now) || Date.now();
  const briefs = emb.bns_briefs || [];

  let risky = 0, warned = 0, skipped = 0;
  for (const b of briefs) {
    const dl = typeof b.deadline === 'number' ? b.deadline : Date.parse(b.deadline);
    if (!dl) continue;
    const deltaH = (dl - nowMs) / H;
    if (!bnsIsRisk(b.durum, deltaH)) continue;        // calc.js — dashboard rozetiyle aynı kural
    risky++;

    const saat = Math.round(deltaH);
    const durumStr = saat <= 0
      ? `termin *${Math.abs(saat)} saat önce geçti*`
      : `teslime *${saat} saat* kaldı`;

    // V2: thread'e spam yerine sorumlulara (lead + worker) kişisel ACİL bildirim.
    if (NOTIFY_V2) {
      const kisiler = [...(b.leads || []), ...(b.workers || [])].filter(p => p && /^U/.test(p.id || ''));
      const uids = [...new Set(kisiler.map(p => p.id))];
      if (DRY) {
        const adMap = new Map(kisiler.map(p => [p.id, p.ad || p.name || p.id]));
        const isim = uids.map(id => adMap.get(id)).join(', ');
        console.log(`[DRY-V2] #${b.no} ${b.marka || ''} → notify: ${isim || '(kimse yok)'}`);
        warned++; continue;
      }
      if (await notifTazeMi(b.id)) { skipped++; continue; }   // 20sa içinde zaten uyarıldı
      for (const uid of uids) {
        await notify(uid, { tip: 'termin', aciliyet: 'acil', text: `⏰ #${b.no} ${b.marka || ''} — ${durumStr}`, link: b.slack_url, briefId: b.id });
      }
      warned++; console.log(`uyarıldı(V2) #${b.no} ${b.marka || ''} → ${uids.length} kişi (${durumStr})`);
      continue;
    }

    if (!b.slack_ts || !b.slack_channel) { skipped++; continue; }

    // Idempotency: son 20 saatte bu thread'e zaten uyarı düştüyse atla
    const msgs = await threadReplies(tok, b.slack_channel, b.slack_ts);
    const recent = msgs && msgs.some(m =>
      (m.text || '').includes(MARKER) && (nowMs - parseFloat(m.ts || 0) * 1000) < WINDOW_MS);
    if (recent) { skipped++; continue; }

    const text = `⚠️ *${MARKER}* — ${durumStr}, iş hâlâ *${b.durum}*.\n` +
      `Durumu güncelleyin ya da termini revize edin.`;

    if (DRY) { console.log(`[DRY] #${b.no} ${b.marka || ''} → ${b.slack_channel}: ${durumStr}`); warned++; continue; }
    const res = await postThread(tok, b.slack_channel, b.slack_ts, text);
    if (res.ok) { warned++; console.log(`uyarıldı #${b.no} ${b.marka || ''} (${durumStr})`); }
    else { skipped++; console.log(`atlandı #${b.no}: ${res.error}`); }
  }
  console.log(`termin-risk: ${risky} riskli iş, ${warned} uyarıldı, ${skipped} atlandı${DRY ? ' (DRY)' : ''}`);
  try { await pool.end(); } catch { /* pool zaten kapalı olabilir */ }
})().catch(e => { console.error('termin-risk hata:', e.message); process.exit(1); });
