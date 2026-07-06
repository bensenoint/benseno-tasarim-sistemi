'use strict';
const test = require('node:test');
const assert = require('node:assert');
const c = require('../dashboard/app/calc.js');

const worker = { id: 'U1' }, lead = { id: 'U2' }, mgr = { id: 'U3', yetki: 'yonetici' }, outsider = { id: 'U9' };
const brief = (durum, extra = {}) => ({ durum, deltaH: 100, leads: [lead], workers: [worker], contributors: [worker], created_by: 'U2', ...extra });

test('atanan yeni işte başla+ilerlet var, dışarıdaki yok', () => {
  const p = c.bnsBriefActionPerms(brief('yeni'), worker);
  assert.equal(p.basla, true); assert.equal(p.ilerlet, true);
  const o = c.bnsBriefActionPerms(brief('yeni'), outsider);
  assert.equal(o.basla, false); assert.equal(o.ilerlet, false);
});
test('başla yalnız yeni/calisiliyor durumunda', () => {
  assert.equal(c.bnsBriefActionPerms(brief('incelemede'), worker).basla, false);
  assert.equal(c.bnsBriefActionPerms(brief('calisiliyor'), worker).basla, true);
});
test('tamamlandi/musteride → ilerlet yok', () => {
  assert.equal(c.bnsBriefActionPerms(brief('tamamlandi'), worker).ilerlet, false);
  assert.equal(c.bnsBriefActionPerms(brief('musteride'), worker).ilerlet, false);
});
test('termin: uzatma önerisi (termin_oneri_ms) varsa lead/açan/yönetici; değilse yok', () => {
  const oneri = brief('basladi', { termin_oneri_ms: 3 * 86400000 });   // 3g bekleme dönüşü
  assert.equal(c.bnsBriefActionPerms(oneri, lead).termin, true);
  assert.equal(c.bnsBriefActionPerms(oneri, mgr).termin, true);
  assert.equal(c.bnsBriefActionPerms(oneri, worker).termin, false);   // yetki yok
  // öneri yoksa (termin_oneri_ms null) riskli olsa bile buton yok
  assert.equal(c.bnsBriefActionPerms(brief('basladi', { deltaH: -5 }), lead).termin, false);
});
test('hatırlat: lead veya yönetici', () => {
  assert.equal(c.bnsBriefActionPerms(brief('basladi'), lead).hatirlat, true);
  assert.equal(c.bnsBriefActionPerms(brief('basladi'), mgr).hatirlat, true);
  assert.equal(c.bnsBriefActionPerms(brief('basladi'), worker).hatirlat, false);
});
test('NEXT_STATUS ileri akış', () => {
  assert.equal(c.BNS_NEXT_STATUS['basladi'], 'incelemede');
  assert.equal(c.BNS_NEXT_STATUS['incelemede'], 'tamamlandi');
  assert.equal(c.BNS_NEXT_STATUS['tamamlandi'], undefined);
});
