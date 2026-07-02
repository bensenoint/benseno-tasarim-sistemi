'use strict';

/**
 * rapor-kisisel.js — Hafta içi 07:55: aktif işi olan HER çalışana kişisel iş özeti DM'i.
 * Veri: /api/embedded (DB). Freelancerlar (FR*) Slack'te yok → atlanır.
 * Test gate: BNS_REPORT_LIVE=1 değilse tüm özetler tek mesajda SADECE Görkem'e gider.
 */

const { trDate, deltaLabel, token, post, fetchEmbedded, GORKEM, DASHBOARD_URL, H } = require('./rapor-lib');

function briefLine(b) {
  const dh = b.deadline ? (b.deadline - Date.now()) / H : null;
  const dl = dh == null ? 'termin yok' : deltaLabel(dh);
  const gec = dh != null && dh <= 0 ? ' ⚠️' : '';
  return `• *#${b.no}* ${b.marka} — ${b.baslik} · ${b.durum}${b.priority ? ' ' + b.priority : ''} · ${dl}${gec}`;
}

async function main() {
  const tok = token();
  if (!tok) { console.error('SLACK token yok — çıkılıyor'); process.exit(1); }
  const d = await fetchEmbedded();
  const briefs = d.bns_briefs || [];
  const users = (d.bns_users || []).filter(u => /^U/.test(u.id)); // FR* freelancer → DM yok

  const live = process.env.BNS_REPORT_LIVE === '1';
  console.log(`Kişisel özet ${live ? 'CANLI' : 'TEST (Görkem)'} — ${briefs.length} aktif brief, ${users.length} kullanıcı`);

  let sent = 0; const preview = [];
  for (const u of users) {
    const mine = briefs.filter(b =>
      b.durum !== 'musteride' && b.durum !== 'tamamlandi' &&   // calc.js aktif tanımıyla aynı (müşteride hariç)
      ((b.workers || []).some(w => w && w.id === u.id) ||
       (b.leads || []).some(l => l && l.id === u.id)));
    if (!mine.length) continue; // aktif işi olmayana DM yok
    mine.sort((a, b) => (a.deadline || Infinity) - (b.deadline || Infinity));
    const gec = mine.filter(b => b.deadline && b.deadline < Date.now()).length;
    const text = [
      `🌅 Günaydın ${u.name.split(' ')[0]}! İş özetin — ${trDate()}`,
      `Aktif: *${mine.length}*${gec ? ` · Geciken: *${gec}* ⚠️` : ''}`,
      '',
      ...mine.map(briefLine),
      '',
      `<${DASHBOARD_URL}|Dashboard'da gör>`,
    ].join('\n');
    if (live) { if (await post(tok, u.id, text)) sent++; }
    else preview.push(`―― ${u.name} ――\n${text}`);
  }
  if (!live && preview.length) await post(tok, GORKEM, `🧪 *Kişisel özet önizleme (${preview.length} kişi)*\n\n${preview.join('\n\n')}`.slice(0, 38000));
  console.log(`bitti — ${live ? sent + ' kişiye DM' : 'önizleme Görkem\'e'}`);
}

main().catch(e => { console.error('rapor-kisisel hata:', e.message); process.exit(1); });
