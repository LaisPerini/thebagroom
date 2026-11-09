// Aba "Despesas" do admin: lançar, filtrar, editar e excluir despesas da loja.
// Usa o supabaseClient e a lista "bolsas" que o admin.html já carrega.
(function () {
  const CATEGORIAS = [
    'Compra de bolsas', 'Frete e envio', 'Embalagem', 'Higienização e manutenção',
    'Autenticação e certificados', 'Marketing e anúncios', 'Fotos e conteúdo',
    'Taxas de pagamento', 'Sistemas e assinaturas', 'Aluguel do espaço',
    'Contador e impostos', 'Outros'
  ];
  const FORMAS = ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Boleto', 'Dinheiro', 'Transferência'];
  let despesas = [];
  let editandoId = null;
  let carregou = false;

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const hoje = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const dataBR = iso => iso ? iso.split('-').reverse().join('/') : '—';
  const valorNum = txt => { const s = String(txt || '').replace(/[^\d,.-]/g, ''); return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s); };
  const listaBolsas = () => { try { return typeof bolsas !== 'undefined' && Array.isArray(bolsas) ? bolsas : []; } catch (e) { return []; } };
  const nomeBolsa = id => { const b = listaBolsas().find(x => x.id === id); return b ? (b.nome || b.slug) : ''; };

  function montarSelects() {
    const cat = $('despCategoria'), filtroCat = $('despFiltroCategoria'), forma = $('despForma'), bolsa = $('despBolsa');
    if (cat && !cat.options.length) cat.innerHTML = CATEGORIAS.map(c => `<option>${esc(c)}</option>`).join('');
    if (filtroCat && filtroCat.options.length <= 1) filtroCat.insertAdjacentHTML('beforeend', CATEGORIAS.map(c => `<option>${esc(c)}</option>`).join(''));
    if (forma && forma.options.length <= 1) forma.insertAdjacentHTML('beforeend', FORMAS.map(f => `<option>${esc(f)}</option>`).join(''));
    if (bolsa) {
      const atual = bolsa.value;
      bolsa.innerHTML = '<option value="">Nenhuma (despesa geral)</option>' + listaBolsas()
        .slice().sort((a, b) => String(a.nome || a.slug).localeCompare(String(b.nome || b.slug), 'pt-BR'))
        .map(b => `<option value="${esc(b.id)}">${esc(b.nome || b.slug)}</option>`).join('');
      bolsa.value = atual;
    }
    const mes = $('despFiltroMes');
    if (mes && !mes.value) mes.value = hoje().slice(0, 7);
    const data = $('despData');
    if (data && !data.value) data.value = hoje();
  }

  async function carregar() {
    montarSelects();
    const status = $('despStatus');
    status.textContent = 'Carregando despesas...';
    const { data, error } = await supabaseClient.from('despesas').select('*').order('data', { ascending: false }).order('created_at', { ascending: false });
    if (error) { status.textContent = 'Não foi possível carregar as despesas: ' + error.message; return; }
    despesas = data || [];
    carregou = true;
    status.textContent = '';
    render();
  }

  function filtradas() {
    const mes = $('despFiltroMes').value; // "AAAA-MM" ou vazio = todos
    const cat = $('despFiltroCategoria').value;
    const busca = $('despBusca').value.trim().toLowerCase();
    return despesas.filter(d => (!mes || String(d.data).startsWith(mes)) && (!cat || d.categoria === cat) &&
      (!busca || [d.descricao, d.observacao, d.forma_pagamento, nomeBolsa(d.bolsa_id)].join(' ').toLowerCase().includes(busca)));
  }

  function render() {
    const lista = filtradas();
    const total = lista.reduce((s, d) => s + Number(d.valor || 0), 0);
    const mes = $('despFiltroMes').value;
    const ano = (mes || hoje()).slice(0, 4);
    const totalAno = despesas.filter(d => String(d.data).startsWith(ano)).reduce((s, d) => s + Number(d.valor || 0), 0);
    $('despTotal').textContent = brl(total);
    $('despTotalLabel').textContent = mes ? 'Total do mês' : 'Total (todos os meses)';
    $('despQtd').textContent = lista.length;
    $('despTotalAno').textContent = brl(totalAno);
    $('despAnoLabel').textContent = 'Total em ' + ano;

    // Resumo por categoria
    const porCat = {};
    lista.forEach(d => { porCat[d.categoria] = (porCat[d.categoria] || 0) + Number(d.valor || 0); });
    const linhas = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
    $('despPorCategoria').innerHTML = linhas.length ? linhas.map(([c, v]) => {
      const pct = total ? Math.round(v / total * 100) : 0;
      return `<div class="desp-cat"><div class="desp-cat-top"><span>${esc(c)}</span><strong>${brl(v)}</strong></div><div class="desp-bar"><i style="width:${pct}%"></i></div><small>${pct}% do total</small></div>`;
    }).join('') : '<p class="message">Nenhuma despesa neste filtro.</p>';

    // Tabela
    $('despLista').innerHTML = lista.length ? lista.map(d => `
      <tr>
        <td data-label="Data">${dataBR(d.data)}</td>
        <td data-label="Descrição"><strong>${esc(d.descricao)}</strong>${d.observacao ? `<small>${esc(d.observacao)}</small>` : ''}</td>
        <td data-label="Categoria">${esc(d.categoria)}</td>
        <td data-label="Bolsa">${esc(nomeBolsa(d.bolsa_id)) || '—'}</td>
        <td data-label="Pagamento">${esc(d.forma_pagamento) || '—'}</td>
        <td data-label="Valor" class="desp-valor">${brl(d.valor)}</td>
        <td class="desp-acoes"><button type="button" class="btn secondary small" data-desp-editar="${esc(d.id)}">Editar</button><button type="button" class="btn secondary small desp-excluir" data-desp-excluir="${esc(d.id)}">Excluir</button></td>
      </tr>`).join('') : '<tr><td colspan="7" class="dashboard-empty">Nenhuma despesa lançada neste período.</td></tr>';
  }

  function limparForm() {
    editandoId = null;
    $('despForm').reset();
    $('despData').value = hoje();
    $('despSalvar').textContent = 'Lançar despesa';
    $('despCancelar').hidden = true;
    $('despFormTitulo').textContent = 'Nova despesa';
    $('despErro').textContent = '';
  }

  function editar(id) {
    const d = despesas.find(x => x.id === id);
    if (!d) return;
    montarSelects();
    editandoId = id;
    $('despData').value = d.data;
    $('despDescricao').value = d.descricao;
    $('despCategoria').value = d.categoria;
    $('despValor').value = Number(d.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    $('despForma').value = d.forma_pagamento || '';
    $('despBolsa').value = d.bolsa_id || '';
    $('despObs').value = d.observacao || '';
    $('despSalvar').textContent = 'Salvar alterações';
    $('despCancelar').hidden = false;
    $('despFormTitulo').textContent = 'Editar despesa';
    $('despForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function salvar(ev) {
    ev.preventDefault();
    const erro = $('despErro');
    const valor = valorNum($('despValor').value);
    const registro = {
      data: $('despData').value,
      descricao: $('despDescricao').value.trim(),
      categoria: $('despCategoria').value,
      valor,
      forma_pagamento: $('despForma').value || null,
      bolsa_id: $('despBolsa').value || null,
      observacao: $('despObs').value.trim() || null
    };
    if (!registro.data || !registro.descricao) { erro.textContent = 'Preencha a data e a descrição.'; return; }
    if (!Number.isFinite(valor) || valor <= 0) { erro.textContent = 'Informe um valor maior que zero.'; return; }
    const botao = $('despSalvar');
    botao.disabled = true; erro.textContent = '';
    const req = editandoId
      ? supabaseClient.from('despesas').update(registro).eq('id', editandoId).select().single()
      : supabaseClient.from('despesas').insert(registro).select().single();
    const { data, error } = await req;
    botao.disabled = false;
    if (error) { erro.textContent = 'Não foi possível salvar: ' + error.message; return; }
    if (editandoId) despesas = despesas.map(d => d.id === editandoId ? data : d);
    else despesas.unshift(data);
    despesas.sort((a, b) => String(b.data).localeCompare(String(a.data)));
    // Mostra o mês da despesa lançada
    $('despFiltroMes').value = String(data.data).slice(0, 7);
    limparForm();
    render();
    document.dispatchEvent(new CustomEvent('tbr:despesas-alteradas'));
  }

  async function excluir(id) {
    const d = despesas.find(x => x.id === id);
    if (!d) return;
    if (!window.confirm(`Excluir a despesa "${d.descricao}" de ${brl(d.valor)}? Essa ação não pode ser desfeita.`)) return;
    const { error } = await supabaseClient.from('despesas').delete().eq('id', id);
    if (error) { window.alert('Não foi possível excluir: ' + error.message); return; }
    despesas = despesas.filter(x => x.id !== id);
    if (editandoId === id) limparForm();
    render();
    document.dispatchEvent(new CustomEvent('tbr:despesas-alteradas'));
  }

  function exportarCSV() {
    const lista = filtradas();
    const linhas = [['Data', 'Descrição', 'Categoria', 'Bolsa', 'Pagamento', 'Valor', 'Observação']]
      .concat(lista.map(d => [dataBR(d.data), d.descricao, d.categoria, nomeBolsa(d.bolsa_id), d.forma_pagamento || '', Number(d.valor).toFixed(2).replace('.', ','), d.observacao || '']));
    const csv = '﻿' + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `despesas-${$('despFiltroMes').value || 'todas'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function iniciar() {
    if (!$('despesas')) return;
    $('despForm').addEventListener('submit', salvar);
    $('despCancelar').addEventListener('click', limparForm);
    ['despFiltroMes', 'despFiltroCategoria'].forEach(id => $(id).addEventListener('change', render));
    $('despBusca').addEventListener('input', render);
    $('despTodosMeses').addEventListener('click', () => { $('despFiltroMes').value = ''; render(); });
    $('despExportar').addEventListener('click', exportarCSV);
    $('despLista').addEventListener('click', e => {
      const ed = e.target.closest('[data-desp-editar]'); if (ed) return editar(ed.dataset.despEditar);
      const ex = e.target.closest('[data-desp-excluir]'); if (ex) return excluir(ex.dataset.despExcluir);
    });
    // Carrega quando a aba é aberta pela primeira vez
    document.querySelectorAll('.nav button[data-panel="despesas"]').forEach(b => b.addEventListener('click', () => { if (!carregou) carregar(); else { montarSelects(); render(); } }));
  }

  window.TBRDespesas = { carregar, valorNum };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
