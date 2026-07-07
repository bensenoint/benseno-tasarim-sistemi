'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { bnsFeedbackOzet } = require('./ody-tools');
test('boş → boş string', () => { assert.equal(bnsFeedbackOzet([]), ''); });
test('downvote sebeplerini derler, 400 kırpar', () => {
  const rows = [{ reason: 'çok genel', advice_text: 'x' }, { reason: 'yanlış kişi', advice_text: 'y' }];
  const s = bnsFeedbackOzet(rows);
  assert.ok(s.includes('çok genel') && s.includes('yanlış kişi'));
  assert.ok(s.length <= 400);
});
