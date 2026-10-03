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
    panel.innerHTML = '<strong>Sua privacidade importa</strong><p>Usamos recursos necessários para conta e pedidos. Você escolhe se permite o Google Analytics para estatísticas de navegação. <a href="/politica-de-cookies.html">Saiba mais</a>.</p><div><button type="button" data-choice="no">Recusar análise</button><button type="button" data-choice="yes">Aceitar análise</button></div>';
    panel.querySelector('[data-choice="no"]').addEventListener('click', () => save(false));
    panel.querySelector('[data-choice="yes"]').addEventListener('click', () => save(true));
    document.body.appendChild(panel);
  }
  window.TBRCookies = { open };
  function mount() {
    const style = document.createElement('style');
    style.textContent = '#tbr-cookie-panel{position:fixed;bottom:16px;left:16px;right:16px;margin:auto;max-width:760px;padding:20px;background:#fff;color:#222;border:1px solid #999;z-index:2147483646;font:14px/1.6 Arial,sans-serif;box-shadow:0 4px 20px #0002;max-height:70dvh;overflow:auto}#tbr-cookie-panel p{margin:10px 0;color:#222}#tbr-cookie-panel a{color:#222;text-decoration:underline}#tbr-cookie-panel div{display:flex;gap:12px;flex-wrap:wrap}#tbr-cookie-panel button{flex:1;min-width:145px;padding:12px;background:#fff;color:#111;border:1px solid #111;cursor:pointer;font:600 14px Arial,sans-serif}#tbr-cookie-panel button:focus-visible{outline:3px solid #836841;outline-offset:3px}';
    document.head.appendChild(style);
    if (!choice) open(); else if (!choice.analytics) clearAnalyticsCookies();
  }
  loadAnalytics();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
