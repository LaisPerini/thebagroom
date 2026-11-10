// Admin: aba "Vales-presente" (vendidos, saldo em aberto e situação de cada vale).
(function () {
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const dataBR = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—';
  let carregou = false;
  async function carregar() {
    $('valesStatus').textContent = 'Carregando...';
    const { data, error } = await supabaseClient.from('vales_presente')
      .select('created_at,pago_em,codigo,comprador_nome,destinatario_nome,destinatario_email,valor,saldo,status,validade,enviado_em')
      .order('created_at', { ascending: false });
    if (error) { $('valesStatus').textContent = 'Não foi possível carregar: ' + error.message; return; }
    carregou = true; $('valesStatus').textContent = '';
    const pagos = (data || []).filter(v => v.status === 'pago');
    const hoje = new Date().toISOString().slice(0, 10);
    $('valesQtd').textContent = String(pagos.length);
    $('valesTotal').textContent = brl(pagos.reduce((s, v) => s + Number(v.valor), 0));
    $('valesSaldo').textContent = brl(pagos.filter(v => v.validade >= hoje).reduce((s, v) => s + Number(v.saldo), 0));
    const situacao = v => v.status !== 'pago' ? (v.status === 'cancelado' ? 'Cancelado' : 'Aguardando pagamento')
      : v.validade < hoje ? 'Vencido' : Number(v.saldo) <= 0 ? 'Usado' : Number(v.saldo) < Number(v.valor) ? 'Em uso' : (v.enviado_em ? 'Enviado' : 'Pago');
    $('valesLista').innerHTML = (data || []).length ? data.map(v => `<tr>
      <td>${dataBR(v.pago_em || v.created_at)}</td><td><strong>${esc(v.codigo || '—')}</strong></td>
      <td>${esc(v.comprador_nome || '—')}</td><td>${esc(v.destinatario_nome)}<br><small>${esc(v.destinatario_email)}</small></td>
      <td>${brl(v.valor)}</td><td>${v.status === 'pago' ? brl(v.saldo) : '—'}</td><td>${situacao(v)}</td></tr>`).join('')
      : '<tr><td colspan="7">Nenhum vale vendido ainda.</td></tr>';
  }
  function iniciar() {
    if (!$('vales')) return;
    document.querySelectorAll('.nav button[data-panel="vales"]').forEach(b => b.addEventListener('click', () => { if (!carregou) carregar(); }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
