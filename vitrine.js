// Vitrine de aluguel: fundo em tom de pedra, grade 1 ou 2 bolsas por linha no celular,
// favoritas (coração, salvas no aparelho) e fotos que deslizam com o dedo.
(function () {
  const grid = document.querySelector('.grid');
  if (!grid) return;
  const cards = [...grid.querySelectorAll('a.card')];
  const LS_FAV = 'tbr-favoritas', LS_GRADE = 'tbr-grade-celular';
  const ler = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const slugDe = c => c.dataset.bolsaSlug || (c.getAttribute('href') || '').split('/').pop().replace('.html', '');

  const ICON_CORACAO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.6-4.6-7.6-10.1A4.2 4.2 0 0 1 12 7.7a4.2 4.2 0 0 1 7.6 2.5c0 5.5-7.6 10.1-7.6 10.1z"/></svg>';
  const ICON_1 = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="14" height="14"/></svg>';
  const ICON_2 = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3" width="6.5" height="14"/><rect x="11" y="3" width="6.5" height="14"/></svg>';

  // ---------- estilos ----------
  const st = document.createElement('style');
  st.textContent = `
body.tbr-catalog .grid .card .img-box{position:relative!important;background:#f6f4f0!important;border-radius:0!important}
.tbr-trilho{position:absolute;inset:0;display:flex;touch-action:pan-y;will-change:transform}
.tbr-trilho::-webkit-scrollbar{display:none}
.tbr-trilho>img{flex:0 0 100%;width:100%!important;height:100%!important;object-fit:cover!important;padding:0!important;min-height:0!important;-webkit-user-drag:none;user-select:none}
.tbr-pontos{position:absolute;left:0;right:0;bottom:12px;display:flex;justify-content:center;gap:6px;pointer-events:none;z-index:2}
.tbr-pontos i{display:block;width:16px;height:1.5px;background:rgba(26,23,20,.22);transition:background .25s}
.tbr-pontos i.on{background:#1a1714}
.tbr-fav{position:absolute;top:8px;right:8px;z-index:3;width:38px;height:38px;display:grid;place-items:center;border:0;background:transparent;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent}
.tbr-fav svg{width:20px;height:20px;fill:none;stroke:#1a1714;stroke-width:1.3;transition:transform .2s,fill .2s}
.tbr-fav[aria-pressed="true"] svg{fill:#1a1714}
.tbr-fav:active svg{transform:scale(.85)}
body.tbr-catalog .grid .card .tag{right:auto!important}
.tbr-vit-acoes{display:flex;align-items:center;gap:6px}
.tbr-btn-favs{display:inline-flex;align-items:center;gap:7px;min-height:42px;border:0!important;border-bottom:1px solid transparent!important;background:transparent!important;padding:0 2px!important;font:inherit;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--tbr-ink,#1a1714);cursor:pointer}
.tbr-btn-favs svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.4}
.tbr-btn-favs[aria-pressed="true"]{border-bottom-color:var(--tbr-ink,#1a1714)!important}
.tbr-btn-favs[aria-pressed="true"] svg{fill:currentColor}
.tbr-grade{display:none;gap:2px}
.tbr-grade button{width:34px;height:34px;display:grid;place-items:center;border:0!important;background:transparent!important;padding:0!important;cursor:pointer;opacity:.35}
.tbr-grade button[aria-pressed="true"]{opacity:1}
.tbr-grade svg{width:17px;height:17px;fill:none;stroke:#1a1714;stroke-width:1.3}
.grid.tbr-so-favs .card:not(.tbr-favorita){display:none!important}
.tbr-sem-favs{grid-column:1/-1;text-align:center;padding:50px 20px;color:var(--tbr-muted,#7a7268);font-size:14px}
@media(max-width:760px){
  .tbr-grade{display:inline-flex}
  .tbr-favs-txt{display:none}
  .tbr-btn-favs{letter-spacing:.04em;gap:4px;min-height:42px}
  .tbr-btn-favs svg{width:19px;height:19px}
  body.tbr-catalog .barra-filtros{display:flex!important;align-items:center!important;gap:14px!important}
  body.tbr-catalog .barra-filtros>button:first-child,body.tbr-catalog .barra-filtros>select{flex:1 1 0;min-width:0}
  .tbr-vit-acoes{flex:0 0 auto;gap:2px}
  .tbr-vit-acoes button{border-bottom:0!important}
  body.tbr-catalog .grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:26px 8px!important;padding:24px 8px 70px!important}
  body.tbr-grade-1.tbr-catalog .grid{grid-template-columns:minmax(0,1fr)!important;gap:40px!important;padding:24px 0 70px!important}
  body.tbr-catalog .grid .card{display:block!important;min-height:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;overflow:visible!important;padding:0!important}
  body.tbr-catalog .grid .card .img-box{width:100%!important;height:auto!important;min-height:0!important;aspect-ratio:4/5!important}
  body.tbr-catalog .grid .card .img-box img{min-height:0!important;padding:0!important;object-fit:cover!important}
  body.tbr-catalog .grid .card .nome{margin:12px 0 0!important;padding:0 6px!important;min-height:0!important;text-align:left!important;align-items:flex-start!important}
  body.tbr-catalog .grid .card .marca{font-size:17px!important;text-align:left!important}
  body.tbr-catalog .grid .card .modelo{font-size:10px!important;letter-spacing:.1em!important;text-align:left!important;margin-top:4px!important}
  body.tbr-catalog .grid .card .preco{margin:6px 0 0!important;padding:0 6px!important;font-size:12px!important;text-align:left!important}
  body.tbr-grade-1.tbr-catalog .grid .card .nome,body.tbr-grade-1.tbr-catalog .grid .card .preco{padding:0 18px!important}
  body.tbr-grade-1.tbr-catalog .grid .card .marca{font-size:22px!important}
  body.tbr-catalog .grid .card .img-hover{display:none!important}
  .tbr-fav{top:2px;right:2px}
}
@media(hover:hover) and (pointer:fine){ .tbr-pontos{display:none} }`;
  document.head.appendChild(st);

  // ---------- fotos deslizáveis ----------
  cards.forEach(card => {
    const box = card.querySelector('.img-box');
    const principal = box && box.querySelector('img:not(.img-hover)');
    const extras = (card.dataset.fotos || '').split('|').filter(Boolean).slice(0, 2); // no máximo 3 fotos por bolsa
    if (!box || !principal || !extras.length) return;
    const trilho = document.createElement('div');
    trilho.className = 'tbr-trilho';
    principal.before(trilho);
    trilho.appendChild(principal);
    extras.forEach(src => {
      const im = document.createElement('img');
      im.src = src + '?v=3'; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
      im.setAttribute('aria-hidden', 'true'); im.setAttribute('data-no-reveal', '');
      trilho.appendChild(im);
    });
    const pontos = document.createElement('div');
    pontos.className = 'tbr-pontos';
    pontos.innerHTML = Array.from({ length: extras.length + 1 }, (_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('');
    box.appendChild(pontos);
    // Deslizar com o dedo: a faixa de fotos acompanha o dedo (transform, mais fluido no iPhone)
    // e encaixa na foto seguinte ao soltar. Arrastar a foto não abre a bolsa.
    const total = extras.length + 1;
    let atual = 0, x0 = 0, y0 = 0, t0 = 0, eixo = '', moveu = false;
    const largura = () => box.clientWidth;
    const posicionar = (px, animar) => {
      trilho.style.transition = animar ? 'transform .38s cubic-bezier(.25,.8,.25,1)' : 'none';
      trilho.style.transform = `translate3d(${px}px,0,0)`;
    };
    const irPara = i => {
      atual = Math.max(0, Math.min(total - 1, i));
      posicionar(-atual * largura(), true);
      pontos.querySelectorAll('i').forEach((p, k) => p.classList.toggle('on', k === atual));
    };
    trilho.__irPara = irPara;
    trilho.addEventListener('touchstart', e => {
      const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); eixo = ''; moveu = false;
    }, { passive: true });
    trilho.addEventListener('touchmove', e => {
      const t = e.touches[0]; let dx = t.clientX - x0; const dy = t.clientY - y0;
      if (!eixo && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) eixo = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (eixo !== 'x') return;
      moveu = true;
      if (e.cancelable) e.preventDefault();
      if ((atual === 0 && dx > 0) || (atual === total - 1 && dx < 0)) dx *= 0.35; // resistência nas pontas
      posicionar(-atual * largura() + dx, false);
    }, { passive: false });
    const soltar = e => {
      if (eixo !== 'x') return;
      const dx = e.changedTouches[0].clientX - x0;
      const rapido = Math.abs(dx) / Math.max(1, Date.now() - t0) > 0.35; // passada rápida
      irPara(Math.abs(dx) > largura() * 0.15 || (rapido && Math.abs(dx) > 20) ? atual + (dx < 0 ? 1 : -1) : atual);
    };
    trilho.addEventListener('touchend', soltar, { passive: true });
    trilho.addEventListener('touchcancel', soltar, { passive: true });
    addEventListener('resize', () => posicionar(-atual * largura(), false));
    card.addEventListener('click', e => { if (moveu) { e.preventDefault(); e.stopPropagation(); moveu = false; } }, true);
  });

  // ---------- favoritas ----------
  let favs = new Set(ler(LS_FAV, []));
  const marcar = card => {
    const on = favs.has(slugDe(card));
    card.classList.toggle('tbr-favorita', on);
    const b = card.querySelector('.tbr-fav');
    if (b) { b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Remover das favoritas' : 'Salvar nas favoritas'); }
  };
  cards.forEach(card => {
    const box = card.querySelector('.img-box'); if (!box) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tbr-fav'; b.innerHTML = ICON_CORACAO;
    b.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const s = slugDe(card);
      favs.has(s) ? favs.delete(s) : favs.add(s);
      gravar(LS_FAV, [...favs]); marcar(card); atualizarBotaoFavs();
    });
    box.appendChild(b); marcar(card);
  });

  // ---------- barra: favoritas + grade ----------
  const barra = document.querySelector('.barra-filtros');
  const acoes = document.createElement('div');
  acoes.className = 'tbr-vit-acoes';
  acoes.innerHTML = `<button type="button" class="tbr-btn-favs" aria-pressed="false">${ICON_CORACAO}<span class="tbr-favs-txt">Favoritas</span><span class="tbr-favs-n"></span></button>
    <div class="tbr-grade" role="group" aria-label="Bolsas por linha"><button type="button" data-g="1" aria-label="Uma bolsa por linha">${ICON_1}</button><button type="button" data-g="2" aria-label="Duas bolsas por linha">${ICON_2}</button></div>`;
  if (barra) barra.appendChild(acoes);
  const btnFavs = acoes.querySelector('.tbr-btn-favs');
  let vazio = null;
  function atualizarBotaoFavs() {
    const n = favs.size;
    btnFavs.querySelector('.tbr-favs-n').textContent = n ? `(${n})` : '';
    const so = grid.classList.contains('tbr-so-favs');
    if (so && !n) {
      if (!vazio) { vazio = document.createElement('p'); vazio.className = 'tbr-sem-favs'; vazio.textContent = 'Toque no coração das bolsas para salvá-las aqui.'; }
      grid.prepend(vazio);
    } else if (vazio) vazio.remove();
  }
  btnFavs.addEventListener('click', () => {
    const on = !grid.classList.contains('tbr-so-favs');
    grid.classList.toggle('tbr-so-favs', on);
    btnFavs.setAttribute('aria-pressed', on);
    atualizarBotaoFavs();
    grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  atualizarBotaoFavs();

  const aplicarGrade = g => {
    document.body.classList.toggle('tbr-grade-1', g === 1);
    acoes.querySelectorAll('.tbr-grade button').forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.g) === g));
    cards.forEach(c => { const t = c.querySelector('.tbr-trilho'); if (t && t.__irPara) t.__irPara(0); });
  };
  acoes.querySelectorAll('.tbr-grade button').forEach(b => b.addEventListener('click', () => { const g = Number(b.dataset.g); gravar(LS_GRADE, g); aplicarGrade(g); }));
  aplicarGrade(ler(LS_GRADE, 2) === 1 ? 1 : 2);
})();
