'use strict';
/**
 * firma-sinyal.js — Firma-seviyesi proaktif sinyaller (P3.3a). Günde 2 kez (09:00/15:00) tarar,
 * eşik ihlallerini yöneticilere Slack DM + dashboard bildirimi olarak push eder.
 * Deterministik (LLM yok). ody-icgoru.js kardeş deseni.
 *   node scripts/firma-sinyal.js         → canlı (BNS_REPORT_LIVE=1 DM için)
 *   node scripts/firma-sinyal.js --dry    → DB/DM yok; sinyaller + hedef liste yazdır
 *
 * NOT: calc.js dashboard'ta; bu script scripts/'te çalışır (tüm repo erişir) → require güvenli.
 * Bu bağımlılık ASLA server/ içine taşınmaz (benseno-api imajı yalnız server/ içerir).
 */
const { token, post, fetchEmbedded, GORKEM, DASHBOARD_URL } = require('./rapor-lib');
const { pool } = require('../server/db');
const C = require('../dashboard/app/calc.js');

const DRY = process.argv.includes('--dry');

// İstanbul saatine göre sessiz-saat (ody-icgoru ile aynı mantık)
function inQuiet(p, trHour) {
  const bas = (p && p.sessiz_bas != null) ? p.sessiz_bas : 19;
  const bit = (p && p.sessiz_bit != null) ? p.sessiz_bit : 8;
  return bas > bit ? (trHour >= bas || trHour < bit) : (trHour >= bas && trHour < bit);
}

// Yönetici mi? users tablosunda hem rol hem yetki olabilir (bnsBriefActionPerms ile aynı kural) + GM.
function yoneticiMi(u) {
  return u.id === GORKEM || u.rol === 'yonetici' || u.yetki === 'yonetici';
}

// Firma kapasitesi: v2 zamana-yayılmış bugün doluluğu (calc.bnsFirmaGunDoluluk) — Aşama 4 geçişi.

// Embedded'dan sinyal girdilerini çıkar → tüm sinyalleri topla
async function sinyalleriHesapla(d, now) {
  const aktif = d.bns_briefs || [];
  const tamamlanan = d.bns_completed || [];
  const out = [];

  // 1. Kapasite (v2: zamana yayılmış bugün doluluğu)
  out.push(...C.bnsSinyalKapasite(C.bnsFirmaGunDoluluk(aktif, d.bns_users, C.bnsGunKey(now))));

  // 2. Geciken (aktif işler)
  out.push(...C.bnsSinyalGeciken(aktif, now));

  // 3. Marka-risk: brand_daily.risk_seviye (son gün) + aktif thread_ton
  let riskMap = {};
  if (!DRY) {
    try {
      const r = await pool.query(
        `SELECT DISTINCT ON (marka) marka, risk_seviye FROM brand_daily
          WHERE risk_seviye IS NOT NULL ORDER BY marka, gun DESC`);
      r.rows.forEach((x) => { if (x.marka) riskMap[x.marka] = x.risk_seviye; });
    } catch (e) { console.error('[firma-sinyal] risk_seviye sorgu hatası:', e.message); }
  }
  out.push(...C.bnsSinyalMarkaRisk(aktif, riskMap));

  // 4. Kişi kalite-düşüşü: puanlı TAMAMLANAN işleri kişi başına tarih sırasıyla topla
  const byKisi = {};
  tamamlanan.forEach((b) => {
    if (b.rating == null || !b.bitis) return;
    (b.workers || []).concat(b.leads || []).forEach((p) => {
      if (!p || !/^U/.test(p.id)) return;
      (byKisi[p.id] = byKisi[p.id] || { id: p.id, ad: (p.name || '').split(' ')[0] || p.name, rows: [] })
        .rows.push({ t: b.bitis, r: b.rating });
    });
  });
  const kisiler = Object.values(byKisi).map((k) => ({
    id: k.id, ad: k.ad,
    ratings: k.rows.sort((a, b) => a.t - b.t).map((x) => x.r), // oldest→newest
  }));
  out.push(...C.bnsSinyalKisiKalite(kisiler));

  // 5. Gecikme öngörüsü: her aktif brief için marka baseline + açık döngü elapsed
  const atRisk = [];
  aktif.forEach((b) => {
    const baselineH = C.bnsBaselineCycle(tamamlanan, b.marka);
    const elapsedH = C.bnsCycleSure(b.durum_olaylari || [], now).toplamH || 0;
    const o = C.bnsGecikmeOngoru({ deadline: b.deadline, durum: b.durum, rev_ic: b.rev_ic, rev_musteri: b.rev_musteri, elapsedH }, baselineH, now);
    if (o.risk) atRisk.push(b);
  });
  out.push(...C.bnsSinyalGecikme(atRisk));

  // 6. Burnout v2: kişi 5-iş-günü serisinde ≥%120 gün (zamana yayılmış projeksiyon).
  const bugun = C.bnsGunKey(now);
  const GUN_AD = (k) => new Date(k + 'T12:00:00+03:00').toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'short' });
  const burnoutlar = [];
  (d.bns_users || []).forEach((u) => {
    if (!/^U/.test(u.id) || u.active === false) return;
    const seri = C.bnsKisiGunlukSeri(aktif, u, bugun, 5);
    const tepe = seri.reduce((a, x) => (x.pct > a.pct ? x : a), { pct: 0 });
    if (tepe.pct >= 120) burnoutlar.push({ ad: (u.name || '').split(' ')[0] || u.id, pct: tepe.pct, gun: GUN_AD(tepe.gun) });
  });
  out.push(...C.bnsSinyalBurnout(burnoutlar));

  return out;
}

// Bu tip+key için bugün (İstanbul günü) zaten push edildi mi?
async function dahaOnceMi(uid, tip, key) {
  const r = await pool.query(
    `SELECT 1 FROM notifications
      WHERE user_id=$1 AND tip=$2
        AND (marka=$3 OR ($3 IS NULL AND marka IS NULL))
        AND (created_at AT TIME ZONE 'Europe/Istanbul')::date = (now() AT TIME ZONE 'Europe/Istanbul')::date
      LIMIT 1`, [uid, tip, key]);
  return r.rowCount > 0;
}

async function main() {
  const tok = token();
  if (!tok && !DRY) { console.error('SLACK token yok'); process.exit(1); }
  const live = process.env.BNS_REPORT_LIVE === '1';
  const now = Date.now();
  const d = await fetchEmbedded();

  const sinyaller = await sinyalleriHesapla(d, now);

  // Dinamik yönetici listesi: rol/yetki='yonetici' + GORKEM
  const ids = Array.from(new Set(
    (d.bns_users || []).filter((u) => /^U/.test(u.id) && yoneticiMi(u)).map((u) => u.id).concat(GORKEM)));

  if (DRY) {
    console.log(`firma-sinyal DRY — ${sinyaller.length} sinyal, ${ids.length} yönetici hedefi:`);
    console.log('  hedefler:', ids.join(', '));
    sinyaller.forEach((s) => console.log(`  [${s.tip}/${s.key || 'firma'}] ${s.text}`));
    await pool.end();
    return;
  }

  const prefs = new Map((await pool.query(
    `SELECT user_id, tip_firma_sinyal, sessiz_bas, sessiz_bit FROM notify_prefs`)).rows.map((r) => [r.user_id, r]));
  const trHour = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul', hour12: false, hour: '2-digit' }), 10);

  let sent = 0;
  for (const s of sinyaller) {
    for (const uid of ids) {
      const p = prefs.get(uid);
      if (p && p.tip_firma_sinyal === false) continue;      // master toggle kapalı
      if (await dahaOnceMi(uid, s.tip, s.key)) continue;    // günlük dedup

      const dmIzin = live && !inQuiet(p, trHour);
      let dmAtildi = false;
      if (dmIzin) dmAtildi = await post(tok, uid, `${s.text}\n🔗 ${DASHBOARD_URL}`);
      try {
        await pool.query(
          `INSERT INTO notifications (user_id, tip, aciliyet, text, brief_id, dijest_at, slack_at, marka)
           VALUES ($1,$2,$3,$4,NULL, now(), $5, $6)`,
          [uid, s.tip, s.aciliyet, s.text, dmAtildi ? new Date() : null, s.key]);
        sent++;
      } catch (e) {
        if (e.code === '23505') { console.error('[firma-sinyal] çift kayıt (23505):', uid, s.tip); continue; }
        throw e;
      }
    }
  }
  console.log(`firma-sinyal ${live ? 'CANLI' : 'TEST'} — ${sinyaller.length} sinyal, ${sent} bildirim`);
  await pool.end();
}

if (require.main === module) main().catch((e) => { console.error('firma-sinyal hata:', e.message); process.exit(1); });
module.exports = { sinyalleriHesapla, firmaCapPct, yoneticiMi };
