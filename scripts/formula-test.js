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

// ── Rol ağırlıklı iş yükü (işçi 5 / lead 2 / gözlemci 1) ──
const _wA = { id: 'A' }, _wB = { id: 'B' }, _wC = { id: 'C' };
t('yük: işçi=5', C.bnsBriefLoadWeight({ workers: [_wA] }, 'A'), 5);
t('yük: lead=2', C.bnsBriefLoadWeight({ leads: [_wB] }, 'B'), 2);
t('yük: gözlemci=1', C.bnsBriefLoadWeight({ observers: [_wC] }, 'C'), 1);
t('yük: rol yoksa 0', C.bnsBriefLoadWeight({ workers: [_wA] }, 'Z'), 0);
t('yük: en yüksek rol (işçi>lead)', C.bnsBriefLoadWeight({ workers: [_wA], leads: [_wA] }, 'A'), 5);
const _briefs = [
  { durum: 'devam', workers: [_wA], leads: [_wB] },
  { durum: 'devam', workers: [_wB], observers: [_wA] },
  { durum: 'tamamlandi', workers: [_wA] },   // sayılmaz
  { durum: 'musteride', workers: [_wA] },     // sayılmaz
];
t('personLoad A = 5+1 = 6', C.bnsPersonLoad(_briefs, 'A'), 6);
t('personLoad B = 2+5 = 7', C.bnsPersonLoad(_briefs, 'B'), 7);
// kapasite %: işçi-eşdeğeri = yük/5. A: 6/5=1.2 iş-eşdeğeri, ai limiti 6 → %20
t('capPct A (rol ağırlıklı)', C.bnsPersonCapPct({ dept: 'ai' }, C.bnsPersonLoad(_briefs, 'A') / 5), 20);
// dept yükü: tasarım üyeleri — A,B tasarımcı say → dept yük; capacity 6 → (yük/5)/6
const _dBriefs = [{ durum: 'devam', workers: [{ id: 'A', dept: 'tasarim' }], leads: [{ id: 'B', dept: 'tasarim' }] }];
t('deptLoad tasarim = 5+2 = 7', C.bnsDeptLoad(_dBriefs, 'tasarim'), 7);
t('deptCapPct tasarim (7/5)/6≈%23', C.bnsDeptCapPct(_dBriefs, { capacity: 6 }, 'tasarim'), 23);

// ── Tarihe duyarlı "o gün açık olan işler" (geri-hesaplama) ──
const _asofBriefs = [
  { no: 1, created_at: 100, durum: 'devam' },   // 100'de açıldı, halen aktif
  { no: 2, created_at: 300, durum: 'devam' },   // 300'de açıldı (sonradan)
];
const _asofDone = [
  { no: 3, baslangic: 50, bitis: 200, durum: 'tamamlandi' },  // 50-200 arası açıktı
];
// cutoff=150: #1 açık (100≤150), #2 yok (300>150), #3 açık (50≤150 & 200>150)
t('asOf 150: 2 açık iş', C.bnsBriefsAsOf(_asofBriefs, _asofDone, 150).length, 2);
t('asOf 150: tamamlanan nötrlenir', C.bnsBriefsAsOf(_asofBriefs, _asofDone, 150).find(b => b.no === 3).durum, 'devam');
// cutoff=250: #1 açık, #2 yok(300>250), #3 yok (200<250 bitti)
t('asOf 250: 1 açık iş', C.bnsBriefsAsOf(_asofBriefs, _asofDone, 250).length, 1);
// cutoff=null → güncel briefler (tamamlananlar eklenmez)
t('asOf null: güncel küme', C.bnsBriefsAsOf(_asofBriefs, _asofDone, null).length, 2);

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

// ── Çıktı hızı — son N hafta tamamlanan / hafta ──
const NOW_T = 1000 * H * 24 * 7 * 10; // sabit "şimdi" (10 hafta)
const wk = (n) => NOW_T - n * 7 * 24 * H; // n hafta önce
t('çıktı: 8 iş / 4 hafta = 2/hafta', C.bnsThroughput([wk(0), wk(0), wk(1), wk(1), wk(2), wk(2), wk(3), wk(3)], NOW_T, 4).perWeek, 2);
t('çıktı: pencere dışı sayılmaz', C.bnsThroughput([wk(0), wk(8), wk(9)], NOW_T, 4).count, 1);
t('çıktı: <3 düşük örneklem', C.bnsThroughput([wk(0), wk(1)], NOW_T, 4).lowSample, true);
t('çıktı: ≥3 örneklem yeterli', C.bnsThroughput([wk(0), wk(1), wk(2)], NOW_T, 4).lowSample, false);
t('çıktı: boş liste = 0', C.bnsThroughput([], NOW_T, 4).count, 0);

// ── Döngü-bazlı süre (bnsCycleSure) ──
const hh = (n) => n * H; // n saat → ms
t('döngü: planlama hariç (basladi+incelemede=3sa)',
  C.bnsCycleSure([{ts:hh(0),durum:'yeni'},{ts:hh(1),durum:'calisiliyor'},{ts:hh(2),durum:'basladi'},{ts:hh(4),durum:'incelemede'},{ts:hh(5),durum:'tamamlandi'}], hh(99)).toplamH, 3);
t('döngü: başladı atlanmış → ilk değişim başlangıç (4sa)',
  C.bnsCycleSure([{ts:hh(0),durum:'yeni'},{ts:hh(1),durum:'calisiliyor'},{ts:hh(3),durum:'incelemede'},{ts:hh(5),durum:'tamamlandi'}], hh(99)).toplamH, 4);
t('döngü: ölü statüler düşülür (basladi+revizyon=2sa)',
  C.bnsCycleSure([{ts:hh(0),durum:'basladi'},{ts:hh(1),durum:'beklemede'},{ts:hh(3),durum:'musteride'},{ts:hh(5),durum:'revizyon'},{ts:hh(6),durum:'tamamlandi'}], hh(99)).toplamH, 2);
const reopen = C.bnsCycleSure([
  {ts:hh(0),durum:'basladi'},{ts:hh(2),durum:'tamamlandi'},
  {ts:hh(10),durum:'basladi'},{ts:hh(13),durum:'tamamlandi'}
], hh(99));
t('döngü: reopen → 2 döngü', reopen.cycles.length, 2);
t('döngü: reopen döngü1=2sa', reopen.cycles[0].sureH, 2);
t('döngü: reopen döngü2=3sa', reopen.cycles[1].sureH, 3);
t('döngü: reopen toplam=5sa', reopen.toplamH, 5);
t('döngü: reopen son=3sa', reopen.sonH, 3);
t('döngü: açık iş now()a kadar (basladi 3sa önce)',
  C.bnsCycleSure([{ts:hh(0),durum:'basladi'}], hh(3)).sonH, 3);
t('döngü: event yoksa fallback',
  C.bnsCycleSure([], hh(99), { baslangic: hh(1), bitis: hh(5), beklemeMs: 0 }).toplamH, 4);

console.log(`\n${FAIL === 0 ? '🟢 FORMÜLLER KİLİTLİ' : '🔴 FORMÜL AYRIŞMASI'} — ${PASS} geçti, ${FAIL} kaldı\n`);
process.exit(FAIL === 0 ? 0 : 1);
