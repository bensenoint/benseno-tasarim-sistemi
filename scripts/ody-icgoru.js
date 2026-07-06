'use strict';
/**
 * ody-icgoru.js — Ody proaktif günlük tek-satır içgörü (sabah cron, dijest'ten önce).
 * Kayda değer durumda (geciken/riskli/bugün) LLM ile tek cümle üretir; notifications'a
 * tip='ody_icgoru' yazar (dashboard gösterir) + tercih açıksa Slack DM gönderir.
 * Kullanım: node scripts/ody-icgoru.js         → canlı (BNS_REPORT_LIVE=1 gerektirir)
 *           node scripts/ody-icgoru.js --dry    → LLM/DM/DB yok; sinyal + prompt yazdır
 */
const { token, post, fetchEmbedded, GORKEM, DASHBOARD_URL } = require('./rapor-lib');
const { pool } = require('../server/db');

const H = 3600000;
const DRY = process.argv.includes('--dry');

function computeSignal(user, briefs, now) {
  const uid = user.id;
  const related = (briefs || []).filter(b =>
    b.durum !== 'musteride' && b.durum !== 'tamamlandi' &&
    ((b.workers || []).some(w => w && w.id === uid) || (b.leads || []).some(l => l && l.id === uid)));
  const dh = (b) => b.deadline == null ? null : (b.deadline - now) / H;
  // "Aynı gün" Europe/Istanbul takvimine göre (sunucu UTC olsa da gün sınırı TR saatiyle).
  const trDay = (ms) => new Date(ms).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
  const sameDay = (ms) => trDay(ms) === trDay(now);
  const geciken = [], riskli = [], bugun = [];
  for (const b of related) {
    const d = dh(b);
    if (d == null) continue;
    if (d <= 0) geciken.push(b);
    else if (sameDay(b.deadline)) bugun.push(b);
    else if (d <= 24) riskli.push(b);
  }
  if (geciken.length + riskli.length + bugun.length === 0) return null;
  geciken.sort((a, b) => (a.deadline || 0) - (b.deadline || 0));
  const focus = geciken[0] || bugun[0] || riskli[0];
  const slim = (b) => ({ no: b.no, marka: b.marka, baslik: b.baslik,
    gun: b.deadline ? Math.round((now - b.deadline) / 86400000) : null });
  return { ad: (user.name || '').split(' ')[0] || user.name || '',
    geciken: geciken.map(slim), riskli: riskli.map(slim), bugun: bugun.map(slim), focus };
}

const SYS = "Sen Ody, Benseno iş asistanısın. Verilen GERÇEK sinyallere dayanarak kişiye TEK CÜMLE, sıcak ve eyleme yönelik bir içgörü yaz. YALNIZ verilen verileri kullan — sayı uydurma, veri ekleme. En fazla 140 karakter. Türkçe. En kritik işe somut atıf ver (#no marka). Selamlama/emoji/markdown ekleme, düz tek cümle.";

async function generateLine(signal) {
  const body = {
    model: 'claude-sonnet-4-6', max_tokens: 80, system: SYS,
    messages: [{ role: 'user', content: JSON.stringify({ ad: signal.ad, geciken: signal.geciken, riskli: signal.riskli, bugun: signal.bugun }) }],
  };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { console.error('[ody-icgoru] LLM HTTP', r.status); return null; }
  const j = await r.json();
  const raw = (j.content && j.content[0] && j.content[0].text) || '';
  const line = raw.split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
  return line ? line.slice(0, 140) : null;
}

async function main() {
  const tok = token();
  if (!tok) { console.error('SLACK token yok'); process.exit(1); }
  if (!DRY && !process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY yok'); process.exit(1); }
  const live = process.env.BNS_REPORT_LIVE === '1';
  const now = Date.now();
  const d = await fetchEmbedded();
  const briefs = d.bns_briefs || [];
  const users = (d.bns_users || []).filter(u => /^U/.test(u.id));

  // DM tercihleri: ody_icgoru kapalı mı + sessiz saat aralığı (dashboard bildirimi yine yazılır; yalnız DM atlanır). --dry'da DB'ye hiç gitme.
  const prefs = DRY ? new Map() : new Map((await pool.query(
    `SELECT user_id, ody_icgoru, sessiz_bas, sessiz_bit FROM notify_prefs`)).rows.map(r => [r.user_id, r]));
  // İstanbul saatine göre şu anki saat + sessiz-saat kontrolü (server/notify.js'teki inQuiet ile aynı mantık, yerel kopya)
  const trHour = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul', hour12: false, hour: '2-digit' }), 10);
  const inQuiet = (p) => {
    const bas = (p && p.sessiz_bas != null) ? p.sessiz_bas : 19;
    const bit = (p && p.sessiz_bit != null) ? p.sessiz_bit : 8;
    return bas > bit ? (trHour >= bas || trHour < bit) : (trHour >= bas && trHour < bit);
  };

  let sent = 0; const preview = [];
  for (const u of users) {
    const signal = computeSignal(u, briefs, now);
    if (!signal) continue;
    if (DRY) { preview.push(`### ${u.name}\n${JSON.stringify(signal, null, 2)}`); continue; }

    const dup = await pool.query(
      `SELECT 1 FROM notifications WHERE user_id=$1 AND tip='ody_icgoru'
        AND (created_at AT TIME ZONE 'Europe/Istanbul')::date = (now() AT TIME ZONE 'Europe/Istanbul')::date LIMIT 1`, [u.id]);
    if (dup.rowCount) continue;

    const line = await generateLine(signal);
    if (!line) continue;

    if (live) {
      // DM gönderilecek mi: tercih açık + sessiz saatte değil (sessizde INSERT yine yapılır, dashboard görür)
      const p = prefs.get(u.id);
      const dmIzin = !(p && p.ody_icgoru === false) && !inQuiet(p);
      let dmAtildi = false;
      if (dmIzin) dmAtildi = await post(tok, u.id, `💡 ${line}\n🔗 ${DASHBOARD_URL}`);
      // K7: çift-çalışma yarışı — unique index ihlalini (23505) yut, diğer hataları fırlat
      try {
        await pool.query(
          `INSERT INTO notifications (user_id, tip, aciliyet, text, brief_id, dijest_at, slack_at, marka)
           VALUES ($1,'ody_icgoru','normal',$2,NULL, now(), $3, $4)`,
          [u.id, line, dmAtildi ? new Date() : null, (signal.focus && signal.focus.marka) || null]);
      } catch (e) {
        if (e.code === '23505') { console.error('[ody-icgoru] çift kayıt engellendi (23505):', u.id); continue; }
        throw e;
      }
    } else {
      preview.push(`### ${u.name}\n💡 ${line}`);
    }
    sent++;
  }

  if (DRY) { console.log(`ody-icgoru DRY — ${preview.length} kişi sinyalli\n\n` + preview.join('\n\n———\n\n')); }
  else if (!live && preview.length) { await post(tok, GORKEM, `🧪 *Ody içgörü önizleme (${sent} kişi)*\n\n` + preview.join('\n\n———\n\n')); }
  console.log(`ody-icgoru ${DRY ? 'DRY' : live ? 'CANLI' : 'TEST'} — ${sent} kişi`);
  await pool.end();
}

if (require.main === module) main().catch(e => { console.error('ody-icgoru hata:', e.message); process.exit(1); });
module.exports = { computeSignal, generateLine };
