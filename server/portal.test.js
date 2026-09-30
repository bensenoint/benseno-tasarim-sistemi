'use strict';
// Portal sızıntı kapısı — beyaz-liste fonksiyonları yasak alan döndüremez (SEC-P).
const test = require('node:test');
const assert = require('node:assert');
const { portalSatir, portalDetay, YASAK_ALANLAR } = require('./portal');

// DB'deki bir brief satırının tüm hassas alanlarıyla sahtesi
const HAM = {
  no: 42, baslik: 'Test işi', durum: 'basladi', faz_no: 1, parent_no: null,
  deadline: '2026-10-01', created_at: '2026-09-01', completed_at: null, rev: 2,
  rating: 4, rating_by: 'U030C48PL23', rating_sebep: 'İÇ: müşteri çok baskı yaptı',
  rating_sebep_musteri: 'Süreç birkaç revizyonla ilerledi.',
  maliyet: 5000, satis: 20000, satis_doviz: 'EUR', satis_orij: 400, satis_kur: 50,
  fatura: true, odeme: false, musteri_notu: 'not',
  thread_ozet: 'İÇ: müşteri gergin, ton sert', thread_ozet_musteri: 'İş planlandığı gibi ilerliyor.',
  thread_ton: 'gergin', insight: 'iç insight', slack_ts: '1.2', slack_channel: 'C1', created_by: 'U1',
};

test('portalSatir yasak alan sızdırmaz', () => {
  const out = portalSatir(HAM);
  for (const k of YASAK_ALANLAR) assert.ok(!(k in out), 'sızıntı: ' + k);
  assert.equal(out.satis, 20000);           // satış görünür (karar)
  assert.equal(out.satis_orij, 400);
  assert.ok(!('maliyet' in out));
});

test('portalDetay ham iç metinleri sızdırmaz, müşteri versiyonlarını verir', () => {
  const out = portalDetay(HAM, [{ ad: 'Cansu', rol: 'lead' }], []);
  for (const k of YASAK_ALANLAR) assert.ok(!(k in out), 'sızıntı: ' + k);
  assert.equal(out.ozet, 'İş planlandığı gibi ilerliyor.');
  assert.equal(out.rating_sebep, 'Süreç birkaç revizyonla ilerledi.');
  assert.ok(!JSON.stringify(out).includes('gergin'), 'ham ton/özet metni sızdı');
  assert.ok(!JSON.stringify(out).includes('baskı yaptı'), 'ham sebep metni sızdı');
});
