// Preenche automaticamente os preços de 7, 10, 15, 20 e 30 dias a partir do valor de 4 dias,
// seguindo a mesma tabela usada nas bolsas já cadastradas.
(function () {
  const DIAS = [7, 10, 15, 20, 30];
  // Tabela de referência (preços praticados no site). Se o banco tiver outra tabela, ela tem prioridade.
  const PADRAO = {
    90:   { 7: 140,  10: 190,  15: 240,  20: 290,  30: 390 },
    190:  { 7: 290,  10: 390,  15: 490,  20: 590,  30: 790 },
    290:  { 7: 390,  10: 490,  15: 590,  20: 690,  30: 990 },
    390:  { 7: 490,  10: 590,  15: 790,  20: 890,  30: 1190 },
    490:  { 7: 690,  10: 790,  15: 990,  20: 1090, 30: 1490 },
    590:  { 7: 790,  10: 990,  15: 1190, 20: 1390, 30: 1790 },
    690:  { 7: 890,  10: 1090, 15: 1390, 20: 1590, 30: 1990 },
    890:  { 7: 1090, 10: 1290, 15: 1590, 20: 1790, 30: 2190 },
    1590: { 7: 1890, 10: 2190, 15: 2590, 20: 2990, 30: 3590 }
  };

  function tabela(precos) {
    const mapa = {};
    Object.keys(PADRAO).forEach(k => { mapa[k] = { ...PADRAO[k] }; });
    if (!Array.isArray(precos) || !precos.length) return mapa;
    const porBolsa = {};
    precos.filter(p => p && p.ativo !== false && Number(p.valor) > 0).forEach(p => {
      (porBolsa[p.bolsa_id] = porBolsa[p.bolsa_id] || {})[Number(p.dias)] = Number(p.valor);
    });
    const contagem = {};
    Object.values(porBolsa).forEach(planos => {
      if (!planos[4] || !DIAS.every(d => planos[d])) return;
      const chave = DIAS.map(d => planos[d]).join('|');
      const grupo = (contagem[planos[4]] = contagem[planos[4]] || {});
      grupo[chave] = (grupo[chave] || 0) + 1;
    });
    Object.entries(contagem).forEach(([quatro, grupos]) => {
      const melhor = Object.entries(grupos).sort((a, b) => b[1] - a[1])[0][0].split('|').map(Number);
      mapa[quatro] = Object.fromEntries(DIAS.map((d, i) => [d, melhor[i]]));
    });
    return mapa;
  }

  function arredondar(valor, base) {
    if (base >= 150 && valor >= 150) return Math.round((valor - 90) / 100) * 100 + 90; // termina em 90, como no site
    return Math.round(valor / 10) * 10;
  }

  function sugerir(valor4, precos) {
    const v = Number(valor4);
    if (!Number.isFinite(v) || v <= 0) return null;
    const mapa = tabela(precos);
    if (mapa[v]) return { ...mapa[v] };
    const chaves = Object.keys(mapa).map(Number).sort((a, b) => a - b);
    const abaixo = chaves.filter(k => k < v).pop();
    const acima = chaves.find(k => k > v);
    const resultado = {};
    let anterior = v;
    DIAS.forEach(d => {
      let bruto;
      if (abaixo !== undefined && acima !== undefined) {
        const t = (v - abaixo) / (acima - abaixo);
        bruto = mapa[abaixo][d] + t * (mapa[acima][d] - mapa[abaixo][d]);
      } else {
        const base = abaixo !== undefined ? abaixo : acima;
        bruto = v * (mapa[base][d] / base);
      }
      let final = arredondar(bruto, v);
      if (final <= anterior) final = anterior + 10;
      resultado[d] = final;
      anterior = final;
    });
    return resultado;
  }

  function precosCarregados() {
    try { return typeof precosBolsas !== 'undefined' ? precosBolsas : []; } catch (e) { return []; }
  }

  function preencher(forcar) {
    const campo4 = document.getElementById('preco4');
    if (!campo4) return;
    const texto = String(campo4.value || '').replace(/\s|R\$/gi, '').replace(/\./g, '').replace(',', '.');
    const sugestao = sugerir(texto ? Number(texto) : NaN, precosCarregados());
    if (!sugestao) return;
    DIAS.forEach(d => {
      const campo = document.getElementById('preco' + d);
      if (!campo) return;
      if (forcar || !campo.value.trim() || campo.dataset.auto === '1') {
        campo.value = String(sugestao[d]);
        campo.dataset.auto = '1';
      }
    });
    if (typeof renderResumoCadastroBolsa === 'function') renderResumoCadastroBolsa();
  }

  function iniciar() {
    const campo4 = document.getElementById('preco4');
    const grade = document.querySelector('.price-grid');
    if (!campo4 || !grade) return;
    campo4.addEventListener('input', () => preencher(false));
    DIAS.forEach(d => {
      const campo = document.getElementById('preco' + d);
      if (campo) campo.addEventListener('input', () => { delete campo.dataset.auto; });
    });
    if (!document.getElementById('precoAutoDica')) {
      const dica = document.createElement('p');
      dica.id = 'precoAutoDica';
      dica.className = 'price-autofill-hint';
      dica.innerHTML = 'Digite o valor de <strong>4 dias</strong> e os outros períodos são preenchidos com a mesma lógica das suas bolsas. Você pode ajustar qualquer valor. ';
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.textContent = 'Recalcular a partir dos 4 dias';
      botao.addEventListener('click', () => preencher(true));
      dica.appendChild(botao);
      grade.insertAdjacentElement('afterend', dica);
    }
  }

  window.TBRPriceAutofill = { sugerir, tabela, preencher };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    else iniciar();
  }
})();
