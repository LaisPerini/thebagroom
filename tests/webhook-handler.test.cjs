const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/mercado-pago-webhook/index.ts','utf8').replace(/^import .*;\r?\n/gm,''));
async function run(valid=true,id='123',error=null){
 let handler,fetches=0,writes=0;
 const uuid='11111111-1111-1111-1111-111111111111';
 vm.runInNewContext(source,{serve:f=>handler=f,Deno:{env:{get:()=> 'synthetic'}},Response,URL,AbortSignal,console,
 verifySignature:async()=>valid,createClient:()=>({rpc:async(name,args)=>{writes++;assert.equal(name,'tbr_processar_pagamento_mp');assert.equal(args.p_payment.external_reference,uuid);assert.equal(args.p_payment.payer,undefined);return {data:{result:'processado'},error};}}),
 fetch:async()=>{fetches++;return {ok:true,json:async()=>({id:123,external_reference:uuid,status:'approved',currency_id:'BRL',transaction_amount:390,date_last_updated:'2026-10-03T00:00:00Z',payer:{email:'never-retained@example.invalid'}})};}});
 const result=await handler(new Request('https://example.invalid?data.id=123',{method:'POST',body:JSON.stringify({type:'payment',data:{id}})}));
 return {status:result.status,fetches,writes};
}
(async()=>{
 assert.deepEqual(await run(false),{status:401,fetches:0,writes:0});
 assert.deepEqual(await run(true,'456'),{status:400,fetches:0,writes:0});
 assert.deepEqual(await run(),{status:200,fetches:1,writes:1});
 assert.equal((await run(true,'123',{code:'synthetic'})).status,500);
 console.log('PASS: handler rejeita assinatura/ID inválidos antes de consultar provedor; RPC segura e falhas retornam erro (simulado).');
})().catch(error=>{console.error(error);process.exitCode=1});
