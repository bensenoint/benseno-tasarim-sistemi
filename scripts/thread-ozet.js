'use strict';

/**
 * thread-ozet.js — Aktif brieflerin Slack thread yazışmalarını okur, Haiku ile
 * 3-5 cümlelik Türkçe özet çıkarır, API'ye yazar (dashboard iş detayında görünür).
 * Yeni mesaj yoksa brief atlanır (thread_ozet_ts karşılaştırması) → maliyet ~0.
 * Hafta içi 2 saatte bir scheduler tetikler; iş tamamlanınca aktif listeden
 * düştüğü için özetleme kendiliğinden durur.
 */

const { token, fetchEmbedded } = require('./rapor-lib');

const API_BASE = (process.env.BNS_API_BASE || 'https://benseno-api-production.up.railway.app').replace(/\/+$/, '');

// Thread mesajlarını çek (parent dahil) — bot mesajlarını da alırız, özetçi ayıklar.
async function threadReplies(tok, channel, ts) {
  const r = await fetch(`https://slack.com/api/conversations.replies?channel=${channel}&ts=${ts}&limit=100`, {
    headers: { authorization: `Bearer ${tok}` },
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) { console.log(`  replies hata (${channel}/${ts}): ${j.error}`); return null; }
  return j.messages || [];
}

async function userNames(tok) {
  const r = await fetch('https://slack.com/api/users.list?limit=200', { headers: { authorization: `Bearer ${tok}` } });
  const j = await r.json().catch(() => ({}));
  const map = {};
  for (const m of j.members || []) map[m.id] = m.profile?.display_name || m.real_name || m.name;
  return map;
}

async function summarize(messages, names, brief) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.error('ANTHROPIC_API_KEY yok — çıkılıyor'); process.exit(1); }
  const lines = messages.map(m => {
    const who = m.bot_id ? 'WT(bot)' : (names[m.user] || m.user || '?');
    const when = new Date(parseFloat(m.ts) * 1000).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `[${when}] ${who}: ${(m.text || '').slice(0, 500)}`;
  }).join('\n');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5', max_tokens: 350,
      system: 'Bir tasarım ajansının iş takip thread\'ini özetliyorsun. 3-5 cümlelik, Türkçe, olgusal bir özet yaz: ne istendi, ne konuşuldu, son durum ne, açık soru/bekleyen ne var. Bot durum bildirimlerini ("durum güncellendi" vb.) sayma — insan yazışmasına odaklan. Mesajlarda OLMAYAN hiçbir şeyi uydurma. İnsan mesajı yoksa sadece "Henüz yazışma yok." yaz. Başlık/madde işareti kullanma, düz metin.',
      messages: [{ role: 'user', content: `İş: #${brief.no} ${brief.marka} — ${brief.baslik}\n\nThread:\n${lines.slice(0, 12000)}` }],
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.log(`  özet hata: ${j.error?.message || r.status}`); return null; }
  return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim() || null;
}

async function saveOzet(briefId, ozet, lastTs) {
  const r = await fetch(`${API_BASE}/api/briefs/${briefId}/thread-ozet`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-bns-token': process.env.BNS_WRITE_TOKEN || '' },
    body: JSON.stringify({ ozet, last_ts: lastTs }),
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); console.log(`  kayıt hata ${r.status}: ${j.error || ''}`); return false; }
  return true;
}

async function main() {
  const tok = token();
  if (!tok) { console.error('SLACK token yok — çıkılıyor'); process.exit(1); }
  const d = await fetchEmbedded();
  const briefs = (d.bns_briefs || []).filter(b => b.slack_ts && b.slack_channel);
  console.log(`Thread özeti — ${briefs.length} aktif brief (slack thread'li)`);
  if (!briefs.length) return;
  const names = await userNames(tok);

  let updated = 0, skipped = 0;
  for (const b of briefs) {
    const msgs = await threadReplies(tok, b.slack_channel, b.slack_ts);
    if (!msgs || msgs.length < 2) { skipped++; continue; }       // sadece parent → özetlenecek yazışma yok
    const lastTs = msgs[msgs.length - 1].ts;
    if (b.thread_ozet_ts && b.thread_ozet_ts === lastTs) { skipped++; continue; }  // yeni mesaj yok
    const ozet = await summarize(msgs, names, b);
    if (!ozet) continue;
    if (await saveOzet(b.id, ozet, lastTs)) { updated++; console.log(`  ✓ #${b.no} ${b.marka} özetlendi (${msgs.length} mesaj)`); }
    await new Promise(r => setTimeout(r, 1100)); // Slack + Anthropic rate-limit nefesi
  }
  console.log(`bitti — ${updated} güncellendi, ${skipped} atlandı (değişiklik yok)`);
}

main().catch(e => { console.error('thread-ozet hata:', e.message); process.exit(1); });
