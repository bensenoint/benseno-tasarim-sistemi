'use strict';

/**
 * TEST SEED — mevcut live-data.json'u Postgres'e aktarır (Faz 1 doğrulama; canlıdan önce SİLİNECEK).
 * Kullanıcılar KANONİK 18 listeden gelir (live-data'daki uydurma isimler değil). Idempotent: her
 * çalışmada tablolar temizlenir + yeniden doldurulur.  Kullanım: node server/scripts/seed-from-livedata.js
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

const LIVE = path.join(process.env.HOME, 'benseno-tasarim-sistemi', 'dashboard/app/live-data.json');

// KANONİK 18 (id, ad, rol, dept, yetki, initials, color) — tek doğruluk
const USERS = [
  ['U030C48PL23','Görkem Kaya','yonetici',null,'yonetici','GK','#7C3AED'],
  ['UD96GH76E','Reyhan Nur Pınar','yonetici',null,'yonetici','RP','#7C3AED'],
  ['U4XCE3532','Cansu Kazgan','editor','editor','yonetici','CK','#10B981'],
  ['U055EDESLSE','İpek Akdeniz','tasarim','tasarim','yonetici','İA','#6366F1'],
  ['U02SZQDAFPF','Erdem Akoğlu','editor','editor','yonetici','EA','#10B981'],
  ['U0AN6DD79M0','Aylin Tozkoparan','tasarim','tasarim','uye','AT','#6366F1'],
  ['U06J26R1XCJ','Aykut Arslan','tasarim','tasarim','uye','AA','#6366F1'],
  ['U09BFPBKQG7','Hasan Serdar Arda','tasarim','tasarim','uye','HA','#6366F1'],
  ['U0B3K2WE7SB','Pelin Özdemir','tasarim','tasarim','uye','PÖ','#6366F1'],
  ['U0AK8U7L57F','İrem Özkan','tasarim','tasarim','uye','İÖ','#6366F1'],
  ['U08HLMHTGEL','Serhat Yıldız','tasarim','tasarim','uye','SY','#6366F1'],
  ['U09BZHR25NG','Eda Tireli','editor','editor','uye','ET','#10B981'],
  ['U07PV0RA9L2','Eda Ayral','editor','editor','uye','EY','#10B981'],
  ['U08NQJ27G5S','Melis Can','editor','editor','uye','MC','#10B981'],
  ['U05PP70GQTX','Aylin Canel','editor','editor','uye','AC','#10B981'],
  ['U063T8M5HL4','Buse Gürbüzer','editor','editor','uye','BG','#10B981'],
  ['U0AAC3YK20G','Simge Acar','editor','editor','uye','SA','#10B981'],
  ['U0AP31SAA1W','Eren Mahzunlar','ai','ai','uye','EM','#F59E0B'],
];

const KNOWN = new Set(USERS.map(u => u[0]));

// freeform durum metni → kod
function durumKodu(s, completed) {
  if (completed) return 'tamamlandi';
  const t = (s || '').toLowerCase();
  if (/^✅|tamamland/.test((s || '').trim().toLowerCase())) return 'tamamlandi';
  if (/blok/.test(t)) return 'blokeli';
  if (/revize|👀|incele/.test(t)) return 'incelemede';
  if (/tasarımda|editörde|ai'da|🎨|✍️|🤖|çalış/.test(t)) return 'calisiliyor';
  return 'yeni';
}
const tsMs = (v) => (v == null ? null : (typeof v === 'number' ? new Date(v) : new Date(Date.parse(v))));
const akisOf = (b) => /paralel/i.test((b.is || '') + (b.durum || '')) ? 'paralel' : 'sirali';

async function main() {
  const d = JSON.parse(fs.readFileSync(LIVE, 'utf8'));
  await pool.query('TRUNCATE events, brief_approvals, brief_attachments, brief_tags, brief_assignees, briefs, brands, users RESTART IDENTITY CASCADE');

  // users
  for (const u of USERS) {
    await pool.query(
      `INSERT INTO users(id,name,rol,dept,yetki,initials,color) VALUES ($1,$2,$3,$4,$5,$6,$7)`, u);
  }

  // brands — brief+completed+bns_brands'taki tüm marka adları
  const brandNames = new Set();
  (d.bns_brands || []).forEach(b => b.marka && brandNames.add(b.marka));
  (d.bns_briefs || []).forEach(b => b.marka && brandNames.add(b.marka));
  (d.bns_completed || []).forEach(b => b.marka && brandNames.add(b.marka));
  const brandId = {};
  for (const name of brandNames) {
    const r = await pool.query(`INSERT INTO brands(name) VALUES ($1) RETURNING id`, [name]);
    brandId[name] = r.rows[0].id;
  }

  const addAssignee = async (briefId, uid, role, sira) => {
    if (!uid || !KNOWN.has(uid)) return;
    await pool.query(
      `INSERT INTO brief_assignees(brief_id,user_id,role,sira) VALUES ($1,$2,$3,$4)
       ON CONFLICT (brief_id,user_id,role) DO NOTHING`, [briefId, uid, role, sira]);
  };
  const addEvent = async (briefId, uid, verb, detail) => {
    await pool.query(`INSERT INTO events(brief_id,user_id,verb,detail,source) VALUES ($1,$2,$3,$4,'system')`,
      [briefId, KNOWN.has(uid) ? uid : null, verb, detail ? JSON.stringify(detail) : null]);
  };

  // aktif briefs
  let nB = 0;
  for (const b of (d.bns_briefs || [])) {
    const r = await pool.query(
      `INSERT INTO briefs(no,marka_id,baslik,dept,deadline,durum,priority,priority_label,rev,
         maliyet,satis,fatura,odeme,akis,stale)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [b.no, brandId[b.marka] || null, b.is || b.baslik || '(başlıksız)', b.dept || null,
       tsMs(b.deadline), durumKodu(b.durum, false), b.oncelik || b.priority || null, b.priority_label || null,
       b.rev || 0, b.maliyet ?? null, b.satis ?? null, !!b.fatura, !!b.odeme, akisOf(b), !!b.blokeli]);
    const id = r.rows[0].id;
    const atanan = b.atanan_ids || [];
    const lead = b.lead_id || atanan[0];
    if (lead) await addAssignee(id, lead, 'lead', 0);
    atanan.filter(u => u !== lead).forEach((u, i) => addAssignee(id, u, 'contributor', i + 1));
    (b.editor_ids || []).forEach(u => addAssignee(id, u, 'editor', null));
    await addEvent(id, lead, 'migrated', { kaynak: 'live-data', durum: b.durum });
    nB++;
  }

  // tamamlananlar
  let nC = 0;
  for (const c of (d.bns_completed || [])) {
    const r = await pool.query(
      `INSERT INTO briefs(no,marka_id,baslik,deadline,durum,rev,maliyet,satis,fatura,odeme,
         slack_url,created_at,completed_at)
       VALUES ($1,$2,$3,$4,'tamamlandi',$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [c.no, brandId[c.marka] || null, c.baslik || c.is || '(başlıksız)', tsMs(c.deadline),
       c.revision || 0, c.maliyet ?? null, c.satis ?? null, !!c.fatura, !!c.odeme,
       c.slack_url || null, tsMs(c.baslangic) || tsMs(c.bitis) || tsMs(c.deadline) || new Date(),
       // completed_at: bitis yoksa fallback (deadline/şimdi) — "tamamlandi" durumu tutarlı kalsın (test verisi)
       tsMs(c.bitis) || tsMs(c.deadline) || new Date()]);
    const id = r.rows[0].id;
    if (c.leadId) await addAssignee(id, c.leadId, 'lead', 0);
    (c.contribIds || []).forEach((u, i) => addAssignee(id, u, 'contributor', i + 1));
    await addEvent(id, c.leadId, 'tamamlandi', { rating: c.rating });
    nC++;
  }

  const cnt = async (t) => (await pool.query(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;
  console.log('✓ SEED tamam:');
  console.log('  users      :', await cnt('users'));
  console.log('  brands     :', await cnt('brands'));
  console.log('  briefs     :', await cnt('briefs'), `(aktif ${nB} + tamamlanan ${nC})`);
  console.log('  assignees  :', await cnt('brief_assignees'));
  console.log('  events     :', await cnt('events'));
  await pool.end();
}

main().catch(e => { console.error('✗ seed hata:', e.message); process.exit(1); });
