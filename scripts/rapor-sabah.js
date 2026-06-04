'use strict';

/**
 * Sabah Raporu — DETERMINISTIK (Cutover C2).
 * Veri kaynağı: /api/embedded (DB). Eski orchestrator→canvas→live-data pipeline'ına BAĞIMLI DEĞİL.
 * Bölümleri hesaplar + Slack'e formatlı mesaj atar. (İleride claude yorum katmanı eklenebilir —
 * olgular burada hesaplanır, claude sadece prose yazar → token minimal.)
 *
 * TEST GATE: varsayılan SADECE Görkem'e DM. Prod'a açmak için BNS_REPORT_LIVE=1.
 *   node scripts/rapor-sabah.js          # test: sadece Görkem
 *   BNS_REPORT_LIVE=1 node ...           # canlı: 5 yönetici + #benseno-grafik
 */

const fs = require('fs');
const path = require('path');

const API_BASE = (process.env.BNS_API_BASE || 'https://benseno-api-production.up.railway.app').replace(/\/+$/, '');
const PROJECT_DIR = path.join(process.env.HOME || '', 'benseno-tasarim-sistemi');
const DASHBOARD_URL = 'https://bensenoint.github.io/benseno-tasarim-sistemi/';

const GORKEM = 'U030C48PL23';
const MANAGERS = ['U030C48PL23', 'UD96GH76E', 'U4XCE3532', 'U055EDESLSE', 'U02SZQDAFPF'];
const GRAFIK_CH = 'C02SZRJGY0M';
const H = 3600000;

function token() {
  if (process.env.SLACK_BOT_TOKEN) return process.env.SLACK_BOT_TOKEN;
  try { return fs.readFileSync(path.join(PROJECT_DIR, 'data/.slack-bot-token'), 'utf8').trim(); } catch { return null; }
}

const trDate = () => new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' });
function deltaLabel(dh) {
  if (dh <= 0) return `${Math.abs(Math.round(dh / 24))}g geçti`;
  if (dh < 24) return `${Math.round(dh)}sa kaldı`;
  return `${Math.round(dh / 24)}g kaldı`;
}
function isToday(ms) {
  if (!ms) return false;
  const fmt = (d) => d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
  return fmt(new Date(ms)) === fmt(new Date());
}

async function buildReport() {
  const r = await fetch(`${API_BASE}/api/embedded`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`embedded HTTP ${r.status}`);
  const d = await r.json();
  const now = Date.now();
  const briefs = (d.bns_briefs || []).map(b => ({
    ...b, dh: b.deadline > 0 ? (b.deadline - now) / H : 999,
  }));
  const fmt = (b) => `  • ${b.marka} #${b.no} — ${b.baslik || '—'} (${deltaLabel(b.dh)})`;

  const acil = briefs.filter(b => b.dh > 0 && b.dh <= 8).sort((a, b) => a.dh - b.dh);
  const gecmis = briefs.filter(b => b.deadline > 0 && b.dh <= 0).sort((a, b) => a.dh - b.dh);
  const bugun = briefs.filter(b => isToday(b.deadline)).sort((a, b) => a.dh - b.dh);

  // Kişi başı aktif iş (kapasite aşımı: >=4 aktif)
  const nameById = Object.fromEntries((d.bns_users || []).map(u => [u.id, u.name]));
  const load = {};
  for (const b of briefs) for (const uid of (b.atanan_ids || [])) load[uid] = (load[uid] || 0) + 1;
  const overload = Object.entries(load).filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]);

  const ds = d.bns_dept_stats || {};
  const dl = (k) => ds[k] ? `${ds[k].active} aktif (${ds[k].overdue} geçmiş)` : '—';

  const lines = [`📊 *Benseno Sabah Raporu — ${trDate()}*`, ''];
  lines.push(`🔴 *Acil* (${acil.length})${acil.length ? ':\n' + acil.map(fmt).join('\n') : ' — yok'}`);
  lines.push(`⚠️ *Geçmiş Tarih* (${gecmis.length})${gecmis.length ? ':\n' + gecmis.slice(0, 15).map(fmt).join('\n') + (gecmis.length > 15 ? `\n  … +${gecmis.length - 15} daha` : '') : ' — yok'}`);
  if (overload.length) lines.push(`🚨 *Kapasite Aşımı*: ` + overload.map(([id, n]) => `${nameById[id] || id} ${n} aktif`).join(' · '));
  lines.push(`📋 *Bugün deadline* (${bugun.length})${bugun.length ? ':\n' + bugun.map(fmt).join('\n') : ' — yok'}`);
  lines.push('');
  lines.push(`🎨 Tasarım: ${dl('tasarim')}  ·  ✍️ Editör: ${dl('editor')}  ·  🤖 AI: ${dl('ai')}`);
  lines.push('');
  lines.push(`🔗 ${DASHBOARD_URL}`);

  // Claude'a verilecek kompakt olgular (veriyi claude'a OKUTMUYORUZ — sadece hesaplanmış özet → token minimal)
  const facts = {
    acil: acil.length, gecmis: gecmis.length, bugun_deadline: bugun.length,
    kapasite_asimi: overload.map(([id, n]) => `${nameById[id] || id}:${n}`),
    dept: { tasarim: ds.tasarim, editor: ds.editor, ai: ds.ai },
    en_geç: gecmis.slice(0, 5).map(b => `${b.marka} #${b.no} (${deltaLabel(b.dh)})`),
  };
  return { text: lines.join('\n'), facts };
}

// Claude yorum katmanı (hibrit) — hesaplanmış olgulara 2-3 cümle yönetici analizi.
// Anthropic Messages API (raw fetch, proje konvansiyonu). Haiku 4.5 — ucuz. Hata/anahtar yoksa null.
async function commentary(facts) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.log('  (ANTHROPIC_API_KEY yok — yorum atlandı)'); return null; }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        system: 'Sen Benseno tasarım ajansının operasyon analistisin. Sana verilen GÜNLÜK OLGULARA bakıp en fazla 2-3 cümlelik, Türkçe, somut bir yönetici yorumu yaz. Önceliklendirme/risk/kapasite vurgula. Giriş cümlesi, başlık, madde işareti KULLANMA — sadece düz yorum. Veriyi tekrar listeleme, yorumla.',
        messages: [{ role: 'user', content: 'Bugünün olguları (JSON):\n' + JSON.stringify(facts, null, 2) }],
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.log(`  (yorum hata: ${j.error?.message || r.status})`); return null; }
    const txt = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
    return txt || null;
  } catch (e) { console.log(`  (yorum exception: ${e.message})`); return null; }
}

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

(async () => {
  const tok = token();
  if (!tok) { console.error('SLACK_BOT_TOKEN/token dosyası yok — çıkılıyor'); process.exit(1); }
  const { text: body, facts } = await buildReport();
  const yorum = await commentary(facts);
  const text = yorum ? `${body}\n\n💬 _${yorum}_` : body;
  const live = process.env.BNS_REPORT_LIVE === '1';
  const targets = live ? [...MANAGERS, GRAFIK_CH] : [GORKEM];
  console.log(`Sabah raporu ${live ? 'CANLI' : 'TEST (sadece Görkem)'} — ${targets.length} hedef`);
  console.log('─'.repeat(50) + '\n' + text + '\n' + '─'.repeat(50));
  for (const ch of targets) await post(tok, ch, text);
})().catch(e => { console.error('rapor-sabah hata:', e.message); process.exit(1); });
