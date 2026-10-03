const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/mercado-pago-webhook/validation.ts','utf8')).replace(/export /g,'');
const context={crypto:require('node:crypto').webcrypto,URL,TextEncoder,Uint8Array};vm.createContext(context);vm.runInContext(source,context);
(async()=>{
 const order={id:'demo',valor_total:390},payment={external_reference:'demo',currency_id:'BRL',transaction_amount:390};
 assert.equal(context.validatePayment(payment,order),true);
 for(const change of [{transaction_amount:1},{currency_id:'USD'},{external_reference:'other'},{transaction_amount:NaN},{transaction_amount:390.001}])assert.equal(context.validatePayment({...payment,...change},order),false);
 const secret='synthetic-test-secret',manifest='id:123;request-id:test;ts:123456;';
 const signature=require('node:crypto').createHmac('sha256',secret).update(manifest).digest('hex');
 const request=new Request('https://example.invalid?data.id=123',{headers:{'x-request-id':'test','x-signature':`ts=123456,v1=${signature}`}});
 assert.equal(await context.verifySignature(request,secret),true);
 assert.equal(await context.verifySignature(request,'wrong'),false);
 assert.equal(await context.verifySignature(new Request('https://example.invalid'),secret),false);
 console.log('PASS: valor/moeda/referência, assinatura válida e rejeição de assinatura inválida (dados fictícios).');
})().catch(error=>{console.error(error);process.exitCode=1});
