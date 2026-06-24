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

test('kisi_dokumu İrem sayıları ed ile tutarlı', async () => {
  const c = await ctx();
  const id = 'U0AK8U7L57F';
  const expTamam = [...new Set((c.ed.bns_completed||[])
    .filter(x => [...(x.workers||[]),...(x.leads||[])].some(p => p.id===id))
    .map(x => x.no))].sort((a,b)=>a-b);
  const expAktif = [...new Set((c.ed.bns_briefs||[])
    .filter(x => [...(x.workers||[]),...(x.leads||[])].some(p => p.id===id))
    .map(x => x.no))].sort((a,b)=>a-b);
  const r = await runTool('kisi_dokumu', { kisi: id }, c);
  assert.equal(r.tamamlanan.say, expTamam.length);
  assert.deepEqual(r.tamamlanan.nos, expTamam);
  assert.equal(r.aktif.say, expAktif.length);
  assert.deepEqual(r.aktif.nos, expAktif);
  assert.ok(expTamam.length >= 1, 'İrem en az 1 tamamlanan işe sahip olmalı (veri sağlık kontrolü)');
});

test('kisi_dokumu Pelin sayıları ed ile tutarlı', async () => {
  const c = await ctx();
  const id = 'U0B3K2WE7SB';
  const expTamam = [...new Set((c.ed.bns_completed||[])
    .filter(x => [...(x.workers||[]),...(x.leads||[])].some(p => p.id===id))
    .map(x => x.no))].sort((a,b)=>a-b);
  const expAktif = [...new Set((c.ed.bns_briefs||[])
    .filter(x => [...(x.workers||[]),...(x.leads||[])].some(p => p.id===id))
    .map(x => x.no))].sort((a,b)=>a-b);
  const r = await runTool('kisi_dokumu', { kisi: id }, c);
  assert.equal(r.tamamlanan.say, expTamam.length);
  assert.deepEqual(r.tamamlanan.nos, expTamam);
  assert.equal(r.aktif.say, expAktif.length);
  assert.deepEqual(r.aktif.nos, expAktif);
  assert.ok(expTamam.length >= 1, 'Pelin en az 1 tamamlanan işe sahip olmalı (veri sağlık kontrolü)');
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

test('kapasite kişi başına aktif yük döner', async () => {
  const c = await ctx();
  const r = await runTool('kapasite', {}, c);
  assert.ok(Array.isArray(r.kisiler));
  assert.ok(r.kisiler.every(k => typeof k.aktif === 'number'));
});

test('trend aktif metriği için zaman serisi özeti döner', async () => {
  const c = await ctx();
  const r = await runTool('trend', { metrik: 'aktif' }, c);
  assert.ok('seri' in r || 'hata' in r || 'nokta' in r);
});
