'use strict';

/** Haftalık Retrospektif — DETERMINISTIK (C2). Veri: /api/embedded. Cuma 17:10. */

const { DASHBOARD_URL, H, DAY, trDate, deltaLabel, money, runReport } = require('./rapor-lib');
const calc = require('../dashboard/app/calc.js');   // zamanında teslim: bekleme düşülmüş (dashboard ile aynı)

const SYS = 'Sen Benseno tasarım ajansının operasyon analistisin. Haftanın olgularına bakıp en fazla 3 cümlelik, Türkçe, somut bir haftalık retrospektif yorumu yaz (verim, zamanında teslim, dikkat edilecekler). Başlık/madde KULLANMA, sadece düz yorum.';

function build(d) {
  const now = Date.now();
  const weekAgo = now - 7 * DAY;
  const completed = d.bns_completed || [];
  const briefs = (d.bns_briefs || []).map(b => ({ ...b, dh: b.deadline > 0 ? (b.deadline - now) / H : 999 }));
  const nameById = Object.fromEntries((d.bns_users || []).map(u => [u.id, u.name]));

  const haftaTamam = completed.filter(c => c.bitis && c.bitis >= weekAgo);
  // Zamanında teslim % (deadline'ı olanlarda)
  const withDl = haftaTamam.filter(c => c.deadline > 0);
  // Zamanında = net gecikme yok (bekleme/müşteri süresi düşülür) — calc.js bnsGecikmeH ile birebir.
  const onTime = withDl.filter(c => calc.bnsGecikmeH(c.bitis, c.bekleme_ms || 0, c.deadline) <= 0).length;
  const onTimePct = withDl.length ? Math.round(onTime / withDl.length * 100) : null;
  // Marka kırılımı
  const byMarka = {};
  for (const c of haftaTamam) byMarka[c.marka] = (byMarka[c.marka] || 0) + 1;
  const topMarka = Object.entries(byMarka).sort((a, b) => b[1] - a[1]).slice(0, 5);
  // En çok iş bitiren (lead)
  const byLead = {};
  for (const c of haftaTamam) if (c.leadId) byLead[c.leadId] = (byLead[c.leadId] || 0) + 1;
  const topLead = Object.entries(byLead).sort((a, b) => b[1] - a[1]).slice(0, 3);
  // Gelir (satış toplamı)
  const gelir = haftaTamam.reduce((s, c) => s + (Number(c.satis) || 0), 0);
  // Gelecek hafta deadline
  const gelecek = briefs.filter(b => b.deadline > 0 && b.dh > 0 && b.dh <= 7 * 24).sort((a, b) => a.dh - b.dh);

  const L = [`📅 *Benseno Haftalık Retro — ${trDate()}*`, ''];
  L.push(`✅ Bu hafta tamamlanan: *${haftaTamam.length}*` + (onTimePct != null ? `  ·  ⏱️ Zamanında: *%${onTimePct}* (${onTime}/${withDl.length})` : ''));
  if (topMarka.length) L.push(`🏷️ Marka: ` + topMarka.map(([m, n]) => `${m} ${n}`).join(' · '));
  if (topLead.length) L.push(`🏆 En üretken: ` + topLead.map(([id, n]) => `${(nameById[id] || id).split(' ')[0]} ${n}`).join(' · '));
  if (gelir > 0) L.push(`💰 Tamamlanan iş geliri: ${money(gelir)}`);
  L.push(`⏭️ *Gelecek hafta deadline* (${gelecek.length})${gelecek.length ? ':\n' + gelecek.slice(0, 12).map(b => `  • ${b.marka} #${b.no} — ${b.baslik || '—'} (${deltaLabel(b.dh)})`).join('\n') : ' — yok'}`);
  L.push('', `🔗 ${DASHBOARD_URL}`);

  const facts = {
    hafta_tamamlanan: haftaTamam.length, zamaninda_pct: onTimePct, gelir: gelir || null,
    marka_kirilimi: Object.fromEntries(topMarka), en_uretken: topLead.map(([id, n]) => `${nameById[id] || id}:${n}`),
    gelecek_hafta_deadline: gelecek.length,
  };
  return { text: L.join('\n'), facts };
}

runReport('Haftalık retro', build, SYS).catch(e => { console.error('rapor-haftalik hata:', e.message); process.exit(1); });
