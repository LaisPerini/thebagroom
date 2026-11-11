// "‹ Anterior · 3 de 29 · Próxima ›" abaixo das fotos, na página da bolsa.
// Ordem: a mesma da vitrine (aluguel.html), só com bolsas ativas; volta ao início no fim.
// No celular também troca de bolsa arrastando para o lado (fora das fotos e dos campos).
(function () {
  'use strict';
  if (!document.querySelector('.produto')) return;
  const API = 'https://zpyjnqkrsmgpwszqlcrs.supabase.co/rest/v1/';
  const KEY = 'sb_publishable_48rLPZfPRNtRX1kpYm0aWg_aVI1Hi2b';
  const slugDe = href => (href || '').split('?')[0].split('#')[0].split('/').pop().replace('.html', '');
  const atual = typeof BOLSA_SLUG !== 'undefined' ? BOLSA_SLUG
    : (new URLSearchParams(location.search).get('slug') || slugDe(location.pathname));

  function memo(k, v) {
    try {
      if (v === undefined) { const s = JSON.parse(sessionStorage.getItem(k) || 'null'); return s && Date.now() - s.t < 6e5 ? s.v : null; }
      sessionStorage.setItem(k, JSON.stringify({ t: Date.now(), v }));
    } catch (e) { return null; }
  }

  async function lista() {
    const salva = memo('tbr-nav-bolsas');
    if (salva) return salva;
    const [html, ativas] = await Promise.all([
      fetch('/aluguel.html', { credentials: 'omit' }).then(r => r.ok ? r.text() : '').catch(() => ''),
      fetch(API + 'bolsas?select=slug&ativa=eq.true', { headers: { apikey: KEY } }).then(r => r.ok ? r.json() : []).catch(() => [])
    ]);
    if (!html || !ativas.length) return [];
    const ok = new Set(ativas.map(b => b.slug));
    const vistos = new Set();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const itens = [...doc.querySelectorAll('.grid a.card')].map(a => {
      const href = a.getAttribute('href') || '';
      return { slug: a.dataset.bolsaSlug || slugDe(href), href: href.replace(/^https?:\/\/[^/]+/, '') };
    }).filter(i => i.slug && i.href && ok.has(i.slug) && !vistos.has(i.slug) && vistos.add(i.slug));
    memo('tbr-nav-bolsas', itens);
    return itens;
  }

  function css() {
    const st = document.createElement('style');
    st.textContent = `
.tbr-bagnav{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:-4px auto 22px;max-width:420px;font:500 11px/1 Inter,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase}
.tbr-bagnav a{color:#1a1714;text-decoration:none;padding:10px 2px;border-bottom:1px solid transparent;transition:border-color .25s ease,opacity .25s ease;white-space:nowrap}
.tbr-bagnav a:hover{border-bottom-color:#1a1714}
.tbr-bagnav a:focus-visible{outline:1px solid #1a1714;outline-offset:4px}
.tbr-bagnav span{color:#9a9188;letter-spacing:.1em}
@media(max-width:700px){.tbr-bagnav{margin:-6px 0 18px;padding:0 4px;max-width:none}}`;
    document.head.appendChild(st);
  }

  function arrastar(ir) {
    if (!('ontouchstart' in window)) return;
    const ignorar = '.galeria, input, textarea, select, button, label, .opcoes, .flatpickr-calendar, .video-modal, .tbr-rec-grid, [data-no-swipe]';
    let x0 = 0, y0 = 0, t0 = 0, valido = false;
    document.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) { valido = false; return; }
      valido = !e.target.closest(ignorar);
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
    }, { passive: true });
    document.addEventListener('touchend', e => {
      if (!valido) return;
      valido = false;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 90 && Math.abs(dy) < Math.abs(dx) / 3 && Date.now() - t0 < 700) ir(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  async function montar() {
    const itens = await lista();
    const i = itens.findIndex(b => b.slug === atual);
    if (i < 0 || itens.length < 2) return;
    const ant = itens[(i - 1 + itens.length) % itens.length];
    const prox = itens[(i + 1) % itens.length];
    css();
    const nav = document.createElement('nav');
    nav.className = 'tbr-bagnav';
    nav.setAttribute('aria-label', 'Navegar entre as bolsas');
    nav.innerHTML = `<a href="${ant.href}" rel="prev">‹ Anterior</a><span>${i + 1} de ${itens.length}</span><a href="${prox.href}" rel="next">Próxima ›</a>`;
    const galeria = document.querySelector('.galeria');
    if (!galeria) return;
    galeria.after(nav); // fora da galeria, que corta o que passa da altura das fotos
    [prox, ant].forEach(b => { const l = document.createElement('link'); l.rel = 'prefetch'; l.href = b.href; document.head.appendChild(l); });
    arrastar(d => { location.href = (d > 0 ? prox : ant).href; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
