// Medidor de estado da peça nas páginas das bolsas.
// Lê o parágrafo "Estado da bolsa: ..." (do HTML ou atualizado pelo banco) e mostra uma
// escala Novo → Regular com o nível da bolsa marcado e os detalhes logo abaixo.
(function () {
  const NIVEIS = [
    { nome: 'Novo', texto: 'Nunca usada, com etiquetas ou embalagem original.' },
    { nome: 'Excelente', texto: 'Pouquíssimos sinais de uso, perceptíveis apenas de perto.' },
    { nome: 'Muito bom', texto: 'Leves sinais de uso que não afetam a aparência da peça.' },
    { nome: 'Bom', texto: 'Sinais de uso visíveis, como marcas no couro ou nas ferragens.' },
    { nome: 'Regular', texto: 'Sinais de uso evidentes, considerados no valor do aluguel.' }
  ];
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  function nivel(texto) {
    const t = norm(texto);
    if (/^(nov[oa]|nunca usad|lacrad)/.test(t)) return 0;
    if (/^excelente/.test(t)) return 1;
    if (/^muito bo/.test(t)) return 2;
    if (/^bo[ma]?\b/.test(t)) return 3;
    if (/^(regular|razoavel|usad)/.test(t)) return 4;
    return -1;
  }

  // Só os detalhes ("com leve desgaste nos cantos...") viram texto; frases genéricas dão lugar à descrição do nível
  function detalhes(texto, n) {
    let resto = String(texto || '').trim().replace(/^[^,.]*[,.]?\s*/, '');
    if (!/^(com|sem)\b/i.test(resto)) return '';
    resto = resto.replace(/\s*\.$/, '');
    return resto.charAt(0).toLowerCase() + resto.slice(1) + '.';
  }

  function css() {
    if (document.getElementById('tbr-cond-css')) return;
    const st = document.createElement('style'); st.id = 'tbr-cond-css';
    st.textContent = `
.tbr-cond{margin:22px 0 18px;padding:18px 0 4px;border-top:1px solid #e7e1d8}
.tbr-cond-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:12px}
.tbr-cond-rot{font:600 10px/1 Inter,Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#7a7268}
.tbr-cond-nivel{font:400 20px/1.1 "DM Serif Display",Georgia,serif;color:#1a1714}
.tbr-cond-barra{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
.tbr-cond-barra i{display:block;height:3px;background:#e7e1d8}
.tbr-cond-barra i.on{background:#1a1714}
.tbr-cond-escala{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:8px}
.tbr-cond-escala span{font:500 10px/1.3 Inter,Arial,sans-serif;letter-spacing:.04em;color:#a39b90;text-align:center}
.tbr-cond-escala span:first-child{text-align:left}.tbr-cond-escala span:last-child{text-align:right}
.tbr-cond-escala span.on{color:#1a1714;font-weight:600}
.tbr-cond-txt{margin:14px 0 0;font-size:14px;line-height:1.6;color:#5f574e}
.tbr-cond-txt strong{color:#1a1714;font-weight:600}
@media(max-width:420px){.tbr-cond-escala span{font-size:9px;letter-spacing:0}}`;
    document.head.appendChild(st);
  }

  function acharParagrafo() {
    return [...document.querySelectorAll('p')].find(p => {
      const s = p.querySelector('strong');
      return s && /estado da bolsa/i.test(s.textContent) && !p.closest('.tbr-cond');
    });
  }

  function montar() {
    const p = acharParagrafo();
    if (!p) return;
    const texto = p.textContent.replace(/^\s*estado da bolsa:\s*/i, '');
    const n = nivel(texto);
    if (n < 0) return; // texto fora do padrão: mantém o parágrafo original
    css();
    let box = p.previousElementSibling && p.previousElementSibling.classList.contains('tbr-cond') ? p.previousElementSibling : null;
    if (!box) { box = document.createElement('div'); box.className = 'tbr-cond'; p.before(box); }
    const det = detalhes(texto, n);
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', `Estado da peça: ${NIVEIS[n].nome}, nível ${n + 1} de 5`);
    box.innerHTML = `
      <div class="tbr-cond-head"><span class="tbr-cond-rot">Estado da peça</span><span class="tbr-cond-nivel">${NIVEIS[n].nome}</span></div>
      <div class="tbr-cond-barra" aria-hidden="true">${NIVEIS.map((_, i) => `<i class="${i === n ? 'on' : ''}"></i>`).join('')}</div>
      <div class="tbr-cond-escala" aria-hidden="true">${NIVEIS.map((x, i) => `<span class="${i === n ? 'on' : ''}">${x.nome}</span>`).join('')}</div>
      <p class="tbr-cond-txt">${NIVEIS[n].texto}${det ? ` <strong>Nesta peça:</strong> ${det.replace(/[<>&]/g, '')}` : ''}</p>`;
    p.hidden = true; p.style.setProperty('display', 'none', 'important');
    // Se o banco atualizar o texto depois, refaz o medidor
    if (!p.__tbrObs) { p.__tbrObs = new MutationObserver(() => montar()); p.__tbrObs.observe(p, { childList: true, characterData: true, subtree: true }); }
  }

  function iniciar() {
    montar();
    // Páginas montadas pelo banco (bolsa.html) criam o parágrafo depois
    if (!acharParagrafo() && !document.querySelector('.tbr-cond')) {
      const obs = new MutationObserver(() => { if (acharParagrafo()) { obs.disconnect(); montar(); } });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => obs.disconnect(), 15000);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
