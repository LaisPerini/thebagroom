(function () {
  'use strict';
  let editing=null,records=[],busy=false;
  const nav=document.querySelector('.nav'),host=document.getElementById('bolsas').parentElement;
  const tab=document.createElement('button');tab.type='button';tab.dataset.panel='cupons';tab.textContent='Cupons';tab.addEventListener('click',()=>abrirPainel('cupons',tab));nav.appendChild(tab);
  const panel=document.createElement('section');panel.id='cupons';panel.className='panel';
  panel.innerHTML='<div class="card"><h2>Criar cupom</h2><p class="panel-intro">Descontos de 1% a 100% somente no aluguel. Frete e caução permanecem. Um código pode ser limitado a uma cliente ou compartilhado, com limite de usos.</p><div class="form-grid"><div class="field"><label for="cupomAdminCodigo">Código</label><input id="cupomAdminCodigo" maxlength="40" placeholder="Ex.: AMIGA-LAIS"></div><div class="field"><label for="cupomAdminPercentual">Desconto (%)</label><input id="cupomAdminPercentual" type="number" min="0.01" max="100" step="0.01" value="100"></div><div class="field"><label for="cupomAdminInicio">Válido a partir de</label><input id="cupomAdminInicio" type="datetime-local"></div><div class="field"><label for="cupomAdminFim">Válido até (opcional)</label><input id="cupomAdminFim" type="datetime-local"></div><div class="field"><label for="cupomAdminTotal">Limite total de usos (vazio = sem limite)</label><input id="cupomAdminTotal" type="number" min="1" step="1" value="1"></div><div class="field"><label for="cupomAdminClienteLimite">Usos por cliente</label><input id="cupomAdminClienteLimite" type="number" min="1" step="1" value="1"></div><div class="field full"><label for="cupomAdminCliente">Disponível para</label><select id="cupomAdminCliente"><option value="">Qualquer cliente aprovada com o código</option></select></div></div><div class="checkbox-row"><label><input id="cupomAdminAtivo" type="checkbox" checked> Ativo</label></div><div class="form-actions"><button type="button" id="cupomAdminSalvar" class="btn">Salvar cupom</button><button type="button" id="cupomAdminLimpar" class="btn secondary">Novo cupom</button></div><p id="cupomAdminStatus" class="message" role="status"></p></div><div class="card" style="margin-top:16px"><h2>Cupons cadastrados</h2><p class="message">Um pedido aguardando pagamento reserva o uso. Se for cancelado sem pagamento, libera o uso. Após aprovação, o uso fica consumido permanentemente.</p><div id="cupomAdminLista"></div></div>';
  host.appendChild(panel);
  const el=id=>document.getElementById('cupomAdmin'+id);
  function dateValue(value){const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
  function status(message,error=false){el('Status').textContent=message;el('Status').className='message'+(error?' error':'');}
  function clients(){const selected=el('Cliente').value;el('Cliente').replaceChildren(new Option('Qualquer cliente aprovada com o código',''));for(const cliente of clientesValidacao||[])if(cliente.usuario_auth_id)el('Cliente').add(new Option(cliente.nome_completo||cliente.email||'Cliente',cliente.usuario_auth_id));el('Cliente').value=selected;}
  function clear(){if(busy)return;editing=null;el('Codigo').value='';el('Percentual').value='100';el('Inicio').value=dateValue(new Date());el('Fim').value='';el('Total').value='1';el('ClienteLimite').value='1';el('Cliente').value='';el('Ativo').checked=true;el('Codigo').readOnly=false;status('');}
  function edit(record){editing=record.id;el('Codigo').value=record.codigo;el('Codigo').readOnly=true;el('Percentual').value=record.percentual;el('Inicio').value=dateValue(record.inicio);el('Fim').value=record.fim?dateValue(record.fim):'';el('Total').value=record.limite_total??'';el('ClienteLimite').value=record.limite_por_cliente;el('Cliente').value=record.cliente_auth_id||'';el('Ativo').checked=record.ativo;status('Editando '+record.codigo+'. Alterações não mudam pedidos já criados.');panel.scrollIntoView({behavior:'smooth',block:'start'});}
  async function load(){
    clients();status('Carregando cupons...');
    const [coupons,uses]=await Promise.all([supabaseClient.from('cupons').select('*').order('created_at',{ascending:false}),supabaseClient.from('cupons_usos').select('cupom_id,pedido_id,consumido,aluguel_pedidos(status)')]);
    if(coupons.error||uses.error){status('Não foi possível carregar cupons. Execute o SQL de cupons no Supabase e confira seu acesso de administrador.',true);return;}
    records=coupons.data||[];el('Lista').replaceChildren();
    for(const record of records){
      const card=document.createElement('article');card.className='order-card';const title=document.createElement('h3');title.textContent=record.codigo+' — '+record.percentual+'%';
      const details=document.createElement('p');details.className='message';const count=(uses.data||[]).filter(use=>use.cupom_id===record.id&&(use.consumido||(use.aluguel_pedidos?.status&&use.aluguel_pedidos.status!=='cancelado'))).length;
      details.textContent=(record.ativo?'Ativo':'Inativo')+' · '+count+' usos reservados/consumidos · Limite total: '+(record.limite_total??'sem limite')+' · Por cliente: '+record.limite_por_cliente+(record.tipo==='boas_vindas'?' · Boas-vindas automático de 5% para novos cadastros':'');
      card.append(title,details);
      if(record.tipo==='manual'){const button=document.createElement('button');button.type='button';button.className='btn secondary small';button.textContent='Editar';button.addEventListener('click',()=>edit(record));card.appendChild(button);}
      el('Lista').appendChild(card);
    }
    if(!records.length)el('Lista').textContent='Nenhum cupom cadastrado.';status('');
  }
  async function save(){
    if(busy)return;busy=true;el('Salvar').disabled=true;
    try{
      const access=await supabaseClient.rpc('is_admin');if(access.error||access.data!==true)throw new Error('Acesso restrito a administradores.');
      const code=el('Codigo').value.trim().toUpperCase(),percent=Number(el('Percentual').value),per=Number(el('ClienteLimite').value),total=el('Total').value.trim()?Number(el('Total').value):null;
      const start=new Date(el('Inicio').value),end=el('Fim').value?new Date(el('Fim').value):null;
      if(!/^[A-Z0-9_-]{3,40}$/.test(code))throw new Error('Use de 3 a 40 letras, números, hífen ou sublinhado no código.');
      if(!Number.isFinite(percent)||percent<=0||percent>100)throw new Error('O percentual deve ser maior que zero e no máximo 100.');
      if(!Number.isInteger(per)||per<1||(total!==null&&(!Number.isInteger(total)||total<1)))throw new Error('Os limites devem ser números inteiros maiores que zero.');
      if(!Number.isFinite(start.getTime())||(end&&(!Number.isFinite(end.getTime())||end<=start)))throw new Error('Confira início e validade do cupom.');
      const data={codigo:code,percentual:percent,tipo:'manual',ativo:el('Ativo').checked,inicio:start.toISOString(),fim:end?.toISOString()||null,limite_total:total,limite_por_cliente:per,cliente_auth_id:el('Cliente').value||null};
      const result=editing?await supabaseClient.from('cupons').update(data).eq('id',editing).eq('tipo','manual').select('id').single():await supabaseClient.from('cupons').insert(data).select('id').single();
      if(result.error)throw new Error(result.error.code==='23505'?'Já existe um cupom com esse código.':result.error.message);
      await load();busy=false;clear();status('Cupom salvo. Ele poderá ser utilizado por clientes aprovadas conforme as regras definidas.');
    }catch(error){status(error.message||'Não foi possível salvar.',true);}finally{busy=false;el('Salvar').disabled=false;}
  }
  el('Salvar').addEventListener('click',save);el('Limpar').addEventListener('click',clear);
  const open=window.abrirPainel;window.abrirPainel=function(id,button){open.apply(this,arguments);if(id==='cupons'){document.getElementById('pageTitle').textContent='Cupons';load();}};
  clear();
})();
