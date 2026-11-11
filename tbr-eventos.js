// Etapas da compra no Google Analytics (só para quem aceitou os cookies de análise):
// view_item (página da bolsa) → add_to_cart (clicou em Alugar) → begin_checkout (abriu o checkout) → purchase (voltou do Mercado Pago com pagamento aprovado).
// Se a pessoa ainda não aceitou os cookies, os eventos ficam numa fila e só vão se ela aceitar nesta mesma página.
(function () {
  'use strict';
  if (window.tbrEvento) return;
  const KEY = 'checkoutAluguelTheBagRoom';
  const fila = [];
  let tentativas = 0, timer = null;
  const pronto = () => typeof window.gtag === 'function' && !window['ga-disable-G-KPVTBY5VK8'];
  function esvaziar() {
    if (!pronto()) {
      if (++tentativas > 90) { clearInterval(timer); timer = null; }
      return;
    }
    while (fila.length) { const [n, d] = fila.shift(); try { window.gtag('event', n, d); } catch (e) { /* sem análise */ } }
    clearInterval(timer); timer = null;
  }
  function evento(nome, dados) {
    fila.push([nome, Object.assign({ currency: 'BRL' }, dados)]);
    if (pronto()) return esvaziar();
    if (!timer) { tentativas = 0; timer = setInterval(esvaziar, 1000); }
  }
  window.tbrEvento = evento;

  const num = v => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined; };
  const itemDe = c => ({ item_id: c.bolsaSlug, item_name: c.bolsaNome, item_category: 'Aluguel', price: num(c.valorAluguel), quantity: 1 });
  const lerCheckout = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.bolsaSlug ? v : null; } catch (e) { return null; } };
  const naPagina = p => location.pathname === p || location.pathname === p.replace('.html', '');

  // Página da bolsa: viu a bolsa + clicou em Alugar (quando o site grava o resumo do aluguel)
  if (typeof BOLSA_SLUG !== 'undefined' && /^\/aluguel\//.test(location.pathname)) {
    let n = 0;
    const visto = () => {
      const b = window.tbrBolsa;
      if (!b && ++n < 20) return setTimeout(visto, 300);
      evento('view_item', { items: [{ item_id: BOLSA_SLUG, item_name: (b && b.nome) || document.title.split('|')[0].trim(), item_brand: b && b.marca, item_category: 'Aluguel' }] });
    };
    visto();
    try {
      const gravar = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        gravar.call(this, k, v);
        // só quando foi um clique da cliente (a sacola também grava esse resumo ao sincronizar a conta)
        if (k !== KEY || this !== window.localStorage || (navigator.userActivation && !navigator.userActivation.isActive)) return;
        try {
          const c = JSON.parse(v);
          if (c && c.bolsaSlug) evento('add_to_cart', { value: num(c.valorTotal), items: [itemDe(c)] });
        } catch (e) { /* ignora */ }
      };
    } catch (e) { /* navegador sem suporte */ }
  }

  // Checkout aberto
  if (naPagina('/checkout-aluguel.html')) {
    const c = lerCheckout();
    if (c) evento('begin_checkout', { value: num(c.valorTotal), items: [itemDe(c)] });
  }

  // Volta do Mercado Pago: /aluguel.html?pedido=ID&pagamento=success
  const q = new URLSearchParams(location.search);
  if (q.get('pagamento') === 'success' && /^[0-9a-f-]{36}$/i.test(q.get('pedido') || '')) {
    const id = q.get('pedido');
    let enviados = [];
    try { enviados = JSON.parse(localStorage.getItem('tbr-ga-compras') || '[]'); } catch (e) { enviados = []; }
    if (!enviados.includes(id)) {
      let token = '';
      try { token = JSON.parse(localStorage.getItem('sb-zpyjnqkrsmgpwszqlcrs-auth-token') || 'null')?.access_token || ''; } catch (e) { token = ''; }
      const KEY_PUB = 'sb_publishable_48rLPZfPRNtRX1kpYm0aWg_aVI1Hi2b';
      fetch('https://zpyjnqkrsmgpwszqlcrs.supabase.co/rest/v1/aluguel_pedidos?select=numero,valor_total,valor_frete,valor_desconto,status,aluguel_itens(valor_aluguel,bolsas(slug,nome,marca))&id=eq.' + id,
        { headers: Object.assign({ apikey: KEY_PUB }, token ? { Authorization: 'Bearer ' + token } : {}) })
        .then(r => (r.ok ? r.json() : []))
        .then(([p]) => {
          if (!p || p.status === 'cancelado') return;
          const itens = (p.aluguel_itens || []).map(i => { const b = Array.isArray(i.bolsas) ? i.bolsas[0] : i.bolsas; return { item_id: b && b.slug, item_name: b && b.nome, item_brand: b && b.marca, item_category: 'Aluguel', price: num(i.valor_aluguel), quantity: 1 }; });
          evento('purchase', { transaction_id: p.numero || id, value: num(p.valor_total), shipping: num(p.valor_frete), discount: num(p.valor_desconto), items: itens });
          enviados.push(id);
          try { localStorage.setItem('tbr-ga-compras', JSON.stringify(enviados.slice(-30))); } catch (e) { /* ignora */ }
        })
        .catch(() => {});
    }
  }
})();
