(function () {
  'use strict';
  const original=window.carregarGA4;
  function groupPages(rows) {
    const totals=new Map();
    for(const row of rows||[]){const path=String(row.pagePath||row.pageTitle||'Página sem identificação');const views=Number(row.screenPageViews||0);if(Number.isFinite(views)&&views>=0)totals.set(path,(totals.get(path)||0)+views);}
    return [...totals].map(([path,views])=>({path,views})).sort((a,b)=>b.views-a.views);
  }
  function render() {
    const root=document.getElementById('gaContent');if(!root?.querySelector('.ga-grid')||!ga4Data)return;
    root.querySelector(':scope > .service-state')?.remove();
    const section=document.createElement('section');section.style.marginTop='24px';
    const title=document.createElement('h3');title.textContent='Visualizações por página';
    const note=document.createElement('p');note.className='message';note.textContent='Últimos 30 dias · visualizações, não usuários únicos.';
    const search=document.createElement('input');search.type='search';search.placeholder='Buscar página';search.setAttribute('aria-label','Buscar página no Google Analytics');search.style.cssText='width:100%;margin:10px 0 16px;';
    const list=document.createElement('div'),pagination=document.createElement('div');pagination.className='actions';pagination.style.marginTop='16px';
    const previous=document.createElement('button'),next=document.createElement('button'),label=document.createElement('span');
    for(const button of [previous,next]){button.type='button';button.className='btn secondary small';}
    previous.textContent='Anterior';next.textContent='Próxima';pagination.append(previous,label,next);
    section.append(title,note,search,list,pagination);root.appendChild(section);
    const all=groupPages(ga4Data.topPages);let page=0;
    function draw(){
      const filtered=all.filter(row=>row.path.toLowerCase().includes(search.value.trim().toLowerCase()));
      page=Math.min(page,Math.max(0,Math.ceil(filtered.length/20)-1));list.replaceChildren();
      const maximum=Math.max(1,...all.map(row=>row.views));
      filtered.slice(page*20,page*20+20).forEach(row=>{
        const item=document.createElement('div');item.style.cssText='padding:10px 0;border-bottom:1px solid #eee;';
        const heading=document.createElement('div');heading.style.cssText='display:flex;gap:12px;justify-content:space-between;align-items:baseline;';
        const path=document.createElement('span');path.textContent=row.path;path.style.cssText='font-size:12px;overflow-wrap:anywhere;min-width:0;';
        const count=document.createElement('strong');count.textContent=row.views.toLocaleString('pt-BR');count.style.whiteSpace='nowrap';heading.append(path,count);
        const track=document.createElement('div');track.style.cssText='height:5px;background:#eee;margin-top:7px;';const bar=document.createElement('div');bar.style.cssText='height:5px;background:#a8824b;width:'+Math.max(0,row.views/maximum*100)+'%;';track.appendChild(bar);item.append(heading,track);list.appendChild(item);
      });
      if(!filtered.length){const empty=document.createElement('p');empty.textContent='Nenhuma página encontrada.';list.appendChild(empty);}
      label.textContent=filtered.length?((page*20+1)+'–'+Math.min((page+1)*20,filtered.length)+' de '+filtered.length+' páginas'):'0 páginas';previous.disabled=page===0;next.disabled=(page+1)*20>=filtered.length;
      if(Number(ga4Data.pagesTotal)>all.length)note.textContent='Últimos 30 dias · exibindo '+all.length+' de '+ga4Data.pagesTotal+' páginas retornadas pelo GA4.';
    }
    search.addEventListener('input',()=>{page=0;draw();});previous.addEventListener('click',()=>{page--;draw();});next.addEventListener('click',()=>{page++;draw();});draw();
  }
  window.carregarGA4=async function(){await original.apply(this,arguments);render();};
})();
