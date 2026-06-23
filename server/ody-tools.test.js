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

test('kisi_dokumu İrem = 3 tamamlanan (#14,#15,#83)', async () => {
  const c = await ctx();
  const r = await runTool('kisi_dokumu', { kisi: 'U0AK8U7L57F' }, c);
  assert.equal(r.tamamlanan.say, 3);
  assert.deepEqual(r.tamamlanan.nos, [14, 15, 83]);
});

test('kisi_dokumu Pelin = 1 tamamlanan (#92), 7 aktif', async () => {
  const c = await ctx();
  const r = await runTool('kisi_dokumu', { kisi: 'U0B3K2WE7SB' }, c);
  assert.equal(r.tamamlanan.say, 1);
  assert.deepEqual(r.tamamlanan.nos, [92]);
  assert.equal(r.aktif.say, 7);
});

test('kisi_dokumu admin değilse puan dönmez', async () => {
  const c = await ctx({ isAdmin: false });
  const r = await runTool('kisi_dokumu', { kisi: 'U0B3K2WE7SB' }, c);
  assert.equal(r.puan, undefined);
});

test('marka_dokumu Hasvet için sayıları döner', async () => {
  const c = await ctx();
  const r = await runTool('marka_dokumu', { marka: 'Hasvet' }, c);
  assert.equal(typeof r.aktif, 'number');
  assert.equal(typeof r.tamamlanan, 'number');
  assert.ok('marka' in r);
});

test('yildiz_karne firma admin için döner, admin değil için reddeder', async () => {
  const a = await ctx();
  const ra = await runTool('yildiz_karne', { kapsam: 'firma' }, a);
  assert.ok('firma' in ra || 'avg' in ra);
  const n = await ctx({ isAdmin: false });
  const rn = await runTool('yildiz_karne', { kapsam: 'kisi', key: 'U0B3K2WE7SB' }, n);
  assert.equal(rn.yetki, 'yöneticilere özel');
});

test('gecikme_analizi gecikmiş aktif briefleri listeler', async () => {
  const c = await ctx();
  const r = await runTool('gecikme_analizi', {}, c);
  assert.equal(typeof r.toplam, 'number');
  assert.ok(r.isler.every(x => x.gecikme_gun >= 0));
});
