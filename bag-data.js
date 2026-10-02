(function () {
  'use strict';
  const base = 'https://zpyjnqkrsmgpwszqlcrs.supabase.co/rest/v1/';
  const key = 'sb_publishable_48rLPZfPRNtRX1kpYm0aWg_aVI1Hi2b';
  const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const safeUrl = value => {
    if (!value) return null;
    try { const url = new URL(value, location.origin); return /^https?:$/.test(url.protocol) ? url.href : null; } catch (_) { return null; }
  };
  async function read(table, query) {
    const response = await fetch(base + table + '?' + new URLSearchParams(query), { headers: { apikey: key }, signal: AbortSignal.timeout(15000), cache: 'no-store' });
    if (!response.ok) throw new Error('Não foi possível consultar ' + table);
    return response.json();
  }
  function text(selector, value) { const node = document.querySelector(selector); if (node) node.textContent = value; }
  function status(message) { text('#reservaStatus', message); }
  async function product() {
    if (!document.querySelector('.produto')) return;
    const dynamicPage = location.pathname.endsWith('/bolsa.html');
    if (dynamicPage) {
      text('.tbr-product-brand', ''); text('.info > .nome', 'Carregando bolsa…'); text('.info > .preco', '');
      document.querySelector('.info .desc')?.replaceChildren();
      document.querySelector('#slider')?.replaceChildren();
      document.querySelector('.opcoes')?.replaceChildren();
      text('.tbr-caution > span', '');
    }
    window.tbrProductReady = false;
    const rent = window.alugar;
    if (typeof rent === 'function') window.alugar = function () {
      if (window.tbrBolsa && !window.tbrBolsa.ativa) { status('Esta bolsa está indisponível para aluguel.'); return; }
      if (!window.tbrProductReady) { status('Os dados de aluguel ainda não estão disponíveis. Recarregue ou fale com a curadoria.'); return; }
      return rent.apply(this, arguments);
    };
    const slug = typeof BOLSA_SLUG !== 'undefined' ? BOLSA_SLUG : location.pathname.split('/').pop().replace('.html', '');
    try {
      const rows = await read('bolsas', { select: '*', slug: 'eq.' + slug, limit: '1' });
      const bag = rows[0];
      if (!bag) throw new Error('Bolsa não encontrada.');
      const [photos, prices] = await Promise.all([
        read('bolsa_imagens', { select: '*', bolsa_id: 'eq.' + bag.id, order: 'principal.desc,ordem.asc' }),
        read('bolsa_precos', { select: '*', bolsa_id: 'eq.' + bag.id, ativo: 'eq.true', order: 'dias.asc' })
      ]);
      const plans = prices.filter(p => Number(p.dias) > 0 && Number(p.valor) > 0);
      window.tbrBolsa = { ...bag, imagem: safeUrl(photos[0]?.url) || '' };
      document.title = `${bag.nome} | Aluguel de bolsas | The Bag Room`;
      text('.tbr-product-brand', bag.marca || '');
      const model = String(bag.nome || '').replace(new RegExp('^' + String(bag.marca || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '');
      text('.info > .nome', model || bag.nome || '');
      text('.info > .preco', plans.length ? 'A partir de ' + money(Math.min(...plans.map(p => Number(p.valor)))) : 'Preço sob consulta');
      text('.tbr-caution > span', 'Caução de segurança: ' + money(bag.valor_caucao));
      const description = document.querySelector('.info .desc');
      if (description) {
        description.replaceChildren();
        const paragraph = document.createElement('p'); paragraph.textContent = bag.descricao || ''; paragraph.style.whiteSpace = 'pre-line'; description.appendChild(paragraph);
        const condition = document.createElement('p'); const strong = document.createElement('strong'); strong.textContent = 'Estado da bolsa: '; condition.append(strong, document.createTextNode(bag.estado || 'Não informado')); description.appendChild(condition);
        const details = document.createElement('div'); details.className = 'detalhes';
        [['Categoria',bag.categoria],['Material',bag.material],['Marca',bag.marca],['Cor',bag.cor],['Dimensões',bag.dimensoes],['Valor do caução',money(bag.valor_caucao)],['Valor em loja',bag.valor_loja == null ? 'Não informado' : money(bag.valor_loja)]].forEach(([label,value]) => {
          const row=document.createElement('p'); const title=document.createElement('strong'); title.textContent=label+': '; row.append(title,document.createTextNode(value || 'Não informado')); details.appendChild(row);
        }); description.appendChild(details);
      }
      const sliderNode = document.getElementById('slider');
      if (sliderNode) {
        sliderNode.replaceChildren();
        photos.forEach((photo, i) => {
          const url=safeUrl(photo.url); if (!url) return;
          const img=document.createElement('img'); img.src=url; img.alt=photo.alt || bag.nome || 'Bolsa'; img.loading=i ? 'lazy' : 'eager';
          img.addEventListener('click',()=> { if (typeof indexAtual !== 'undefined') indexAtual=i; if (typeof atualizarZoom==='function' && typeof zoomOverlay!=='undefined') { atualizarZoom(); zoomOverlay.style.display='flex'; } }); sliderNode.appendChild(img);
        });
        if (!sliderNode.children.length) { const note=document.createElement('p');note.textContent='Fotos em atualização.';sliderNode.appendChild(note); }
        if (typeof imagens !== 'undefined') imagens=sliderNode.querySelectorAll('img');
        if (typeof images !== 'undefined') images=sliderNode.querySelectorAll('img');
        if (typeof indexAtual !== 'undefined') indexAtual=0;
        document.querySelectorAll('.galeria .seta').forEach(arrow => { arrow.hidden=sliderNode.querySelectorAll('img').length < 2; });
        const dotsNode=document.getElementById('dots');
        if (dotsNode) { dotsNode.replaceChildren();sliderNode.querySelectorAll('img').forEach((_,i)=>{const dot=document.createElement('span');if(!i)dot.className='active';dotsNode.appendChild(dot);}); if(typeof dots!=='undefined') dots=dotsNode.querySelectorAll('span'); }
        text('.tbr-gallery-count', `1 / ${sliderNode.querySelectorAll('img').length}`);
      }
      const options=document.querySelector('.opcoes');
      if (options) {
        const selected=document.querySelector('input[name="dias"]:checked')?.value;
        options.replaceChildren();
        plans.forEach((plan,i)=> {
          const label=document.createElement('label');label.className='opcao';const radio=document.createElement('input');radio.type='radio';radio.name='dias';radio.value=plan.dias;radio.checked=plans.some(p=>String(p.dias)===selected) ? String(plan.dias)===selected : !i;
          if(radio.checked)label.classList.add('active');label.append(radio,document.createTextNode(`${plan.dias} dias • ${money(plan.valor)}`));
          radio.addEventListener('change',()=>{options.querySelectorAll('.opcao').forEach(el=>el.classList.toggle('active',el.contains(radio)));if(typeof atualizarDevolucao==='function')atualizarDevolucao();if(typeof atualizarTotal==='function')atualizarTotal();text('.tbr-mobile-rent > span',label.textContent);});options.appendChild(label);
        });
        text('.tbr-mobile-rent > span',options.querySelector('.active')?.textContent || 'Preço sob consulta');
      }
      const cert = safeUrl(bag.certificado_url);
      if (cert) document.querySelectorAll('.auth-selo-link,.tbr-certificate-link').forEach(link => { link.href=cert; });
      else if (Object.hasOwn(bag,'certificado_url') || new URLSearchParams(location.search).has('slug')) document.querySelectorAll('.auth-selo-link,.tbr-certificate-link').forEach(link=>link.remove());
      window.tbrProductReady=Boolean(bag.ativa && plans.length);
      status(!bag.ativa ? 'Esta bolsa está indisponível para aluguel.' : !plans.length ? 'Períodos de aluguel em atualização. Fale com a curadoria.' : '');
      document.dispatchEvent(new CustomEvent('tbr:bag-loaded',{detail:bag}));
    } catch (error) { console.error('Dados da bolsa:',error);status('Não foi possível carregar os dados atualizados. Recarregue a página ou fale com a curadoria.'); }
  }
  async function catalog() {
    if (!location.pathname.endsWith('/aluguel.html')) return;
    const grid=document.querySelector('.grid');if(!grid)return;
    try {
      const [bags,photos,prices]=await Promise.all([read('bolsas',{select:'*',ativa:'eq.true',order:'nome.asc'}),read('bolsa_imagens',{select:'*',order:'principal.desc,ordem.asc'}),read('bolsa_precos',{select:'*',ativo:'eq.true',order:'dias.asc'})]);
      const routes={};grid.querySelectorAll('.card').forEach(card=>{const url=new URL(card.href);routes[url.pathname.split('/').pop().replace('.html','')]=url.pathname;});
      grid.replaceChildren();
      bags.forEach(bag=>{
        const plans=prices.filter(p=>p.bolsa_id===bag.id && Number(p.valor)>0);if(!plans.length)return;
        const photo=photos.find(p=>p.bolsa_id===bag.id);const card=document.createElement('a');card.className='card';card.href=routes[bag.slug] || '/aluguel/bolsa.html?slug='+encodeURIComponent(bag.slug);card.dataset.slug=bag.slug;card.dataset.marca=bag.marca||'';card.dataset.cor=bag.cor||'';
        const box=document.createElement('div');box.className='img-box';const tag=document.createElement('span');tag.className='tag';tag.textContent='Para alugar';box.appendChild(tag);const image=document.createElement('img');image.alt=photo?.alt||bag.nome;image.loading='lazy';const src=safeUrl(photo?.url);if(src)image.src=src;box.appendChild(image);card.appendChild(box);
        const name=document.createElement('div');name.className='nome';const brand=document.createElement('span');brand.className='marca';brand.textContent=bag.marca||'';const model=document.createElement('span');model.className='modelo';model.textContent=bag.nome;name.append(brand,model);card.appendChild(name);
        const price=document.createElement('div');price.className='preco';card.dataset.price=Math.min(...plans.map(p=>Number(p.valor)));price.textContent='A partir de '+money(card.dataset.price);card.appendChild(price);
        const state=document.createElement('div');state.className='card-status';state.textContent='Confira datas disponíveis';const action=document.createElement('div');action.className='card-action';action.textContent='Alugar';card.append(state,action);grid.appendChild(card);
      });
      if(typeof aplicarFiltros==='function')aplicarFiltros();if(typeof atualizarContador==='function')atualizarContador();
      // Preserve the curated hero slots; refresh their bag data and dedicated images.
      document.querySelectorAll('.hero-feature-link').forEach(link=>{
        const slug=new URL(link.href).pathname.split('/').pop().replace('.html','');const bag=bags.find(b=>b.slug===slug);if(!bag){link.hidden=true;return;}
        const url=safeUrl(bag.imagem_destaque_url);const img=link.querySelector('img');if(img){if(url)img.src=url;img.alt=bag.nome;}
        const caption=link.querySelector('.hero-feature-caption');if(caption){caption.replaceChildren();caption.append(document.createTextNode(bag.marca||''));const span=document.createElement('span');span.textContent=bag.nome;caption.appendChild(span);}
      });
    } catch(error) { console.error('Catálogo:',error);const warning=document.createElement('p');warning.className='calendario-status error';warning.textContent='Não foi possível atualizar o catálogo. Recarregue a página.';grid.before(warning); }
  }
  product();catalog();
})();
