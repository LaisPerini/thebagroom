// "Você também pode gostar": 4 bolsas parecidas no fim da página da bolsa.
// Critério: primeiro a mesma marca, depois as de preço mais próximo; só bolsas ativas.
// Fotos e nomes vêm dos cards da vitrine (aluguel.html); preços e disponibilidade, do banco.
(function () {
  'use strict';
  if (typeof BOLSA_SLUG === 'undefined' || !document.querySelector('.produto')) return;
  const API = 'https://zpyjnqkrsmgpwszqlcrs.supabase.co/rest/v1/';
  const KEY = 'sb_publishable_48rLPZfPRNtRX1kpYm0aWg_aVI1Hi2b';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const ler = q => fetch(API + q, { headers: { apikey: KEY }, cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []);
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  async function vitrine() {
    try {
      const html = await (await fetch('/aluguel.html', { credentials: 'omit' })).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return [...doc.querySelectorAll('.grid a.card')].map(card => {
        const slug = card.dataset.bolsaSlug || (card.getAttribute('href') || '').split('/').pop().replace('.html', '');
        const img = card.querySelector('.img-box img:not(.img-hover)');
        return {
          slug,
          marca: card.querySelector('.marca')?.textContent.trim() || card.dataset.marca || '',
          modelo: card.querySelector('.modelo')?.textContent.trim() || '',
          img: img?.getAttribute('src') || '',
          hover: card.querySelector('.img-hover')?.getAttribute('src') || ''
        };
      }).filter(c => c.slug && c.img);
    } catch (e) { return []; }
  }

  function css() {
    const st = document.createElement('style');
    st.textContent = `
.tbr-rec{max-width:1280px;margin:0 auto;padding:72px 40px 24px;border-top:1px solid #e7e1d8}
.tbr-rec h2{margin:0 0 32px;text-align:center;font:400 34px/1.1 "DM Serif Display",Georgia,serif;color:#1a1714}
.tbr-rec-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}
.tbr-rec a{display:block;color:#1a1714;text-decoration:none}
.tbr-rec-img{position:relative;display:block;aspect-ratio:4/5;background:#f6f4f0;overflow:hidden}
.tbr-rec-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity .45s ease,transform .6s ease}
.tbr-rec-img img+img{opacity:0}
@media(hover:hover){.tbr-rec a:hover .tbr-rec-img img+img{opacity:1}.tbr-rec a:hover .tbr-rec-img img:only-child{transform:scale(1.025)}}
.tbr-rec-marca{display:block;margin-top:14px;font:400 20px/1.2 "DM Serif Display",Georgia,serif}
.tbr-rec-modelo{display:block;margin-top:3px;font:500 11px/1.45 Inter,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#7a7268}
.tbr-rec-preco{display:block;margin-top:6px;font:400 13px/1.4 Inter,Arial,sans-serif;color:#7a7268}
@media(max-width:760px){
  .tbr-rec{padding:48px 0 12px}
  .tbr-rec h2{font-size:27px;margin-bottom:22px;padding:0 16px}
  .tbr-rec-grid{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 16px 6px;scroll-padding:0 16px;scrollbar-width:none}
  .tbr-rec-grid::-webkit-scrollbar{display:none}
  .tbr-rec-grid a{flex:0 0 62%;scroll-snap-align:start}
  .tbr-rec-marca{font-size:19px}
}`;
    document.head.appendChild(st);
  }

  async function montar() {
    const [cards, bolsas, precos] = await Promise.all([
      vitrine(),
      ler('bolsas?select=id,slug,marca,ativa'),
      ler('bolsa_precos?select=bolsa_id,valor&ativo=eq.true')
    ]);
    if (!cards.length || !bolsas.length) return;
    const minimo = {};
    precos.forEach(p => { const v = Number(p.valor); if (v > 0 && (!minimo[p.bolsa_id] || v < minimo[p.bolsa_id])) minimo[p.bolsa_id] = v; });
    const porSlug = Object.fromEntries(bolsas.map(b => [b.slug, b]));
    const atual = porSlug[BOLSA_SLUG];
    const cardAtual = cards.find(c => c.slug === BOLSA_SLUG);
    const marcaAtual = norm(atual?.marca || cardAtual?.marca);
    const precoAtual = atual ? minimo[atual.id] || 0 : 0;
    const vistos = new Set();
    const candidatas = cards.filter(c => {
      const b = porSlug[c.slug];
      if (!b || b.ativa === false || c.slug === BOLSA_SLUG || vistos.has(c.slug) || !minimo[b.id]) return false;
      vistos.add(c.slug); return true;
    }).map(c => ({ ...c, preco: minimo[porSlug[c.slug].id], mesma: norm(c.marca) === marcaAtual || norm(porSlug[c.slug].marca) === marcaAtual }));
    const ordem = (a, b) => (b.mesma - a.mesma) || (Math.abs(a.preco - precoAtual) - Math.abs(b.preco - precoAtual));
    const escolhidas = candidatas.sort(ordem).slice(0, 4);
    if (escolhidas.length < 2) return;

    css();
    const sec = document.createElement('section');
    sec.className = 'tbr-rec';
    sec.setAttribute('aria-labelledby', 'tbrRecTitulo');
    sec.innerHTML = `<h2 id="tbrRecTitulo">Você também pode gostar</h2><div class="tbr-rec-grid">${escolhidas.map(c => `
      <a href="/aluguel/${encodeURIComponent(c.slug)}.html">
        <span class="tbr-rec-img"><img src="${esc(c.img)}" alt="Bolsa ${esc(c.marca)} ${esc(c.modelo)}" loading="lazy" decoding="async">${c.hover ? `<img src="${esc(c.hover)}" alt="" aria-hidden="true" loading="lazy" decoding="async">` : ''}</span>
        <span class="tbr-rec-marca">${esc(c.marca)}</span>
        <span class="tbr-rec-modelo">${esc(c.modelo)}</span>
        <span class="tbr-rec-preco">A partir de ${brl(c.preco)}</span>
      </a>`).join('')}</div>`;
    document.querySelector('.produto').after(sec);
  }

  const iniciar = () => { montar().catch(e => console.warn('Recomendações indisponíveis', e)); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
