'use strict';
/**
 * haftalik-karne.js — Pazartesi karneleri: kişi/marka/departman/benseno için
 * ÇİFT değerlendirme üretir ve haftalik_karne tablosuna İDEMPOTENT yazar.
 *   · yildiz_hafta / yildiz_genel: DB'den hesaplanır (LLM asla sayı üretmez)
 *   · ozet_hafta: yalnız o hafta biten işlerin insight/puan-sebep metinlerinden (Opus)
 *   · ozet_genel: önceki haftanın genel özeti + bu haftanın gelişmeleri harmanlanarak
 *     GÜNCELLENİR (evrilir; sıfırdan yazılmaz). İşsiz haftada LLM çağrılmaz:
 *     haftalık "iş yok", genel özet öncekinden aynen taşınır (maliyet korunur).
 * Kullanım:
 *   node scripts/haftalik-karne.js                 # son tamamlanan hafta (geçen pzt→bu pzt)
 *   node scripts/haftalik-karne.js --backfill 8    # son 8 haftayı kronolojik üret
 *   node scripts/haftalik-karne.js --dry
 */
const { pool } = require('../server/db');

const DRY = process.argv.includes('--dry');
const BF = (() => { const i = process.argv.indexOf('--backfill'); return i > -1 ? Math.min(30, +process.argv[i + 1] || 0) : 0; })();
const OPUS = process.env.ODY_OPUS_MODEL || 'claude-opus-4-7';
const HAFTA_MS = 7 * 86400e3;

// TR gününe göre pencerenin PAZARTESİsi (00:00 TR)
function pazartesi(ts) {
  const d = new Date(ts + 3 * 3600e3);   // UTC→TR kaydır
  const gun = (d.getUTCDay() + 6) % 7;   // pzt=0
  const p = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - gun) - 3 * 3600e3;
  return p;
}
const ymd = (ts) => new Date(ts + 3 * 3600e3).toISOString().slice(0, 10);

async function llm(prompt, maxTok) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: OPUS, max_tokens: maxTok || 350,
      system: 'Benseno tasarım ajansının karne yazarısın. Türkçe, somut, veriye dayalı ve öz yaz; puan/sayı üretme (sayılar sana verilir), yalnız nitel değerlendirme yap. Selam/giriş yok, doğrudan değerlendirme.',
      messages: [{ role: 'user', content: prompt }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || ('HTTP ' + r.status));
  return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
}

// Haftada biten puanlı işler → varlık kırılımları
async function haftaVerisi(fromTs, toTs) {
  const r = await pool.query(`
    SELECT b.id, b.no, b.baslik, b.rating, b.rating_sebep, b.insight, br.name AS marka,
           b.completed_at,
           COALESCE((SELECT json_agg(json_build_object('id', a.user_id, 'dept', u.dept, 'ad', u.name))
                     FROM brief_assignees a JOIN users u ON u.id = a.user_id
                     WHERE a.brief_id = b.id AND a.role = 'contributor'), '[]') AS kisiler
    FROM briefs b LEFT JOIN brands br ON br.id = b.marka_id
    WHERE b.completed_at >= to_timestamp($1/1000.0) AND b.completed_at < to_timestamp($2/1000.0)
      AND b.deleted_at IS NULL`, [fromTs, toTs]);
  return r.rows;
}

// Genel (bugüne kadar, hafta sonu itibarıyla) yıldız ortalamaları
async function genelYildiz(toTs) {
  const [g, marka, dept, kisi] = await Promise.all([
    pool.query(`SELECT round(avg(rating)::numeric,1)::float avg, count(*)::int cnt FROM briefs
                WHERE rating IS NOT NULL AND completed_at < to_timestamp($1/1000.0) AND deleted_at IS NULL`, [toTs]),
    pool.query(`SELECT br.name k, round(avg(b.rating)::numeric,1)::float avg, count(*)::int cnt
                FROM briefs b JOIN brands br ON br.id=b.marka_id
                WHERE b.rating IS NOT NULL AND b.completed_at < to_timestamp($1/1000.0) AND b.deleted_at IS NULL GROUP BY 1`, [toTs]),
    pool.query(`SELECT u.dept k, round(avg(b.rating)::numeric,1)::float avg, count(DISTINCT b.id)::int cnt
                FROM briefs b JOIN brief_assignees a ON a.brief_id=b.id AND a.role='contributor'
                JOIN users u ON u.id=a.user_id
                WHERE b.rating IS NOT NULL AND b.completed_at < to_timestamp($1/1000.0) AND b.deleted_at IS NULL
                  AND u.dept IS NOT NULL AND u.dept <> 'freelance' GROUP BY 1`, [toTs]),
    pool.query(`SELECT a.user_id k, round(avg(b.rating)::numeric,1)::float avg, count(DISTINCT b.id)::int cnt
                FROM briefs b JOIN brief_assignees a ON a.brief_id=b.id AND a.role='contributor'
                WHERE b.rating IS NOT NULL AND b.completed_at < to_timestamp($1/1000.0) AND b.deleted_at IS NULL GROUP BY 1`, [toTs]),
  ]);
  const map = (rows) => Object.fromEntries(rows.map(x => [x.k, { avg: x.avg, cnt: x.cnt }]));
  return { benseno: { avg: g.rows[0].avg, cnt: g.rows[0].cnt }, marka: map(marka.rows), dept: map(dept.rows), kisi: map(kisi.rows) };
}

function isSatiri(b) {
  const p = [`#${b.no} "${String(b.baslik || '').slice(0, 60)}" (${b.marka || '—'})`, b.rating != null ? `puan ${b.rating}/5` : 'puansız'];
  if (b.rating_sebep) p.push('sebep: ' + String(b.rating_sebep).slice(0, 180));
  else if (b.insight) p.push('insight: ' + String(b.insight).slice(0, 180));
  return '• ' + p.join(' · ');
}

async function varlikKarne({ haftaTs, tip, kimlik, ad, isler, yGenel, oncekiGenel }) {
  const puanli = isler.filter(b => b.rating != null);
  const yHafta = puanli.length ? Math.round(puanli.reduce((s, b) => s + Number(b.rating), 0) / puanli.length * 10) / 10 : null;
  let ozetHafta = null, ozetGenel = oncekiGenel && oncekiGenel.ozet_genel;
  if (isler.length) {
    const satirlar = isler.slice(0, 25).map(isSatiri).join('\n');
    ozetHafta = await llm(
      `${ad} için ${ymd(haftaTs)} haftasının karne özetini yaz (3-5 cümle). Bu hafta biten işler:\n${satirlar}\n` +
      `Haftalık yıldız ortalaması: ${yHafta != null ? yHafta + '/5' : 'puanlı iş yok'}. Güçlü ve zayıf yönleri somut işlere bağlayarak değerlendir.`);
    ozetGenel = await llm(
      `${ad} için GENEL (bugüne kadar) karne özetini GÜNCELLE (4-6 cümle).\n` +
      `Önceki genel değerlendirme:\n${(oncekiGenel && oncekiGenel.ozet_genel) || '(ilk değerlendirme — yok)'}\n\n` +
      `Bu haftanın gelişmeleri:\n${ozetHafta}\n\n` +
      `Genel yıldız (tüm zaman): ${yGenel ? yGenel.avg + '/5 (' + yGenel.cnt + ' iş)' : 'veri yok'}. ` +
      `Önceki değerlendirmenin doğrulanan yanlarını koru, bu haftayla değişen eğilimleri güncelle; tarih listesi değil bütüncül değerlendirme yaz.`, 450);
  } else {
    ozetHafta = 'Bu hafta tamamlanan iş yok.';
    // genel özet öncekinden aynen taşınır (LLM çağrısı yok)
  }
  return { hafta: ymd(haftaTs), tip, kimlik, ad,
    yildiz_hafta: yHafta, ozet_hafta: ozetHafta, is_sayisi_hafta: isler.length,
    yildiz_genel: yGenel ? yGenel.avg : (oncekiGenel ? oncekiGenel.yildiz_genel : null),
    ozet_genel: ozetGenel || null,
    is_sayisi_genel: yGenel ? yGenel.cnt : (oncekiGenel ? oncekiGenel.is_sayisi_genel : 0) };
}

async function kaydet(k) {
  if (DRY) { console.log('[dry]', k.hafta, k.tip, k.kimlik, '⭐hafta', k.yildiz_hafta, '⭐genel', k.yildiz_genel, `(${k.is_sayisi_hafta} iş)`); return; }
  await pool.query(`
    INSERT INTO haftalik_karne (hafta, tip, kimlik, ad, yildiz_hafta, ozet_hafta, is_sayisi_hafta, yildiz_genel, ozet_genel, is_sayisi_genel)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (hafta, tip, kimlik) DO UPDATE SET
      ad=$4, yildiz_hafta=$5, ozet_hafta=$6, is_sayisi_hafta=$7, yildiz_genel=$8, ozet_genel=$9, is_sayisi_genel=$10`,
    [k.hafta, k.tip, k.kimlik, k.ad, k.yildiz_hafta, k.ozet_hafta, k.is_sayisi_hafta, k.yildiz_genel, k.ozet_genel, k.is_sayisi_genel]);
}

async function oncekiler(haftaTs) {
  const r = await pool.query(`SELECT DISTINCT ON (tip, kimlik) tip, kimlik, yildiz_genel, ozet_genel, is_sayisi_genel
    FROM haftalik_karne WHERE hafta < $1 ORDER BY tip, kimlik, hafta DESC`, [ymd(haftaTs)]);
  const m = {};
  r.rows.forEach(x => { m[x.tip + '|' + x.kimlik] = x; });
  return m;
}

async function haftayiUret(haftaTs) {
  const toTs = haftaTs + HAFTA_MS;
  const isler = await haftaVerisi(haftaTs, toTs);
  const yG = await genelYildiz(toTs);
  const prev = await oncekiler(haftaTs);
  const users = (await pool.query(`SELECT id, name, dept FROM users WHERE active IS NOT FALSE AND dept <> 'freelance'`)).rows;
  const gorevler = [];
  // benseno
  gorevler.push({ tip: 'benseno', kimlik: 'benseno', ad: 'Benseno', isler, yGenel: yG.benseno });
  // markalar (bu hafta işi olan + geçmiş karnesi olanlar)
  const markalar = new Set([...isler.map(b => b.marka).filter(Boolean),
    ...Object.keys(prev).filter(k => k.startsWith('marka|')).map(k => k.slice(6))]);
  for (const m of markalar) gorevler.push({ tip: 'marka', kimlik: m, ad: m,
    isler: isler.filter(b => b.marka === m), yGenel: yG.marka[m] });
  // departmanlar
  const depts = new Set([...users.map(u => u.dept).filter(Boolean), ...Object.keys(yG.dept)]);
  for (const d of depts) gorevler.push({ tip: 'dept', kimlik: d, ad: d,
    isler: isler.filter(b => (b.kisiler || []).some(k => k.dept === d)), yGenel: yG.dept[d] });
  // kişiler (aktif, freelance hariç)
  for (const u of users) gorevler.push({ tip: 'kisi', kimlik: u.id, ad: u.name,
    isler: isler.filter(b => (b.kisiler || []).some(k => k.id === u.id)), yGenel: yG.kisi[u.id] });

  let llmli = 0;
  for (const g of gorevler) {
    const k = await varlikKarne({ haftaTs, ...g, oncekiGenel: prev[g.tip + '|' + g.kimlik] });
    if (g.isler.length) llmli++;
    await kaydet(k);
  }
  console.log(`[karne] ${ymd(haftaTs)} haftası: ${gorevler.length} varlık (${llmli} LLM'li, ${isler.length} iş)`);
}

(async () => {
  if (!process.env.ANTHROPIC_API_KEY) { console.error('[karne] ANTHROPIC_API_KEY yok'); process.exit(1); }
  // "Son tamamlanan hafta" = bu haftanın pazartesisinden bir önceki pazartesi
  const buPzt = pazartesi(Date.now());
  const haftalar = [];
  const n = BF > 0 ? BF : 1;
  for (let i = n; i >= 1; i--) haftalar.push(buPzt - i * HAFTA_MS);
  for (const h of haftalar) await haftayiUret(h);
  await pool.end().catch(() => {});
  console.log('[karne] bitti');
})().catch(e => { console.error('[karne] hata:', e.message); process.exit(1); });
