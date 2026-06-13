'use strict';
const L = require('../v2/app/layout.js');
let FAIL = 0, PASS = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { PASS++; console.log('  ✅ ' + name); }
  else { FAIL++; console.log('  ❌ ' + name + ' — beklenen ' + JSON.stringify(want) + ', gelen ' + JSON.stringify(got)); }
}
console.log('\n🧪 v2 layout testi\n');
t('varsayılan 5 widget', L.bnsV2DefaultLayout().length, 5);
t('boş layout → varsayılan', L.bnsV2Validate([]).length, 5);
t('null → varsayılan', L.bnsV2Validate(null).length, 5);
t('bilinmeyen tip atılır', L.bnsV2Validate([{type:'sahte',x:0,y:0,w:1,h:1}]).length, 5);
t('geçerli korunur', L.bnsV2Validate([{type:'kapasitem',x:0,y:0,w:4,h:2}]).length, 1);
t('negatif boyut → varsayılan', L.bnsV2Validate([{type:'kapasitem',x:0,y:-1,w:4,h:2}]).length, 5);
t('serialize tip+konum', L.bnsV2Serialize([{type:'kapasitem',x:1,y:2,w:3,h:4}]), [{type:'kapasitem',x:1,y:2,w:3,h:4}]);
console.log('\n' + (FAIL === 0 ? '🟢 GEÇTİ' : '🔴 KALDI') + ' — ' + PASS + ' geçti, ' + FAIL + ' kaldı\n');
process.exit(FAIL === 0 ? 0 : 1);
