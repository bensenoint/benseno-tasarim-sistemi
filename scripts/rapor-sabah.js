'use strict';

/**
 * Sabah Raporu — DETERMINISTIK (Cutover C2). Veri: /api/embedded (DB).
 * Test: node scripts/rapor-sabah.js (Görkem-only) · Canlı: BNS_REPORT_LIVE=1 node ...
 */

const { DASHBOARD_URL, H, deltaLabel, isToday, runReport } = require('./rapor-lib');
const calc = require('../dashboard/app/calc.js');   // TEK KURAL: kapasite dashboard ile aynı (rol ağırlıklı 5/2/0)

const SYS = 'Sen Benseno tasarım ajansının operasyon analistisin. Verilen GÜNLÜK OLGULARA bakıp en fazla 2-3 cümlelik, Türkçe, somut bir yönetici yorumu yaz. Önceliklendirme/risk/kapasite vurgula. Giriş cümlesi, başlık, madde işareti KULLANMA — sadece düz yorum. Veriyi tekrar listeleme, yorumla.';

function build(d) {
  const now = Date.now();
  const briefs = (d.bns_briefs || []).map(b => ({ ...b, dh: b.deadline > 0 ? (b.deadline - now) / H : 999 }));
  const fmt = (b) => `  • ${b.marka} #${b.no} — ${b.baslik || '—'} (${deltaLabel(b.dh)})`;

  const acil = briefs.filter(b => b.dh > 0 && b.dh <= 8).sort((a, b) => a.dh - b.dh);
  const gecmis = briefs.filter(b => b.deadline > 0 && b.dh <= 0).sort((a, b) => a.dh - b.dh);
  const bugun = briefs.filter(b => isToday(b.deadline)).sort((a, b) => a.dh - b.dh);

  // Kapasite aşımı — dashboard'la AYNI: rol-ağırlıklı yük (işçi 5/lead 2/gözlemci 0),
  // işçi-eşdeğerine çevrilip (yük/5) kişi limitine bölünür. %100 = dolu/aşım.
  const overload = (d.bns_users || []).map(u => {
    const pct = calc.bnsPersonCapPct(u, calc.bnsPersonLoad(briefs, u.id) / 5);
    return { name: u.name || u.id, pct };
  }).filter(x => x.pct >= 100).sort((a, b) => b.pct - a.pct);

  const ds = d.bns_dept_stats || {};
  const dl = (k) => ds[k] ? `${ds[k].active} aktif (${ds[k].overdue} geçmiş)` : '—';

  const L = [`📊 *Benseno Sabah Raporu — ${require('./rapor-lib').trDate()}*`, ''];
  L.push(`🔴 *Acil* (${acil.length})${acil.length ? ':\n' + acil.map(fmt).join('\n') : ' — yok'}`);
  L.push(`⚠️ *Geçmiş Tarih* (${gecmis.length})${gecmis.length ? ':\n' + gecmis.slice(0, 15).map(fmt).join('\n') + (gecmis.length > 15 ? `\n  … +${gecmis.length - 15} daha` : '') : ' — yok'}`);
  if (overload.length) L.push(`🚨 *Kapasite Aşımı*: ` + overload.map(x => `${x.name} %${x.pct}`).join(' · '));
  L.push(`📋 *Bugün deadline* (${bugun.length})${bugun.length ? ':\n' + bugun.map(fmt).join('\n') : ' — yok'}`);
  L.push('', `🎨 Tasarım: ${dl('tasarim')}  ·  ✍️ Editör: ${dl('editor')}  ·  🤖 AI: ${dl('ai')}`, '', `🔗 ${DASHBOARD_URL}`);

  const facts = {
    acil: acil.length, gecmis: gecmis.length, bugun_deadline: bugun.length,
    kapasite_asimi: overload.map(x => `${x.name}:%${x.pct}`),
    dept: { tasarim: ds.tasarim, editor: ds.editor, ai: ds.ai },
    en_geç: gecmis.slice(0, 5).map(b => `${b.marka} #${b.no} (${deltaLabel(b.dh)})`),
  };
  return { text: L.join('\n'), facts };
}

runReport('Sabah raporu', build, SYS).catch(e => { console.error('rapor-sabah hata:', e.message); process.exit(1); });
