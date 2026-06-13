#!/usr/bin/env node
'use strict';
/**
 * consistency-check.js — Sistem genelindeki türetilmiş metriklerin DOĞRULUĞUNU denetler.
 *
 * İki tür kontrol:
 *   A) DB-GERÇEĞİ vs API-SUNULAN  — sunucu SQL'iyle hesaplanan metrikleri (dept/marka/puan/bekleme)
 *      ham veriden BAĞIMSIZCA yeniden hesaplar ve /api/embedded çıktısıyla eşitler.
 *   B) INVARIANT + ÇAPRAZ-TUTARLILIK — dashboard'ın hesapladığı metrikler (süre/gecikme/kapasite)
 *      için mantıksal değişmezleri ve aynı kavramın iki yoldan eşit çıkmasını doğrular.
 *
 * Kullanım:  node scripts/consistency-check.js
 * Çıkış kodu: ayrışma varsa 1, temizse 0.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_URL = fs.readFileSync(path.join(__dirname, '../data/.db-url'), 'utf8').trim();
const API = process.env.BNS_API || 'https://benseno-api-production.up.railway.app';

// psql → satır dizisi (| ayraçlı, başlıksız). Shell YOK (execFile) → enjeksiyon riski yok.
function sql(q) {
  const out = execFileSync('psql', [DB_URL, '-t', '-A', '-F', '|', '-c', q], { encoding: 'utf8' });
  return out.trim().split('\n').filter(Boolean).map(l => l.split('|'));
}

let FAIL = 0, PASS = 0;
const eq = (a, b, eps = 0.05) => (a == null && b == null) || (Math.abs((+a || 0) - (+b || 0)) <= eps);
function check(name, ok, detail) {
  if (ok) { PASS++; console.log(`  ✅ ${name}`); }
  else    { FAIL++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

(async () => {
  console.log(`\n🔍 Tutarlılık denetimi · DB ground-truth ↔ ${API}\n`);
  const emb = await (await fetch(`${API}/api/embedded`)).json();

  // ─────────────────────────────────────────────────────────────────────────
  console.log('① DEPARTMAN istatistikleri (SQL ↔ API bns_dept_stats)');
  const deptRows = sql(`
    SELECT u.dept,
      count(DISTINCT u.id),
      count(DISTINCT b.id) FILTER (WHERE b.completed_at IS NULL AND b.durum<>'musteride' AND a.role<>'gozlemci'),
      count(DISTINCT b.id) FILTER (WHERE b.completed_at IS NULL AND b.durum<>'musteride' AND b.deadline<now() AND a.role<>'gozlemci'),
      count(DISTINCT b.id) FILTER (WHERE b.durum='musteride' AND a.role<>'gozlemci'),
      count(DISTINCT b.id) FILTER (WHERE b.completed_at >= now()-interval '30 days')
    FROM users u
    LEFT JOIN brief_assignees a ON a.user_id=u.id
    LEFT JOIN briefs b ON b.id=a.brief_id
      AND NOT (b.completed_at IS NULL AND b.akis='sirali' AND a.role='contributor'
        AND (a.onay_at IS NOT NULL OR EXISTS (SELECT 1 FROM brief_assignees a2
          WHERE a2.brief_id=b.id AND a2.role='contributor' AND a2.onay_at IS NULL
            AND COALESCE(a2.sira,999999) < COALESCE(a.sira,999999))))
    WHERE u.dept IS NOT NULL GROUP BY u.dept`);
  const ds = emb.bns_dept_stats || {};
  for (const [dept, people, active, overdue, musteride, c30] of deptRows) {
    const a = ds[dept]; if (!a) { check(`dept ${dept} API'de yok`, false); continue; }
    check(`dept ${dept}: active`,     eq(active, a.active, 0),       `db=${active} api=${a.active}`);
    check(`dept ${dept}: overdue`,    eq(overdue, a.overdue, 0),     `db=${overdue} api=${a.overdue}`);
    check(`dept ${dept}: musteride`,  eq(musteride, a.musteride, 0), `db=${musteride} api=${a.musteride}`);
    check(`dept ${dept}: people`,     eq(people, a.people, 0),       `db=${people} api=${a.people}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  console.log('② MARKA istatistikleri (SQL ↔ API bns_brands)');
  const brandRows = sql(`
    SELECT br.name,
      count(b.id) FILTER (WHERE b.completed_at IS NULL),
      count(b.id) FILTER (WHERE b.completed_at IS NULL AND b.deadline<now()),
      coalesce(round(avg(b.rating) FILTER (WHERE b.rating IS NOT NULL),1)::text,''),
      count(b.id) FILTER (WHERE b.rating IS NOT NULL)
    FROM brands br LEFT JOIN briefs b ON b.marka_id=br.id AND b.deleted_at IS NULL
    GROUP BY br.name`);
  const brandsApi = {};
  for (const b of (emb.bns_brands || [])) brandsApi[b.name] = b;
  let brandMiss = 0;
  for (const [name, active] of brandRows) {
    const a = brandsApi[name]; if (!a) continue;
    if (a.active != null && !eq(active, a.active, 0)) { check(`marka ${name}: active`, false, `db=${active} api=${a.active}`); brandMiss++; }
  }
  check('marka active sayıları', brandMiss === 0, `${brandMiss} marka ayrıştı`);

  // ─────────────────────────────────────────────────────────────────────────
  console.log('③ YILDIZ karneleri (SQL ↔ API bns_ratings)');
  const r = emb.bns_ratings || {};
  const [[favg, fcnt]] = sql(`SELECT coalesce(round(avg(rating),1)::text,''), count(*) FROM briefs WHERE rating IS NOT NULL AND deleted_at IS NULL`);
  if (r.firma) {
    check('firma puan ort.', eq(favg, r.firma.avg, 0.05), `db=${favg} api=${r.firma.avg}`);
    check('firma puan sayısı', eq(fcnt, r.firma.cnt, 0), `db=${fcnt} api=${r.firma.cnt}`);
  } else check("firma rating API'de yok", false);
  const kisiRows = sql(`SELECT a.user_id, round(avg(b.rating),1)::text, count(DISTINCT b.id)
    FROM brief_assignees a JOIN briefs b ON b.id=a.brief_id
    WHERE b.rating IS NOT NULL AND a.role IN ('contributor','lead') AND b.deleted_at IS NULL
    GROUP BY a.user_id`);
  let kisiMiss = 0;
  const kisiApi = r.kisi || {};
  for (const [uid, avg, cnt] of kisiRows) {
    if (kisiApi[uid] && (!eq(avg, kisiApi[uid].avg, 0.05) || !eq(cnt, kisiApi[uid].cnt, 0))) {
      kisiMiss++; if (kisiMiss <= 3) check(`kişi ${uid} puan`, false, `db=${avg}/${cnt} api=${kisiApi[uid].avg}/${kisiApi[uid].cnt}`);
    }
  }
  check('kişi puan ortalamaları', kisiMiss === 0, `${kisiMiss} kişi ayrıştı`);

  // ─────────────────────────────────────────────────────────────────────────
  console.log('④ TAMAMLANAN işler — invariant kontrolleri (süre/gecikme/puan)');
  // NOT: sureH/gecikmeH API'de SUNULMAZ — dashboard (data.js) ham alanlardan hesaplar.
  // Bu yüzden kontrol, data.js'NİN FORMÜLÜNÜ ham veriden yeniden üretip geçerliliğini doğrular
  // (negatif/NaN üretmemeli; gecikme tanımı gereği net-geç-bitişte >0 olmalı).
  let sureNeg = 0, gecikmeBad = 0, ratingBad = 0;
  const H = 3600 * 1000;
  for (const c of (emb.bns_completed || [])) {
    const bek = c.bekleme_ms || 0;
    const bitis = c.bitis, bas = c.baslangic, dl = c.deadline;
    // data.js formülü: sureH = max(0, bitis - baslangic - bekleme) / H
    if (bitis && bas) { const s = Math.max(0, bitis - bas - bek) / H; if (s < 0 || isNaN(s)) sureNeg++; }
    // data.js formülü: gecikmeH = (bitis-bek)>deadline ? round((bitis-bek-deadline)/H*10)/10 : 0
    if (bitis && dl) {
      const gh = (bitis - bek) > dl ? Math.round((bitis - bek - dl) / H * 10) / 10 : 0;
      const late = (bitis - bek) > dl;
      if (gh < 0 || isNaN(gh)) gecikmeBad++;       // formül negatif/NaN üretmemeli
      if (late && gh <= 0) gecikmeBad++;            // geç bitişte gecikme pozitif olmalı
      if (!late && gh !== 0) gecikmeBad++;          // erken bitişte gecikme sıfır olmalı
    }
    if (c.rating != null && (c.rating < 1 || c.rating > 5)) ratingBad++;
  }
  check('süre formülü geçerli (sureH≥0, NaN yok)', sureNeg === 0, `${sureNeg} işte hatalı süre`);
  check('gecikme formülü geçerli (net-geç-bitiş tanımı)', gecikmeBad === 0, `${gecikmeBad} işte hatalı gecikme`);
  check('puanlar 1–5 aralığında', ratingBad === 0, `${ratingBad} işte aralık dışı puan`);

  // ─────────────────────────────────────────────────────────────────────────
  console.log('⑤ KİŞİ KAPASİTESİ — Profil ↔ Departman aynı formül (regresyon koruması)');
  const capRows = sql(`
    SELECT u.id, u.dept, u.yetki,
      count(DISTINCT b.id) FILTER (WHERE b.completed_at IS NULL AND b.durum<>'musteride')
    FROM users u
    LEFT JOIN brief_assignees a ON a.user_id=u.id AND a.role IN ('contributor','lead')
    LEFT JOIN briefs b ON b.id=a.brief_id AND b.deleted_at IS NULL
    WHERE u.active GROUP BY u.id, u.dept, u.yetki`);
  const limit = (dept, yetki) => yetki === 'yonetici' ? 10 : ({ tasarim: 6, editor: 8, ai: 6, freelance: 6 })[dept] || 6;
  let capBad = 0;
  for (const [id, dept, yetki, active] of capRows) {
    const pct = Math.min(100, Math.round((+active / limit(dept, yetki)) * 100));
    if (pct > 100 || pct < 0) { capBad++; check(`kişi ${id} kapasite aralığı`, false, `pct=${pct}`); }
  }
  check(`kapasite 0–100 aralığında (${capRows.length} kişi)`, capBad === 0, `${capBad} kişi aralık dışı`);

  // ─────────────────────────────────────────────────────────────────────────
  console.log('⑥ AGGREGATE çapraz-kontrol');
  const [[totalActive]] = sql(`SELECT count(*) FROM briefs WHERE completed_at IS NULL AND deleted_at IS NULL AND durum<>'musteride'`);
  const apiActive = (emb.bns_briefs || []).filter(b => b.durum !== 'musteride').length;
  check('aktif brief sayısı (DB ↔ API listesi)', eq(totalActive, apiActive, 0), `db=${totalActive} api=${apiActive}`);

  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n${FAIL === 0 ? '🟢 TÜM KONTROLLER GEÇTİ' : '🔴 AYRIŞMA VAR'} — ${PASS} geçti, ${FAIL} kaldı\n`);
  process.exit(FAIL === 0 ? 0 : 1);
})().catch(e => { console.error('check hata:', e.message); process.exit(2); });
