'use strict';

/**
 * rapor-lib.js — Benseno deterministik raporlar için ortak katman (Cutover C2).
 * Veri: /api/embedded (DB). Slack: chat.postMessage (raw fetch). Yorum: Anthropic API (haiku).
 * Test gate: varsayılan SADECE Görkem'e DM; BNS_REPORT_LIVE=1 → 5 yönetici + #benseno-grafik.
 */

const fs = require('fs');
const path = require('path');

const API_BASE = (process.env.BNS_API_BASE || 'https://benseno-api-production.up.railway.app').replace(/\/+$/, '');
const PROJECT_DIR = path.join(process.env.HOME || '', 'benseno-tasarim-sistemi');
const DASHBOARD_URL = 'https://bensenoint.github.io/benseno-tasarim-sistemi/';
const GORKEM = 'U030C48PL23';
const MANAGERS = ['U030C48PL23', 'UD96GH76E', 'U4XCE3532', 'U055EDESLSE', 'U02SZQDAFPF'];
const GRAFIK_CH = 'C02SZRJGY0M';
const H = 3600000, DAY = 86400000;

function token() {
  if (process.env.SLACK_BOT_TOKEN) return process.env.SLACK_BOT_TOKEN;
  try { return fs.readFileSync(path.join(PROJECT_DIR, 'data/.slack-bot-token'), 'utf8').trim(); } catch { return null; }
}
function targets() {
  return process.env.BNS_REPORT_LIVE === '1' ? [...MANAGERS, GRAFIK_CH] : [GORKEM];
}
async function fetchEmbedded() {
  // /api/embedded artık korumalı → server-to-server write token (x-bns-token) ile kimliklen.
  const wt = process.env.BNS_WRITE_TOKEN;
  const r = await fetch(`${API_BASE}/api/embedded`, {
    cache: 'no-store',
    headers: wt ? { 'x-bns-token': wt } : {},
  });
  if (!r.ok) throw new Error(`embedded HTTP ${r.status}`);
  return r.json();
}
const trDate = () => new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' });
const ymd = (ms) => new Date(ms).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
const isToday = (ms) => !!ms && ymd(ms) === ymd(Date.now());
function deltaLabel(dh) {
  if (dh <= 0) return `${Math.abs(Math.round(dh / 24))}g geçti`;
  if (dh < 24) return `${Math.round(dh)}sa kaldı`;
  return `${Math.round(dh / 24)}g kaldı`;
}
const money = (v) => (v == null ? null : Number(v).toLocaleString('tr-TR') + '₺');

async function post(tok, channel, text) {
  const r = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` },
    body: JSON.stringify({ channel, text, unfurl_links: false }),
  });
  const j = await r.json().catch(() => ({}));
  console.log(`  → ${channel}: ${j.ok ? 'OK' : 'HATA ' + (j.error || r.status)}`);
  return j.ok;
}

// Claude yorum katmanı (hibrit) — hesaplanmış olgulara kısa analiz. Anahtar/hata yoksa null.
async function commentary(systemPrompt, facts) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.log('  (ANTHROPIC_API_KEY yok — yorum atlandı)'); return null; }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5', max_tokens: 400,
        system: systemPrompt + ' ÖNEMLİ: Yalnızca aşağıdaki olgulara dayan. Tarih, ay, proje türü (bu bir tasarım/reklam ajansıdır — yazılım değil), müşteri veya OLMAYAN hiçbir bilgi UYDURMA. Emin olmadığını yazma.',
        messages: [{ role: 'user', content: 'Olgular (JSON):\n' + JSON.stringify({ tarih: trDate(), ...facts }, null, 2) }],
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.log(`  (yorum hata: ${j.error?.message || r.status})`); return null; }
    const txt = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
    return txt || null;
  } catch (e) { console.log(`  (yorum exception: ${e.message})`); return null; }
}

// Bir raporu çalıştır: build() → {text, facts}; sysPrompt ile yorum; hedeflere gönder.
async function runReport(name, build, sysPrompt) {
  const tok = token();
  if (!tok) { console.error('SLACK token yok — çıkılıyor'); process.exit(1); }
  const d = await fetchEmbedded();
  const { text: body, facts } = build(d);
  const yorum = sysPrompt ? await commentary(sysPrompt, facts) : null;
  const text = yorum ? `${body}\n\n💬 _${yorum}_` : body;
  const tgs = targets();
  console.log(`${name} ${process.env.BNS_REPORT_LIVE === '1' ? 'CANLI' : 'TEST (Görkem)'} — ${tgs.length} hedef`);
  console.log('─'.repeat(50) + '\n' + text + '\n' + '─'.repeat(50));
  for (const ch of tgs) await post(tok, ch, text);
}

module.exports = { DASHBOARD_URL, H, DAY, trDate, ymd, isToday, deltaLabel, money, runReport, token, post, fetchEmbedded, GORKEM };
