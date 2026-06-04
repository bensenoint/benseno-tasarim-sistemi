'use strict';

/** Aylık Strateji — DETERMINISTIK (C2). Veri: /api/embedded. Ay sonu (25-31). */

const { DASHBOARD_URL, trDate, money, runReport } = require('./rapor-lib');

const SYS = 'Sen Benseno tasarım ajansının operasyon stratejistisin. Ayın olgularına bakıp en fazla 4 cümlelik, Türkçe, somut aylık strateji değerlendirmesi yaz (verim trendi, marka yoğunluğu, kapasite önerisi). Başlık/madde KULLANMA, sadece düz yorum.';

function build(d) {
  const now = new Date();
  const ayBasi = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const completed = d.bns_completed || [];
  const nameById = Object.fromEntries((d.bns_users || []).map(u => [u.id, u.name]));
  const ds = d.bns_dept_stats || {};

  const ayTamam = completed.filter(c => c.bitis && c.bitis >= ayBasi);
  const byMarka = {};
  for (const c of ayTamam) byMarka[c.marka] = (byMarka[c.marka] || 0) + 1;
  const topMarka = Object.entries(byMarka).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const byLead = {};
  for (const c of ayTamam) if (c.leadId) byLead[c.leadId] = (byLead[c.leadId] || 0) + 1;
  const topLead = Object.entries(byLead).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const gelir = ayTamam.reduce((s, c) => s + (Number(c.satis) || 0), 0);
  const maliyet = ayTamam.reduce((s, c) => s + (Number(c.maliyet) || 0), 0);

  const aktifToplam = Object.values(ds).reduce((s, x) => s + (x.active || 0), 0);
  const gecmisToplam = Object.values(ds).reduce((s, x) => s + (x.overdue || 0), 0);

  const L = [`🗓️ *Benseno Aylık Strateji — ${trDate()}*`, ''];
  L.push(`✅ Bu ay tamamlanan: *${ayTamam.length}*`);
  if (topMarka.length) L.push(`🏷️ Marka yoğunluğu: ` + topMarka.map(([m, n]) => `${m} ${n}`).join(' · '));
  if (topLead.length) L.push(`🏆 En üretken: ` + topLead.map(([id, n]) => `${(nameById[id] || id).split(' ')[0]} ${n}`).join(' · '));
  if (gelir > 0 || maliyet > 0) L.push(`💰 Gelir: ${money(gelir)}  ·  Maliyet: ${money(maliyet)}`);
  L.push(`📊 Şu anki yük: ${aktifToplam} aktif · ${gecmisToplam} geçmiş tarih`);
  L.push(`🔑 Hatırlatma: GitHub PAT yenileme durumunu kontrol et (\`check-pat-expiry.sh\`).`);
  L.push('', `🔗 ${DASHBOARD_URL}`);

  const facts = {
    ay_tamamlanan: ayTamam.length, gelir: gelir || null, maliyet: maliyet || null,
    marka_yogunlugu: Object.fromEntries(topMarka), en_uretken: topLead.map(([id, n]) => `${nameById[id] || id}:${n}`),
    su_anki_yuk: { aktif: aktifToplam, gecmis: gecmisToplam, dept: ds },
  };
  return { text: L.join('\n'), facts };
}

runReport('Aylık strateji', build, SYS).catch(e => { console.error('rapor-aylik hata:', e.message); process.exit(1); });
