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

// ── Rol ağırlıklı iş yükü (işçi 5 / lead 1 / gözlemci 0) ──
const _wA = { id: 'A' }, _wB = { id: 'B' }, _wC = { id: 'C' };
t('yük: işçi=5', C.bnsBriefLoadWeight({ workers: [_wA] }, 'A'), 5);
t('yük: lead=1', C.bnsBriefLoadWeight({ leads: [_wB] }, 'B'), 1);
t('yük: gözlemci=0 (kapasiteye katılmaz)', C.bnsBriefLoadWeight({ observers: [_wC] }, 'C'), 0);
t('yük: rol yoksa 0', C.bnsBriefLoadWeight({ workers: [_wA] }, 'Z'), 0);
t('yük: en yüksek rol (işçi>lead)', C.bnsBriefLoadWeight({ workers: [_wA], leads: [_wA] }, 'A'), 5);
const _briefs = [
  { durum: 'devam', workers: [_wA], leads: [_wB] },
  { durum: 'devam', workers: [_wB], observers: [_wA] },
  { durum: 'tamamlandi', workers: [_wA] },   // sayılmaz
  { durum: 'musteride', workers: [_wA] },     // sayılmaz
];
t('personLoad A = 5+0(gözlemci) = 5', C.bnsPersonLoad(_briefs, 'A'), 5);
t('personLoad B = 1+5 = 6', C.bnsPersonLoad(_briefs, 'B'), 6);
// kapasite %: işçi-eşdeğeri = yük/5. A: 5/5=1 iş-eşdeğeri, ai limiti 6 → %17
t('capPct A (rol ağırlıklı, gözlemci hariç)', C.bnsPersonCapPct({ dept: 'ai' }, C.bnsPersonLoad(_briefs, 'A') / 5), 17);
// dept yükü: tasarım üyeleri — A,B tasarımcı say → dept yük; capacity 6 → (yük/5)/6
const _dBriefs = [{ durum: 'devam', workers: [{ id: 'A', dept: 'tasarim' }], leads: [{ id: 'B', dept: 'tasarim' }] }];
t('deptLoad tasarim = 5+1 = 6', C.bnsDeptLoad(_dBriefs, 'tasarim'), 6);
t('deptCapPct tasarim (6/5)/6=%20', C.bnsDeptCapPct(_dBriefs, { capacity: 6 }, 'tasarim'), 20);

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

// ── P3.3a firma sinyalleri ──
// Kapasite: eşik %85
t('kapasite %85 tam → sinyal yok', C.bnsSinyalKapasite(85).length, 0);
t('kapasite %86 → 1 sinyal',       C.bnsSinyalKapasite(86).length, 1);
t('kapasite sinyal tipi',          C.bnsSinyalKapasite(90)[0].tip, 'firma_kapasite');

// Geciken: eşik 5 (deadline < now, durum aktif)
const NOW = new Date('2026-07-07T12:00:00+03:00').getTime();
const gec = (n) => ({ no: n, marka: 'M' + n, deadline: NOW - 3600000, durum: 'devam' });
t('geciken 5 → sinyal yok', C.bnsSinyalGeciken([gec(1),gec(2),gec(3),gec(4),gec(5)], NOW).length, 0);
t('geciken 6 → 1 sinyal',   C.bnsSinyalGeciken([gec(1),gec(2),gec(3),gec(4),gec(5),gec(6)], NOW).length, 1);
t('geciken: tamamlandi hariç', C.bnsSinyalGeciken(
   [gec(1),gec(2),gec(3),gec(4),gec(5),{ no:6, marka:'X', deadline: NOW-3600000, durum:'tamamlandi' }], NOW).length, 0);
t('geciken: gelecek deadline hariç', C.bnsSinyalGeciken(
   [gec(1),gec(2),gec(3),gec(4),gec(5),{ no:6, marka:'X', deadline: NOW+3600000, durum:'devam' }], NOW).length, 0);

// Marka-risk: risk_seviye='yuksek' VEYA thread_ton gergin/acil
t('marka risk_seviye yuksek → sinyal', C.bnsSinyalMarkaRisk(
   [{ marka:'Acme', thread_ton:null }], { Acme:'yuksek' }).length, 1);
t('marka risk_seviye orta → yok', C.bnsSinyalMarkaRisk(
   [{ marka:'Acme', thread_ton:null }], { Acme:'orta' }).length, 0);
t('marka thread_ton gergin → sinyal', C.bnsSinyalMarkaRisk(
   [{ marka:'Beta', thread_ton:'gergin' }], {}).length, 1);
t('marka: aynı marka tek sinyal', C.bnsSinyalMarkaRisk(
   [{ marka:'Beta', thread_ton:'gergin' }, { marka:'Beta', thread_ton:'acil' }], {}).length, 1);
t('marka key = marka adı', C.bnsSinyalMarkaRisk([{ marka:'Beta', thread_ton:'acil' }], {})[0].key, 'Beta');

// Kişi kalite: son5 ort, önceki5 ort; ≥1.0 düşüş VE son<4.0, en az 10 iş
const kisi = (ad, ratings) => ({ id:'U'+ad, ad, ratings });
t('kişi ≥1.0 düşüş & son<4 → sinyal', C.bnsSinyalKisiKalite(
   [kisi('A', [5,5,5,5,5, 3,3,3,4,4])]).length, 1);
t('kişi <1.0 düşüş → yok', C.bnsSinyalKisiKalite(
   [kisi('B', [4,4,4,4,4, 4,4,4,3,4])]).length, 0);
t('kişi son≥4.0 → yok', C.bnsSinyalKisiKalite(
   [kisi('C', [5,5,5,5,5, 4,4,4,5,5])]).length, 0);
t('kişi <10 iş → yok', C.bnsSinyalKisiKalite(
   [kisi('D', [5,5,5,5, 2,2,2,2])]).length, 0);

// ── P3.3b tahmin katmanı ──
const H2 = C.BNS_H;
const comp = (marka, sureH) => ({ marka, sureH });
t('baseline <3 örnek → null', C.bnsBaselineCycle([comp('A',10),comp('A',20)], 'A'), null);
t('baseline 3 örnek medyan', C.bnsBaselineCycle([comp('A',10),comp('A',20),comp('A',30)], 'A'), 20);
t('baseline farklı marka sayılmaz', C.bnsBaselineCycle([comp('A',10),comp('A',20),comp('A',30),comp('B',99)], 'A'), 20);

const NOWG = new Date('2026-07-07T12:00:00+03:00').getTime();
const dlIn = (h) => NOWG + h*H2;
t('gecikme projMiss → risk', C.bnsGecikmeOngoru({ deadline: dlIn(20), durum:'calisiliyor', rev_ic:0, rev_musteri:0, elapsedH:10 }, 40, NOWG).risk, true);
t('gecikme projMiss sebep', C.bnsGecikmeOngoru({ deadline: dlIn(20), durum:'calisiliyor', rev_ic:0, rev_musteri:0, elapsedH:10 }, 40, NOWG).sebep, 'projeksiyon');
t('gecikme bol zaman → risk yok', C.bnsGecikmeOngoru({ deadline: dlIn(100), durum:'calisiliyor', rev_ic:0, rev_musteri:0, elapsedH:10 }, 40, NOWG).risk, false);
t('gecikme davranışsal → risk', C.bnsGecikmeOngoru({ deadline: dlIn(24), durum:'revizyon', rev_ic:1, rev_musteri:1, elapsedH:5 }, null, NOWG).sebep, 'davranissal');
t('gecikme incelemede → risk yok', C.bnsGecikmeOngoru({ deadline: dlIn(1), durum:'incelemede', rev_ic:3, rev_musteri:0, elapsedH:99 }, 40, NOWG).risk, false);


const cb = (o) => Object.assign({ sureH:10, deadline: 1000, bitis: 900, rev_ic:0, rev_musteri:0, rating:5, marka:'A' }, o);
const perf = C.bnsKisiPerformans([
  cb({ sureH:10, bitis:900, deadline:1000, rev_ic:1, rev_musteri:0, rating:5, marka:'A' }),
  cb({ sureH:20, bitis:1200, deadline:1000, rev_ic:1, rev_musteri:2, rating:3, marka:'B' }),
], NOWG);
t('perf tamamlanan', perf.tamamlanan, 2);
t('perf ortDonguH', perf.ortDonguH, 15);
t('perf zamanindaPct (1/2)', perf.zamanindaPct, 50);
t('perf ortRevize', perf.ortRevize, 2);
t('perf ortPuan', perf.ortPuan, 4);
t('perf tipDagilim', JSON.stringify(perf.tipDagilim), JSON.stringify({ A:1, B:1 }));
t('perf boş girdi', C.bnsKisiPerformans([], NOWG).tamamlanan, 0);

t('sinyal gecikme sayısı+key', (() => { const s = C.bnsSinyalGecikme([{ marka:'Z', no:5 }]); return s.length===1 && s[0].key==='Z' && s[0].tip==='gecikme_ongoru'; })(), true);
t('sinyal gecikme aynı marka toplulaşır', (() => { const s = C.bnsSinyalGecikme([{marka:'Z',no:5},{marka:'Z',no:9},{marka:'Y',no:1}]); return s.length===2 && s.find(x=>x.key==='Z').text.includes('2 iş'); })(), true);
t('sinyal burnout sayısı+key', (() => { const s = C.bnsSinyalBurnout([{ ad:'Eda', pct:140 }]); return s.length===1 && s[0].key==='Eda' && s[0].tip==='burnout'; })(), true);

// ── P3.4b kişisel trend (aylık kovalar, İstanbul takvimi) ──
const TNOW = Date.parse('2026-07-08T12:00:00+03:00');
const tj = (iso, rating) => ({ bitis: Date.parse(iso), rating: rating == null ? 4 : rating,
  deadline: Date.parse(iso) + 1, sureH: 10, rev_ic: 0, rev_musteri: 0, marka: 'A' });
const tr6 = C.bnsKisiTrend([tj('2026-07-02T10:00:00+03:00', 5), tj('2026-06-15T10:00:00+03:00', 3)], TNOW);
t('trend 6 eleman', tr6.length, 6);
t('trend son ay Tem', tr6[5].ay, 'Tem');
t('trend Tem tamamlanan', tr6[5].tamamlanan, 1);
t('trend Tem ortPuan', tr6[5].ortPuan, 5);
t('trend Haz ortPuan', tr6[4].ortPuan, 3);
t('trend boş ay 0/null', tr6[0].tamamlanan === 0 && tr6[0].ortPuan === null, true);
const sinir = C.bnsKisiTrend([tj('2026-06-30T23:30:00+03:00'), tj('2026-07-01T00:30:00+03:00')], TNOW);
t('trend ay sınırı Haz', sinir[4].tamamlanan, 1);
t('trend ay sınırı Tem', sinir[5].tamamlanan, 1);
t('trend bitis null sayılmaz', C.bnsKisiTrend([{ rating: 5 }], TNOW)[5].tamamlanan, 0);
t('trend yıl geçişi', C.bnsKisiTrend([], Date.parse('2026-02-10T12:00:00+03:00'))[0].ay, 'Eyl');

// ── P3.4c self-servis termin/hatırlat (perms) ──
const pB = { leads: [{id:'L1'}], workers: [{id:'W1'}], created_by: 'C1', durum: 'calisiliyor', termin_oneri_ms: 3600000 };
const pB0 = { ...pB, termin_oneri_ms: null };
t('perms: worker termin (öneri var)', C.bnsBriefActionPerms(pB, {id:'W1'}).termin, true);
t('perms: worker termin (öneri yok)', C.bnsBriefActionPerms(pB0, {id:'W1'}).termin, false);
t('perms: worker hatirlat', C.bnsBriefActionPerms(pB, {id:'W1'}).hatirlat, true);
t('perms: açan hatirlat', C.bnsBriefActionPerms(pB, {id:'C1'}).hatirlat, true);
t('perms: yabancı termin', C.bnsBriefActionPerms(pB, {id:'X9'}).termin, false);
t('perms: yabancı hatirlat', C.bnsBriefActionPerms(pB, {id:'X9'}).hatirlat, false);
t('perms: lead hatirlat (regresyon)', C.bnsBriefActionPerms(pB, {id:'L1'}).hatirlat, true);

// ── Kapasite v2: zamana yayılmış yük ──
const D = (s) => Date.parse(s + 'T12:00:00+03:00');           // İstanbul öğlen ts
const K = (s) => s;                                             // gün anahtarı 'YYYY-MM-DD'
const bYeni = { created_at: D('2026-07-06'), deadline: D('2026-07-10'),
  durum: 'yeni', durum_olaylari: [] };
t('v2: başlanmamış gün1 pay 1.0', C.bnsYayilimGunlukPay(bYeni, 5, K('2026-07-06')), 1);
t('v2: başlanmamış gün2 pay 1.25', C.bnsYayilimGunlukPay(bYeni, 5, K('2026-07-07')), 1.25);
t('v2: başlanmamış son gün pay 5', C.bnsYayilimGunlukPay(bYeni, 5, K('2026-07-10')), 5);
const bCalisan = { created_at: D('2026-07-06'), deadline: D('2026-07-10'), durum: 'basladi',
  durum_olaylari: [{ ts: D('2026-07-06'), durum: 'basladi' }] };
t('v2: çalışan gün1 pay 1.0', C.bnsYayilimGunlukPay(bCalisan, 5, K('2026-07-06')), 1);
t('v2: çalışan gün3 pay 1.0', C.bnsYayilimGunlukPay(bCalisan, 5, K('2026-07-08')), 1);
t('v2: çalışan gün5 pay 1.0', C.bnsYayilimGunlukPay(bCalisan, 5, K('2026-07-10')), 1);
const bBekle = { created_at: D('2026-07-06'), deadline: D('2026-07-10'), durum: 'revizyon',
  durum_olaylari: [
    { ts: D('2026-07-06'), durum: 'basladi' },
    { ts: Date.parse('2026-07-06T18:00:00+03:00'), durum: 'musteride' },
    { ts: D('2026-07-09'), durum: 'revizyon' } ] };
t('v2: ✈️ günü pay 0', C.bnsYayilimGunlukPay(bBekle, 5, K('2026-07-06')), 0);
t('v2: müşteride gün pay 0', C.bnsYayilimGunlukPay(bBekle, 5, K('2026-07-07')), 0);
t('v2: dönüş günü pay 2.5 (R=5, 2 gün)', C.bnsYayilimGunlukPay(bBekle, 5, K('2026-07-09')), 2.5);
const bInc = { created_at: D('2026-07-06'), deadline: D('2026-07-10'), durum: 'incelemede',
  durum_olaylari: [{ ts: D('2026-07-06'), durum: 'incelemede' }] };
t('v2: incelemede tüketir (gün2 pay 1.0)', C.bnsYayilimGunlukPay(bInc, 5, K('2026-07-07')), 1);
const bGec = { created_at: D('2026-07-01'), deadline: D('2026-07-03'), durum: 'yeni', durum_olaylari: [] };
t('v2: overdue tüm R bugüne', C.bnsYayilimGunlukPay(bGec, 5, K('2026-07-08')), 5);
t('v2: hafta sonu pay 0', C.bnsYayilimGunlukPay(bYeni, 5, K('2026-07-11')), 0);
const bCuma = { created_at: D('2026-07-10'), deadline: D('2026-07-13'), durum: 'yeni', durum_olaylari: [] };
t('v2: Cum→Pzt 2 iş günü (pay 2.5)', C.bnsYayilimGunlukPay(bCuma, 5, K('2026-07-10')), 2.5);
const bBitti = { created_at: D('2026-07-06'), deadline: D('2026-07-10'), durum: 'tamamlandi',
  durum_olaylari: [{ ts: D('2026-07-06'), durum: 'basladi' }, { ts: D('2026-07-08'), durum: 'tamamlandi' }] };
t('v2: tamamlandi günü pay 0', C.bnsYayilimGunlukPay(bBitti, 5, K('2026-07-08')), 0);
const bReopen = { created_at: D('2026-07-01'), deadline: D('2026-07-03'), durum: 'basladi',
  durum_olaylari: [
    { ts: D('2026-07-01'), durum: 'basladi' }, { ts: D('2026-07-02'), durum: 'tamamlandi' },
    { ts: D('2026-07-08'), durum: 'basladi' } ] };
t('v2: reopen tam V + overdue', C.bnsYayilimGunlukPay(bReopen, 5, K('2026-07-08')), 5);
const u2 = { id: 'U9', dept: 'tasarim' };
const bA = { ...bCalisan, workers: [{ id: 'U9' }], leads: [] };
const bB2 = { ...bCalisan, workers: [], leads: [{ id: 'U9' }] };
t('v2: kişi gün doluluk %20', C.bnsKisiGunDoluluk([bA, bB2], u2, K('2026-07-07')), 20);
const seri = C.bnsKisiGunlukSeri([bA], u2, K('2026-07-06'), 5);
t('v2: seri 5 eleman', seri.length, 5);
t('v2: seri hafta sonunu atlar (Cum→Pzt)', seri[4].gun, '2026-07-10');

// ── Kapasite v2: departman/firma + burnout v2 ──
const uT1 = { id: 'U11', dept: 'tasarim', active: true };
const uT2 = { id: 'U12', dept: 'tasarim', active: true };
const uE1 = { id: 'U13', dept: 'editor', active: true };
const bD1 = { created_at: D('2026-07-06'), deadline: D('2026-07-10'), durum: 'basladi',
  durum_olaylari: [{ ts: D('2026-07-06'), durum: 'basladi' }], workers: [{ id: 'U11' }], leads: [] };
t('v2: dept doluluk %8', C.bnsDeptGunDoluluk([bD1], [uT1, uT2, uE1], 'tasarim', K('2026-07-07')), 8);
t('v2: firma doluluk %5', C.bnsFirmaGunDoluluk([bD1], [uT1, uT2, uE1], K('2026-07-07')), 5);
t('v2: dept boş üye listesi %0', C.bnsDeptGunDoluluk([bD1], [], 'tasarim', K('2026-07-07')), 0);
t('v2: burnout sinyal gün adlı', C.bnsSinyalBurnout([{ ad: 'Eda', pct: 140, gun: 'Per' }])[0].text.includes('Per'), true);

// ── Fatura v2: kapsamda işler satış tarafında sayılmaz; maliyet her işte ──
const fEk = { maliyet: 100, satis: 400, fatura: true, odeme: false, ucret_tipi: 'ek' };
const fKap = { maliyet: 200, satis: 999, fatura: false, odeme: false, ucret_tipi: 'kapsamda' }; // satis girilmişse bile sayılmaz
const fo2 = C.bnsFinansOzet([fEk, fKap]);
t('fatura-v2: satis yalnız ek', fo2.satis, 400);
t('fatura-v2: maliyet hepsi', fo2.maliyet, 300);
t('fatura-v2: kar = ek satış − tüm maliyet', fo2.kar, 100);
t('fatura-v2: tahsil yalnız ek', fo2.tahsilEdilmemis, 400);
t('fatura-v2: tipsiz eski davranış', C.bnsFinansOzet([{ maliyet: 50, satis: 150 }]).kar, 100);

console.log(`\n${FAIL === 0 ? '🟢 FORMÜLLER KİLİTLİ' : '🔴 FORMÜL AYRIŞMASI'} — ${PASS} geçti, ${FAIL} kaldı\n`);
process.exit(FAIL === 0 ? 0 : 1);
