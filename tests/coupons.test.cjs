const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
for(const file of ['admin-coupons.js','checkout-coupons.js','admin-ga-pages.js'])new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});
for(const file of ['admin.html','checkout-aluguel.html','pedido-aluguel-confirmado.html']){
 const html=fs.readFileSync(file,'utf8');
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/src=|application\/ld\+json/.test(match[1]))new vm.Script(match[2],{filename:file});
}
const sql=fs.readFileSync('supabase/migrations/20261002_cupons.sql','utf8');
assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/for update/);assert.match(sql,/u\.consumido or p\.status<>'cancelado'/);
assert.match(sql,/percentual=5 and limite_por_cliente=1/);assert.match(sql,/grant execute on function public\.confirmar_pedido_cortesia\(uuid,uuid\) to service_role/);
const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/mercado-pago-checkout/index.ts','utf8').replace(/^import .*;\r?\n/gm,''));
async function run(total,rpcError=null){
 let handler,chargeCount=0,courtesyCount=0;
 const pedido={id:'p1',numero:1,cliente_auth_id:'u1',status:'aguardando_pagamento',valor_total:total,aluguel_itens:[]};
 const client={auth:{getUser:async()=>({data:{user:{id:'u1',email:'test@example.invalid'}}})},from(table){
  if(table==='aluguel_pedidos')return {select(){return this},eq(){return this},single:async()=>({data:pedido})};
  if(table==='aceites_contratos_aluguel')return {upsert:async()=>({error:null})};
  return {insert:async()=>({error:null})};
 },rpc:async()=>{courtesyCount++;return {error:rpcError}}};
 vm.runInNewContext(source,{serve:f=>handler=f,createClient:()=>client,Deno:{env:{get:()=> 'https://example.invalid'}},Response,Number,console,encodeURIComponent,fetch:async()=>{chargeCount++;return {ok:true,json:async()=>({id:'fake',init_point:'https://example.invalid/pay'})}}});
 const response=await handler({method:'POST',headers:new Headers({Authorization:'Bearer fake'}),json:async()=>({pedido_id:'p1',aceite_contrato:{aceito:true,versao:'2026-07-02'}})});
 return {status:response.status,result:await response.json(),chargeCount,courtesyCount};
}
(async()=>{
 const free=await run(0);assert.equal(free.status,200);assert.equal(free.result.cortesia,true);assert.equal(free.chargeCount,0);assert.equal(free.courtesyCount,1);
 const denied=await run(0,{message:'invalid'});assert.equal(denied.status,409);assert.equal(denied.chargeCount,0);
 const paid=await run(50);assert.equal(paid.status,200);assert.equal(paid.chargeCount,1);assert.equal(paid.courtesyCount,0);
 const invalid=await run(-1);assert.equal(invalid.status,400);assert.equal(invalid.chargeCount,0);
 console.log('PASS: sintaxe, uso único protegido, cortesia sem cobrança externa, cobrança positiva e rejeição de valor inválido (simulados).');
})().catch(error=>{console.error(error);process.exitCode=1});
