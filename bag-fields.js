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
  // Corrige a grafia de marcas cadastradas sem acento/com erro (o filtro e a vitrine usam o nome oficial)
  const BRAND_FIX = { 'hermes':'Hermès', 'carolina herreira':'Carolina Herrera' };
  function brand(bag) { const raw = String(bag.marca || '').trim(); return BRAND_FIX[raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()] || raw; }
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
  // "A partir de R$ 390 · 4 dias": deixa claro por quanto tempo é o menor preço
  function priceLabel(plans) {
    if (!plans.length) return 'Preço sob consulta';
    const best = plans.reduce((a, b) => Number(b.valor) < Number(a.valor) ? b : a);
    return 'A partir de ' + currency(best.valor) + ' · ' + Number(best.dias) + ' dias';
  }
  async function homeCards() {
    const cards = document.querySelectorAll('.week-card, .tbr-h-card');
    if (!cards.length) return;
    try {
      const [bags, rows] = await Promise.all([read('bolsas', { select: 'id,slug' }), read('bolsa_precos', { select: 'bolsa_id,dias,valor,ativo', ativo: 'eq.true' })]);
      cards.forEach(card => {
        const slug = (card.getAttribute('href') || '').split('/').pop().replace('.html', '');
        const bag = bags.find(row => row.slug === slug); if (!bag) return;
        const plans = validPlans(rows.filter(row => row.bolsa_id === bag.id));
        if (plans.length) text('.week-price', priceLabel(plans), card);
      });
    } catch (error) { console.error('Preços da página inicial:', error); }
    finally { mostrar(); }
  }
  // Avaliações aprovadas pela curadoria (e autorizadas pela cliente): aparecem na página e viram estrelas no Google
  async function reviews(bag) {
    let rows;
    try { rows = await read('avaliacoes', { select: 'nota,comentario,nome_exibicao,created_at', bolsa_id: 'eq.' + bag.id, order: 'created_at.desc', limit: '50' }); }
    catch (error) { console.warn('Avaliações indisponíveis:', error); return; }
    rows = (rows || []).filter(row => Number(row.nota) >= 1 && Number(row.nota) <= 5);
    if (!rows.length) return;
    const average = rows.reduce((sum, row) => sum + Number(row.nota), 0) / rows.length;
    const averageText = average.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const stars = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
    const date = value => { const d = new Date(value); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); };
    if (!document.getElementById('tbr-reviews-style')) {
      const style = document.createElement('style'); style.id = 'tbr-reviews-style';
      style.textContent = '.tbr-reviews{max-width:1100px;margin:56px auto 0;padding:0 20px;font-family:Inter,Arial,sans-serif;color:#111}'
        + '.tbr-reviews h2{font-family:"DM Serif Display",Georgia,serif;font-weight:400;font-size:26px;margin:0 0 6px}'
        + '.tbr-reviews-summary{display:flex;align-items:baseline;gap:10px;font-size:14px;color:#555;margin-bottom:22px}'
        + '.tbr-reviews-summary strong{font-family:"DM Serif Display",Georgia,serif;font-weight:400;font-size:30px;color:#111}'
        + '.tbr-stars{color:#a8824b;letter-spacing:2px}'
        + '.tbr-review{border-top:1px solid #eaeaea;padding:18px 0}'
        + '.tbr-review p{margin:8px 0 0;color:#555;line-height:1.7;font-size:15px;white-space:pre-line}'
        + '.tbr-review-meta{font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#777}';
      document.head.appendChild(style);
    }
    const section = document.createElement('section'); section.className = 'tbr-reviews'; section.setAttribute('aria-label', 'Avaliações das clientes');
    const title = document.createElement('h2'); title.textContent = 'Avaliações das clientes';
    const summary = document.createElement('div'); summary.className = 'tbr-reviews-summary';
    const big = document.createElement('strong'); big.textContent = averageText;
    const summaryStars = document.createElement('span'); summaryStars.className = 'tbr-stars'; summaryStars.textContent = stars(average); summaryStars.setAttribute('aria-hidden', 'true');
    const count = document.createElement('span'); count.textContent = rows.length === 1 ? '1 avaliação' : rows.length + ' avaliações';
    summary.append(big, summaryStars, count);
    section.append(title, summary);
    rows.forEach(row => {
      const item = document.createElement('article'); item.className = 'tbr-review';
      const head = document.createElement('div');
      const itemStars = document.createElement('span'); itemStars.className = 'tbr-stars'; itemStars.textContent = stars(row.nota); itemStars.setAttribute('aria-label', row.nota + ' de 5 estrelas');
      const meta = document.createElement('div'); meta.className = 'tbr-review-meta'; meta.textContent = [row.nome_exibicao || 'Cliente The Bag Room', date(row.created_at)].filter(Boolean).join(' · ');
      head.append(itemStars, meta); item.appendChild(head);
      if (row.comentario) { const body = document.createElement('p'); body.textContent = row.comentario; item.appendChild(body); }
      section.appendChild(item);
    });
    (document.querySelector('.produto') || document.querySelector('.info'))?.after(section);
    const ld = document.getElementById('tbr-product-ld');
    if (ld) {
      try {
        const data = JSON.parse(ld.textContent);
        data.aggregateRating = { '@type': 'AggregateRating', ratingValue: average.toFixed(1), reviewCount: rows.length, bestRating: 5, worstRating: 1 };
        data.review = rows.slice(0, 10).map(row => ({
          '@type': 'Review',
          reviewRating: { '@type': 'Rating', ratingValue: Number(row.nota), bestRating: 5, worstRating: 1 },
          author: { '@type': 'Person', name: row.nome_exibicao || 'Cliente The Bag Room' },
          datePublished: String(row.created_at || '').slice(0, 10) || undefined,
          reviewBody: row.comentario || undefined
        }));
        ld.textContent = JSON.stringify(data);
      } catch (_) {}
    }
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
      text('.tbr-product-brand', brand(bag));
      text('.info > .nome', model(bag));
      if (bag.nome) {
        const minPrice = plans.length ? Math.min(...plans.map(p => Number(p.valor))) : 0;
        document.title = bag.nome + (minPrice > 0 ? ' | Aluguel a partir de ' + currency(minPrice) : ' | Aluguel de bolsas') + ' | The Bag Room';
      }
      const ld=document.getElementById('tbr-product-ld');
      if(ld){try{const data=JSON.parse(ld.textContent);data.name=bag.nome||data.name;if(bag.marca)data.brand={'@type':'Brand',name:brand(bag)};if(bag.descricao)data.description=bag.descricao;
        if(plans.length){data.offers.price=Math.min(...plans.map(p=>Number(p.valor))).toFixed(2);}
        data.offers.availability='https://schema.org/'+(bag.ativa===false?'OutOfStock':'InStock');ld.textContent=JSON.stringify(data);}catch(e){}}
      reviews(bag);
      const paragraph = document.querySelector('.info .desc > p');
      if (paragraph && bag.descricao != null) paragraph.textContent = bag.descricao;
      [['estado da bolsa',bag.estado],['categoria',bag.categoria],['material',bag.material],['marca',brand(bag)],['cor',bag.cor],['dimensões',bag.dimensoes]].forEach(([label,value]) => detail(label,value));
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
    finally { mostrar(); }
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
        text('.marca',brand(bag),card); text('.modelo',model(bag),card);
        const cover=safeImage(photoConfigs.find(config=>config.id===bag.id)?.imagem_capa_url);
        if(cover){const img=card.querySelector('.img-box img');if(img){
          // Mantém a versão reduzida quando é a mesma foto
          const id=u=>{const m=String(u).match(/(?:i\.imgur\.com|\/img\/fotos|\/img\/vitrine)\/([A-Za-z0-9]{7})[a-z]?\./);return m?m[1]:u;};
          if(id(img.src)!==id(cover))img.src=cover;img.alt=bag.nome;}}
        card.dataset.marca = brand(bag); card.dataset.cor = bag.cor || '';
        card.dataset.price = plans.length ? Math.min(...plans.map(p => Number(p.valor))) : '';
        text('.preco',priceLabel(plans),card);
      });
      if (typeof aplicarFiltros === 'function') aplicarFiltros();
    } catch (error) { console.error('Atualização dos campos do catálogo:',error); }
    finally { mostrar(); }
  }
  // As páginas escondem preços até o banco responder (classe colocada no <head>), para não piscar valor antigo
  const mostrar = () => document.documentElement.classList.remove('tbr-carregando');
  function start() { product(); catalog(); homeCards(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
