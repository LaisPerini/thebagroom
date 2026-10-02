// Adapted from the deployed function, inspected on 2026-10-02.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const supabaseUrl=Deno.env.get("SUPABASE_URL")??"";
const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const mercadoPagoAccessToken=Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")??"";
const siteUrl=Deno.env.get("SITE_URL")??"https://www.thebagroom.com.br";
const contratoAluguelVersao="2026-07-02";
const contratoAluguelUrl=`${siteUrl}/contrato-aluguel`;
const termosUsoUrl=`${siteUrl}/termos-de-uso.html`;
const textoAceiteContrato="Li e concordo com o Contrato de Locação e Termos de Uso.";
function jsonResponse(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});}
function getClientIp(req:Request){return (req.headers.get("x-forwarded-for")??"").split(",")[0]?.trim()||req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||req.headers.get("x-client-ip")||"";}
serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return jsonResponse({error:"method_not_allowed"},405);
 try{
  if(!supabaseUrl||!serviceRoleKey||!mercadoPagoAccessToken)return jsonResponse({error:"missing_server_configuration"},500);
  const token=(req.headers.get("Authorization")??"").replace("Bearer ","").trim();
  if(!token)return jsonResponse({error:"login_required"},401);
  const supabase=createClient(supabaseUrl,serviceRoleKey);
  const {data:authData,error:authError}=await supabase.auth.getUser(token);
  if(authError||!authData.user)return jsonResponse({error:"invalid_user"},401);
  const {pedido_id,aceite_contrato}=await req.json();
  if(!pedido_id)return jsonResponse({error:"pedido_id_required"},400);
  if(!aceite_contrato?.aceito)return jsonResponse({error:"contract_acceptance_required"},400);
  if(aceite_contrato.versao!==contratoAluguelVersao)return jsonResponse({error:"contract_version_invalid"},400);
  const {data:pedido,error:pedidoError}=await supabase.from("aluguel_pedidos").select("id,numero,cliente_auth_id,status,valor_total,aluguel_itens(data_inicio,data_fim,dias,bolsas(nome))").eq("id",pedido_id).single();
  if(pedidoError||!pedido)return jsonResponse({error:"pedido_not_found"},404);
  if(pedido.cliente_auth_id!==authData.user.id)return jsonResponse({error:"forbidden"},403);
  if(pedido.status==="cancelado")return jsonResponse({error:"pedido_cancelado"},409);
  const item:any=Array.isArray(pedido.aluguel_itens)?pedido.aluguel_itens[0]:null;
  const bolsaNome=item?.bolsas?.nome??"Aluguel The Bag Room";
  const valorTotal=Number(pedido.valor_total);
  if(!Number.isFinite(valorTotal)||valorTotal<0)return jsonResponse({error:"valor_total_invalid"},400);
  const {error:aceiteError}=await supabase.from("aceites_contratos_aluguel").upsert({pedido_id:pedido.id,cliente_auth_id:authData.user.id,contrato_versao:contratoAluguelVersao,contrato_url:contratoAluguelUrl,termos_url:termosUsoUrl,texto_aceite:textoAceiteContrato,ip_address:getClientIp(req),user_agent:req.headers.get("user-agent")??"",aceito_em:new Date().toISOString()},{onConflict:"pedido_id,contrato_versao"});
  if(aceiteError){console.error("Contract acceptance insert error",aceiteError);return jsonResponse({error:"contract_acceptance_record_error"},500);}
  // Zero-value orders still require an approved client, a real 100% coupon,
  // recorded contract acceptance and a matching reservation, checked in SQL.
  if(valorTotal===0){
   const {error}=await supabase.rpc("confirmar_pedido_cortesia",{p_pedido_id:pedido.id,p_cliente_auth_id:authData.user.id});
   if(error){console.error("Courtesy confirmation error",error);return jsonResponse({error:"cortesia_invalid"},409);}
   return jsonResponse({checkout_url:`${siteUrl}/pedido-aluguel-confirmado.html?pedido=${encodeURIComponent(pedido.id)}`,cortesia:true});
  }
  if(pedido.status!=="aguardando_pagamento")return jsonResponse({error:"pedido_ja_processado"},409);
  const preferencePayload={
   items:[{id:pedido.id,title:`Aluguel ${bolsaNome}`,description:`Pedido ${pedido.numero??pedido.id}`,quantity:1,currency_id:"BRL",unit_price:valorTotal}],
   payer:{email:authData.user.email},external_reference:pedido.id,
   back_urls:{success:`${siteUrl}/aluguel.html?pedido=${pedido.id}&pagamento=success`,failure:`${siteUrl}/aluguel.html?pedido=${pedido.id}&pagamento=failure`,pending:`${siteUrl}/aluguel.html?pedido=${pedido.id}&pagamento=pending`},
   payment_methods:{excluded_payment_types:[{id:"ticket"},{id:"bank_transfer"},{id:"atm"},{id:"debit_card"},{id:"prepaid_card"}],excluded_payment_methods:[{id:"pix"}],installments:1},
   auto_return:"approved",notification_url:`${supabaseUrl}/functions/v1/mercado-pago-webhook`,statement_descriptor:"THE BAG ROOM",metadata:{pedido_id:pedido.id,numero:pedido.numero}
  };
  const preferenceResponse=await fetch("https://api.mercadopago.com/checkout/preferences",{method:"POST",headers:{Authorization:`Bearer ${mercadoPagoAccessToken}`,"Content-Type":"application/json"},body:JSON.stringify(preferencePayload)});
  const preference=await preferenceResponse.json();
  if(!preferenceResponse.ok){console.error("Mercado Pago preference error",preference);return jsonResponse({error:"mercado_pago_error",details:preference},502);}
  const checkoutUrl=preference.init_point??preference.sandbox_init_point;
  const {error:pagamentoError}=await supabase.from("pagamentos_aluguel").insert({pedido_id:pedido.id,provider:"mercado_pago",provider_payment_id:preference.id,status:"pendente",valor:valorTotal,moeda:"BRL",checkout_url:checkoutUrl,raw_response:preference});
  if(pagamentoError){console.error("Payment insert error",pagamentoError);return jsonResponse({error:"payment_record_error"},500);}
  return jsonResponse({checkout_url:checkoutUrl,preference_id:preference.id});
 }catch(error){console.error(error);return jsonResponse({error:"unexpected_error"},500);}
});
