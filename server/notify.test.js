'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { shouldPushNow } = require('./notify');

const prefs = { ogle_dijest: true, tip_termin: true, tip_atama: true, tip_bloke: true, sessiz_bas: 19, sessiz_bit: 8 };

test('normal aciliyet asla anlık push edilmez', () => {
  assert.equal(shouldPushNow({ tip: 'bloke', aciliyet: 'normal' }, prefs, new Date('2026-07-02T10:00:00+03:00')), false);
});
test('acil + mesai içi + pref açık → push', () => {
  assert.equal(shouldPushNow({ tip: 'termin', aciliyet: 'acil' }, prefs, new Date('2026-07-02T10:00:00+03:00')), true);
});
test('acil ama kategori kapalı → push yok', () => {
  const p = { ...prefs, tip_termin: false };
  assert.equal(shouldPushNow({ tip: 'termin', aciliyet: 'acil' }, p, new Date('2026-07-02T10:00:00+03:00')), false);
});
test('acil ama sessiz saatte (20:00) → push yok', () => {
  assert.equal(shouldPushNow({ tip: 'termin', aciliyet: 'acil' }, prefs, new Date('2026-07-02T20:00:00+03:00')), false);
});
test('acil ama hafta sonu → push yok', () => {
  // 2026-07-04 Cumartesi
  assert.equal(shouldPushNow({ tip: 'atama', aciliyet: 'acil' }, prefs, new Date('2026-07-04T10:00:00+03:00')), false);
});
test('sessiz saat sınırı: tam 08:00 mesai içi sayılır, 07:59 sayılmaz', () => {
  assert.equal(shouldPushNow({ tip: 'termin', aciliyet: 'acil' }, prefs, new Date('2026-07-02T08:00:00+03:00')), true);
  assert.equal(shouldPushNow({ tip: 'termin', aciliyet: 'acil' }, prefs, new Date('2026-07-02T07:59:00+03:00')), false);
});
