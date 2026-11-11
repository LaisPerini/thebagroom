// "‹ Anterior   Próxima ›" abaixo das fotos (sem mostrar o total de bolsas), na página da bolsa.
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
@media(max-width:700px){.tbr-bagnav{margin:-6px 0 18px;padding:0 4px;max-width:none}}
.info>.tbr-bagnav{margin:0 0 26px;max-width:none}`;
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
    nav.innerHTML = `<a href="${ant.href}" rel="prev">‹ Anterior</a><a href="${prox.href}" rel="next">Próxima ›</a>`;
    const galeria = document.querySelector('.galeria');
    if (!galeria) return;
    // Celular: abaixo das fotos (fora da galeria, que corta o que passa da altura).
    // Computador: no topo da coluna de informações, que fica fixa ao lado das fotos.
    const pc = matchMedia('(min-width: 1024px)');
    const posicionar = () => {
      const info = document.querySelector('.produto > .info');
      if (pc.matches && info) info.prepend(nav); else galeria.after(nav);
    };
    posicionar();
    pc.addEventListener?.('change', posicionar);
    [prox, ant].forEach(b => { const l = document.createElement('link'); l.rel = 'prefetch'; l.href = b.href; document.head.appendChild(l); });
    arrastar(d => { location.href = (d > 0 ? prox : ant).href; });
  }

  // Computador: contador discreto "1/3" ao lado das fotos, que ficam uma embaixo da outra.
  function contador() {
    const galeria = document.querySelector('.galeria');
    if (!galeria) return;
    const box = document.createElement('div');
    box.className = 'tbr-photo-count';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<span></span>';
    galeria.before(box);
    const texto = box.firstChild;
    let pendente = false;
    const atualizar = () => {
      pendente = false;
      const fotos = [...galeria.querySelectorAll('#slider img')];
      if (fotos.length < 2) { texto.textContent = ''; return; }
      const meio = innerHeight / 2;
      let atual = 0, menor = Infinity;
      fotos.forEach((f, i) => { const r = f.getBoundingClientRect(); const d = Math.abs((r.top + r.bottom) / 2 - meio); if (d < menor) { menor = d; atual = i; } });
      texto.textContent = `${atual + 1}/${fotos.length}`;
    };
    addEventListener('scroll', () => { if (!pendente) { pendente = true; requestAnimationFrame(atualizar); } }, { passive: true });
    addEventListener('resize', atualizar);
    setTimeout(atualizar, 300); setTimeout(atualizar, 2500); // fotos podem chegar depois (página dinâmica)
  }

  // Computador: a coluna de informações acompanha as fotos. Se for mais alta que a tela,
  // ela rola junto até o botão aparecer e só então fica parada (o botão nunca some).
  function colunaFixa() {
    const info = document.querySelector('.produto > .info');
    if (!info) return;
    const pc = matchMedia('(min-width: 1024px)');
    const ajustar = () => {
      if (pc.matches) info.style.setProperty('top', Math.min(126, innerHeight - info.offsetHeight - 24) + 'px', 'important');
      else info.style.removeProperty('top');
    };
    ajustar();
    if ('ResizeObserver' in window) new ResizeObserver(ajustar).observe(info);
    addEventListener('resize', ajustar);
  }

  const iniciar = () => { contador(); colunaFixa(); montar(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
