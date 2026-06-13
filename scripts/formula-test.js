#!/usr/bin/env node
'use strict';
/**
 * formula-test.js — calc.js saf formüllerini bilinen girdi/çıktılarla KİLİTLER.
 * Secret/DB/API GEREKTİRMEZ → CI'da çalışır. Formül sabitleri (kapasite limitleri,
 * bekleme muafiyeti) bilerek değiştirilmedikçe bu testler kalmamalı.
 *   node scripts/formula-test.js   (ayrışma → exit 1)
 */
const C = require('../dashboard/app/calc.js');
const H = C.BNS_H;
let FAIL = 0, PASS = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { PASS++; console.log(`  ✅ ${name}`); }
  else { FAIL++; console.log(`  ❌ ${name} — beklenen ${JSON.stringify(want)}, gelen ${JSON.stringify(got)}`); }
}

console.log('\n🧪 calc.js formül kilidi\n');

// ── Kişi kapasite limiti (rol/departman → eşzamanlı slot) ──
t('limit: yönetici=10', C.bnsPersonCapLimit({ yetki: 'yonetici', dept: 'ai' }), 10);
t('limit: editor=8',    C.bnsPersonCapLimit({ dept: 'editor' }), 8);
t('limit: tasarim=6',   C.bnsPersonCapLimit({ dept: 'tasarim' }), 6);
t('limit: ai=6',        C.bnsPersonCapLimit({ dept: 'ai' }), 6);
t('limit: freelance=6', C.bnsPersonCapLimit({ dept: 'freelance' }), 6);
t('limit: bilinmeyen=6',C.bnsPersonCapLimit({ dept: 'xyz' }), 6);
t('limit: null=6',      C.bnsPersonCapLimit(null), 6);

// ── Kişi kapasite yüzdesi — Görkem örneği (5 iş / yönetici limiti 10 = %50) ──
t('Görkem 5 iş = %50', C.bnsPersonCapPct({ yetki: 'yonetici' }, 5), 50);
t('editor 4 iş = %50', C.bnsPersonCapPct({ dept: 'editor' }, 4), 50);
t('100 üstü kırpılır', C.bnsPersonCapPct({ dept: 'ai' }, 20), 100); // 20/6 → %333 → %100
t('0 iş = %0',         C.bnsPersonCapPct({ dept: 'ai' }, 0), 0);

// ── Departman kapasite yüzdesi (active/capacity) ──
t('dept %36 (15/42)', C.bnsCapPct({ active: 15, capacity: 42 }), 36);
t('dept capacity_pct öncelikli', C.bnsCapPct({ active: 99, capacity: 1, capacity_pct: 71 }), 71);
t('dept capacity yoksa 0', C.bnsCapPct({ active: 5 }), 0);

// ── Net süre — bekleme DÜŞÜLÜR, negatif olmaz ──
// gerçekçi zaman damgaları (0/epoch falsy → guard "eksik" sayar; gerçek veri ~1.7e12 ms)
const T0 = 100 * H;
t('süre: 10sa iş, bekleme yok', C.bnsSureH(T0 + 10 * H, T0, 0), 10);
t('süre: 10sa - 4sa bekleme = 6sa', C.bnsSureH(T0 + 10 * H, T0, 4 * H), 6);
t('süre: bekleme süreyi aşarsa 0', C.bnsSureH(T0 + 2 * H, T0, 5 * H), 0);
t('süre: eksik veri = null', C.bnsSureH(null, T0, 0), null);

// ── Gecikme — yalnız NET bitiş deadline'ı aşınca >0 ──
t('gecikme: net bitiş deadline öncesi = 0', C.bnsGecikmeH(T0 + 10 * H, 0, T0 + 12 * H), 0);
t('gecikme: 2sa geç = 2', C.bnsGecikmeH(T0 + 12 * H, 0, T0 + 10 * H), 2);
t('gecikme: bekleme muafiyeti gecikmeyi sıfırlar', C.bnsGecikmeH(T0 + 12 * H, 3 * H, T0 + 10 * H), 0); // net 9sa < 10
t('gecikme: eksik veri = 0', C.bnsGecikmeH(null, 0, T0 + 10 * H), 0);

// ── Termin riski — aktif iş + teslime ≤24sa ──
t('risk: yarın teslim, çalışılıyor = true', C.bnsIsRisk('calisiliyor', 12), true);
t('risk: 3 gün var = false', C.bnsIsRisk('yeni', 72), false);
t('risk: termin geçmiş + aktif = true', C.bnsIsRisk('yeni', -5), true);
t('risk: incelemede = false (esasen bitti)', C.bnsIsRisk('incelemede', 2), false);
t('risk: musteride = false', C.bnsIsRisk('musteride', 1), false);
t('risk: tamamlandi = false', C.bnsIsRisk('tamamlandi', -10), false);
t('risk: deltaH yok = false', C.bnsIsRisk('yeni', null), false);
t('risk: sınırda 24 = true', C.bnsIsRisk('calisiliyor', 24), true);

console.log(`\n${FAIL === 0 ? '🟢 FORMÜLLER KİLİTLİ' : '🔴 FORMÜL AYRIŞMASI'} — ${PASS} geçti, ${FAIL} kaldı\n`);
process.exit(FAIL === 0 ? 0 : 1);
