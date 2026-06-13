'use strict';
/**
 * termin-risk.js — Aktif brieflerden TERMİN RİSKİ taşıyanları bulur ve briefin Slack
 * thread'ine bir uyarı düşer (briefteki herkes görür + thread özetine girer = sistem
 * hafızası + Ody okur). Dashboard 'risk' rozetiyle AYNI kuralı (calc.js bnsIsRisk) kullanır.
 *
 * Idempotent: aynı thread'e son 20 saatte uyarı atıldıysa tekrar atmaz.
 * Çalıştırma:
 *   node scripts/termin-risk.js          → gerçek uyarı (scheduler kullanır)
 *   node scripts/termin-risk.js --dry    → POST etmeden ne yapacağını yazdırır (test)
 *
 * GÜVENLİK: --dry test için; gerçek mod sadece scheduler'da (prod) çalışmalı.
 */
const { token, fetchEmbedded, H } = require('./rapor-lib');
const { bnsIsRisk } = require('../dashboard/app/calc.js');

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
    if (!b.slack_ts || !b.slack_channel) { skipped++; continue; }

    // Idempotency: son 20 saatte bu thread'e zaten uyarı düştüyse atla
    const msgs = await threadReplies(tok, b.slack_channel, b.slack_ts);
    const recent = msgs && msgs.some(m =>
      (m.text || '').includes(MARKER) && (nowMs - parseFloat(m.ts || 0) * 1000) < WINDOW_MS);
    if (recent) { skipped++; continue; }

    const saat = Math.round(deltaH);
    const durumStr = saat <= 0
      ? `termin *${Math.abs(saat)} saat önce geçti*`
      : `teslime *${saat} saat* kaldı`;
    const text = `⚠️ *${MARKER}* — ${durumStr}, iş hâlâ *${b.durum}*.\n` +
      `Durumu güncelleyin ya da termini revize edin.`;

    if (DRY) { console.log(`[DRY] #${b.no} ${b.marka || ''} → ${b.slack_channel}: ${durumStr}`); warned++; continue; }
    const res = await postThread(tok, b.slack_channel, b.slack_ts, text);
    if (res.ok) { warned++; console.log(`uyarıldı #${b.no} ${b.marka || ''} (${durumStr})`); }
    else { skipped++; console.log(`atlandı #${b.no}: ${res.error}`); }
  }
  console.log(`termin-risk: ${risky} riskli iş, ${warned} uyarıldı, ${skipped} atlandı${DRY ? ' (DRY)' : ''}`);
})().catch(e => { console.error('termin-risk hata:', e.message); process.exit(1); });
