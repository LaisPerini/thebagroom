const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('freight-fast.js','utf8');
let calls=0,started=[],resolve=[];
const context={window:{},document:{},Date,Map,AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{calls++;started.push(JSON.parse(options.body));await new Promise(r=>resolve.push(r));return {ok:true,json:async()=>[{name:'SEDEX',price:'20',delivery_time:2}]};}};
vm.runInNewContext(source,context);
(async()=>{
 const first=context.window.tbrQuoteRoundTrip('11060-003','01001-000');
 assert.equal(calls,2,'Ida e volta iniciam antes de qualquer resposta');
 const repeated=context.window.tbrQuoteRoundTrip('11060-003','01001-000');assert.equal(calls,2,'Deduplica chamadas concorrentes');
 resolve.forEach(r=>r());await Promise.all([first,repeated]);await context.window.tbrQuoteRoundTrip('11060-003','01001-000');assert.equal(calls,2,'Reutiliza cotação recente');
 for(const name of fs.readdirSync('aluguel').filter(x=>x.endsWith('.html'))){const html=fs.readFileSync('aluguel/'+name,'utf8');assert.match(html,/freight-fast\.js/);assert.match(html,/tbrQuoteRoundTrip/);for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/src=|application\/ld\+json/.test(match[1]))new vm.Script(match[2],{filename:name});}
 const html=fs.readFileSync('checkout-aluguel.html','utf8');assert.match(html,/id="voltarParaBolsa"/);assert.doesNotMatch(html,/href="\/aluguel\/bvlgari-micro-amarela.html"/);
 for(const file of ['minha-conta.html','cadastro-locacao.html'])for(const match of fs.readFileSync(file,'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/src=|application\/ld\+json/.test(match[1]))new vm.Script(match[2],{filename:file});
 console.log('PASS: frete paralelo/cache/deduplicação, 25 páginas sem erro de sintaxe e retorno dinâmico ao produto.');
})().catch(error=>{console.error(error);process.exitCode=1});
