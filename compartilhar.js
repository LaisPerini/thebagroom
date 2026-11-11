// "Enviar para uma amiga" na página da bolsa.
// Abre o compartilhamento do celular (ou o WhatsApp no computador) com o link da bolsa;
// a prévia do WhatsApp mostra a foto da bolsa (og:image da página).
// Cliente logada: o link já leva o código dela de "Indique uma amiga" (10% para a amiga no primeiro aluguel).
(function () {
  'use strict';
  if (typeof BOLSA_SLUG === 'undefined' || document.querySelector('.tbr-enviar')) return;
  const API = 'https://zpyjnqkrsmgpwszqlcrs.supabase.co/rest/v1/rpc/meu_codigo_indicacao';
  const KEY = 'sb_publishable_48rLPZfPRNtRX1kpYm0aWg_aVI1Hi2b';
  const AUTH = 'sb-zpyjnqkrsmgpwszqlcrs-auth-token';
  const sessao = () => { try { const s = JSON.parse(localStorage.getItem(AUTH) || 'null'); return s && s.access_token && s.expires_at * 1000 > Date.now() + 30000 ? s : null; } catch (e) { return null; } };

  async function meuCodigo() {
    const s = sessao();
    if (!s) return '';
    const salvo = (() => { try { return JSON.parse(localStorage.getItem('tbr-meu-codigo') || 'null'); } catch (e) { return null; } })();
    if (salvo && salvo.uid === s.user.id && salvo.codigo) return salvo.codigo;
    try {
      const r = await fetch(API, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(4000) });
      const codigo = r.ok ? String(await r.json() || '') : '';
      if (codigo) try { localStorage.setItem('tbr-meu-codigo', JSON.stringify({ uid: s.user.id, codigo })); } catch (e) { /* ignora */ }
      return codigo;
    } catch (e) { return ''; }
  }

  function nomeBolsa() {
    const b = window.tbrBolsa;
    if (b && b.nome) return b.marca && !b.nome.toLowerCase().includes(b.marca.toLowerCase()) ? b.marca + ' ' + b.nome : b.nome;
    return (document.querySelector('.info > .nome')?.textContent || document.title.split('|')[0]).trim();
  }

  function css() {
    const st = document.createElement('style');
    st.textContent = `
.tbr-enviar{display:inline-flex;align-items:center;gap:8px;margin:2px 0 18px;padding:6px 0!important;background:none!important;border:0!important;min-height:0!important;cursor:pointer;font:400 13px/1.4 Inter,Arial,sans-serif!important;letter-spacing:0!important;text-transform:none!important;color:#5f574e!important;text-decoration:underline;text-underline-offset:4px;text-decoration-color:#cfc6ba}
.tbr-enviar:hover{color:#1a1714!important;text-decoration-color:#1a1714}
.tbr-enviar svg{width:16px;height:16px;flex:0 0 auto;stroke:currentColor}
.tbr-enviar-ok{display:block;margin:-10px 0 16px;font:400 12px/1.4 Inter,Arial,sans-serif;color:#2f6b45}`;
    document.head.appendChild(st);
  }

  function montar() {
    const preco = document.querySelector('.info > .preco');
    if (!preco || document.querySelector('.tbr-enviar')) return;
    css();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tbr-enviar';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg><span>Enviar para uma amiga</span>';
    preco.after(btn);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const codigo = await meuCodigo();
      const url = new URL(location.origin + location.pathname);
      if (codigo) url.searchParams.set('amiga', codigo);
      url.searchParams.set('utm_source', 'compartilhar');
      url.searchParams.set('utm_medium', 'amiga');
      const nome = nomeBolsa();
      const texto = codigo
        ? `Olha essa ${nome} para alugar na The Bag Room! Com o meu código ${codigo} você ganha 10% no seu primeiro aluguel.`
        : `Olha essa ${nome} para alugar na The Bag Room!`;
      try { window.tbrEvento && window.tbrEvento('share', { method: navigator.share ? 'nativo' : 'whatsapp', content_type: 'bolsa', item_id: BOLSA_SLUG }); } catch (e) { /* ignora */ }
      try {
        if (navigator.share && matchMedia('(pointer:coarse)').matches) {
          await navigator.share({ title: nome + ' | The Bag Room', text: texto, url: url.href });
        } else {
          window.open('https://wa.me/?text=' + encodeURIComponent(texto + ' ' + url.href), '_blank', 'noopener');
        }
      } catch (e) { /* cancelou */ }
      btn.disabled = false;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar, { once: true });
  else montar();
})();
