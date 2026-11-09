// Dashboard do admin: "Lucro por mês" (receita de aluguéis pagos − despesas) e
// despesas por bolsa para a tabela "Retorno por bolsa".
// Usa as globais do admin.html: supabaseClient, pedidos, pagamentoAprovado, renderDashboard.
(function () {
  window.TBRDespesasPorBolsa = {};
  let despesas = [];
  let carregando = null;
  let ano = new Date().getFullYear();

  const $ = id => document.getElementById(id);
  const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
  const brl0 = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0, minimumFractionDigits: 0 });
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const listaPedidos = () => { try { return Array.isArray(pedidos) ? pedidos : []; } catch (e) { return []; } };
  const aprovado = p => { try { return pagamentoAprovado(p); } catch (e) { return null; } };

  async function carregar() {
    if (carregando) return carregando;
    carregando = (async () => {
      const { data, error } = await supabaseClient.from('despesas').select('data,valor,bolsa_id');
      if (error) { console.warn('Despesas indisponíveis para o lucro:', error.message); despesas = []; }
      else despesas = data || [];
      const porBolsa = {};
      despesas.forEach(d => { if (d.bolsa_id) porBolsa[d.bolsa_id] = (porBolsa[d.bolsa_id] || 0) + Number(d.valor || 0); });
      window.TBRDespesasPorBolsa = porBolsa;
    })();
    try { await carregando; } finally { carregando = null; }
  }

  // Receita: pagamento aprovado, no mês em que foi pago (ou no mês do pedido, se não tiver data)
  function receitas() {
    return listaPedidos().map(p => {
      const pg = aprovado(p);
      if (!pg) return null;
      const quando = String(pg.paid_at || p.created_at || '').slice(0, 10);
      return quando ? { data: quando, valor: Number(pg.valor || p.valor_total || 0) } : null;
    }).filter(Boolean);
  }

  function anosDisponiveis(rec) {
    const s = new Set([new Date().getFullYear()]);
    rec.concat(despesas).forEach(x => { const a = Number(String(x.data).slice(0, 4)); if (a > 2000) s.add(a); });
    return [...s].sort((a, b) => b - a);
  }

  function render() {
    const card = $('lucroCard');
    if (!card) return;
    const rec = receitas();
    const sel = $('lucroAno');
    const anos = anosDisponiveis(rec);
    if (!anos.includes(ano)) ano = anos[0];
    sel.innerHTML = anos.map(a => `<option value="${a}"${a === ano ? ' selected' : ''}>${a}</option>`).join('');

    const meses = MESES.map((nome, i) => {
      const chave = `${ano}-${String(i + 1).padStart(2, '0')}`;
      const r = rec.filter(x => x.data.startsWith(chave)).reduce((s, x) => s + x.valor, 0);
      const d = despesas.filter(x => String(x.data).startsWith(chave)).reduce((s, x) => s + Number(x.valor || 0), 0);
      return { i, nome, chave, receita: r, despesa: d, lucro: r - d };
    });
    const hoje = new Date();
    const mesAtual = ano === hoje.getFullYear() ? meses[hoje.getMonth()] : null;
    const ateAgora = ano === hoje.getFullYear() ? meses.slice(0, hoje.getMonth() + 1) : meses;
    const tot = ateAgora.reduce((s, m) => ({ receita: s.receita + m.receita, despesa: s.despesa + m.despesa }), { receita: 0, despesa: 0 });
    const lucroAno = tot.receita - tot.despesa;
    const margem = tot.receita ? lucroAno / tot.receita * 100 : null;
    const cls = v => v < 0 ? ' lucro-neg' : '';

    $('lucroKpis').innerHTML = [
      mesAtual ? kpi(`Lucro de ${MESES_LONGOS[mesAtual.i]}`, brl0(mesAtual.lucro), `${brl0(mesAtual.receita)} de receita · ${brl0(mesAtual.despesa)} de despesas`, mesAtual.lucro) : '',
      kpi(`Lucro em ${ano}`, brl0(lucroAno), ano === hoje.getFullYear() ? 'De janeiro até hoje' : 'Ano completo', lucroAno),
      kpi(`Receita em ${ano}`, brl0(tot.receita), 'Aluguéis com pagamento aprovado'),
      kpi(`Despesas em ${ano}`, brl0(tot.despesa), 'Lançadas na aba Despesas'),
      kpi('Margem', margem === null ? '—' : margem.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%', 'Quanto da receita virou lucro', margem)
    ].join('');

    // Mostra a partir do primeiro mês com movimento (no mínimo os últimos 6 meses)
    const primeiro = ateAgora.findIndex(m => m.receita || m.despesa);
    const inicio = Math.min(primeiro < 0 ? ateAgora.length - 1 : primeiro, Math.max(0, ateAgora.length - 6));
    const visiveis = ateAgora.slice(inicio);
    const max = Math.max(1, ...visiveis.map(m => Math.max(m.receita, m.despesa)));
    $('lucroBarras').innerHTML = visiveis.map(m => `
      <div class="lucro-col" title="${m.nome}: receita ${brl(m.receita)} · despesas ${brl(m.despesa)} · lucro ${brl(m.lucro)}">
        <div class="lucro-bars"><i class="r" style="height:${(m.receita / max * 100).toFixed(1)}%"></i><i class="d" style="height:${(m.despesa / max * 100).toFixed(1)}%"></i></div>
        <span>${m.nome}</span>
      </div>`).join('');

    $('lucroTabela').innerHTML = visiveis.filter(m => m.receita || m.despesa || m === mesAtual).reverse().map(m => {
      const mg = m.receita ? (m.lucro / m.receita * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '—';
      return `<tr><td data-label="Mês"><strong>${MESES_LONGOS[m.i].replace(/^./, c => c.toUpperCase())}</strong></td><td data-label="Receita">${brl(m.receita)}</td><td data-label="Despesas">${brl(m.despesa)}</td><td data-label="Lucro" class="lucro-valor${cls(m.lucro)}">${brl(m.lucro)}</td><td data-label="Margem">${mg}</td></tr>`;
    }).join('');
    $('lucroTotais').innerHTML = `<tr class="portfolio-totals"><td data-label="Mês"><strong>Total</strong></td><td data-label="Receita">${brl(tot.receita)}</td><td data-label="Despesas">${brl(tot.despesa)}</td><td data-label="Lucro" class="lucro-valor${cls(lucroAno)}">${brl(lucroAno)}</td><td data-label="Margem">${margem === null ? '—' : margem.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'}</td></tr>`;
  }

  function kpi(rotulo, valor, nota, sinal) {
    return `<div class="stat-card kpi${typeof sinal === 'number' && sinal < 0 ? ' lucro-neg' : ''}"><div class="stat-label">${rotulo}</div><div class="stat-value">${valor}</div><div class="kpi-note">${nota}</div></div>`;
  }

  async function atualizar() {
    await carregar();
    render();
    // Atualiza as colunas de despesas/lucro da tabela "Retorno por bolsa"
    try { if (typeof renderPortfolioAnalysis === 'function') renderPortfolioAnalysis(); } catch (e) { /* ainda sem dados */ }
  }

  function iniciar() {
    if (!$('lucroCard')) return;
    $('lucroAno').addEventListener('change', e => { ano = Number(e.target.value); render(); });
    // Sempre que o dashboard é redesenhado, redesenha o lucro também
    if (typeof window.renderDashboard === 'function' && !window.renderDashboard.__lucro) {
      const original = window.renderDashboard;
      const embrulho = function () { const r = original.apply(this, arguments); try { render(); } catch (e) { console.warn(e); } return r; };
      embrulho.__lucro = true;
      window.renderDashboard = embrulho;
    }
    document.addEventListener('tbr:despesas-alteradas', atualizar);
    atualizar();
  }

  window.TBRLucro = { atualizar, render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
