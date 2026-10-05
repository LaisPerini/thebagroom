(function(){
 'use strict';
 const cache=new Map(),pending=new Map(),ttl=5*60*1000;
 const storageKey='tbr:freight:session:v2';
 const validQuote=data=>Array.isArray(data)&&data.some(item=>item?.name==='SEDEX'&&Number.isFinite(Number(item.price))&&Number(item.price)>0&&Number.isFinite(Number(item.delivery_time))&&Number(item.delivery_time)>0);
 // Short-lived functional cache, shared across product pages in this tab.
 // Storage is optional: private browsing/quota errors must not block shipping.
 try{
  const saved=JSON.parse(window.sessionStorage?.getItem(storageKey)||'[]');
  if(Array.isArray(saved))for(const [key,value] of saved.slice(-30)){
   if(/^\d{8}:\d{8}$/.test(key)&&value&&Number.isFinite(value.at)&&value.at<=Date.now()&&Date.now()-value.at<ttl&&validQuote(value.data))cache.set(key,value);
  }
 }catch(_){}
 function remember(key,data){
  cache.set(key,{at:Date.now(),data});
  for(const [entry,value] of cache)if(Date.now()-value.at>=ttl)cache.delete(entry);
  while(cache.size>30)cache.delete(cache.keys().next().value);
  try{window.sessionStorage?.setItem(storageKey,JSON.stringify([...cache]));}catch(_){}
 }
 async function quote(from,to){
  from=String(from).replace(/\D/g,'');to=String(to).replace(/\D/g,'');
  if(from.length!==8||to.length!==8)throw new Error('cep_invalido');
  const key=from+':'+to;
  const cached=cache.get(key);if(cached&&Date.now()-cached.at<ttl)return cached.data;
  if(pending.has(key))return pending.get(key);
  const request=(async()=>{
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),90000);
   try{
    const response=await fetch('https://thebagroomtest.onrender.com/frete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:{postal_code:from},to:{postal_code:to}}),signal:controller.signal});
    if(!response.ok)throw new Error('frete_http_'+response.status);
    const data=await response.json();if(!validQuote(data))throw new Error('frete_indisponivel');
    remember(key,data);return data;
   }finally{clearTimeout(timeout);pending.delete(key);}
  })();pending.set(key,request);return request;
 }
 window.tbrQuoteRoundTrip=(origin,destination)=>Promise.all([quote(origin,destination),quote(destination,origin)]);
 const addresses=new Map();
 window.validarCepEstadoSP=async function(cep){
  const key=String(cep).replace(/\D/g,'');if(key.length!==8)throw new Error('cep_invalido');
  if(addresses.has(key))return addresses.get(key);
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
  try{const response=await fetch('https://viacep.com.br/ws/'+key+'/json/',{signal:controller.signal});if(!response.ok)throw new Error('cep_indisponivel');const data=await response.json();if(data.erro)throw new Error('cep_nao_encontrado');addresses.set(key,data);return data;}finally{clearTimeout(timeout);}
 };
 const calculate=window.calcularFrete;let busy=false;
 if(calculate)window.calcularFrete=async function(){
  if(busy)return;busy=true;const button=document.querySelector('.btn-frete'),label=button?.textContent;
  if(button){button.disabled=true;button.textContent='Calculando frete…';button.setAttribute('aria-busy','true');}
  const slowNotice=setTimeout(()=>{if(button)button.textContent='Aguarde, iniciando consulta…';},12000);
  try{return await calculate.apply(this,arguments);}finally{clearTimeout(slowNotice);busy=false;if(button){button.disabled=false;button.textContent=label;button.removeAttribute('aria-busy');}}
 };
})();
