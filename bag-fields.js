(function () {
  'use strict';
  const api = 'https://zpyjnqkrsmgpwszqlcrs.supabase.co/rest/v1/';
  const key = 'sb_publishable_48rLPZfPRNtRX1kpYm0aWg_aVI1Hi2b';
  const fields = 'id,slug,nome,marca,categoria,cor,material,dimensoes,estado,descricao,valor_loja,valor_caucao,ativa';
  const currency = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2 });
  async function read(table, query) {
    const result = await fetch(api + table + '?' + new URLSearchParams(query), { headers: { apikey: key }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!result.ok) throw new Error('Falha na consulta de ' + table);
    return result.json();
  }
  function text(selector, value, scope = document) {
    const element = scope.querySelector(selector);
    if (element && value != null) element.textContent = value;
  }
  function model(bag) {
    const name = String(bag.nome || ''), brand = String(bag.marca || '');
    return (brand && name.toLowerCase().startsWith(brand.toLowerCase()) ? name.slice(brand.length).trim() : name) || name;
  }
  function safeImage(value) { try { const url=new URL(value); return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : null; } catch (_) { return null; } }
  async function photoSettings(query) {
    // The optional columns exist only after installing the Admin editor SQL.
    try { return await read('bolsas',{select:'id,imagem_capa_url,galeria_automatica',...query}); } catch (_) { return []; }
  }
  function updateGallery(rows,bag) {
    const gallery=document.getElementById('slider');if(!gallery)return;
    const photos=rows.map(row=>({url:safeImage(row.url),alt:row.alt})).filter(row=>row.url);
    if(!photos.length)return;
    const existing=Array.from(gallery.querySelectorAll('img'));
    existing.slice(photos.length).forEach(img=>img.remove());
    photos.forEach((photo,index)=>{
      let img=existing[index];
      if(!img){img=document.createElement('img');gallery.appendChild(img);img.addEventListener('click',()=>{if(typeof indexAtual!=='undefined')indexAtual=index;if(typeof atualizarZoom==='function' && typeof zoomOverlay!=='undefined'){atualizarZoom();zoomOverlay.style.display='flex';}});}
      img.src=photo.url;img.alt=photo.alt||bag.nome;img.loading=index?'lazy':'eager';
    });
    // Keep the original scrolling, zoom, swipe and CSS; only update their references.
    if(typeof imagens!=='undefined')imagens=gallery.querySelectorAll('img');
    if(typeof images!=='undefined')images=gallery.querySelectorAll('img');
    if(typeof indexAtual!=='undefined')indexAtual=0;
    gallery.scrollLeft=0;
    const dotsNode=document.getElementById('dots');
    if(dotsNode){dotsNode.replaceChildren();photos.forEach((_,i)=>{const dot=document.createElement('span');if(!i)dot.className='active';dotsNode.appendChild(dot);});if(typeof dots!=='undefined')dots=dotsNode.querySelectorAll('span');}
    text('.tbr-gallery-count','1 / '+photos.length);
    window.tbrGalleryImage=photos[0].url;
  }
  function detail(prefix, value) {
    if (value == null) return;
    document.querySelectorAll('.info .desc strong').forEach(label => {
      if (!label.textContent.trim().toLowerCase().startsWith(prefix)) return;
      let node = label.nextSibling;
      while (node) { const next = node.nextSibling; if (node.nodeType === Node.TEXT_NODE) node.remove(); node = next; }
      label.after(document.createTextNode(' ' + value));
    });
  }
  function validPlans(rows) {
    const days = new Set();
    return rows.filter(row => {
      const day = Number(row.dias), price = Number(row.valor);
      if (!row.ativo || !Number.isInteger(day) || day <= 0 || !Number.isFinite(price) || price <= 0 || days.has(day)) return false;
      days.add(day); return true;
    }).sort((a, b) => Number(a.dias) - Number(b.dias));
  }
  async function product() {
    if (!document.querySelector('.produto') || typeof BOLSA_SLUG === 'undefined') return;
    let ready = false;
    const originalRent = window.alugar;
    if (typeof originalRent === 'function') window.alugar = function () {
      if (!ready) { text('#reservaStatus', 'Não foi possível confirmar os dados de aluguel. Atualize a página ou fale com a curadoria.'); return; }
      return originalRent.apply(this, arguments);
    };
    const options = document.querySelector('.opcoes');
    options?.querySelectorAll('input').forEach(input => { input.disabled = true; });
    try {
      const bag = (await read('bolsas', { select: fields, slug: 'eq.' + BOLSA_SLUG, limit: '1' }))[0];
      if (!bag) throw new Error('Bolsa não encontrada.');
      const plans = validPlans(await read('bolsa_precos', { select: 'dias,valor,ativo', bolsa_id: 'eq.' + bag.id, order: 'dias.asc' }));
      window.tbrBagFields = bag;
      const photoConfig=(await photoSettings({id:'eq.'+bag.id}))[0];
      if(photoConfig?.galeria_automatica){
        try { updateGallery(await read('bolsa_imagens',{select:'url,alt,ordem',bolsa_id:'eq.'+bag.id,order:'ordem.asc'}),bag); }
        catch(error){console.warn('Não foi possível atualizar a galeria; fotos atuais mantidas.',error);}
      }
      text('.tbr-product-brand', bag.marca);
      text('.info > .nome', model(bag));
      document.title = bag.nome + ' | The Bag Room';
      const paragraph = document.querySelector('.info .desc > p');
      if (paragraph && bag.descricao != null) paragraph.textContent = bag.descricao;
      [['estado da bolsa',bag.estado],['categoria',bag.categoria],['material',bag.material],['marca',bag.marca],['cor',bag.cor],['dimensões',bag.dimensoes]].forEach(([label,value]) => detail(label,value));
      if (bag.valor_caucao != null) { text('.tbr-caution > span','Caução de segurança: ' + currency(bag.valor_caucao)); detail('valor do caução',currency(bag.valor_caucao)); }
      if (bag.valor_loja != null) detail('valor em loja',currency(bag.valor_loja));
      const previous = options?.querySelector('input:checked')?.value;
      const selected = plans.find(p => String(p.dias) === previous) || plans[0];
      if (options) {
        const labels = Array.from(options.querySelectorAll('.opcao'));
        labels.forEach(label => {
          const radio = label.querySelector('input');
          const plan = plans.find(p => String(p.dias) === radio?.value);
          label.style.display = plan ? '' : 'none';
          label.classList.remove('active');
          if (radio) { radio.disabled = true; radio.checked = false; }
        });
        plans.forEach(plan => {
          let label = labels.find(el => el.querySelector('input')?.value === String(plan.dias));
          if (!label) { label = document.createElement('label'); label.className = 'opcao'; const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'dias'; radio.value = plan.dias; label.appendChild(radio); options.appendChild(label); }
          // Only replace the text beside the existing radio; no gallery/layout changes.
          Array.from(label.childNodes).filter(node => node.nodeType === Node.TEXT_NODE).forEach(node => node.remove());
          label.appendChild(document.createTextNode(plan.dias + ' dias • ' + currency(plan.valor)));
          const radio = label.querySelector('input'); radio.disabled = !bag.ativa; radio.checked = plan === selected; radio.dataset.price = plan.valor;
          label.classList.toggle('active',radio.checked);
        });
        options.addEventListener('change', () => {
          options.querySelectorAll('.opcao').forEach(label => label.classList.toggle('active', Boolean(label.querySelector('input:checked'))));
          text('.tbr-mobile-rent > span',options.querySelector('input:checked')?.parentElement.textContent || '');
          if (typeof atualizarDevolucao === 'function') atualizarDevolucao();
          if (typeof atualizarTotal === 'function') atualizarTotal();
        });
      }
      text('.info > .preco',plans.length ? 'A partir de ' + currency(Math.min(...plans.map(p => Number(p.valor)))) : 'Preço sob consulta');
      text('.tbr-mobile-rent > span',options?.querySelector('input:checked')?.parentElement.textContent || 'Preço sob consulta');
      ready = Boolean(bag.ativa && plans.length && options);
      if (!ready) text('#reservaStatus',!bag.ativa ? 'Esta bolsa está indisponível para aluguel.' : 'Períodos de aluguel em atualização. Fale com a curadoria.');
      if (typeof atualizarDevolucao === 'function') atualizarDevolucao();
      if (typeof atualizarTotal === 'function') atualizarTotal();
    } catch (error) { console.error('Atualização dos campos da bolsa:',error); text('#reservaStatus','Não foi possível confirmar os dados de aluguel. Atualize a página ou fale com a curadoria.'); }
  }
  async function catalog() {
    if (!location.pathname.endsWith('/aluguel.html')) return;
    try {
      const [bags,rows] = await Promise.all([read('bolsas',{select:fields}),read('bolsa_precos',{select:'bolsa_id,dias,valor,ativo',ativo:'eq.true',order:'dias.asc'})]);
      const photoConfigs=await photoSettings({});
      document.querySelectorAll('.grid .card').forEach(card => {
        const slug = card.dataset.bolsaSlug || card.getAttribute('href')?.split('/').pop().replace('.html','');
        const bag = bags.find(row => row.slug === slug); if (!bag) return;
        const plans = validPlans(rows.filter(row => row.bolsa_id === bag.id));
        text('.marca',bag.marca,card); text('.modelo',model(bag),card);
        const cover=safeImage(photoConfigs.find(config=>config.id===bag.id)?.imagem_capa_url);
        if(cover){const img=card.querySelector('.img-box img');if(img){img.src=cover;img.alt=bag.nome;}}
        card.dataset.marca = bag.marca || ''; card.dataset.cor = bag.cor || '';
        card.dataset.price = plans.length ? Math.min(...plans.map(p => Number(p.valor))) : '';
        text('.preco',plans.length ? 'A partir de ' + currency(card.dataset.price) : 'Preço sob consulta',card);
      });
      if (typeof aplicarFiltros === 'function') aplicarFiltros();
    } catch (error) { console.error('Atualização dos campos do catálogo:',error); }
  }
  function start() { product(); catalog(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
