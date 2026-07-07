'use strict';
const test = require('node:test');
const assert = require('node:assert');
const c = require('../dashboard/app/calc.js');

test('bnsKarMarj: temel kâr + marj%', () => {
  assert.deepEqual(c.bnsKarMarj({ maliyet: 1000, satis: 4000 }), { kar: 3000, marj: 75 });
});
test('bnsKarMarj: satış=0 → marj null', () => {
  assert.deepEqual(c.bnsKarMarj({ maliyet: 500, satis: 0 }), { kar: -500, marj: null });
});
test('bnsKarMarj: ikisi de null → kar null', () => {
  assert.deepEqual(c.bnsKarMarj({}), { kar: null, marj: null });
});
test('bnsKarMarj: biri null → diğeri 0', () => {
  assert.deepEqual(c.bnsKarMarj({ satis: 2000 }), { kar: 2000, marj: 100 });
});
test('bnsFinansOzet: toplam + faturalanmamış/tahsil ayrımı', () => {
  const o = c.bnsFinansOzet([
    { maliyet: 1000, satis: 4000, fatura: true, odeme: true },
    { maliyet: 500, satis: 2000, fatura: true, odeme: false },
    { maliyet: 300, satis: 1000, fatura: false, odeme: false },
  ]);
  assert.equal(o.satis, 7000); assert.equal(o.maliyet, 1800); assert.equal(o.kar, 5200);
  assert.equal(o.marj, Math.round(5200/7000*100));
  assert.equal(o.tahsilEdilmemis, 2000); assert.equal(o.faturalanmamis, 1000);
});
