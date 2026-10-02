(function(){
 'use strict';
 const cache=new Map(),pending=new Map(),ttl=5*60*1000;
 async function quote(from,to){
  const key=from.replace(/\D/g,'')+':'+to.replace(/\D/g,'');
  const cached=cache.get(key);if(cached&&Date.now()-cached.at<ttl)return cached.data;
  if(pending.has(key))return pending.get(key);
  const request=(async()=>{
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
   try{
    const response=await fetch('https://thebagroomtest.onrender.com/frete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:{postal_code:from},to:{postal_code:to}}),signal:controller.signal});
    if(!response.ok)throw new Error('frete_http_'+response.status);
    const data=await response.json();if(!Array.isArray(data)||!data.some(item=>item.name==='SEDEX'&&Number(item.price)>0&&Number(item.delivery_time)>0))throw new Error('frete_indisponivel');
    cache.set(key,{at:Date.now(),data});return data;
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
  if(button){button.disabled=true;button.textContent='Calculando…';button.setAttribute('aria-busy','true');}
  try{return await calculate.apply(this,arguments);}finally{busy=false;if(button){button.disabled=false;button.textContent=label;button.removeAttribute('aria-busy');}}
 };
})();
