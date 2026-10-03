import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifySignature } from './validation.ts';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
serve(async(req)=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 try{
  const secret=Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET'),token=Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!secret||!token||!url||!key)return json({error:'server_configuration'},503);
  if(!await verifySignature(req,secret))return json({error:'invalid_signature'},401);
  const id=new URL(req.url).searchParams.get('data.id');
  if(!id||!/^\d+$/.test(id))return json({error:'invalid_payment_id'},400);
  let payload;try{payload=await req.json();}catch{return json({error:'invalid_json'},400);}
  if((payload.type??payload.topic)!=='payment')return json({ignored:true});
  if(String(payload.data?.id)!==id)return json({error:'payment_id_mismatch'},400);
  const response=await fetch(`https://api.mercadopago.com/v1/payments/${id}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
  if(!response.ok)return json({error:'provider_unavailable'},502);
  const payment=await response.json();
  if(String(payment.id)!==id)return json({error:'provider_id_mismatch'},502);
  const reference=payment.external_reference??payment.metadata?.pedido_id;
  if(!reference)return json({ignored:true});
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference))return json({ignored:true,reason:'unrelated_reference'});
  // Only non-personal fields needed for financial validation are retained.
  const minimal={id:String(payment.id),external_reference:reference,status:payment.status,currency_id:payment.currency_id,transaction_amount:payment.transaction_amount,date_last_updated:payment.date_last_updated,date_approved:payment.date_approved};
  const {data,error}=await createClient(url,key).rpc('tbr_processar_pagamento_mp',{p_payment:minimal});
  if(error){console.error('mp_webhook_database_error',error.code);return json({error:'processing_failed'},500);}
  return json({received:true,...data});
 }catch{console.error('mp_webhook_unexpected_error');return json({error:'processing_failed'},500);}
});
