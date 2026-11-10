// Página inicial: busca e WhatsApp no cabeçalho, carrossel das maisons.
(function () {
  const ICON_SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.3"/></svg>';

  function cabecalho() {
    const left = document.querySelector('.site-header .tbr-head-left');
    if (left && !left.querySelector('.tbr-search')) {
      left.innerHTML = `<form class="tbr-search" action="/aluguel.html" method="get" role="search">${ICON_SEARCH}<label for="tbrBusca">Pesquisar bolsas</label><input id="tbrBusca" name="busca" type="search" placeholder="Pesquisar" autocomplete="off"></form>`;
    }
    // Topo igual às outras páginas: só sacola e Minha conta (o WhatsApp fica no botão flutuante)
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

  // Vídeo de abertura: garante que toque sozinho. Alguns celulares (ex.: iPhone em modo
  // economia de bateria) bloqueiam o início automático; aí tentamos de novo assim que a
  // cliente toca, rola ou volta para a aba.
  function videoAbertura() {
    const v = document.querySelector('.hero-video');
    if (!v) return;
    v.muted = true; v.defaultMuted = true; v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    const tocar = () => { if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } };
    tocar();
    ['loadedmetadata', 'canplay'].forEach(ev => v.addEventListener(ev, tocar));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tocar(); });
    const gesto = () => { tocar(); if (!v.paused) ['touchstart', 'touchend', 'pointerup', 'click', 'scroll', 'keydown'].forEach(ev => removeEventListener(ev, gesto)); };
    ['touchstart', 'touchend', 'pointerup', 'click', 'scroll', 'keydown'].forEach(ev => addEventListener(ev, gesto, { passive: true }));
    // Se sair da tela e voltar, continua tocando
    if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) tocar(); })).observe(v);
  }

  function iniciar() {
    videoAbertura();
    cabecalho();
    document.querySelectorAll('[data-carousel-nav]').forEach(carrossel);
  }
  // O cabeçalho é montado pelo luxury-refresh.js; este arquivo roda depois (defer)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
