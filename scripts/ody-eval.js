// scripts/ody-eval.js — bilinen-cevaplı soruları canlı /api/chat'e sorup regresyon yakalar.
// Kullanım: API_BASE=https://benseno-api-production.up.railway.app node scripts/ody-eval.js
const fs = require('fs');
const path = require('path');
const auth = require('../server/auth');

const BASE = process.env.API_BASE || 'http://localhost:3000';
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'ody-evals.json'), 'utf8'));

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
        body: JSON.stringify({ messages: [{ role: 'user', content: t.q }] }),
      });
      const j = await r.json().catch(() => ({}));
      const reply = j.reply || '';
      const fails = check(reply, t.expect);
      if (fails.length) { fail++; console.log(`❌ "${t.q}"\n   → ${reply.slice(0, 160)}\n   sebep: ${fails.join(', ')}`); }
      else { pass++; console.log(`✅ "${t.q}"`); }
    } catch (e) { fail++; console.log(`❌ "${t.q}" — istek hatası: ${e.message}`); }
  }
  console.log(`\nOdy eval: ${pass} geçti, ${fail} kaldı`);
  process.exit(fail ? 1 : 0);
})();
