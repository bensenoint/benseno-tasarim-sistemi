'use strict';
const test = require('node:test');
const assert = require('node:assert');
const s = require('./ody-slack');

test('erisebilirMi: üye kanal geçer, üye olmayan elenir', () => {
  const uch = new Set(['C1', 'C2']);
  assert.equal(s.erisebilirMi(uch, 'C1', 'U1'), true);
  assert.equal(s.erisebilirMi(uch, 'C9', 'U1'), false);
});
test('erisebilirMi: Görkem her kanalı geçer (üye olmasa da)', () => {
  const uch = new Set([]);
  assert.equal(s.erisebilirMi(uch, 'C9', 'U030C48PL23'), true);
});
test('erisebilirMi: DM (D…/G…) her zaman elenir, Görkem dahil', () => {
  assert.equal(s.erisebilirMi(new Set(['D1']), 'D1', 'U030C48PL23'), false);
});
test('cacheTaze: 6sa içi taze, dışı bayat', () => {
  const now = Date.parse('2026-07-07T12:00:00Z');
  assert.equal(s.cacheTaze({ created_at: '2026-07-07T09:00:00Z' }, now), true);
  assert.equal(s.cacheTaze({ created_at: '2026-07-07T05:00:00Z' }, now), false);
  assert.equal(s.cacheTaze(null, now), false);
});
