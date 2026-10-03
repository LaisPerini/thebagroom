(function(){
 'use strict';let busy=false;
 const descriptions={pedido:'O aluguel, suas reservas, rastreios, aceites e histórico serão apagados do Supabase. Pagamentos/cauções iniciados impedem a exclusão.',bolsa:'A bolsa, preços e links das fotos serão apagados do Supabase. Bolsas com histórico ou reservas não podem ser apagadas. A página HTML não é removida.',cliente:'Somente este cadastro de validação será apagado do Supabase. Login e arquivos enviados permanecem. Clientes com pedidos não podem ser apagadas.'};
 window.excluirRegistroAdmin=async function(type,id){
  if(busy||!descriptions[type])return;
  const source=type==='pedido'?pedidos:type==='bolsa'?bolsas:clientesValidacao;
  const record=source.find(item=>String(item.id)===String(id));if(!record)return;
  const label=record.numero||record.nome||record.nome_completo||id;
  if(prompt('Apagar '+label+'?\n\n'+descriptions[type]+'\n\nNão há desfazer. Digite APAGAR para confirmar.')!=='APAGAR')return;
  busy=true;document.querySelectorAll('.admin-delete').forEach(button=>button.disabled=true);
  try{
   const {data,error}=await supabaseClient.rpc('admin_excluir_registro',{p_tipo:type,p_id:String(id),p_confirmacao:'APAGAR'});
   if(error)throw error;if(!data?.deleted)throw new Error('Exclusão não confirmada.');
   await carregarTudo();if(type==='cliente')await carregarValidacoes();
   alert('Registro apagado do Supabase. Esta exclusão não pode ser desfeita pelo painel.');
  }catch(error){
   const message=String(error.message||error);
   const known={pedido_com_pagamento_ou_caucao:'Este aluguel possui pagamento ou caução iniciados. Use o cancelamento e preserve o histórico financeiro.',cupom_consumido:'Este aluguel possui cupom consumido e não pode ser apagado.',bolsa_com_historico_ou_reserva:'Esta bolsa tem histórico ou reserva. Desative a bolsa no editor em vez de apagá-la.',cliente_com_historico:'Esta cliente possui pedidos. O cadastro não pode ser apagado.',admin_obrigatorio:'Apenas administradores podem apagar registros.',PGRST202:'Execute a migração de exclusões no Supabase antes de usar esta opção.'};
   alert(Object.entries(known).find(([key])=>message.includes(key)||error.code===key)?.[1]||'Não foi possível apagar. Nenhuma exclusão foi confirmada.');
  }finally{busy=false;document.querySelectorAll('.admin-delete').forEach(button=>button.disabled=false);}
 };
})();
