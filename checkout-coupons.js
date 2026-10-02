(function () {
  'use strict';
  let revision=0;
  const input=document.getElementById('cupomCodigo'),message=document.getElementById('cupomStatus'),button=document.getElementById('aplicarCupom');
  function reset(){document.getElementById('linhaDesconto').classList.add('hidden');if(checkout){document.getElementById('valorTotal').textContent=moeda(Number(checkout.valorAluguel||0)+Number(checkout.valorFrete||0));document.getElementById('valorCaucao').textContent=moeda(checkout.valorCaucao??1000);}}
  window.aplicarCupomAluguel=async function(){
    const token=++revision;button.disabled=true;message.textContent='Conferindo desconto...';
    try{
      if(!checkout){message.textContent='Selecione uma bolsa primeiro.';return;}
      const {data:{session}}=await supabaseClient.auth.getSession();
      if(!session){message.textContent='Entre na sua conta para verificar o cupom de boas-vindas ou aplicar seu código.';return;}
      const {data,error}=await supabaseClient.rpc('consultar_cupom_aluguel',{p_bolsa_slug:checkout.bolsaSlug,p_dias:Number(checkout.dias),p_codigo:input.value.trim()||null});
      if(token!==revision)return;
      if(error)throw error;
      document.getElementById('valorAluguel').textContent=moeda(data.valor_aluguel);
      document.getElementById('valorCaucao').textContent=Number(data.percentual)===100?'Isenta — cupom de 100%':moeda(data.valor_caucao??checkout.valorCaucao??1000);
      document.getElementById('valorTotal').textContent=moeda(Number(data.aluguel_liquido)+Number(checkout.valorFrete||0));
      document.getElementById('valorDesconto').textContent='− '+moeda(data.valor_desconto);
      document.getElementById('linhaDesconto').classList.toggle('hidden',!Number(data.valor_desconto));
      message.textContent=data.codigo?(data.codigo+' aplicado: '+data.percentual+'% de desconto no aluguel. '+(Number(data.percentual)===100?'Caução isenta. O frete, se houver, permanece.':'Frete e caução não mudam.')):'Novos cadastros recebem 5% no primeiro aluguel, uma única vez. Não há cupom de boas-vindas disponível para esta conta.';
    }catch(error){if(token!==revision)return;reset();message.textContent=error.code==='PGRST202'?'Os cupons ainda não foram ativados no servidor.':'Cupom inválido, fora da validade, sem usos disponíveis ou não permitido para esta conta.';}
    finally{if(token===revision)button.disabled=false;}
  };
  input.addEventListener('input',()=>{revision++;button.disabled=false;reset();message.textContent='Clique em Aplicar cupom para conferir o novo código.';});
  aplicarCupomAluguel();
})();
