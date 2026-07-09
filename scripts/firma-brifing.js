'use strict';
/**
 * firma-brifing.js — Haftalık GM brifingi (P3.3c). Pazartesi 08:00. Tüm firma sinyalleri +
 * finans → Opus sentezi (yoksa deterministik fallback) → yönetici+GM DM.
 * DRY: firma-sinyal.js sinyalleriHesapla + calc bnsFinansOzet.
 *   node scripts/firma-brifing.js         → canlı (BNS_REPORT_LIVE=1 DM)
 *   node scripts/firma-brifing.js --dry    → DM/LLM yok; olgular + hedef yazdır
 */
const { token, post, fetchEmbedded, GORKEM, DASHBOARD_URL } = require('./rapor-lib');
const { pool } = require('../server/db');
const { sinyalleriHesapla, yoneticiMi } = require('./firma-sinyal');
const C = require('../dashboard/app/calc.js');

const DRY = process.argv.includes('--dry');
const OPUS = process.env.ODY_OPUS_MODEL || 'claude-opus-4-7';
const GUARD = ' ÖNEMLİ: Yalnızca aşağıdaki olgulara dayan. Tarih, ay, proje türü (bu bir tasarım/reklam ajansıdır — yazılım değil), müşteri veya OLMAYAN hiçbir bilgi UYDURMA. Emin olmadığını yazma.';
const SYS = 'Sen Ody, Benseno iş asistanısın. Yöneticilere HAFTA-ÖNÜ stratejik brifing yaz: bu hafta neye dikkat edilmeli. Verilen sinyalleri ve finansı yorumla; en kritik 3-5 maddeyi öne çıkar, kısa ve eyleme yönelik ol. Başlık + madde imleri kullan, en fazla ~250 kelime. Türkçe. Eğer finansVar=false ise finansal rakam/yorum YAPMA (veri girilmemiş, 0 sanma).' + GUARD;

// Saf olgu toplama (Opus'a ve fallback'e girdi)
async function brifingOlgulari(d, now) {
  const sinyaller = await sinyalleriHesapla(d, now);
  const finans = C.bnsFinansOzet(d.bns_completed || []);
  // Finans alanları (satış/maliyet) girilmemişse yanıltıcı 0 gösterme / Opus'a "yorum yapma" de.
  const finansVar = (finans.satis || 0) > 0 || (finans.maliyet || 0) > 0;
  // fatura-v2: bu ay retainer faturası kesilmemiş markalar (aylik_ucret'li olup bu ayın
  // marka_fatura kaydı fatura=true OLMAYANLAR).
  const buAy = new Date(now).toISOString().slice(0, 7);
  const mf = d.bns_marka_fatura || [];
  const kesilmemisRetainer = (d.bns_brands || [])
    .filter((b) => b.aylik_ucret != null)
    .filter((b) => !mf.some((x) => x.marka === b.name && x.ay === buAy && x.fatura))
    .map((b) => b.name);
  return { sinyaller, finans, finansVar, kesilmemisRetainer,
    aktifSayi: (d.bns_briefs || []).length, tamamlananSayi: (d.bns_completed || []).length };
}

// Deterministik fallback (Opus yok/hatalı) — link main'de eklenir
function fallbackMetin(o) {
  const f = o.finans || {};
  const satirlar = (o.sinyaller || []).map((s) => '• ' + s.text);
  return [
    '📋 *Haftalık firma brifingi* (hafta-önü)',
    '',
    `🚨 Sinyaller (${(o.sinyaller || []).length}):`,
    ...(satirlar.length ? satirlar : ['• Bu hafta kritik sinyal yok.']),
    '',
    '💰 Finans (tamamlanan):',
    ...(o.finansVar
      ? [`• Kâr: ${f.kar != null ? f.kar : '—'} · Marj: ${f.marj != null ? '%' + f.marj : '—'}`,
         `• Faturalanmamış: ${f.faturalanmamis || 0} · Tahsil edilmemiş: ${f.tahsilEdilmemis || 0}`]
      : ['• Finans verisi girilmemiş (satış/maliyet alanları boş).']),
    ...((o.kesilmemisRetainer || []).length
      ? ['', `📄 Kesilmemiş retainer (bu ay): ${o.kesilmemisRetainer.join(', ')}`] : []),
  ].join('\n');
}

async function opusBrifing(o) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.log('  (ANTHROPIC_API_KEY yok — fallback)'); return null; }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: OPUS, max_tokens: 800, system: SYS,
        messages: [{ role: 'user', content: 'Olgular (JSON):\n' + JSON.stringify(o, null, 2) }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.log(`  (Opus hata: ${j.error?.message || r.status} — fallback)`); return null; }
    const txt = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
    return txt || null;
  } catch (e) { console.log(`  (Opus exception: ${e.message} — fallback)`); return null; }
}

async function main() {
  const tok = token();
  if (!tok && !DRY) { console.error('SLACK token yok'); process.exit(1); }
  const live = process.env.BNS_REPORT_LIVE === '1';
  const now = Date.now();
  const d = await fetchEmbedded();
  const olgular = await brifingOlgulari(d, now);

  const ids = Array.from(new Set(
    (d.bns_users || []).filter((u) => /^U/.test(u.id) && yoneticiMi(u)).map((u) => u.id).concat(GORKEM)));

  if (DRY) {
    console.log(`firma-brifing DRY — ${olgular.sinyaller.length} sinyal, ${ids.length} hedef`);
    console.log('  hedefler:', ids.join(', '));
    console.log(fallbackMetin(olgular));
    await pool.end();
    return;
  }

  const metin = (await opusBrifing(olgular)) || fallbackMetin(olgular);
  const full = metin + `\n\n🔗 ${DASHBOARD_URL}`;

  const prefs = new Map((await pool.query(
    `SELECT user_id, tip_firma_sinyal FROM notify_prefs`)).rows.map((r) => [r.user_id, r]));
  let sent = 0;
  for (const uid of ids) {
    const p = prefs.get(uid);
    if (p && p.tip_firma_sinyal === false) continue;
    if (live) { if (await post(tok, uid, full)) sent++; }
  }
  console.log(`firma-brifing ${live ? 'CANLI' : 'TEST'} — ${sent} DM`);
  await pool.end();
}

if (require.main === module) main().catch((e) => { console.error('firma-brifing hata:', e.message); process.exit(1); });
module.exports = { brifingOlgulari, fallbackMetin };
