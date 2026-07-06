'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { computeSignal } = require('./ody-icgoru');

const H = 3600000;
const now = new Date('2026-07-06T09:00:00+03:00').getTime();
const u = { id: 'U1', name: 'Serra' };
const mk = (no, marka, dhHours) => ({ no, marka, baslik: marka + ' işi', durum: 'basladi',
  deadline: now + dhHours * H, workers: [{ id: 'U1' }], leads: [] });

test('sinyal yoksa null (kapı)', () => {
  const briefs = [mk(1, 'A', 100), { ...mk(2, 'B', 5), workers: [{ id: 'U9' }] }];
  assert.equal(computeSignal(u, briefs, now), null);
});
test('geciken/riskli/bugün doğru sınıflanır + odak en çok geciken', () => {
  const briefs = [
    mk(1, 'Splenda', -30),
    mk(2, 'Acme', -5),
    mk(3, 'Beta', 6),
    mk(4, 'Gamma', 20),
    mk(5, 'Delta', 200),
  ];
  const s = computeSignal(u, briefs, now);
  assert.ok(s);
  assert.equal(s.ad, 'Serra');
  assert.deepEqual(s.geciken.map(b => b.no).sort(), [1, 2]);
  assert.deepEqual(s.bugun.map(b => b.no), [3]);
  assert.deepEqual(s.riskli.map(b => b.no), [4]);
  assert.equal(s.focus.no, 1);
});
test('yalnız bugün deadline → sinyal var, odak bugünden', () => {
  const s = computeSignal(u, [mk(7, 'Tek', 3)], now);
  assert.ok(s);
  assert.equal(s.focus.no, 7);
});
