(function () {
  'use strict';
  let editing = null, revision = 0, saving = false, loading = false;
  const originalClear = window.limparFormularioBolsa;
  const fields = { nome:'novaBolsaNome',slug:'novaBolsaSlug',marca:'novaBolsaMarca',categoria:'novaBolsaCategoria',cor:'novaBolsaCor',material:'novaBolsaMaterial',dimensoes:'novaBolsaDimensoes',estado:'novaBolsaEstado',descricao:'novaBolsaDescricao',valor_loja:'novaBolsaValorLoja',valor_pago:'novaBolsaValorPago',valor_caucao:'novaBolsaCaucao' };
  const byId = id => document.getElementById(id);
  function url(value) { try { const result = new URL(value); return /^https?:$/.test(result.protocol) && !result.username && !result.password ? result.href : null; } catch (_) { return null; } }
  function mode() {
    byId('tituloEditorBolsa').textContent = editing ? 'Editar bolsa' : 'Cadastrar bolsa';
    byId('salvarBolsaEditor').textContent = editing ? 'Salvar alterações' : 'Cadastrar bolsa';
    byId('novaBolsaSlug').readOnly = Boolean(editing);
    byId('salvarBolsaEditor').disabled = saving || loading;
    byId('editarBolsaSelect').disabled = saving;
  }
  window.previsualizarFotosEditor = function () {
    const preview = byId('fotosEditorPreview'); preview.replaceChildren();
    const photos = [{label:'Capa',src:byId('novaBolsaImagem').value},...byId('novaBolsaGaleria').value.split(/\r?\n/).filter(v=>v.trim()).map((src,i)=>({label:'Foto '+(i+1),src:src.trim()}))];
    photos.slice(0,31).forEach(photo => {
      const src=url(photo.src);if(!src)return;
      const figure=document.createElement('figure');figure.style.margin='0';
      const image=document.createElement('img');image.src=src;image.alt=photo.label;image.loading='lazy';image.style.cssText='width:100px;height:100px;object-fit:contain;background:white;border:1px solid #ddd;';
      image.addEventListener('error',()=>{image.alt=photo.label+' — não foi possível carregar';});
      const caption=document.createElement('figcaption');caption.textContent=photo.label;caption.style.fontSize='12px';figure.append(image,caption);preview.appendChild(figure);
    });
  };
  window.limparFormularioBolsa = function () {
    if(saving)return;
    revision++; editing=null; loading=false;
    originalClear();byId('novaBolsaGaleria').value='';byId('editarBolsaSelect').value='';
    document.querySelectorAll('[data-extra-period]').forEach(node=>node.remove());
    mode();previsualizarFotosEditor();
  };
  function refreshSelector() {
    const select=byId('editarBolsaSelect');const chosen=editing;
    select.replaceChildren(new Option('Nova bolsa',''));
    bolsas.forEach(bag=>select.add(new Option(bag.nome+' — '+bag.slug+(bag.ativa?'':' (inativa)'),bag.id)));
    select.value=chosen||'';
  }
  const render=window.renderBolsas;
  window.renderBolsas=function(){render();refreshSelector();};
  window.selecionarBolsaEditor = async function (id) {
    if(saving)return;
    if(!id){limparFormularioBolsa();return;}
    limparFormularioBolsa();editing=id;byId('editarBolsaSelect').value=id;loading=true;mode();
    const token=revision;
    setMessage('bolsaStatus','Carregando dados da bolsa...');
    try {
      const [bagResult,priceResult,imageResult] = await Promise.all([
        supabaseClient.from('bolsas').select('*').eq('id',id).single(),
        supabaseClient.from('bolsa_precos').select('*').eq('bolsa_id',id).order('dias'),
        supabaseClient.from('bolsa_imagens').select('*').eq('bolsa_id',id).order('ordem')
      ]);
      if(token!==revision)return;
      if(bagResult.error||priceResult.error||imageResult.error)throw bagResult.error||priceResult.error||imageResult.error;
      const bag=bagResult.data;
      Object.entries(fields).forEach(([field,id])=>{const value=bag[field];byId(id).value=typeof value==='number'?value.toLocaleString('pt-BR',{useGrouping:false,maximumFractionDigits:2}):value??'';});
      byId('novaBolsaSlug').dataset.editado='true';
      byId('novaBolsaAtiva').checked=Boolean(bag.ativa);byId('novaBolsaDestaque').checked=Boolean(bag.destaque);
      const manual=window.TBR_MANUAL_PHOTOS?.[bag.slug];
      byId('novaBolsaImagem').value=bag.imagem_capa_url||manual?.cover||imageResult.data.find(i=>i.principal)?.url||imageResult.data[0]?.url||'';
      const gallery=bag.galeria_automatica?imageResult.data.map(i=>i.url):(manual?.gallery?.length?manual.gallery:imageResult.data.map(i=>i.url));
      byId('novaBolsaGaleria').value=gallery.join('\n');
      priceResult.data.filter(p=>p.ativo).forEach(price=>{
        let input=byId('preco'+price.dias);
        if(!input){const field=document.createElement('div');field.className='field';field.dataset.extraPeriod='true';const label=document.createElement('label');label.htmlFor='preco'+price.dias;label.textContent=price.dias+' dias';input=document.createElement('input');input.id=label.htmlFor;input.inputMode='decimal';field.append(label,input);document.querySelector('.price-grid').appendChild(field);}
        input.value=Number(price.valor).toLocaleString('pt-BR',{useGrouping:false,maximumFractionDigits:2});
      });
      previsualizarFotosEditor();renderResumoCadastroBolsa();loading=false;mode();
      setMessage('bolsaStatus','Dados carregados. Revise a capa, as fotos e os preços antes de salvar. Campos de preço vazios desativam aquele período.');
    } catch(error){if(token!==revision)return;console.error(error);setMessage('bolsaStatus','Não foi possível carregar a bolsa. Selecione novamente para tentar.','error');loading=true;mode();}
  };
  window.cadastrarBolsa = async function () {
    if(saving||loading)return;
    saving=true;mode();
    try {
      const access=await supabaseClient.rpc('is_admin');if(access.error||access.data!==true)throw new Error('Acesso restrito a administradores.');
      const data={};Object.entries(fields).forEach(([field,id])=>{data[field]=field.startsWith('valor_')?valorDecimal(id):campoTexto(id)||null;});
      for(const field of ['valor_loja','valor_pago','valor_caucao'])if(campoTexto(fields[field]) && data[field]===null)throw new Error('Informe valores numéricos válidos; use vírgula para os centavos.');
      data.slug=slugifyBolsa(data.slug||data.nome);data.ativa=byId('novaBolsaAtiva').checked;data.destaque=byId('novaBolsaDestaque').checked;data.imagem_capa_url=url(campoTexto('novaBolsaImagem'));
      if(!data.nome||!data.marca||!data.slug)throw new Error('Preencha nome, marca e slug.');
      if(!data.imagem_capa_url)throw new Error('Informe um link HTTP/HTTPS válido para a capa.');
      for(const field of ['valor_loja','valor_pago','valor_caucao'])if(data[field]!==null&&(!Number.isFinite(data[field])||data[field]<0))throw new Error('Valores não podem ser negativos ou inválidos.');
      const images=byId('novaBolsaGaleria').value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean).map(value=>({url:url(value)}));
      if(!images.length||images.length>30||images.some(i=>!i.url))throw new Error('Inclua entre 1 e 30 links HTTP/HTTPS válidos para a galeria.');
      const prices=[];
      document.querySelectorAll('.price-grid input').forEach(input=>{if(!input.value.trim())return;const value=valorDecimal(input.id),days=Number(input.id.replace('preco',''));if(!Number.isInteger(days)||days<=0||value===null||!Number.isFinite(value)||value<=0)throw new Error('Os preços preenchidos devem ser maiores que zero.');prices.push({dias:days,valor:value});});
      saving=true;mode();setMessage('bolsaStatus','Salvando dados, preços e imagens...');
      const result=await supabaseClient.rpc('admin_salvar_bolsa',{p_id:editing,p_bolsa:data,p_precos:prices,p_imagens:images});
      if(result.error){if(result.error.code==='PGRST202'||/schema cache|does not exist/i.test(result.error.message))throw new Error('Execute primeiro o SQL 20261002_editor_bolsas.sql no Supabase para ativar o salvamento.');throw new Error(result.error.message||'Não foi possível salvar.');}
      const id=result.data;await carregarTudo();saving=false;await selecionarBolsaEditor(id);
      setMessage('bolsaStatus','Bolsa salva. Dados, preços, capa e galeria aparecerão nas páginas ao atualizar.','success');
    }catch(error){console.error(error);setMessage('bolsaStatus',error.message||'Não foi possível salvar.','error');}
    finally{saving=false;mode();}
  };
  refreshSelector();mode();
})();
