// server/writes-durum.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { DURUMLAR } = require('./writes');

test("DURUMLAR 'basladi' içerir ve çalışılıyor ile incelemede arasındadır", () => {
  assert.ok(DURUMLAR.includes('basladi'), "basladi eklenmeli");
  const i = DURUMLAR.indexOf('basladi'), c = DURUMLAR.indexOf('calisiliyor'), r = DURUMLAR.indexOf('incelemede');
  assert.ok(c < i && i < r, "sıra: calisiliyor < basladi < incelemede");
});
