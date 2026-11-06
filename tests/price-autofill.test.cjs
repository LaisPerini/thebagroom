// Offline test: sugestão de preços a partir do valor de 4 dias.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('admin-price-autofill.js','utf8'),ctx);
const {sugerir}=ctx.window.TBRPriceAutofill;const plain=o=>JSON.parse(JSON.stringify(o));
assert.deepEqual(plain(sugerir(390,[])),{7:490,10:590,15:790,20:890,30:1190});
assert.deepEqual(plain(sugerir(1590,[])),{7:1890,10:2190,15:2590,20:2990,30:3590});
const db=[4,7,10,15,20,30].map((dias,i)=>({bolsa_id:'x',dias,valor:[390,550,650,850,950,1250][i]}));
assert.deepEqual(plain(sugerir(390,db)),{7:550,10:650,15:850,20:950,30:1250});
const mid=sugerir(450,[]);let prev=450;for(const d of [7,10,15,20,30]){assert.ok(mid[d]>prev);assert.equal(mid[d]%10,0);prev=mid[d];}
assert.equal(sugerir(0,[]),null);
console.log('PASS: preços de 7 a 30 dias sugeridos a partir dos 4 dias.');
