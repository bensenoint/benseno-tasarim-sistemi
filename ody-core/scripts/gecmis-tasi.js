'use strict';
// Tek seferlik: benseno DB'sindeki ody_chat_log → ody-core sohbet_log (idempotent).
// Kullanım: KAYNAK_DB=<benseno DATABASE_PUBLIC_URL> DATABASE_URL=<ody-core url> node scripts/gecmis-tasi.js
const { Pool } = require('pg');

(async () => {
  const kaynak = new Pool({ connectionString: process.env.KAYNAK_DB, ssl: { rejectUnauthorized: false } });
  const hedef = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  // İdempotens: hedefte zaten bulunan created_at damgaları atlanır (canlı servis
  // taşıma sırasında yeni kayıt yazmış olabilir — onlar dokunulmaz).
  const mevcut = new Set((await hedef.query(`SELECT created_at FROM sohbet_log`)).rows.map(x => +x.created_at));
  const r0 = await kaynak.query(`SELECT user_id,user_name,role,soru,tools,tool_sayisi,turlar,yanit,kanal,created_at FROM ody_chat_log ORDER BY created_at`);
  const r = { rows: r0.rows.filter(x => !mevcut.has(+x.created_at)) };
  console.log('[tasi] kaynak:', r0.rows.length, '| taşınacak:', r.rows.length);
  // 200'lük partiler halinde çok-satırlı INSERT (tek tek ~8k satır ağ üstünde çok yavaştı)
  const B = 200;
  for (let i = 0; i < r.rows.length; i += B) {
    const parti = r.rows.slice(i, i + B);
    const vals = [], ph = [];
    parti.forEach((x, j) => {
      const o = j * 10;
      ph.push(`($${o+1},$${o+2},$${o+3},$${o+4},$${o+5},$${o+6},$${o+7},$${o+8},$${o+9},$${o+10})`);
      vals.push(x.user_id, x.user_name, x.role, x.soru, JSON.stringify(x.tools || []),
        x.tool_sayisi || 0, x.turlar || 0, x.yanit, x.kanal, x.created_at);
    });
    await hedef.query(
      `INSERT INTO sohbet_log(user_id,user_name,role,soru,tools,tool_sayisi,turlar,yanit,kanal,created_at) VALUES ${ph.join(',')}`, vals);
    console.log('[tasi]', Math.min(i + B, r.rows.length), '/', r.rows.length);
  }
  console.log('[tasi] taşındı:', r.rows.length, 'kayıt');
  await kaynak.end(); await hedef.end();
})().catch(e => { console.error('[tasi] hata:', e.message); process.exit(1); });
