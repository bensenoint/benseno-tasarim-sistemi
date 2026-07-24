#!/usr/bin/env node
'use strict';
// ── ODY BAĞLANTI KURULUMU ───────────────────────────────────────────────────
// Herhangi bir Node projesine Ody sağlayıcısını kurar:
//   node kur.js /yol/projeye kaynak-adi
// Yaptıkları:
//   1. Projenin modül tipini algılar (package.json "type") → doğru sürümü kopyalar
//   2. @modelcontextprotocol/sdk bağımlılığını kurar
//   3. Güvenli bir bağlantı token'ı üretir (DEĞERİ ekrana basar)
//   4. Başlangıç araç dosyası (ody-araclar örneği) oluşturur
//   5. ody-core'a kayıt için SQL + env adımlarını ekrana yazar
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { randomBytes } = require('crypto');

const hedef = process.argv[2];
const kaynakAd = (process.argv[3] || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
if (!hedef || !kaynakAd) {
  console.log('Kullanım: node kur.js /yol/projeye <kaynak-adi>\n  örn: node kur.js ~/benseno-arsiv arsiv');
  process.exit(1);
}
const pj = path.join(hedef, 'package.json');
if (!fs.existsSync(pj)) { console.error('HATA: package.json yok — Node projesi değil:', hedef); process.exit(1); }
const pkg = JSON.parse(fs.readFileSync(pj, 'utf8'));
const esm = pkg.type === 'module';
const uzanti = esm ? 'mjs' : 'cjs';

// 1-2: dosya + bağımlılık
fs.copyFileSync(path.join(__dirname, `ody-provider.${uzanti}`), path.join(hedef, `ody-provider.${uzanti}`));
console.log(`✓ ody-provider.${uzanti} kopyalandı (${esm ? 'ESM' : 'CommonJS'} projesi)`);
try {
  execFileSync('npm', ['ls', '@modelcontextprotocol/sdk'], { cwd: hedef, stdio: 'ignore' });
  console.log('✓ @modelcontextprotocol/sdk zaten kurulu');
} catch (e) {
  console.log('… @modelcontextprotocol/sdk kuruluyor');
  execFileSync('npm', ['install', '@modelcontextprotocol/sdk'], { cwd: hedef, stdio: 'inherit' });
}

// 3: token
const token = randomBytes(32).toString('hex');
const envVar = `${kaynakAd.toUpperCase()}_MCP_TOKEN`;

// 4: örnek araç dosyası (varsa dokunma)
const ornekYol = path.join(hedef, `ody-araclar.${uzanti}`);
if (!fs.existsSync(ornekYol)) {
  const imp = esm
    ? `import { odyProvider } from "./ody-provider.mjs";`
    : `const { odyProvider } = require('./ody-provider.cjs');`;
  const exp = esm ? 'export function odyBaglan(app)' : 'function odyBaglan(app)';
  const son = esm ? '' : '\nmodule.exports = { odyBaglan };';
  fs.writeFileSync(ornekYol, `${imp}

// Ody bağlantısı — express uygulamana: odyBaglan(app)
// Araçlarını burada tanımla; kurallar için BAGLANTI.md'ye bak.
${exp} {
  odyProvider(app, {
    ad: '${kaynakAd}',
    sistemBilgisi: 'Bu sistem ... (Ody promptuna girer: ne olduğunu ve araçların ne zaman kullanılacağını anlat)',
    guard: (req, res, next) => {
      const want = process.env.${envVar};
      if (!want) return res.status(403).json({ error: '${envVar} zorunlu' });
      if ((req.get('x-bns-token') || '') === want) return next();
      return res.status(403).json({ error: 'yalnız sistem erişimi' });
    },
    araclar: {
      ornek_arac: {
        description: 'Örnek: buradan başla, kendi araçlarını ekle',
        input_schema: { type: 'object', properties: { q: { type: 'string' } } },
        run: async (input, kimlik) => ({ mesaj: 'merhaba', soran: kimlik.kullanici && kimlik.kullanici.name }),
      },
    },
  });
}${son}
`);
  console.log(`✓ ody-araclar.${uzanti} oluşturuldu (örnek araçla)`);
} else console.log(`• ody-araclar.${uzanti} zaten var — dokunulmadı`);

// 5: talimatlar
console.log(`
━━━ SONRAKİ ADIMLAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Sunucu dosyanda bağla:
   ${esm ? `import { odyBaglan } from "./ody-araclar.mjs";` : `const { odyBaglan } = require('./ody-araclar.cjs');`}
   odyBaglan(app);

2. Projenin ortamına (Railway vb.) token'ı ekle:
   ${envVar}=${token}

3. ody-core'a kaynağı kaydet (ody-core Postgres'inde):
   INSERT INTO kaynaklar(ad, base_url, token_env)
   VALUES ('${kaynakAd}', 'https://<servis-adresin>/mcp', '${envVar}');
   ve ody-core servisine AYNI değerle ${envVar} env değişkenini ekle.

4. Doğrula:
   curl -s https://ody-core-production.up.railway.app/kaynaklar -H "x-ody-token: <ODY_SERVICE_TOKEN>"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
