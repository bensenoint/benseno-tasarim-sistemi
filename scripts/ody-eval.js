// scripts/ody-eval.js — bilinen-cevaplı soruları canlı /api/chat'e sorup regresyon yakalar.
// Kullanım: API_BASE=https://benseno-api-production.up.railway.app node scripts/ody-eval.js
const fs = require('fs');
const path = require('path');
const auth = require('../server/auth');
const { getEmbedded } = require('../server/queries');
const ody = require('../server/ody-tools');

const BASE = process.env.API_BASE || 'http://localhost:3000';
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'ody-evals.json'), 'utf8'));

// Ortak gömülü veri (getEmbedded) — DATABASE_URL yoksa null kalır, expectTool atlanır.
let ED = null, edErr = null;
async function ensureEmbedded() {
  if (ED || edErr) return ED;
  try { ED = await getEmbedded(); } catch (e) { edErr = e; }
  return ED;
}

function resolvePath(obj, p) {
  return String(p).split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

// expectTool: ground truth'u yerel ody-tools'tan canlı hesaplar, cevap o sayıyı içeriyor mu bakar.
async function checkExpectTool(reply, c) {
  const et = c.expectTool;
  const ed = await ensureEmbedded();
  if (!ed) { console.log(`   ⚠️  expectTool atlandı (DB yok): ${edErr ? edErr.message : 'getEmbedded boş'}`); return []; }
  const ctx = { user: { id: 'eval', name: 'Eval', role: c.admin ? 'admin' : 'user', slack_id: 'eval' }, isAdmin: !!c.admin, range: c.range || null, ed };
  const out = await ody.runTool(et.tool, et.input, ctx);
  const exp = resolvePath(out, et.path);
  if (exp == null) return [`expectTool: ${et.path} çözülemedi (out=${JSON.stringify(out).slice(0, 120)})`];
  // Sayı → kelime-sınırlı sayı eşleşmesi; metin (örn. isim) → küçük-harf içerme.
  if (typeof exp === 'number') {
    if (!new RegExp('(^|\\D)' + exp + '($|\\D)').test(reply)) {
      return [`beklenen sayı yok: ${exp} (yanıt: ${reply.slice(0, 120)})`];
    }
  } else {
    if (!reply.toLocaleLowerCase('tr').includes(String(exp).toLocaleLowerCase('tr'))) {
      return [`beklenen metin yok: "${exp}" (yanıt: ${reply.slice(0, 120)})`];
    }
  }
  return [];
}

function token(admin) {
  return auth.signToken({ id: 'eval-bot', name: 'Eval', role: admin ? 'admin' : 'user', slack_id: 'eval-bot' });
}

function check(reply, expect) {
  const fails = [];
  if (expect.regex && !new RegExp(expect.regex).test(reply)) fails.push('regex:' + expect.regex);
  for (const c of (expect.contains || [])) if (!reply.toLocaleLowerCase('tr').includes(c.toLocaleLowerCase('tr'))) fails.push('eksik:' + c);
  for (const c of (expect.notContains || [])) if (reply.toLocaleLowerCase('tr').includes(c.toLocaleLowerCase('tr'))) fails.push('olmamalı:' + c);
  return fails;
}

(async () => {
  let pass = 0, fail = 0;
  for (const t of cases) {
    try {
      const r = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token(t.admin) },
        body: JSON.stringify({ messages: [{ role: 'user', content: t.q }], ...(t.range ? { range: t.range } : {}) }),
      });
      const j = await r.json().catch(() => ({}));
      const reply = j.reply || '';
      const fails = t.expect ? check(reply, t.expect) : [];
      if (t.expectTool) fails.push(...await checkExpectTool(reply, t));
      if (fails.length) { fail++; console.log(`❌ "${t.q}"\n   → ${reply.slice(0, 160)}\n   sebep: ${fails.join(', ')}`); }
      else { pass++; console.log(`✅ "${t.q}"`); }
    } catch (e) { fail++; console.log(`❌ "${t.q}" — istek hatası: ${e.message}`); }
  }
  console.log(`\nOdy eval: ${pass} geçti, ${fail} kaldı`);
  process.exit(fail ? 1 : 0);
})();
