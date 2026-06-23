// server/ody-tools.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { getEmbedded } = require('./queries');
const { TOOLS, runTool, _matchUser } = require('./ody-tools');

async function ctx(extra = {}) {
  const ed = await getEmbedded();
  return { user: { id: 'admin1', name: 'Test', role: 'admin', slack_id: 'admin1' }, isAdmin: true, range: null, ed, ...extra };
}

test('genel_ozet tamamlanan toplamını verir (tüm zaman = 60)', async () => {
  const c = await ctx();
  const r = await runTool('genel_ozet', {}, c);
  assert.equal(typeof r.tamamlanan, 'number');
  assert.equal(r.tamamlanan, c.ed.bns_completed.length);
  assert.equal(typeof r.aktif, 'number');
});

test('TOOLS Anthropic şemasına uygun (name+description+input_schema)', () => {
  for (const t of TOOLS) {
    assert.ok(t.name && t.description && t.input_schema, t.name + ' eksik alan');
    assert.equal(t.input_schema.type, 'object');
  }
});

test('brief_sorgula durum=tamamlandi + marka filtresi sayı döner', async () => {
  const c = await ctx();
  const r = await runTool('brief_sorgula', { tamamlandi: true, marka: 'Hasvet' }, c);
  assert.equal(typeof r.toplam, 'number');
  assert.ok(Array.isArray(r.isler));
  assert.ok(r.isler.every(x => x.marka.toLowerCase().includes('hasvet')));
});
