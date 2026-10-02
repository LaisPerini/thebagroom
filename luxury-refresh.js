(function () {
  'use strict';

  const path = location.pathname.toLowerCase();
  const body = document.body;
  if (!body) return;

  if (/\/(index\.html)?$/.test(path)) body.classList.add('tbr-home');
  else if (/\/aluguel\.html$/.test(path)) body.classList.add('tbr-catalog');
  else if (/\/aluguel\/.+\.html$/.test(path)) body.classList.add('tbr-product');
  else if (/cadastro|checkout|login|minha-conta|pedido-aluguel|contrato/.test(path)) body.classList.add('tbr-utility');
  else body.classList.add('tbr-editorial');

  const header = document.querySelector('.site-header') || document.querySelector('body > header');
  if (header) {
    header.classList.add('site-header');
    header.querySelectorAll('.menu-mobile-btn').forEach((toggle) => {
      toggle.classList.add('tbr-menu-toggle');
      toggle.setAttribute('aria-label', 'Abrir menu');
      toggle.innerHTML = '<svg class="tbr-menu-icon" width="24" height="16" viewBox="0 0 24 16" aria-hidden="true" focusable="false"><path d="M1 4h22M1 12h22" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
    });
    const brand = header.querySelector('.brand') || header.querySelector('h1');
    if (brand) brand.classList.add('brand');
    if (brand && !brand.querySelector('a')) {
      const text = brand.textContent.trim() || 'THE BAG ROOM';
      brand.textContent = '';
      const link = document.createElement('a');
      link.href = '/index.html';
      link.textContent = text;
      link.setAttribute('aria-label', 'The Bag Room — página inicial');
      brand.appendChild(link);
    }

    if (!header.querySelector('.luxury-desktop-nav')) {
      const nav = document.createElement('nav');
      nav.className = 'luxury-desktop-nav';
      nav.setAttribute('aria-label', 'Navegação principal');
      nav.innerHTML = [
        ['/index.html', 'Home'],
        ['/aluguel.html', 'Alugar'],
        ['/como-alugar.html', 'Como funciona'],
        ['/autenticidade.html', 'Autenticidade'],
        ['/quem-somos.html', 'Sobre']
      ].map(([href, label]) => `<a href="${href}">${label}</a>`).join('');
      header.insertBefore(nav, brand || header.firstChild);
    }

    if (!header.querySelector('.luxury-header-actions')) {
      const actions = document.createElement('div');
      actions.className = 'luxury-header-actions';
      actions.innerHTML = '<a class="tbr-sell-link" href="/como-desapegar.html">Desapegue sua bolsa</a><a href="/login.html">Minha conta</a><a class="tbr-appointment" href="https://wa.me/5513996904227" target="_blank" rel="noopener">Falar com a curadoria</a>';
      header.appendChild(actions);
    }

    const mobileInner = header.querySelector('.menu-mobile-inner');
    if (mobileInner) {
      mobileInner.innerHTML = '<a href="/index.html">Home</a><a href="/aluguel.html">Alugar</a><a href="/como-alugar.html">Como funciona</a><a href="/autenticidade.html">Autenticidade</a><a href="/como-desapegar.html">Desapegue sua bolsa</a><a href="/universo/universo-do-luxo.html">Journal</a><a href="/quem-somos.html">Sobre</a><a href="/login.html">Minha conta</a><a href="https://wa.me/5513996904227" target="_blank" rel="noopener">Falar com a curadoria</a>';
    }

    const activePath = path.endsWith('/') ? '/index.html' : path;
    header.querySelectorAll('a').forEach((link) => {
      try {
        const linkPath = new URL(link.href, location.href).pathname.toLowerCase();
        if (linkPath === activePath) link.setAttribute('aria-current', 'page');
      } catch (_) {}
    });
  }

  const mobileMenu = document.getElementById('menuMobile');
  if (mobileMenu) {
    const syncMenuState = () => body.classList.toggle('tbr-menu-open', mobileMenu.classList.contains('open'));
    const observer = new MutationObserver(syncMenuState);
    observer.observe(mobileMenu, { attributes: true, attributeFilter: ['class'] });
    mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      syncMenuState();
    }));
  }

  if (body.classList.contains('tbr-home')) {
    const hero = document.querySelector('.hero');
    if (hero && !document.querySelector('.tbr-trust-strip')) {
      const strip = document.createElement('section');
      strip.className = 'tbr-trust-strip';
      strip.setAttribute('aria-label', 'Compromissos The Bag Room');
      strip.innerHTML = '<div><strong>100% autênticas</strong><span>Curadoria e certificação</span></div><div><strong>Aluguel descomplicado</strong><span>Períodos flexíveis</span></div><div><strong>Atendimento próximo</strong><span>Do pedido à devolução</span></div>';
      hero.insertAdjacentElement('afterend', strip);
    }

    const weekProducts = document.querySelector('.week-products');
    if (weekProducts && !document.querySelector('.tbr-week-controls')) {
      const controls = document.createElement('div');
      controls.className = 'tbr-week-controls';
      controls.setAttribute('aria-label', 'Navegação das bolsas disponíveis');
      controls.innerHTML = '<button type="button" class="tbr-week-prev" aria-label="Ver bolsa anterior">←</button><button type="button" class="tbr-week-next" aria-label="Ver próxima bolsa">→</button>';
      weekProducts.insertAdjacentElement('afterend', controls);
      const moveWeek = (direction) => {
        const card = weekProducts.querySelector('.week-card');
        const distance = card ? card.getBoundingClientRect().width + 12 : weekProducts.clientWidth * .85;
        weekProducts.scrollBy({ left: direction * distance, behavior: 'smooth' });
      };
      controls.querySelector('.tbr-week-prev').addEventListener('click', () => moveWeek(-1));
      controls.querySelector('.tbr-week-next').addEventListener('click', () => moveWeek(1));
    }
  }

  if (body.classList.contains('tbr-product')) {
    const info = document.querySelector('.info');
    const rentButton = document.getElementById('botaoAlugar');
    if (info && rentButton && !info.querySelector('.tbr-product-assurance')) {
      const assurance = document.createElement('div');
      assurance.className = 'tbr-product-assurance';
      assurance.setAttribute('aria-label', 'Garantias da locação');
      assurance.innerHTML = '<span>Autenticidade garantida</span><span>Pagamento seguro</span><span>Atendimento próximo</span>';
      rentButton.insertAdjacentElement('afterend', assurance);
    }

    const gallery = document.querySelector('.galeria');
    const slider = gallery && gallery.querySelector('.slider');
    const images = slider ? Array.from(slider.querySelectorAll('img')) : [];
    images.forEach((image, index) => {
      image.decoding = 'async';
      if (index === 0) {
        image.loading = 'eager';
        image.fetchPriority = 'high';
      } else {
        image.loading = 'lazy';
      }
      image.alt ||= `Foto ${index + 1} da bolsa`;
    });

    if (gallery && images.length && !gallery.querySelector('.tbr-gallery-count')) {
      const count = document.createElement('span');
      count.className = 'tbr-gallery-count';
      count.setAttribute('aria-live', 'polite');
      count.textContent = `1 / ${images.length}`;
      gallery.appendChild(count);

      const dots = document.getElementById('dots');
      if (dots) {
        const syncCount = () => {
          const active = Array.from(dots.children).findIndex((dot) => dot.classList.contains('active'));
          count.textContent = `${Math.max(0, active) + 1} / ${slider.querySelectorAll('img').length}`;
        };
        new MutationObserver(syncCount).observe(dots, { subtree: true, attributes: true, attributeFilter: ['class'] });
        syncCount();
      }

      let touchStartX = 0;
      gallery.addEventListener('touchstart', (event) => { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
      gallery.addEventListener('touchend', (event) => {
        const distance = event.changedTouches[0].clientX - touchStartX;
        if (Math.abs(distance) > 45 && typeof window.slide === 'function') window.slide(distance < 0 ? 1 : -1);
      }, { passive: true });
    }

    if (info) {
      const name = info.querySelector(':scope > .nome');
      const details = info.querySelector('.detalhes');
      const brandRow = details && Array.from(details.querySelectorAll('p')).find((row) => /marca:/i.test(row.textContent));
      const brand = brandRow ? brandRow.textContent.replace(/.*marca:\s*/i, '').trim() : '';
      if (name && brand && !info.querySelector('.tbr-product-brand')) {
        const eyebrow = document.createElement('div');
        eyebrow.className = 'tbr-product-brand';
        eyebrow.textContent = brand;
        name.insertAdjacentElement('beforebegin', eyebrow);
        const model = name.textContent.trim().replace(new RegExp(`^${brand}\\s*`, 'i'), '').trim();
        name.classList.add('tbr-product-model');
        if (model) name.textContent = model;
        else name.hidden = true;
      }

      const options = info.querySelector('.opcoes');
      if (options && !options.previousElementSibling?.classList.contains('tbr-section-label')) {
        options.insertAdjacentHTML('beforebegin', '<div class="tbr-section-label"><span>Escolha o período</span><small>Selecione a duração da locação</small></div>');
      }
      const dateInput = document.getElementById('dataInicio');
      if (dateInput && !dateInput.previousElementSibling?.classList.contains('tbr-section-label')) {
        dateInput.insertAdjacentHTML('beforebegin', '<div class="tbr-section-label"><span>Escolha quando deseja receber sua bolsa</span><small>A devolução será calculada conforme o período</small></div>');
      }
      const cepInput = document.getElementById('cep');
      if (cepInput) {
        cepInput.inputMode = 'numeric';
        cepInput.maxLength = 9;
        cepInput.autocomplete = 'postal-code';
        cepInput.placeholder = '00000-000';
        if (!cepInput.previousElementSibling?.classList.contains('tbr-section-label')) {
          cepInput.insertAdjacentHTML('beforebegin', '<div class="tbr-section-label tbr-delivery-label"><span>Entrega</span><small>Consulte as opções para o seu CEP</small></div>');
        }
      }

      const cautionRow = details && Array.from(details.querySelectorAll('p')).find((row) => /valor do cau[cç][aã]o:/i.test(row.textContent));
      if (cautionRow && !info.querySelector('.tbr-caution')) {
        const caution = document.createElement('div');
        caution.className = 'tbr-caution';
        caution.innerHTML = `<span>${cautionRow.textContent.replace(/valor do cau[cç][aã]o:/i, 'Caução de segurança:').trim()}</span><button type="button" aria-label="Como funciona a caução">?</button><small>O valor é apenas pré-autorizado no cartão e liberado após a devolução da peça nas condições acordadas.</small>`;
        (info.querySelector(':scope > .preco') || name).insertAdjacentElement('afterend', caution);
      }

      if (!info.querySelector('.tbr-authenticity')) {
        const authenticity = document.createElement('aside');
        authenticity.className = 'tbr-authenticity';
        const certificateLink = document.querySelector('.auth-selo-link');
        const certificateAction = certificateLink
          ? `<a class="tbr-certificate-link" href="${certificateLink.getAttribute('href')}" target="_blank" rel="noopener">Ver certificado de autenticidade</a>`
          : '';
        authenticity.innerHTML = `<strong>Autenticidade garantida</strong><p>Todas as peças da The Bag Room passam por processo de verificação de autenticidade.</p><div class="tbr-authenticity-links">${certificateAction}<a href="/autenticidade.html">Saiba mais sobre autenticidade</a></div>`;
        const product = document.querySelector('.produto');
        if (product && gallery) {
          const media = document.createElement('div');
          media.className = 'tbr-product-media';
          product.insertBefore(media, gallery);
          media.appendChild(gallery);
          media.appendChild(authenticity);
        }
        else if (product) product.appendChild(authenticity);
        else (rentButton || info.lastElementChild).insertAdjacentElement('afterend', authenticity);
      }
    }

    if (rentButton && !document.querySelector('.tbr-mobile-rent')) {
      const selected = document.querySelector('input[name="dias"]:checked');
      const sticky = document.createElement('div');
      sticky.className = 'tbr-mobile-rent';
      sticky.innerHTML = `<span>${selected ? selected.parentElement.textContent.trim() : 'Escolha o período'}</span><button type="button">Alugar</button>`;
      sticky.querySelector('button').addEventListener('click', () => rentButton.click());
      document.querySelectorAll('input[name="dias"]').forEach((radio) => radio.addEventListener('change', () => {
        sticky.querySelector('span').textContent = radio.parentElement.textContent.trim();
      }));
      body.appendChild(sticky);
    }

    const shippingCache = new Map();
    let activeShippingRequest = null;
    const cleanCep = (value) => String(value || '').replace(/\D/g, '').slice(0, 8);
    const formatCep = (value) => {
      const cep = cleanCep(value);
      return cep.length > 5 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep;
    };
    const fetchJson = async (url, options, timeout = 10000) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) throw new Error('service_unavailable');
        return await response.json();
      } finally {
        clearTimeout(timer);
      }
    };
    const shippingMessage = (result, message, type = '') => {
      result.className = `tbr-shipping-status ${type}`.trim();
      result.textContent = message;
    };

    window.calcularFrete = async function calcularFreteOtimizado() {
      const input = document.getElementById('cep');
      const result = document.getElementById('freteResultado');
      const summary = document.getElementById('freteSelecionado');
      const button = document.querySelector('.btn-frete');
      const cep = cleanCep(input && input.value);
      if (!input || !result) return;
      input.value = formatCep(cep);
      if (cep.length !== 8) {
        shippingMessage(result, 'Digite um CEP completo com 8 números.', 'error');
        return;
      }
      if (activeShippingRequest) return activeShippingRequest;
      if (summary) summary.innerHTML = '';
      if (typeof freteIdaSelecionado !== 'undefined') freteIdaSelecionado = null;
      if (typeof freteVoltaSelecionado !== 'undefined') freteVoltaSelecionado = null;
      if (typeof prazoEntregaAtual !== 'undefined') prazoEntregaAtual = null;

      const renderOptions = ({ endereco, idaData, voltaData }) => {
        if (typeof ultimoEnderecoCep !== 'undefined') ultimoEnderecoCep = endereco;
        const outsideSP = String(endereco.uf || '').toUpperCase() !== 'SP';
        const shipping = Array.isArray(idaData) ? idaData.find((item) => item.name === 'SEDEX') : null;
        if (!shipping || !shipping.delivery_time) throw new Error('region_unavailable');
        const returnMatch = Array.isArray(voltaData) ? voltaData.find((item) => item.name === shipping.name) : null;
        const outboundPrice = Number.parseFloat(shipping.price);
        const returnPrice = Number.parseFloat(returnMatch?.price || shipping.price);
        const returnDays = returnMatch?.delivery_time || shipping.delivery_time;
        if (typeof prazoEntregaAtual !== 'undefined') prazoEntregaAtual = Number(shipping.delivery_time);
        result.className = 'tbr-shipping-options';
        result.innerHTML = `<p class="tbr-delivery-place">Entrega para: <strong>${endereco.localidade || 'Cidade'} — ${endereco.uf || ''}</strong></p><div class="tbr-shipping-group"><strong>Entrega</strong><div class="frete-opcao frete-ida" onclick="selecionarFreteIda('SEDEX', ${outboundPrice}, ${shipping.delivery_time}, this)"><span>SEDEX</span><small>${shipping.delivery_time} dias úteis</small><b>R$ ${outboundPrice.toFixed(2).replace('.', ',')}</b></div>${outsideSP ? '' : `<div class="frete-opcao frete-ida" onclick="selecionarFreteIda('Retirar', 0, 0, this)"><span>Retirar no showroom</span><small>Santos — SP</small><b>Grátis</b></div>`}</div><div class="tbr-shipping-group"><strong>Devolução</strong><div class="frete-opcao frete-volta" onclick="selecionarFreteVolta('SEDEX', ${returnPrice}, ${returnDays}, this)"><span>SEDEX</span><small>${returnDays} dias úteis</small><b>R$ ${returnPrice.toFixed(2).replace('.', ',')}</b></div>${outsideSP ? '' : `<div class="frete-opcao frete-volta" onclick="selecionarFreteVolta('Retirar', 0, 0, this)"><span>Entregar no showroom</span><small>Santos — SP</small><b>Grátis</b></div>`}</div>`;
      };

      const cached = shippingCache.get(cep);
      if (cached && Date.now() - cached.time < 10 * 60 * 1000) {
        try { renderOptions(cached.data); } catch (_) { shippingMessage(result, 'Não há entrega disponível para esse CEP.', 'error'); }
        return;
      }

      shippingMessage(result, 'Calculando entrega…', 'loading');
      if (button) {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
      }
      activeShippingRequest = (async () => {
        try {
          const endereco = await fetchJson(`https://viacep.com.br/ws/${cep}/json/`, {}, 7000);
          if (endereco.erro) throw new Error('cep_not_found');
          const endpoint = 'https://thebagroomtest.onrender.com/frete';
          const headers = { 'Content-Type': 'application/json' };
          const origin = '11060-003';
          const [idaData, voltaData] = await Promise.all([
            fetchJson(endpoint, { method: 'POST', headers, body: JSON.stringify({ from: { postal_code: origin }, to: { postal_code: cep } }) }, 15000),
            fetchJson(endpoint, { method: 'POST', headers, body: JSON.stringify({ from: { postal_code: cep }, to: { postal_code: origin } }) }, 15000)
          ]);
          const data = { endereco, idaData, voltaData };
          shippingCache.set(cep, { time: Date.now(), data });
          renderOptions(data);
        } catch (error) {
          const message = error.name === 'AbortError'
            ? 'A consulta demorou mais que o esperado. Tente novamente.'
            : error.message === 'cep_not_found'
              ? 'CEP não encontrado. Confira os números e tente novamente.'
              : error.message === 'region_unavailable'
                ? 'Não há entrega disponível para essa região.'
                : 'O serviço de entrega está indisponível no momento. Tente novamente em instantes.';
          shippingMessage(result, message, 'error');
        } finally {
          activeShippingRequest = null;
          if (button) {
            button.disabled = false;
            button.removeAttribute('aria-busy');
          }
        }
      })();
      return activeShippingRequest;
    };

    const cepInput = document.getElementById('cep');
    if (cepInput) {
      cepInput.addEventListener('input', () => { cepInput.value = formatCep(cepInput.value); });
      cepInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && cleanCep(cepInput.value).length === 8) {
          event.preventDefault();
          window.calcularFrete();
        }
      });
    }
  }

  const internalHero = document.querySelector('.hero-video, .internal-title');
  if (internalHero && !body.classList.contains('tbr-home')) {
    internalHero.classList.add('tbr-internal-hero');
  }

  const mountCanonicalFooter = () => {
    const footerMarkup = '<div class="footer-item"><span class="tbr-footer-label">PRECISA DE AJUDA?</span><div class="footer-content"><a href="https://wa.me/5513996904227" target="_blank" rel="noopener">WhatsApp (13) 99690-4227</a><br><a href="/como-alugar.html">Como alugar</a><br><a href="/autenticidade.html">Autenticidade</a></div></div><div class="footer-item"><span class="tbr-footer-label">EMPRESA</span><div class="footer-content"><a href="/quem-somos.html">Sobre a The Bag Room</a><br><a href="/como-desapegar.html">Como desapegar</a><br><a href="/universo/universo-do-luxo.html">Journal</a></div></div><div class="footer-item"><span class="tbr-footer-label">ENDEREÇO</span><div class="footer-content">Av. Ana Costa, 471 – Gonzaga<br>Santos – SP<br><a href="/termos-de-uso.html">Termos de uso</a></div></div><div class="footer-bottom">© 2026 The Bag Room · Curadoria, aluguel e consignação de luxo</div>';
    document.querySelectorAll('.footer-luxo').forEach((footer) => footer.remove());
    const canonicalFooter = document.createElement('footer');
    canonicalFooter.className = 'footer-luxo';
    canonicalFooter.innerHTML = footerMarkup;
    document.body.appendChild(canonicalFooter);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountCanonicalFooter, { once: true });
  else mountCanonicalFooter();

  document.querySelectorAll('img:not([alt])').forEach((img) => img.setAttribute('alt', ''));
})();
