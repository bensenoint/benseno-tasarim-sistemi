const { test } = require('node:test');
const assert = require('node:assert');
const w = require('./writes');

test('writes setQueue + queue yardımcıları export ediliyor', () => {
  assert.equal(typeof w.setQueue, 'function');
});
