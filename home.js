// Página inicial: busca e WhatsApp no cabeçalho, carrossel das maisons.
(function () {
  const ICON_SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.3"/></svg>';
  const ICON_WA = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-3.8A8 8 0 1 1 8 19z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';

  function cabecalho() {
    const left = document.querySelector('.site-header .tbr-head-left');
    if (left && !left.querySelector('.tbr-search')) {
      left.innerHTML = `<form class="tbr-search" action="/aluguel.html" method="get" role="search">${ICON_SEARCH}<label for="tbrBusca">Pesquisar bolsas</label><input id="tbrBusca" name="busca" type="search" placeholder="Pesquisar" autocomplete="off"></form>`;
    }
    const right = document.querySelector('.site-header .tbr-head-right');
    if (right && !right.querySelector('.tbr-wa')) {
      const wa = document.createElement('a');
      wa.className = 'tbr-wa';
      wa.href = 'https://wa.me/5513996904227';
      wa.target = '_blank';
      wa.rel = 'noopener';
      wa.setAttribute('aria-label', 'Falar com a curadoria pelo WhatsApp');
      wa.innerHTML = ICON_WA;
      right.appendChild(wa);
    }
  }

  function carrossel(nav) {
    const track = document.getElementById(nav.dataset.carouselNav);
    if (!track) return;
    const cards = [...track.children];
    const count = nav.querySelector('.tbr-m-count');
    const [prev, next] = nav.querySelectorAll('.tbr-m-arrow');
    const porPagina = () => Math.max(1, Math.round(track.clientWidth / (cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth)));
    const atualizar = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      const paginas = Math.max(1, Math.ceil(cards.length / porPagina()));
      const atual = track.scrollLeft >= max ? paginas : Math.min(paginas, Math.round(track.scrollLeft / track.clientWidth) + 1);
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max;
      if (count) { count.querySelector('b').textContent = atual; count.querySelector('i').textContent = paginas; }
      nav.hidden = paginas < 2;
    };
    nav.querySelectorAll('.tbr-m-arrow').forEach(btn => btn.addEventListener('click', () => {
      track.scrollBy({ left: Number(btn.dataset.dir) * track.clientWidth, behavior: 'smooth' });
    }));
    track.addEventListener('scroll', () => requestAnimationFrame(atualizar), { passive: true });
    addEventListener('resize', atualizar);
    atualizar();
  }

  function iniciar() {
    cabecalho();
    document.querySelectorAll('[data-carousel-nav]').forEach(carrossel);
  }
  // O cabeçalho é montado pelo luxury-refresh.js; este arquivo roda depois (defer)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
