'use strict';

/** Günlük Özet — DETERMINISTIK (C2). Veri: /api/embedded. Hafta içi 17:05. */

const { DASHBOARD_URL, H, trDate, isToday, deltaLabel, runReport } = require('./rapor-lib');

const SYS = 'Sen Benseno tasarım ajansının operasyon analistisin. Günün kapanış olgularına bakıp en fazla 2 cümlelik, Türkçe, somut bir gün-sonu değerlendirmesi yaz (bugünkü ilerleme + yarına taşınan risk). Başlık/madde KULLANMA, sadece düz yorum.';

function build(d) {
  const now = Date.now();
  const briefs = (d.bns_briefs || []).map(b => ({ ...b, dh: b.deadline > 0 ? (b.deadline - now) / H : 999 }));
  const completed = d.bns_completed || [];
  const nameById = Object.fromEntries((d.bns_users || []).map(u => [u.id, u.name]));

  const bugunTamam = completed.filter(c => isToday(c.bitis));
  const acil = briefs.filter(b => b.dh > 0 && b.dh <= 8);
  const gecmis = briefs.filter(b => b.deadline > 0 && b.dh <= 0);
  const yarin = briefs.filter(b => b.deadline > 0 && b.dh > 0 && b.dh <= 24).sort((a, b) => a.dh - b.dh);

  const fmtC = (c) => `  • ${c.marka} #${c.no} — ${c.baslik || '—'}${c.leadId ? ' · ' + (nameById[c.leadId] || '').split(' ')[0] : ''}`;
  const fmtB = (b) => `  • ${b.marka} #${b.no} — ${b.baslik || '—'} (${deltaLabel(b.dh)})`;

  const L = [`🌆 *Benseno Günlük Özet — ${trDate()}*`, ''];
  L.push(`✅ *Bugün tamamlanan* (${bugunTamam.length})${bugunTamam.length ? ':\n' + bugunTamam.map(fmtC).join('\n') : ' — yok'}`);
  L.push(`🔴 Açık acil: ${acil.length}  ·  ⚠️ Geçmiş tarih: ${gecmis.length}`);
  L.push(`⏭️ *Yarın deadline* (${yarin.length})${yarin.length ? ':\n' + yarin.map(fmtB).join('\n') : ' — yok'}`);
  L.push('', `🔗 ${DASHBOARD_URL}`);

  const facts = {
    bugun_tamamlanan: bugunTamam.length, acik_acil: acil.length, gecmis_tarih: gecmis.length,
    yarin_deadline: yarin.length,
    tamamlananlar: bugunTamam.slice(0, 8).map(c => `${c.marka} #${c.no}`),
  };
  return { text: L.join('\n'), facts };
}

runReport('Günlük özet', build, SYS).catch(e => { console.error('rapor-gunluk hata:', e.message); process.exit(1); });
