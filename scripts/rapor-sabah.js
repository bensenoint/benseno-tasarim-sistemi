'use strict';

/**
 * Sabah Raporu — DETERMINISTIK (Cutover C2). Veri: /api/embedded (DB).
 * Test: node scripts/rapor-sabah.js (Görkem-only) · Canlı: BNS_REPORT_LIVE=1 node ...
 */

const { DASHBOARD_URL, H, deltaLabel, isToday, runReport } = require('./rapor-lib');

const SYS = 'Sen Benseno tasarım ajansının operasyon analistisin. Verilen GÜNLÜK OLGULARA bakıp en fazla 2-3 cümlelik, Türkçe, somut bir yönetici yorumu yaz. Önceliklendirme/risk/kapasite vurgula. Giriş cümlesi, başlık, madde işareti KULLANMA — sadece düz yorum. Veriyi tekrar listeleme, yorumla.';

function build(d) {
  const now = Date.now();
  const briefs = (d.bns_briefs || []).map(b => ({ ...b, dh: b.deadline > 0 ? (b.deadline - now) / H : 999 }));
  const fmt = (b) => `  • ${b.marka} #${b.no} — ${b.baslik || '—'} (${deltaLabel(b.dh)})`;

  const acil = briefs.filter(b => b.dh > 0 && b.dh <= 8).sort((a, b) => a.dh - b.dh);
  const gecmis = briefs.filter(b => b.deadline > 0 && b.dh <= 0).sort((a, b) => a.dh - b.dh);
  const bugun = briefs.filter(b => isToday(b.deadline)).sort((a, b) => a.dh - b.dh);

  const nameById = Object.fromEntries((d.bns_users || []).map(u => [u.id, u.name]));
  const load = {};
  for (const b of briefs) for (const uid of (b.atanan_ids || [])) load[uid] = (load[uid] || 0) + 1;
  const overload = Object.entries(load).filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]);

  const ds = d.bns_dept_stats || {};
  const dl = (k) => ds[k] ? `${ds[k].active} aktif (${ds[k].overdue} geçmiş)` : '—';

  const L = [`📊 *Benseno Sabah Raporu — ${require('./rapor-lib').trDate()}*`, ''];
  L.push(`🔴 *Acil* (${acil.length})${acil.length ? ':\n' + acil.map(fmt).join('\n') : ' — yok'}`);
  L.push(`⚠️ *Geçmiş Tarih* (${gecmis.length})${gecmis.length ? ':\n' + gecmis.slice(0, 15).map(fmt).join('\n') + (gecmis.length > 15 ? `\n  … +${gecmis.length - 15} daha` : '') : ' — yok'}`);
  if (overload.length) L.push(`🚨 *Kapasite Aşımı*: ` + overload.map(([id, n]) => `${nameById[id] || id} ${n} aktif`).join(' · '));
  L.push(`📋 *Bugün deadline* (${bugun.length})${bugun.length ? ':\n' + bugun.map(fmt).join('\n') : ' — yok'}`);
  L.push('', `🎨 Tasarım: ${dl('tasarim')}  ·  ✍️ Editör: ${dl('editor')}  ·  🤖 AI: ${dl('ai')}`, '', `🔗 ${DASHBOARD_URL}`);

  const facts = {
    acil: acil.length, gecmis: gecmis.length, bugun_deadline: bugun.length,
    kapasite_asimi: overload.map(([id, n]) => `${nameById[id] || id}:${n}`),
    dept: { tasarim: ds.tasarim, editor: ds.editor, ai: ds.ai },
    en_geç: gecmis.slice(0, 5).map(b => `${b.marka} #${b.no} (${deltaLabel(b.dh)})`),
  };
  return { text: L.join('\n'), facts };
}

runReport('Sabah raporu', build, SYS).catch(e => { console.error('rapor-sabah hata:', e.message); process.exit(1); });
