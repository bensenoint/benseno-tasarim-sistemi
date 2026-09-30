'use strict';
/**
 * akilli-bildirim.js — Akıllı durum bildirimleri (bildirim reformu 2026-09-30).
 * termin-risk.js'in yerini alır ve genişletir. Saatlik (09-19 hafta içi) tarar;
 * her sinyali işin listesindeki sorumlulara (lead + worker; GÖZCÜ HARİÇ) notify() ile
 * gönderir → dashboard çanı + acil DM (sessiz saat/prefs korumalı) + Ody sesi.
 *
 * Sinyaller (tip → bastırma penceresi):
 *  - termin       (≤24sa kaldı, bnsIsRisk)                     → 20sa
 *  - gecikme      (termin geçti, iş hâlâ aktif; uzatma önerisi) → 20sa
 *  - hareketsiz   (aktif işte 48sa+ hiç olay yok)               → 44sa
 *  - musteri-bekliyor (müşteride 3+ gün)                        → 44sa
 *  (fatura hatırlatmaları fatura-hatirlatma.js'te — saatlik zaten çalışıyor.)
 *
 *   node scripts/akilli-bildirim.js [--dry]
 */
const { fetchEmbedded, H, DAY } = require('./rapor-lib');
const { bnsIsRisk } = require('../dashboard/app/calc.js');
const { notify } = require('../server/notify');
const { pool } = require('../server/db');

const DRY = process.argv.includes('--dry');
const AKTIF_CALISAN = new Set(['basladi', 'calisiliyor', 'incelemede', 'kontrole', 'revizyon']);

async function tazeMi(briefId, tip, saat) {
  const r = await pool.query(
    `SELECT created_at FROM notifications WHERE brief_id=$1 AND tip=$2 ORDER BY id DESC LIMIT 1`, [briefId, tip]);
  if (!r.rows[0]) return false;
  return (Date.now() - new Date(r.rows[0].created_at).getTime()) < saat * H;
}

function sorumlular(b) {
  return [...new Set([...(b.leads || []), ...(b.workers || [])]
    .filter(p => p && /^U/.test(p.id || '')).map(p => p.id))];
}
const isAd = (b) => `#${b.no}${b.baslik ? ` "${String(b.baslik).slice(0, 60)}"` : ''} ${b.marka || ''}`.trim();

async function gonder(b, tip, text, sayac) {
  const uids = sorumlular(b);
  if (!uids.length) return;
  if (DRY) { console.log(`[DRY] ${tip} ${isAd(b)} → ${uids.length} kişi: ${text}`); sayac.n++; return; }
  for (const uid of uids) await notify(uid, { tip, aciliyet: 'acil', text, link: b.slack_url, briefId: b.id });
  sayac.n++; console.log(`${tip} ${isAd(b)} → ${uids.length} kişi`);
}

(async () => {
  const emb = await fetchEmbedded();
  const nowMs = Date.parse(emb.now) || Date.now();
  const briefs = emb.bns_briefs || [];

  // İş başına son olay zamanı — DOĞRUDAN DB'den (embedded bns_events son-200 olayla
  // sınırlı; yoğun günde eski işler pencere dışında kalıp sahte "hareketsiz" alarmı
  // üretiyordu). Ayrıca müşteride-bekleme süresi için durum:musteride'nin zamanı ayrı.
  const sonOlay = new Map(), musterideAt = new Map();
  {
    const r = await pool.query(`SELECT brief_id, EXTRACT(EPOCH FROM max(ts))*1000 AS t FROM events GROUP BY brief_id`);
    for (const x of r.rows) sonOlay.set(x.brief_id, Math.round(+x.t));
    const m = await pool.query(`SELECT brief_id, EXTRACT(EPOCH FROM max(ts))*1000 AS t FROM events WHERE verb='durum:musteride' GROUP BY brief_id`);
    for (const x of m.rows) musterideAt.set(x.brief_id, Math.round(+x.t));
  }

  const sayac = { n: 0 };
  for (const b of briefs) {
    const dl = typeof b.deadline === 'number' ? b.deadline : Date.parse(b.deadline);
    const deltaH = dl ? (dl - nowMs) / H : null;

    // 1) Termin riski (≤24sa) — dashboard rozetiyle aynı kural
    if (dl && deltaH > 0 && bnsIsRisk(b.durum, deltaH)) {
      if (!(await tazeMi(b.id, 'termin', 20)))
        await gonder(b, 'termin', `⏰ *Gecikme riski* — ${isAd(b)}: teslime *${Math.round(deltaH)} saat* kaldı, iş hâlâ *${b.durum}*.`, sayac);
    }

    // 2) Fiilî gecikme + uzatma önerisi
    if (dl && deltaH <= 0 && b.durum !== 'tamamlandi' && b.durum !== 'musteride') {
      if (!(await tazeMi(b.id, 'gecikme', 20)))
        await gonder(b, 'gecikme', `🔴 *Gecikme* — ${isAd(b)}: termin *${Math.abs(Math.round(deltaH))} saat önce* geçti. Termini revize edin (dashboard → termin uzat) ya da işi kapatın.`, sayac);
    }

    // 3) Hareketsiz iş (aktif ama 48sa+ olay yok)
    const son = sonOlay.get(b.id) || b.baslangic || null;
    if (AKTIF_CALISAN.has(b.durum) && son && nowMs - son > 2 * DAY) {
      if (!(await tazeMi(b.id, 'hareketsiz', 44)))
        await gonder(b, 'hareketsiz', `😴 *Hareketsiz iş* — ${isAd(b)}: ${Math.round((nowMs - son) / DAY)} gündür hiçbir hareket yok, durum *${b.durum}*. Durumu güncelleyin ya da beklemeye alın.`, sayac);
    }

    // 4) Müşteri onayında 3+ gün — süre, müşteriye GÖNDERİM anından ölçülür
    const mAt = b.durum === 'musteride' ? (musterideAt.get(b.id) || son) : null;
    if (mAt && nowMs - mAt > 3 * DAY) {
      if (!(await tazeMi(b.id, 'musteri-bekliyor', 44)))
        await gonder(b, 'musteri-bekliyor', `📮 *Müşteri dönüşü gecikti* — ${isAd(b)}: ${Math.round((nowMs - mAt) / DAY)} gündür müşteride. Müşteriye nazik bir hatırlatma zamanı olabilir.`, sayac);
    }
  }
  console.log(`akilli-bildirim: ${sayac.n} sinyal${DRY ? ' (DRY)' : ''}`);
  try { await pool.end(); } catch { /* kapalı olabilir */ }
})().catch(e => { console.error('akilli-bildirim hata:', e.message); process.exit(1); });
