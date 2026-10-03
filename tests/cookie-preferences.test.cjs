const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'cookie-preferences.js'), 'utf8');
function simulate(saved) {
 const scripts = []; const handlers = {}; const store = {};
 const document = { readyState:'loading', cookie:'', activeElement:null, getElementById:()=>null,
  addEventListener:(name,fn)=>{handlers[name]=fn}, createElement:()=>({}), head:{appendChild:node=>scripts.push(node)} };
 const context={window:{},document,localStorage:{getItem:()=>saved,setItem:(k,v)=>{store[k]=v}},location:{hostname:'www.thebagroom.com.br',reload:()=>{}},Date};
 vm.runInNewContext(source,context); return {scripts,context,store};
}
assert.equal(simulate(null).scripts.length,0);
assert.equal(simulate('{broken').scripts.length,0);
assert.equal(simulate(JSON.stringify({version:1,analytics:false,at:Date.now()})).scripts.length,0);
assert.equal(simulate(JSON.stringify({version:1,analytics:true,at:Date.now()-181*86400000})).scripts.length,0);
const accepted=simulate(JSON.stringify({version:1,analytics:true,at:Date.now()}));
assert.equal(accepted.scripts.length,1);
assert.match(accepted.scripts[0].src,/googletagmanager/);
assert.equal(accepted.context.window['ga-disable-G-KPVTBY5VK8'],false);
function inspect(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())inspect(file);else if(e.name.endsWith('.html')){const text=fs.readFileSync(file,'utf8');assert.doesNotMatch(text,/src=["']https:\/\/www\.googletagmanager\.com\/gtag/);assert.match(text,/src="\/cookie-preferences.js"/);}}}
inspect(root);
console.log('PASS: Analytics bloqueado por padrão, recusa, dados corrompidos e preferência vencida; aceite carrega; HTML sem carregamento direto.');
