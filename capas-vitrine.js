// Fotos da vitrine (fundo pedra, bolsa centralizada) por slug, lidas do próprio aluguel.html.
// Assim as miniaturas de Minha conta e da página de avaliação seguem o mesmo padrão da vitrine
// sem precisar de outra lista para manter. Uso: const capas = await window.tbrCapasVitrine();
(function () {
  let promessa = null;
  window.tbrCapasVitrine = function () {
    if (promessa) return promessa;
    promessa = fetch('/aluguel.html', { credentials: 'omit' })
      .then(r => r.ok ? r.text() : '')
      .then(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const capas = {};
        doc.querySelectorAll('.grid a.card').forEach(card => {
          const slug = card.dataset.bolsaSlug || (card.getAttribute('href') || '').split('/').pop().replace('.html', '');
          const img = card.querySelector('.img-box img:not(.img-hover)');
          const src = img && img.getAttribute('src');
          if (slug && src && src.startsWith('/img/')) capas[slug] = src;
        });
        return capas;
      })
      .catch(() => ({}));
    return promessa;
  };
})();
