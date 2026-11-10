// Sacola da The Bag Room: uma bolsa por vez (bolsa + datas + frete escolhidos na página da bolsa).
// Usa o mesmo resumo que o checkout já lê (localStorage "checkoutAluguelTheBagRoom").
// - Ícone no topo com pontinho quando há bolsa esperando; painel lateral com foto, datas e total.
// - Avisa quando as datas passaram ou foram reservadas por outra pessoa.
// - Avisa antes de trocar a bolsa da sacola por outra.
// - Cliente logada: a sacola fica salva na conta (aparece em outro aparelho e permite o e-mail de lembrete).
(function () {
  'use strict';
  if (window.__tbrSacola) return;
  window.__tbrSacola = true;
  const path = location.pathname.toLowerCase();
  if (/\/admin/.test(path)) return;

  const KEY = 'checkoutAluguelTheBagRoom';
  const SB_URL = 'https://zpyjnqkrsmgpwszqlcrs.supabase.co';
  const SB_KEY = 'sb_publishable_48rLPZfPRNtRX1kpYm0aWg_aVI1Hi2b';
  const AUTH_KEY = 'sb-zpyjnqkrsmgpwszqlcrs-auth-token';
  const ATIVAS = ['aguardando_pagamento', 'confirmada', 'em_preparacao', 'enviada', 'em_uso', 'devolucao_pendente', 'bloqueio_manual'];
  const ICON = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.5 8.5h13l-1 12h-11l-1-12z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const hojeISO = (soma = 0) => { const d = new Date(); d.setDate(d.getDate() + soma); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const ler = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.bolsaSlug ? v : null; } catch (e) { return null; } };
  const gravar = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) {} };
  const slugOk = s => /^[a-z0-9_-]{1,120}$/.test(String(s || ''));

  // ---------- sessão (sem criar outro cliente do Supabase: só lê o token já salvo) ----------
  function sessao() {
    try {
      const s = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
      if (s && s.access_token && s.user && s.expires_at * 1000 > Date.now() + 30000) return s;
    } catch (e) {}
    return null;
  }
  async function api(metodo, caminho, corpo, s) {
    const r = await fetch(`${SB_URL}/rest/v1/${caminho}`, {
      method: metodo,
      headers: Object.assign({ apikey: SB_KEY, 'Content-Type': 'application/json' },
        s ? { Authorization: 'Bearer ' + s.access_token } : {},
        metodo === 'POST' ? { Prefer: 'resolution=merge-duplicates,return=minimal' } : {}),
      body: corpo ? JSON.stringify(corpo) : undefined,
      cache: 'no-store',
      keepalive: metodo !== 'GET'
    });
    if (!r.ok) throw new Error('sacola_' + r.status);
    return metodo === 'GET' ? r.json() : null;
  }

  // ---------- estilos ----------
  const css = document.createElement('style');
  css.textContent = `
.tbr-sacola-btn{position:relative;display:inline-flex;align-items:center;gap:10px;background:none;border:0;padding:0;margin:0 22px 0 0;font:inherit;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--tbr-ink,#1a1714);cursor:pointer}
.tbr-sacola-btn svg{width:18px;height:18px}
.tbr-sacola-btn i{position:absolute;top:-3px;left:12px;width:7px;height:7px;border-radius:50%;background:#1a1714;box-shadow:0 0 0 2px var(--tbr-paper,#fffdf9);display:none}
.tbr-sacola-btn.tem i{display:block}
body.tbr-overlay:not(.tbr-scrolled) .tbr-sacola-btn,body.tbr-home:not(.tbr-scrolled) .tbr-sacola-btn{color:#fff}
body.tbr-overlay:not(.tbr-scrolled) .tbr-sacola-btn i,body.tbr-home:not(.tbr-scrolled) .tbr-sacola-btn i{background:#fff;box-shadow:none}
.tbr-head-right{display:flex;align-items:center}
@media(max-width:760px){.tbr-sacola-btn{width:40px;height:44px;justify-content:center;margin:0}.tbr-sacola-btn span{display:none}.tbr-sacola-btn i{top:10px;left:23px}}
.tbr-sac-fundo{position:fixed;inset:0;z-index:100000;background:rgba(26,23,20,.32);opacity:0;visibility:hidden;transition:opacity .3s ease,visibility .3s}
.tbr-sac-painel{position:fixed;top:0;right:0;bottom:0;z-index:100001;width:min(420px,100%);background:#fffdf9;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .38s cubic-bezier(.25,.8,.25,1);box-shadow:-20px 0 60px rgba(26,23,20,.12)}
.tbr-sac-aberta .tbr-sac-fundo{opacity:1;visibility:visible}
.tbr-sac-aberta .tbr-sac-painel{transform:none}
.tbr-sac-topo{display:flex;justify-content:space-between;align-items:center;padding:22px 24px;border-bottom:1px solid #e7e1d8}
.tbr-sac-topo h2{margin:0;font:400 24px/1 "DM Serif Display",Georgia,serif;color:#1a1714}
.tbr-sac-fechar{display:inline-flex;align-items:center;gap:8px;background:none;border:0;padding:8px 0;font:600 10px/1 Inter,Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#1a1714;cursor:pointer}
.tbr-sac-corpo{flex:1;overflow:auto;padding:24px}
.tbr-sac-item{display:grid;grid-template-columns:104px 1fr;gap:18px;align-items:start}
.tbr-sac-item img{width:104px;height:130px;object-fit:cover;background:#f6f4f0;display:block}
.tbr-sac-item small{display:block;font:600 10px/1.2 Inter,Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#7a7268;margin-bottom:6px}
.tbr-sac-item strong{display:block;font:400 22px/1.1 "DM Serif Display",Georgia,serif;color:#1a1714;margin-bottom:10px}
.tbr-sac-item p{margin:0;font:400 13px/1.6 Inter,Arial,sans-serif;color:#5f574e}
.tbr-sac-linhas{margin:24px 0 0;padding:16px 0 0;border-top:1px solid #e7e1d8}
.tbr-sac-linhas div{display:flex;justify-content:space-between;gap:12px;padding:6px 0;font:400 14px/1.4 Inter,Arial,sans-serif;color:#5f574e}
.tbr-sac-linhas div.total{margin-top:6px;padding-top:12px;border-top:1px solid #e7e1d8;color:#1a1714;font-weight:600}
.tbr-sac-nota{margin:14px 0 0;font:400 12px/1.6 Inter,Arial,sans-serif;color:#7a7268}
.tbr-sac-aviso{margin:20px 0 0;padding:14px 16px;background:#f6f1e8;border-left:2px solid #1a1714;font:400 13px/1.55 Inter,Arial,sans-serif;color:#1a1714}
.tbr-sac-acoes{padding:18px 24px 24px;border-top:1px solid #e7e1d8;display:grid;gap:10px}
.tbr-sac-acoes a,.tbr-sac-acoes button{display:flex;align-items:center;justify-content:center;min-height:52px;padding:0 18px;border:1px solid #1a1714;background:#1a1714;color:#fff!important;font:600 11px/1 Inter,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;cursor:pointer}
.tbr-sac-acoes .sec{background:transparent;color:#1a1714!important}
.tbr-sac-acoes .link{border:0;background:none;color:#7a7268!important;min-height:36px;text-decoration:underline;text-underline-offset:4px;letter-spacing:.14em}
.tbr-sac-vazia{text-align:center;padding:40px 6px}
.tbr-sac-vazia strong{display:block;font:400 24px/1.2 "DM Serif Display",Georgia,serif;color:#1a1714;margin-bottom:10px}
.tbr-sac-vazia p{margin:0 0 24px;font:400 14px/1.6 Inter,Arial,sans-serif;color:#5f574e}
.tbr-sac-vazia a{display:inline-flex;min-height:50px;align-items:center;padding:0 28px;background:#1a1714;color:#fff!important;font:600 11px/1 Inter,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;text-decoration:none}
.tbr-sac-confirma{position:fixed;inset:0;z-index:100002;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(26,23,20,.4)}
.tbr-sac-confirma>div{width:min(420px,100%);background:#fffdf9;padding:28px 24px 22px}
.tbr-sac-confirma h3{margin:0 0 10px;font:400 24px/1.15 "DM Serif Display",Georgia,serif;color:#1a1714}
.tbr-sac-confirma p{margin:0 0 22px;font:400 14px/1.6 Inter,Arial,sans-serif;color:#5f574e}
.tbr-sac-confirma .tbr-sac-acoes{padding:0;border:0}
html.tbr-sac-trava,html.tbr-sac-trava body{overflow:hidden}
@media(prefers-reduced-motion:reduce){.tbr-sac-painel,.tbr-sac-fundo{transition:none}}`;
  document.head.appendChild(css);

  // ---------- ícone no topo ----------
  let botao = null;
  function montarBotao() {
    const right = document.querySelector('.site-header .tbr-head-right');
    if (!right || right.querySelector('.tbr-sacola-btn')) return !!right;
    botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'tbr-sacola-btn';
    botao.setAttribute('aria-haspopup', 'dialog');
    botao.innerHTML = `${ICON}<i></i><span>Sacola</span>`;
    botao.addEventListener('click', abrir);
    right.prepend(botao);
    atualizarBotao();
    return true;
  }
  function atualizarBotao() {
    if (!botao) return;
    const tem = !!ler();
    botao.classList.toggle('tem', tem);
    botao.setAttribute('aria-label', tem ? 'Sacola: 1 bolsa esperando' : 'Sacola vazia');
  }

  // ---------- painel ----------
  let raiz = null, ultimoFoco = null;
  function montarPainel() {
    if (raiz) return;
    raiz = document.createElement('div');
    raiz.className = 'tbr-sac';
    raiz.innerHTML = `<div class="tbr-sac-fundo" data-fechar></div>
      <aside class="tbr-sac-painel" role="dialog" aria-modal="true" aria-labelledby="tbrSacTitulo" tabindex="-1">
        <div class="tbr-sac-topo"><h2 id="tbrSacTitulo">Sua sacola</h2><button type="button" class="tbr-sac-fechar" data-fechar>Fechar <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button></div>
        <div class="tbr-sac-corpo"></div>
        <div class="tbr-sac-acoes" hidden></div>
      </aside>`;
    document.body.appendChild(raiz);
    raiz.addEventListener('click', e => { if (e.target.closest('[data-fechar]')) fechar(); if (e.target.closest('[data-remover]')) remover(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.documentElement.classList.contains('tbr-sac-aberta')) fechar(); });
  }
  // Foto da vitrine (mesmo padrão dos cards), carregada só quando a sacola abre
  let capasPedidas = false;
  function carregarCapas() {
    if (capasPedidas) return; capasPedidas = true;
    const usar = () => window.tbrCapasVitrine().then(c => { capas = c || {}; if (document.documentElement.classList.contains('tbr-sac-aberta')) render(); });
    if (window.tbrCapasVitrine) return usar();
    const sc = document.createElement('script'); sc.src = '/capas-vitrine.js?v=20261110-1'; sc.onload = usar; document.head.appendChild(sc);
  }
  function abrir() {
    montarPainel();
    if (ler()) carregarCapas();
    ultimoFoco = document.activeElement;
    render();
    document.documentElement.classList.add('tbr-sac-aberta', 'tbr-sac-trava');
    setTimeout(() => raiz.querySelector('.tbr-sac-painel').focus(), 50);
  }
  function fechar() {
    document.documentElement.classList.remove('tbr-sac-aberta', 'tbr-sac-trava');
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  let capas = {};
  async function render() {
    const corpo = raiz.querySelector('.tbr-sac-corpo'), acoes = raiz.querySelector('.tbr-sac-acoes');
    const item = ler();
    if (!item) {
      acoes.hidden = true;
      corpo.innerHTML = `<div class="tbr-sac-vazia"><strong>Sua sacola está vazia</strong><p>Escolha a bolsa, o período e a data. Ela fica guardada aqui até você finalizar o aluguel.</p><a href="/aluguel.html">Ver bolsas</a></div>`;
      return;
    }
    const slug = slugOk(item.bolsaSlug) ? item.bolsaSlug : '';
    const foto = capas[slug] || item.imagem || '';
    const urlBolsa = slug ? `/aluguel/${slug}.html` : '/aluguel.html';
    corpo.innerHTML = `
      <div class="tbr-sac-item">
        ${foto ? `<img src="${esc(foto)}" alt="">` : '<span></span>'}
        <div><small>Aluguel · ${esc(item.dias)} dias</small><strong>${esc(item.bolsaNome || 'Bolsa')}</strong>
        <p>${esc(item.dataInicio)} a ${esc(item.dataFim)}</p>
        <p>Entrega: ${esc(item.freteIda?.nome === 'Retirar' ? 'retirada no showroom' : (item.freteIda?.nome || '—'))}</p></div>
      </div>
      <div class="tbr-sac-linhas">
        <div><span>Aluguel</span><span>${brl(item.valorAluguel)}</span></div>
        <div><span>Frete (entrega e devolução)</span><span>${brl(item.valorFrete)}</span></div>
        <div class="total"><span>Total</span><span>${brl(item.valorTotal)}</span></div>
      </div>
      <p class="tbr-sac-nota">Caução de ${brl(item.valorCaucao)}, apenas pré-autorizada no cartão e liberada após a devolução.</p>
      <div class="tbr-sac-status" aria-live="polite"></div>`;
    acoes.hidden = false;
    acoes.innerHTML = `<a href="/checkout-aluguel.html" data-finalizar>Finalizar aluguel</a><a class="sec" href="${urlBolsa}">Ver a bolsa</a><button type="button" class="link" data-remover>Remover da sacola</button>`;
    const problema = await conferir(item);
    if (problema && ler() && ler().bolsaSlug === item.bolsaSlug) {
      corpo.querySelector('.tbr-sac-status').innerHTML = `<p class="tbr-sac-aviso">${problema}</p>`;
      acoes.innerHTML = `<a href="${urlBolsa}">Escolher novas datas</a><button type="button" class="link" data-remover>Remover da sacola</button>`;
    }
  }

  // Datas passadas ou reservadas por outra pessoa enquanto a bolsa estava na sacola
  async function conferir(item) {
    const ini = String(item.dataInicioISO || ''), fim = String(item.dataFimISO || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ini)) return 'Não conseguimos ler as datas escolhidas. Escolha a data de novo na página da bolsa.';
    if (ini < hojeISO(3)) return 'A data escolhida já não está disponível para entrega. Escolha uma nova data na página da bolsa.';
    try {
      const [bolsa] = await api('GET', `bolsas?select=id,ativa&slug=eq.${encodeURIComponent(item.bolsaSlug)}&limit=1`);
      if (!bolsa) return 'Esta bolsa não está mais disponível.';
      if (bolsa.ativa === false) return 'Esta bolsa está indisponível para aluguel no momento.';
      const conflitos = await api('GET', `bolsa_reservas?select=id&bolsa_id=eq.${bolsa.id}&status=in.(${ATIVAS.join(',')})&data_inicio=lte.${fim || ini}&data_fim=gte.${ini}&limit=1`);
      if (conflitos.length) return 'Estas datas acabaram de ser reservadas. Escolha um novo período na página da bolsa.';
    } catch (e) { /* sem conexão: o checkout confere de novo */ }
    return '';
  }

  function remover() {
    const item = ler();
    gravar(null);
    atualizarBotao();
    if (item) apagarNaConta();
    render();
  }

  // ---------- troca de bolsa: avisa antes ----------
  function confirmar(atual, nova) {
    return new Promise(resolve => {
      const box = document.createElement('div');
      box.className = 'tbr-sac-confirma';
      box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      box.innerHTML = `<div><h3>Trocar a bolsa da sacola?</h3><p>Sua sacola já tem a <strong>${esc(atual)}</strong>. Cada aluguel é de uma bolsa por vez: ao continuar, ela será substituída pela <strong>${esc(nova)}</strong>.</p>
        <div class="tbr-sac-acoes"><button type="button" data-sim>Trocar e continuar</button><button type="button" class="sec" data-nao>Manter a atual</button></div></div>`;
      document.body.appendChild(box);
      box.querySelector('[data-sim]').focus();
      box.addEventListener('click', e => {
        if (e.target.closest('[data-sim]')) { box.remove(); resolve(true); }
        else if (e.target.closest('[data-nao]') || e.target === box) { box.remove(); resolve(false); }
      });
    });
  }
  function embrulharAlugar() {
    if (typeof window.alugar !== 'function' || window.alugar.__sacola || typeof BOLSA_SLUG === 'undefined') return;
    const original = window.alugar;
    const novo = async function () {
      const atual = ler();
      if (atual && atual.bolsaSlug !== BOLSA_SLUG) {
        const marca = document.querySelector('.tbr-product-brand')?.textContent.trim() || '', modelo = document.querySelector('.info > .nome')?.textContent.trim() || '';
        const nomeNovo = (window.tbrBagFields && window.tbrBagFields.nome) || [marca, modelo].filter(Boolean).join(' ') || 'nova bolsa';
        if (!(await confirmar(atual.bolsaNome || 'outra bolsa', nomeNovo))) { abrir(); return; }
      }
      const r = await original.apply(this, arguments);
      const salvo = ler();
      if (salvo && salvo !== atual) { salvo.salvoEm = Date.now(); gravar(salvo); }
      atualizarBotao();
      salvarNaConta();
      return r;
    };
    novo.__sacola = true;
    window.alugar = novo;
  }

  // ---------- sacola na conta ----------
  async function salvarNaConta() {
    const s = sessao(), item = ler();
    if (!s || !item || !slugOk(item.bolsaSlug)) return;
    try {
      await api('POST', 'sacolas?on_conflict=cliente_auth_id', { cliente_auth_id: s.user.id, bolsa_slug: item.bolsaSlug, data_inicio: item.dataInicioISO || null, dados: item, atualizado_em: new Date().toISOString() }, s);
    } catch (e) { /* tenta de novo na próxima página */ }
  }
  async function apagarNaConta() {
    const s = sessao(); if (!s) return;
    try { await api('DELETE', `sacolas?cliente_auth_id=eq.${s.user.id}`, null, s); } catch (e) {}
  }
  async function sincronizar() {
    const s = sessao(); if (!s) return;
    let remota = null;
    try { [remota] = await api('GET', `sacolas?select=bolsa_slug,dados,atualizado_em&cliente_auth_id=eq.${s.user.id}&limit=1`, null, s); } catch (e) { return; }
    const local = ler();
    if (local && (!remota || (local.salvoEm || 0) > Date.parse(remota.atualizado_em || 0))) { salvarNaConta(); return; }
    if (!local && remota && remota.dados && slugOk(remota.dados.bolsaSlug)) {
      gravar(Object.assign({}, remota.dados, { salvoEm: Date.parse(remota.atualizado_em) || Date.now() }));
      atualizarBotao();
    }
  }

  // ---------- início ----------
  function iniciar() {
    let tentativas = 0;
    const tentar = () => { if (!montarBotao() && ++tentativas < 20) setTimeout(tentar, 150); };
    tentar();
    embrulharAlugar(); setTimeout(embrulharAlugar, 1500); // bag-fields.js também embrulha o alugar
    sincronizar().then(() => { if (/[?&]sacola=1\b/.test(location.search) && ler()) abrir(); });
    addEventListener('storage', e => { if (e.key === KEY) atualizarBotao(); });
    addEventListener('pageshow', atualizarBotao);
  }
  window.tbrSacola = { abrir, fechar, atualizar: atualizarBotao };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
