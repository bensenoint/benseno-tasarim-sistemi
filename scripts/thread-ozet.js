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

// İsim haritası + tatildeki kullanıcılar (Slack durum: 🌴 emoji ya da tatil/izin/OOO metni)
async function userNames(tok) {
  const r = await fetch('https://slack.com/api/users.list?limit=200', { headers: { authorization: `Bearer ${tok}` } });
  const j = await r.json().catch(() => ({}));
  const map = {}; const vacation = new Set();
  for (const m of j.members || []) {
    map[m.id] = m.profile?.display_name || m.real_name || m.name;
    const se = m.profile?.status_emoji || '', st = m.profile?.status_text || '';
    if (/palm_tree|island|beach/.test(se) || /tatil|izin|vacation|ooo|out of office/i.test(st)) vacation.add(m.id);
  }
  return { map, vacation };
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

async function saveInsight(briefId, insight) {
  const r = await fetch(`${API_BASE}/api/briefs/${briefId}/insight`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-bns-token': process.env.BNS_WRITE_TOKEN || '' },
    body: JSON.stringify({ insight }),
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); console.log(`  insight kayıt hata ${r.status}: ${j.error || ''}`); return false; }
  return true;
}

// Tamamlanan iş için değerlendirme insight'ı — ileride marka/iş analizlerinde kullanılacak.
async function generateInsight(messages, names, brief) {
  const key = process.env.ANTHROPIC_API_KEY;
  const lines = messages.map(m => {
    const who = m.bot_id ? 'WT(bot)' : (names[m.user] || m.user || '?');
    return `${who}: ${(m.text || '').slice(0, 500)}`;
  }).join('\n');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5', max_tokens: 400,
      system: 'Bir tasarım ajansında TAMAMLANMIŞ bir işin thread\'inden değerlendirme insight\'ı çıkarıyorsun. Bu metin ileride marka ve iş performans analizlerinde kullanılacak — şu açılardan kısa, olgusal değerlendir: süreç nasıl aktı (pürüzsüz mü, revize/sürtünme oldu mu), müşteri/marka tarafı geri bildirimi neydi, gecikme yaşandıysa nedeni, bu marka/iş tipi için kayda değer öğrenim ne. Yalnızca mesajlardan kanıtlanabilir gözlem yaz, UYDURMA. Yeterli yazışma yoksa "Değerlendirme için yeterli yazışma yok." de. Düz metin, en fazla 5 cümle.',
      messages: [{ role: 'user', content: `İş: #${brief.no} ${brief.marka} — ${brief.baslik} (rev: ${brief.rev || 0})\n\nThread:\n${lines.slice(0, 12000)}` }],
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.log(`  insight hata: ${j.error?.message || r.status}`); return null; }
  return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim() || null;
}

// TR resmî tatilleri (tam gün) — yıl dönümünde güncelle. Dini bayramlar takvime göre kayar.
const TR_HOLIDAYS = new Set([
  // 2026
  '2026-01-01',                                          // Yılbaşı
  '2026-03-20', '2026-03-21', '2026-03-22',              // Ramazan Bayramı
  '2026-04-23',                                          // Ulusal Egemenlik ve Çocuk Bayramı
  '2026-05-01',                                          // Emek ve Dayanışma Günü
  '2026-05-19',                                          // Atatürk'ü Anma, Gençlik ve Spor Bayramı
  '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30',// Kurban Bayramı
  '2026-07-15',                                          // Demokrasi ve Millî Birlik Günü
  '2026-08-30',                                          // Zafer Bayramı
  '2026-10-29',                                          // Cumhuriyet Bayramı
  // 2027
  '2027-01-01',
  '2027-03-09', '2027-03-10', '2027-03-11',              // Ramazan Bayramı
  '2027-04-23', '2027-05-01', '2027-05-19',
  '2027-05-16', '2027-05-17', '2027-05-18', '2027-05-19',// Kurban Bayramı
  '2027-07-15', '2027-08-30', '2027-10-29',
]);

const trYmd = (ms) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }); // YYYY-MM-DD

// İki an arasındaki süre; Cmt/Paz + TR resmî tatil günleri tamamen düşülerek (ms).
function businessMs(t0, t1) {
  if (!t0 || t1 <= t0) return 0;
  let total = 0;
  const d = new Date(t0);
  while (d.getTime() < t1) {
    const dayEnd = new Date(d); dayEnd.setHours(24, 0, 0, 0);
    const chunkEnd = Math.min(dayEnd.getTime(), t1);
    const dow = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' })).getDay();
    if (dow !== 0 && dow !== 6 && !TR_HOLIDAYS.has(trYmd(d.getTime()))) total += chunkEnd - d.getTime();
    d.setTime(chunkEnd);
  }
  return total;
}

async function setStale(briefId, stale) {
  const r = await fetch(`${API_BASE}/api/briefs/${briefId}/stale`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-bns-token': process.env.BNS_WRITE_TOKEN || '' },
    body: JSON.stringify({ stale }),
  });
  return r.ok;
}

async function markUyari(briefId, level) {
  const r = await fetch(`${API_BASE}/api/briefs/${briefId}/uyari`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-bns-token': process.env.BNS_WRITE_TOKEN || '' },
    body: JSON.stringify({ level: level || 1 }),
  });
  return r.ok;
}

async function dm(tok, userId, text) {
  if (!/^U/.test(userId)) return false; // freelancer (FR*) — Slack'te yok
  const r = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` },
    body: JSON.stringify({ channel: userId, text, unfurl_links: false }),
  });
  const j = await r.json().catch(() => ({}));
  return j.ok;
}

const H = 3600000;
const STALE_H = 24;      // iş günü saati (Cmt/Paz + TR tatil hariç) — hareket yoksa stale
const UYARI_H = 1;       // brief açıldıktan sonra iş planına alınmadıysa atananlara DM
const ESKALASYON_H = 2;  // 1. uyarıdan sonra hâlâ 'yeni' ise: kişiye tekrar + yöneticiye bilgi

async function main() {
  const tok = token();
  if (!tok) { console.error('SLACK token yok — çıkılıyor'); process.exit(1); }
  const d = await fetchEmbedded();
  const briefs = (d.bns_briefs || []).filter(b => b.slack_ts && b.slack_channel);
  console.log(`Thread bakımı — ${briefs.length} aktif brief (özet + hareketsiz + cevapsız uyarısı)`);
  if (!briefs.length) return;
  // KPI anlık görüntüsü — Overview spark grafiklerinin tarihsel verisi (saatlik birikir)
  try {
    const ks = await fetch(`${API_BASE}/api/kpi-snapshot`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-bns-token': process.env.BNS_WRITE_TOKEN || '' }, body: '{}',
    });
    console.log(`  kpi-snapshot: ${ks.ok ? 'OK' : 'HATA ' + ks.status}`);
  } catch (e) { console.log(`  kpi-snapshot hata: ${e.message}`); }

  const { map: names, vacation } = await userNames(tok);
  if (vacation.size) console.log(`  tatilde: ${[...vacation].map(id => names[id]).join(', ')}`);
  const usersById = Object.fromEntries((d.bns_users || []).map(u => [u.id, u]));
  const now = Date.now();

  let updated = 0, skipped = 0, staleFlips = 0, warned = 0, escalated = 0;
  for (const b of briefs) {
    const msgs = await threadReplies(tok, b.slack_channel, b.slack_ts);
    if (!msgs) continue;

    // İnsan mesajları (bot hariç) — son aktivite ve "çalışan dokundu mu" tespiti için
    const humanMsgs = msgs.filter(m => !m.bot_id && m.user);
    const lastHumanMs = humanMsgs.length ? parseFloat(humanMsgs[humanMsgs.length - 1].ts) * 1000 : 0;

    // ── 1) Thread özeti (yeni mesaj varsa) ──
    if (msgs.length >= 2) {
      const lastTs = msgs[msgs.length - 1].ts;
      if (b.thread_ozet_ts && b.thread_ozet_ts === lastTs) skipped++;
      else {
        const ozet = await summarize(msgs, names, b);
        if (ozet && await saveOzet(b.id, ozet, lastTs)) { updated++; console.log(`  ✓ #${b.no} ${b.marka} özetlendi (${msgs.length} mesaj)`); }
        await new Promise(r => setTimeout(r, 1100));
      }
    } else skipped++;

    // ── 2) Hareketsizlik: 24 iş saati (Cmt/Paz hariç) ne durum/içerik değişikliği ne insan mesajı ──
    // Atananların TAMAMI tatildeyse (Slack 🌴/tatil/izin/OOO) süre işlemez — resmî tatil gibi.
    const wIds = (b.workers || []).map(w => w && w.id).filter(Boolean);
    const allOnVacation = wIds.length > 0 && wIds.every(id => vacation.has(id));
    const lastActivity = Math.max(b.created_at || 0, b.updated_at || 0, lastHumanMs);
    const shouldStale = !allOnVacation && lastActivity > 0 && businessMs(lastActivity, now) >= STALE_H * H;
    if (shouldStale !== !!b.stale) {
      if (await setStale(b.id, shouldStale)) { staleFlips++; console.log(`  ${shouldStale ? '🟠' : '🟢'} #${b.no} ${b.marka} stale=${shouldStale}`); }
    }

    // ── 3) Cevapsız uyarısı + eskalasyon ──
    // Ölçüt: durum hâlâ 'yeni' = iş planına alınmamış (başlama emojisi 🎨/✍️/🤖 durumu değiştirirdi).
    // Thread'e yazışma olması yetmez — emoji konmadıysa uyarı yine gider.
    // Tatildeki çalışana (Slack durumu 🌴/tatil/izin/OOO) DM gitmez; dönünce sonraki turda alır.
    if (b.durum === 'yeni' && b.created_at) {
      const workerIds = [...new Set((b.workers || []).map(w => w && w.id).filter(Boolean))];

      // 1. uyarı: açılıştan 1 saat sonra, atananın kendisine
      if (!b.uyari_at && (now - b.created_at) >= UYARI_H * H && workerIds.length) {
        let sent = 0;
        for (const wid of workerIds) {
          if (vacation.has(wid)) continue;
          const ok = await dm(tok, wid,
            `👋 *#${b.no} ${b.marka} — ${b.baslik}* sana atandı ama henüz iş planına almadın görünüyor.\n` +
            `İş planına almak için thread'e emoji bırak (🎨/✍️/🤖) ya da yaz: <${b.slack_url}|thread'i aç>`);
          if (ok) sent++;
        }
        if (sent) { await markUyari(b.id, 1); warned++; console.log(`  📣 #${b.no} ${b.marka} — ${sent} kişiye cevapsız uyarısı`); }
      }

      // 2. uyarı (eskalasyon): 1. uyarıdan 2 saat sonra hâlâ 'yeni' → kişiye tekrar + departman yöneticisine bilgi
      if (b.uyari_at && !b.uyari2_at && (now - b.uyari_at) >= ESKALASYON_H * H && workerIds.length) {
        let sent = 0;
        const workerNames = workerIds.map(id => names[id] || id).join(', ');
        for (const wid of workerIds) {
          if (vacation.has(wid)) continue;
          const ok = await dm(tok, wid,
            `⏰ *#${b.no} ${b.marka} — ${b.baslik}* hâlâ iş planında görünmüyor (2. hatırlatma).\n` +
            `Yapamayacaksan ya da bir engel varsa hemen yöneticine haber ver — zaman kaybetmeyelim. <${b.slack_url}|Thread'i aç>`);
          if (ok) sent++;
        }
        // Yöneticiye bilgi: atananların departman yöneticileri (kendisi atanansa hariç, tatildekiler hariç)
        const depts = new Set(usersById ? workerIds.map(id => usersById[id]?.dept).filter(Boolean) : []);
        const mgrIds = (d.bns_users || [])
          .filter(u => u.yetki === 'yonetici' && depts.has(u.dept) && !workerIds.includes(u.id) && !vacation.has(u.id))
          .map(u => u.id);
        for (const mid of mgrIds) {
          await dm(tok, mid,
            `ℹ️ *#${b.no} ${b.marka} — ${b.baslik}*: ${workerNames} işi henüz planına almadı (açılalı ${Math.round((now - b.created_at) / H)} saat, 2 hatırlatma yapıldı).\n` +
            `Bir engel olabilir — bilgi alıp gerekirse yeniden atama yapın. <${b.slack_url}|Thread'i aç>`);
        }
        if (sent || mgrIds.length) {
          await markUyari(b.id, 2); escalated++;
          console.log(`  🚨 #${b.no} ${b.marka} — eskalasyon: ${sent} çalışan + ${mgrIds.length} yönetici`);
        }
      }
    }
  }
  console.log(`aktifler bitti — özet:${updated} atlanan:${skipped} stale-değişimi:${staleFlips} uyarı:${warned} eskalasyon:${escalated}`);

  // ── Tamamlananlar: insight (bir kez) ──────────────────────
  // Son 30 günde biten, insight'ı olmayan, thread'li işler. İleride marka/iş değerlendirmesi için.
  const cutoff = Date.now() - 30 * 86400000;
  const done = (d.bns_completed || []).filter(b =>
    b.slack_ts && b.slack_channel && !b.insight && b.bitis && b.bitis >= cutoff);
  console.log(`Insight — ${done.length} tamamlanan iş bekliyor`);
  let insighted = 0;
  for (const b of done) {
    const msgs = await threadReplies(tok, b.slack_channel, b.slack_ts);
    if (!msgs) continue;
    const ins = await generateInsight(msgs, names, b);
    if (!ins) continue;
    if (await saveInsight(b.id, ins)) { insighted++; console.log(`  ✓ #${b.no} ${b.marka} insight kaydedildi`); }
    await new Promise(r => setTimeout(r, 1100));
  }
  console.log(`bitti — ${insighted} insight üretildi`);
}

main().catch(e => { console.error('thread-ozet hata:', e.message); process.exit(1); });
