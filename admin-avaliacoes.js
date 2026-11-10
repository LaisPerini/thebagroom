// Admin: aba "Avaliações" (notas das clientes depois da devolução, com opção de mostrar no site)
// e o quadro "Bolsas mais favoritadas" do dashboard. Usa o supabaseClient e a lista "bolsas" do admin.html.
(function () {
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dataBR = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—';
  const listaBolsas = () => { try { return typeof bolsas !== 'undefined' && Array.isArray(bolsas) ? bolsas : []; } catch (e) { return []; } };
  let avaliacoes = [];
  let carregou = false;

  async function nomesBolsas() {
    const lista = listaBolsas();
    if (lista.length) return lista;
    const { data } = await supabaseClient.from('bolsas').select('id,slug,nome,marca');
    return data || [];
  }
  const rotulo = b => b ? (b.marca && !String(b.nome || '').toLowerCase().startsWith(String(b.marca).toLowerCase()) ? `${b.marca} ${b.nome}` : (b.nome || b.slug)) : '';

  // ---------- avaliações ----------
  async function carregar() {
    $('avStatus').textContent = 'Carregando avaliações...';
    const [{ data, error }, todas] = await Promise.all([
      supabaseClient.from('avaliacoes').select('id,pedido_id,bolsa_id,nota,comentario,nome_exibicao,autoriza_publicacao,publicar,created_at,aluguel_pedidos(numero)').order('created_at', { ascending: false }),
      nomesBolsas()
    ]);
    if (error) { $('avStatus').textContent = 'Não foi possível carregar: ' + error.message; return; }
    const porId = Object.fromEntries(todas.map(b => [b.id, b]));
    avaliacoes = (data || []).map(a => ({ ...a, bolsa: rotulo(porId[a.bolsa_id]) }));
    carregou = true;
    $('avStatus').textContent = '';
    render();
  }

  function render() {
    const n = avaliacoes.length;
    $('avQtd').textContent = String(n);
    $('avMedia').textContent = n ? (avaliacoes.reduce((s, a) => s + a.nota, 0) / n).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' ★' : '—';
    $('avPublicadas').textContent = String(avaliacoes.filter(a => a.publicar && a.autoriza_publicacao).length);
    $('avLista').innerHTML = n ? avaliacoes.map(a => {
      const pedido = Array.isArray(a.aluguel_pedidos) ? a.aluguel_pedidos[0] : a.aluguel_pedidos;
      return `<article class="card av-item">
        <div>
          <div class="av-notas" aria-label="${a.nota} de 5">${'★'.repeat(a.nota)}${'☆'.repeat(5 - a.nota)}</div>
          <h3>${esc(a.nome_exibicao || 'Cliente')}${a.autoriza_publicacao ? '' : '<span class="av-tag">Não autorizou publicar</span>'}</h3>
          <p class="av-meta">${esc(a.bolsa || 'Bolsa')} · Pedido ${esc(pedido?.numero || String(a.pedido_id).slice(0, 8))} · ${dataBR(a.created_at)}</p>
          <p class="av-txt">${a.comentario ? esc(a.comentario) : '<em style="color:#8a847a">Sem comentário</em>'}</p>
        </div>
        ${a.autoriza_publicacao ? `<label class="av-toggle"><input type="checkbox" data-av-publicar="${esc(a.id)}"${a.publicar ? ' checked' : ''}> Mostrar no site</label>` : ''}
      </article>`;
    }).join('') : '<div class="card"><p class="message" style="margin:0">Nenhuma avaliação ainda. Elas chegam depois que as clientes devolvem as bolsas.</p></div>';
  }

  async function publicar(id, on, input) {
    input.disabled = true;
    const { error } = await supabaseClient.from('avaliacoes').update({ publicar: on }).eq('id', id);
    input.disabled = false;
    if (error) { input.checked = !on; window.alert('Não foi possível salvar: ' + error.message); return; }
    const a = avaliacoes.find(x => x.id === id); if (a) a.publicar = on;
    render();
  }

  // ---------- favoritas ----------
  async function ranking() {
    const box = $('favRanking'); if (!box) return;
    const [{ data, error }, todas] = await Promise.all([supabaseClient.from('favoritas').select('bolsa_slug'), nomesBolsas()]);
    if (error) { box.innerHTML = '<p class="message">Favoritas indisponíveis no momento.</p>'; return; }
    const cont = {};
    (data || []).forEach(f => { cont[f.bolsa_slug] = (cont[f.bolsa_slug] || 0) + 1; });
    const top = Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!top.length) { box.innerHTML = '<p class="message" style="margin:0">Ainda nenhuma bolsa salva por clientes logadas.</p>'; return; }
    const porSlug = Object.fromEntries(todas.map(b => [b.slug, b]));
    const max = top[0][1];
    box.innerHTML = top.map(([slug, n], i) => `<div class="fav-row"><b>${i + 1}</b><span>${esc(rotulo(porSlug[slug]) || slug)}</span><strong>${n} ♥</strong><div class="fav-bar"><i style="width:${(n / max * 100).toFixed(0)}%"></i></div></div>`).join('');
  }

  function iniciar() {
    if ($('avaliacoes')) {
      $('avLista').addEventListener('change', e => { const i = e.target.closest('[data-av-publicar]'); if (i) publicar(i.dataset.avPublicar, i.checked, i); });
      document.querySelectorAll('.nav button[data-panel="avaliacoes"]').forEach(b => b.addEventListener('click', () => { if (!carregou) carregar(); }));
    }
    if ($('favRanking')) {
      // espera o login do admin
      let tentativas = 0;
      const tentar = async () => {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) return ranking();
        if (++tentativas < 30) setTimeout(tentar, 1000);
      };
      tentar();
    }
  }
  window.TBRAvaliacoes = { carregar, ranking };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
