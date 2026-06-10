'use strict';

/**
 * kanal-ozet.js — Marka kanallarının TAMAMINI (tüm thread'ler dahil) okuyup
 * AI ile genel akış özeti çıkarır → Marka detay sayfasında gösterilir.
 * BNS_GUNSONU=1 ile ayrıca gün-sonu değerlendirme insight'ı üretir ve
 * brand_daily'ye arşivler (ileride marka değerlendirmeleri/raporları için).
 *
 * Maliyet kontrolü: son mesajı değişmeyen kanal atlanır (kanal_ozet_ts).
 * Mesajsız kanal hiç AI çağrısı yapmaz.
 */

const path = require('path');
const { token, fetchEmbedded } = require('./rapor-lib');
const { CHANNELS } = require(path.join(__dirname, '..', 'server', 'slack.js'));

const API_BASE = (process.env.BNS_API_BASE || 'https://benseno-api-production.up.railway.app').replace(/\/+$/, '');
const GUNSONU = process.env.BNS_GUNSONU === '1';
const H = 3600000;
// Özelliğin devreye alındığı an — bu tarihten ÖNCEKİ mesajlar asla okunmaz (geçmişe gidilmez).
const EPOCH = Date.parse('2026-06-10T14:40:00+03:00');

async function slackGet(tok, method, params) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`https://slack.com/api/${method}?${qs}`, { headers: { authorization: `Bearer ${tok}` } });
  return r.json().catch(() => ({}));
}

// Kanal adı → ID haritası (tek conversations.list taraması, sayfalı)
async function channelIds(tok) {
  const map = {}; let cursor = '';
  do {
    const j = await slackGet(tok, 'conversations.list',
      { types: 'public_channel,private_channel', exclude_archived: 'true', limit: '200', ...(cursor ? { cursor } : {}) });
    if (!j.ok) { console.error('conversations.list hata:', j.error); break; }
    for (const c of j.channels || []) map[c.name] = c.id;
    cursor = j.response_metadata?.next_cursor || '';
  } while (cursor);
  return map;
}

async function userNames(tok) {
  const j = await slackGet(tok, 'users.list', { limit: '200' });
  const map = {};
  for (const m of j.members || []) map[m.id] = m.profile?.display_name || m.real_name || m.name;
  return map;
}

// Kanalın son 24 saatini topla: ana mesajlar + thread yanıtları, kronolojik düz metin
async function channelDigest(tok, chId, names, sinceMs) {
  const hist = await slackGet(tok, 'conversations.history',
    { channel: chId, oldest: String(sinceMs / 1000), limit: '100' });
  if (!hist.ok) return { error: hist.error };
  const msgs = (hist.messages || []).reverse(); // eski → yeni
  if (!msgs.length) return { lines: [], lastTs: null, count: 0 };
  const fmt = (m) => {
    const who = m.bot_id ? 'WT(bot)' : (names[m.user] || m.user || '?');
    const when = new Date(parseFloat(m.ts) * 1000).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
    return `[${when}] ${who}: ${(m.text || '').slice(0, 400)}`;
  };
  const lines = [];
  let lastTs = msgs[msgs.length - 1].ts;
  for (const m of msgs) {
    lines.push(fmt(m));
    if (m.reply_count > 0 && m.thread_ts) {
      const rep = await slackGet(tok, 'conversations.replies', { channel: chId, ts: m.thread_ts, limit: '50' });
      for (const r2 of (rep.messages || []).slice(1)) {            // [0] = parent (zaten eklendi)
        lines.push('  ↳ ' + fmt(r2));
        if (parseFloat(r2.ts) > parseFloat(lastTs)) lastTs = r2.ts;
      }
    }
  }
  return { lines, lastTs, count: lines.length };
}

async function haiku(system, content) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.error('ANTHROPIC_API_KEY yok — çıkılıyor'); process.exit(1); }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 400, system,
      messages: [{ role: 'user', content: content.slice(0, 14000) }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.log(`  AI hata: ${j.error?.message || r.status}`); return null; }
  return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim() || null;
}

async function apiWrite(method, urlPath, body) {
  const r = await fetch(`${API_BASE}${urlPath}`, {
    method, headers: { 'content-type': 'application/json', 'x-bns-token': process.env.BNS_WRITE_TOKEN || '' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); console.log(`  kayıt hata ${r.status}: ${j.error || ''}`); }
  return r.ok;
}

async function main() {
  const tok = token();
  if (!tok) { console.error('SLACK token yok — çıkılıyor'); process.exit(1); }
  const d = await fetchEmbedded();
  const brandMeta = Object.fromEntries((d.bns_brands || []).map(b => [b.name, b]));
  const [ids, names] = await Promise.all([channelIds(tok), userNames(tok)]);
  // Bugünün başlangıcı (TR) — gün sonu insight penceresi
  const trNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  const todayStart = Date.now() - (trNow.getHours() * 60 + trNow.getMinutes()) * 60000 - trNow.getSeconds() * 1000;

  console.log(`Kanal özeti ${GUNSONU ? '+ GÜN SONU' : ''} — ${Object.keys(CHANNELS).length} marka kanalı`);
  let updated = 0, skipped = 0, insights = 0;
  for (const [brand, chName] of Object.entries(CHANNELS)) {
    const chId = ids[chName];
    if (!chId) { console.log(`  ⚠️ #${chName} bulunamadı (bot üye değil / arşivli)`); continue; }
    // Pencere: son özetten beri (yoksa son 24sa) — ama asla EPOCH'tan (devreye alma) önce değil.
    const meta0 = brandMeta[brand] || {};
    const since = Math.max(GUNSONU ? todayStart : (meta0.kanal_ozet_at || Date.now() - 24 * H), EPOCH);
    const dig = await channelDigest(tok, chId, names, since);
    if (dig.error) { console.log(`  ⚠️ #${chName}: ${dig.error}`); continue; }
    if (!dig.count) { skipped++; continue; }                       // son 24 saatte mesaj yok
    const meta = brandMeta[brand] || {};
    const text = `Marka: ${brand} (#${chName})\n\nDevreden beri kanal akışı (thread yanıtları ↳ ile):\n${dig.lines.join('\n')}`;

    // 1) Genel kanal özeti — yeni mesaj yoksa atla
    if (meta.kanal_ozet_at && dig.lastTs && String(meta.kanal_ozet_ts || '') === dig.lastTs) skipped++;
    else {
      const ozet = await haiku(
        'Bir tasarım ajansının marka Slack kanalının yeni TÜM akışını (ana mesajlar + thread yazışmaları) özetliyorsun. 4-6 cümlelik Türkçe, olgusal genel özet: hangi işler konuşuldu, neler ilerledi, açık konular/bekleyenler ne, dikkat çeken bir şey var mı. Bot durum bildirimlerini sayma, insan yazışmasına odaklan. Mesajlarda OLMAYAN hiçbir şeyi uydurma. Düz metin.',
        text);
      if (ozet && await apiWrite('PATCH', `/api/brands/by-name/${encodeURIComponent(brand)}/kanal-ozet`, { ozet, last_ts: dig.lastTs })) {
        updated++; console.log(`  ✓ ${brand} kanal özeti (${dig.count} satır)`);
      }
      await new Promise(r => setTimeout(r, 1100));
    }

    // 2) Gün sonu insight — sadece BNS_GUNSONU=1 turunda
    if (GUNSONU) {
      const ins = await haiku(
        'Bir tasarım ajansının marka Slack kanalının BUGÜNKÜ akışından gün-sonu değerlendirme insight\'ı çıkarıyorsun. Bu metin ileride marka performans değerlendirmelerinde ve raporlarda kullanılacak — şu açılardan kısa ve olgusal değerlendir: bugün bu markada iş yoğunluğu/tempo nasıldı, süreçte pürüz/sürtünme var mıydı, müşteri-marka tarafından gelen sinyaller (memnuniyet, aciliyet, revize baskısı), yarına sarkan/bekleyen konular. Yalnızca mesajlardan kanıtlanabilir gözlem yaz, UYDURMA. Düz metin, en fazla 5 cümle.',
        text);
      if (ins && await apiWrite('POST', `/api/brands/by-name/${encodeURIComponent(brand)}/gun-sonu`, { insight: ins })) {
        insights++; console.log(`  🌙 ${brand} gün-sonu insight`);
      }
      await new Promise(r => setTimeout(r, 1100));
    }
  }
  console.log(`bitti — özet:${updated} atlanan:${skipped}${GUNSONU ? ` insight:${insights}` : ''}`);
}

main().catch(e => { console.error('kanal-ozet hata:', e.message); process.exit(1); });
