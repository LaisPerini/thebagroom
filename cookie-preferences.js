(() => {
  'use strict';
  const key = 'tbr-cookie-choice-v1', measurement = 'G-KPVTBY5VK8';
  let choice = null, loaded = false;
  try { const saved = JSON.parse(localStorage.getItem(key)); if (saved?.version === 1 && typeof saved.analytics === 'boolean' && Date.now() - saved.at < 180 * 86400000 && saved.at <= Date.now()) choice = saved; } catch (_) {}
  window['ga-disable-' + measurement] = !choice?.analytics;
  function loadAnalytics() {
    if (loaded || !choice?.analytics) return;
    loaded = true; window['ga-disable-' + measurement] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', measurement, { allow_google_signals: false, allow_ad_personalization_signals: false });
    const script = document.createElement('script'); script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurement;
    document.head.appendChild(script);
  }
  function clearAnalyticsCookies() {
    const host = location.hostname, domains = ['', host, '.' + host, '.thebagroom.com.br'];
    document.cookie.split(';').forEach(cookie => {
      const name = cookie.split('=')[0].trim();
      if (!/^_ga(?:_|$)|^_gid$|^_gat/.test(name)) return;
      domains.forEach(domain => { document.cookie = name + '=; Max-Age=0; path=/' + (domain ? '; domain=' + domain : '') + '; SameSite=Lax'; });
    });
  }
  let lastFocus;
  function save(analytics) {
    const hadAnalytics = loaded;
    choice = { version: 1, analytics, at: Date.now() };
    try { localStorage.setItem(key, JSON.stringify(choice)); } catch (_) {}
    window['ga-disable-' + measurement] = !analytics;
    document.getElementById('tbr-cookie-panel')?.remove();
    lastFocus?.focus?.();
    if (analytics) loadAnalytics();
    else { clearAnalyticsCookies(); if (hadAnalytics) location.reload(); }
  }
  function open() {
    if (document.getElementById('tbr-cookie-panel')) return;
    lastFocus = document.activeElement;
    const panel = document.createElement('section'); panel.id = 'tbr-cookie-panel';
    panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Preferências de cookies');
    panel.innerHTML = '<div class="tbr-ck-text"><strong>Cookies</strong><p>Usamos cookies essenciais para a sua conta e os seus pedidos e, com a sua permissão, cookies de análise para entender como o site é usado. <a href="/politica-de-cookies.html">Política de cookies</a></p></div><div class="tbr-ck-actions"><button type="button" data-choice="no">Recusar</button><button type="button" data-choice="yes" class="tbr-ck-primary">Aceitar</button></div>';
    panel.querySelector('[data-choice="no"]').addEventListener('click', () => save(false));
    panel.querySelector('[data-choice="yes"]').addEventListener('click', () => save(true));
    document.body.appendChild(panel);
  }
  window.TBRCookies = { open };
  function mount() {
    const style = document.createElement('style');
    style.textContent = '#tbr-cookie-panel{position:fixed;left:0;right:0;bottom:0;z-index:2147483646;display:flex;align-items:center;justify-content:space-between;gap:40px;padding:22px max(40px,env(safe-area-inset-left)) calc(22px + env(safe-area-inset-bottom));background:#fffefa;color:#1a1714;border-top:1px solid #e4ddd2;font:13px/1.6 Inter,Arial,sans-serif;max-height:70dvh;overflow:auto;animation:tbrCk .35s ease both}@keyframes tbrCk{from{transform:translateY(100%)}to{transform:none}}#tbr-cookie-panel .tbr-ck-text{max-width:760px}#tbr-cookie-panel strong{display:block;margin:0 0 4px;font:400 20px/1.2 "DM Serif Display",Georgia,serif;letter-spacing:0;color:#1a1714}#tbr-cookie-panel p{margin:0;color:#5f574e}#tbr-cookie-panel a{color:#1a1714;text-decoration:underline;text-underline-offset:3px;white-space:nowrap}#tbr-cookie-panel .tbr-ck-actions{display:flex;gap:10px;flex:0 0 auto}#tbr-cookie-panel button{min-width:150px;min-height:46px;padding:0 24px;background:transparent;color:#1a1714;border:1px solid #1a1714;cursor:pointer;font:600 11px/1 Inter,Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;transition:opacity .2s}#tbr-cookie-panel button.tbr-ck-primary{background:#1a1714;color:#fff}#tbr-cookie-panel button:hover{opacity:.82}#tbr-cookie-panel button:focus-visible{outline:2px solid #836841;outline-offset:3px}@media(max-width:760px){#tbr-cookie-panel{flex-direction:column;align-items:stretch;gap:16px;padding:20px 20px calc(18px + env(safe-area-inset-bottom))}#tbr-cookie-panel strong{font-size:18px}#tbr-cookie-panel .tbr-ck-actions button{flex:1;min-width:0}}@media(prefers-reduced-motion:reduce){#tbr-cookie-panel{animation:none}}';
    document.head.appendChild(style);
    if (!choice) open(); else if (!choice.analytics) clearAnalyticsCookies();
  }
  loadAnalytics();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
