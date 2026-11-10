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

  /* ===== Cabeçalho e menu (padrão único em todas as páginas) ===== */
  const NAV = [
    ['/aluguel.html', 'Alugar'],
    ['/como-alugar.html', 'Como funciona'],
    ['/como-desapegar.html', 'Desapegar'],
    ['/autenticidade.html', 'Autenticidade'],
    ['/universo/universo-do-luxo.html', 'Journal'],
    ['/quem-somos.html', 'Sobre']
  ];
  const WHATSAPP = 'https://wa.me/5513996904227';
  const ICON_USER = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8.5" r="4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4 21c1.2-4.2 4.3-6.3 8-6.3s6.8 2.1 8 6.3" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';

  const header = document.querySelector('.site-header') || document.querySelector('body > header');
  const mobileMenu = document.getElementById('menuMobile');

  if (header) {
    header.classList.add('site-header');
    header.querySelectorAll('.luxury-desktop-nav, .luxury-header-actions').forEach((el) => el.remove());

    header.querySelectorAll('.menu-mobile-btn').forEach((toggle) => {
      toggle.classList.add('tbr-menu-toggle');
      toggle.setAttribute('role', 'button');
      toggle.setAttribute('tabindex', '0');
      toggle.setAttribute('aria-label', 'Abrir menu');
      toggle.setAttribute('aria-controls', 'menuMobile');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = '<svg class="tbr-menu-icon" width="26" height="12" viewBox="0 0 26 12" aria-hidden="true" focusable="false"><path d="M0 1h26M0 11h18" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
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

    if (!header.querySelector('.tbr-head-left')) {
      const left = document.createElement('div');
      left.className = 'tbr-head-left';
      left.innerHTML = `<a href="${WHATSAPP}" target="_blank" rel="noopener">Falar com a curadoria</a>`;
      header.appendChild(left);

      const right = document.createElement('div');
      right.className = 'tbr-head-right';
      right.innerHTML = `<a href="/minha-conta.html" aria-label="Minha conta">${ICON_USER}<span>Minha conta</span></a>`;
      header.appendChild(right);

      const nav = document.createElement('nav');
      nav.className = 'tbr-nav';
      nav.setAttribute('aria-label', 'Navegação principal');
      nav.innerHTML = NAV.map(([href, label]) => `<a href="${href}">${label}</a>`).join('');
      header.appendChild(nav);
    }

    if (mobileMenu) {
      // Fora do cabeçalho o menu cobre a tela inteira (o blur do cabeçalho o prenderia)
      document.body.appendChild(mobileMenu);
      mobileMenu.classList.add('tbr-drawer');
      const close = mobileMenu.querySelector('.close-menu');
      if (close) {
        close.setAttribute('role', 'button');
        close.setAttribute('tabindex', '0');
        close.innerHTML = '<span>Fechar</span><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
      }
      const inner = mobileMenu.querySelector('.menu-mobile-inner');
      if (inner) {
        const primary = [['/index.html', 'Início'], ...NAV];
        inner.innerHTML =
          '<p class="tbr-drawer-brand">THE BAG ROOM</p>' +
          '<div class="tbr-drawer-primary">' + primary.map(([href, label], i) => `<a href="${href}" style="--i:${i}">${label}</a>`).join('') + '</div>' +
          '<div class="tbr-drawer-secondary">' +
            `<a href="/minha-conta.html">Minha conta</a>` +
            `<a href="${WHATSAPP}" target="_blank" rel="noopener">Falar com a curadoria</a>` +
            '<a href="https://instagram.com/thebagroom.br" target="_blank" rel="noopener">Instagram</a>' +
          '</div>' +
          '<p class="tbr-drawer-address">Av. Ana Costa, 471 · Gonzaga · Santos</p>';
      }
    }

    const activePath = path.endsWith('/') ? '/index.html' : path;
    document.querySelectorAll('.site-header a, .tbr-drawer a').forEach((link) => {
      try {
        const linkPath = new URL(link.href, location.href).pathname.toLowerCase();
        const inJournal = activePath.startsWith('/universo/') && linkPath === '/universo/universo-do-luxo.html';
        const inRental = activePath.startsWith('/aluguel/') && linkPath === '/aluguel.html';
        if (linkPath === activePath || inJournal || inRental) link.setAttribute('aria-current', 'page');
      } catch (_) {}
    });

    // Cabeçalho compacto ao rolar
    let ticking = false;
    const onScroll = () => {
      body.classList.toggle('tbr-scrolled', window.scrollY > 40);
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  }

  if (mobileMenu) {
    if (typeof window.toggleMenuMobile !== 'function') {
      window.toggleMenuMobile = () => mobileMenu.classList.toggle('open');
    }
    const syncMenuState = () => {
      const open = mobileMenu.classList.contains('open');
      body.classList.toggle('tbr-menu-open', open);
      document.querySelectorAll('.menu-mobile-btn').forEach((b) => b.setAttribute('aria-expanded', String(open)));
    };
    const observer = new MutationObserver(syncMenuState);
    observer.observe(mobileMenu, { attributes: true, attributeFilter: ['class'] });
    mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
    }));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && mobileMenu.classList.contains('open')) mobileMenu.classList.remove('open');
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches && event.target.matches('.menu-mobile-btn, .close-menu')) {
        event.preventDefault();
        window.toggleMenuMobile();
      }
    });
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

      // Contador acompanha a rolagem da galeria (dedo, setas ou pontos)
      let countFrame = 0;
      slider.addEventListener('scroll', () => {
        cancelAnimationFrame(countFrame);
        countFrame = requestAnimationFrame(() => {
          const width = slider.clientWidth || 1;
          const total = slider.querySelectorAll('img').length;
          const index = Math.min(total - 1, Math.max(0, Math.round(slider.scrollLeft / width)));
          count.textContent = `${index + 1} / ${total}`;
        });
      }, { passive: true });

      // Arraste por script só quando a galeria NÃO rola sozinha.
      // No celular ela rola nativamente com o dedo; somar o script fazia a galeria
      // andar duas fotos ou parar no meio, mostrando fotos cortadas.
      const scrollsNatively = () => /auto|scroll/.test(getComputedStyle(slider).overflowX);
      let touchStartX = 0;
      gallery.addEventListener('touchstart', (event) => { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
      gallery.addEventListener('touchend', (event) => {
        if (scrollsNatively()) return;
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
        caution.innerHTML = `<span>${cautionRow.textContent.replace(/valor do cau[cç][aã]o:\s*/i, 'Caução de segurança: ').trim()}</span><button type="button" aria-label="Como funciona a caução">?</button><small>O valor é apenas pré-autorizado no cartão e liberado após a devolução da peça nas condições acordadas.</small>`;
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
      if (cached && Date.now() - cached.time < 5 * 60 * 1000) {
        try { renderOptions(cached.data); } catch (_) { shippingMessage(result, 'Não há entrega disponível para esse CEP.', 'error'); }
        return;
      }

      shippingMessage(result, 'Calculando entrega…', 'loading');
      if (button) {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
      }
      const slowShippingNotice = setTimeout(() => {
        shippingMessage(result, 'Consultando a transportadora. A primeira consulta pode levar um pouco mais de tempo…', 'loading');
      }, 12000);
      activeShippingRequest = (async () => {
        try {
          const endpoint = 'https://thebagroomtest.onrender.com/frete';
          const headers = { 'Content-Type': 'application/json' };
          const origin = '11060-003';
          const addressRequest = typeof window.validarCepEstadoSP === 'function'
            ? window.validarCepEstadoSP(cep)
            : fetchJson(`https://viacep.com.br/ws/${cep}/json/`, {}, 10000);
          const quoteRequest = typeof window.tbrQuoteRoundTrip === 'function'
            ? window.tbrQuoteRoundTrip(origin, cep)
            : Promise.all([
              fetchJson(endpoint, { method: 'POST', headers, body: JSON.stringify({ from: { postal_code: origin }, to: { postal_code: cep } }) }, 90000),
              fetchJson(endpoint, { method: 'POST', headers, body: JSON.stringify({ from: { postal_code: cep }, to: { postal_code: origin } }) }, 90000)
            ]);
          const [endereco, [idaData, voltaData]] = await Promise.all([addressRequest, quoteRequest]);
          if (endereco.erro) throw new Error('cep_not_found');
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
          clearTimeout(slowShippingNotice);
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

  // Vídeo da bolsa: a bolinha deixa de flutuar sobre a página e fica no canto da galeria
  const videoBubble = document.querySelector('.video-bubble');
  const productGallery = document.querySelector('.galeria');
  if (videoBubble && productGallery && body.classList.contains('tbr-product')) {
    productGallery.appendChild(videoBubble);
    videoBubble.classList.add('tbr-video-chip');
    videoBubble.setAttribute('role', 'button');
    videoBubble.setAttribute('aria-label', 'Assistir ao vídeo da bolsa');
  }

  const internalHero = document.querySelector('.hero-video, .internal-title');
  if (internalHero && !body.classList.contains('tbr-home')) {
    internalHero.classList.add('tbr-internal-hero');
    // Páginas com vídeo no topo: o menu fica transparente por cima do vídeo, como na página inicial
    if (internalHero.classList.contains('hero-video') && internalHero.querySelector('video')) body.classList.add('tbr-overlay');
  }

  const mountCanonicalFooter = () => {
    const footerMarkup = '<div class="footer-item"><span class="tbr-footer-label">PRECISA DE AJUDA?</span><div class="footer-content"><a href="https://wa.me/5513996904227" target="_blank" rel="noopener">WhatsApp (13) 99690-4227</a><br><a href="/como-alugar.html">Como alugar</a><br><a href="/como-alugar.html#duvidas">Dúvidas frequentes</a><br><a href="/autenticidade.html">Autenticidade</a></div></div><div class="footer-item"><span class="tbr-footer-label">EMPRESA</span><div class="footer-content"><a href="/quem-somos.html">Sobre a The Bag Room</a><br><a href="/como-desapegar.html">Como desapegar</a><br><a href="/universo/universo-do-luxo.html">Journal</a><span class="tbr-footer-social"><a href="https://instagram.com/thebagroom.br" target="_blank" rel="noopener">Instagram</a><a href="https://tiktok.com/@thebagroom.br" target="_blank" rel="noopener">TikTok</a><a href="https://chat.whatsapp.com/J9gxW9Whk778OKfLGnjoWN?mode=gi_t" target="_blank" rel="noopener">Grupo VIP</a></span></div></div><div class="footer-item"><span class="tbr-footer-label">ENDEREÇO</span><div class="footer-content">Av. Ana Costa, 471 – Gonzaga<br>Santos – SP<br><a href="/termos-de-uso.html">Termos de uso</a><br><a href="/politica-de-privacidade.html">Privacidade e LGPD</a><br><a href="/politica-de-cookies.html">Política de cookies</a><br><button type="button" onclick="window.TBRCookies && window.TBRCookies.open()" style="border:0;padding:0;background:none;color:inherit;font:inherit;text-decoration:underline;cursor:pointer">Preferências de cookies</button><br><a href="/entrega-e-devolucao.html">Entrega, devolução e cancelamento</a><br><a href="/contrato-aluguel.html">Contrato de locação</a></div></div><div class="footer-bottom">© 2026 The Bag Room · Curadoria, aluguel e consignação de luxo<br>67.639.754 LAIS DE PAULA PERINI · CNPJ 67.639.754/0001-67<br>Av. Ana Costa, 471 — Gonzaga, Santos/SP — CEP 11060-003<br><a href="mailto:contato@thebagroom.com.br">contato@thebagroom.com.br</a></div>';
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

// Revelação ao rolar (inspirado na Dior): títulos aparecem palavra por palavra saindo do desfoque
// e as fotos surgem do desfoque dentro do próprio quadro (como na Tod's), sem mexer no texto quando entram na tela. Só anima o que ainda está abaixo
// da dobra; respeita quem prefere menos movimento.
(function () {
  if (/\/(admin|checkout|minha-conta|login|cadastro)/.test(location.pathname)) return;
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const FORA = 'header, nav, footer, form, dialog, .menu-mobile, #tbr-cookie-panel, .slider, .hero-feature, .tbr-cond, [data-no-reveal]';
  const TITULOS = 'h1, h2';
  const BLOCOS = 'img';

  function css() {
    const st = document.createElement('style');
    st.textContent = `
.tbr-rv{opacity:0;filter:blur(10px);transform:scale(1.03);transition:opacity 1.1s ease,filter 1.2s ease,transform 1.4s cubic-bezier(.2,.7,.2,1)!important;transition-delay:var(--tbr-d,0s)!important}
.tbr-rv.tbr-in{opacity:1;filter:none;transform:none}
.tbr-w{display:inline-block}
.tbr-w>span{display:inline-block;opacity:0;filter:blur(12px);transition:opacity .9s ease,filter 1s ease;transition-delay:calc(var(--tbr-i,0) * 90ms + var(--tbr-d,0s))}
.tbr-words.tbr-in .tbr-w>span{opacity:1;filter:none}`;
    document.head.appendChild(st);
  }

  const abaixoDaDobra = el => el.getBoundingClientRect().top > innerHeight * 0.9;
  const visivel = el => el.offsetParent !== null || getComputedStyle(el).position === 'fixed';

  // Quebra o título em palavras (só títulos de texto simples)
  function palavras(h) {
    if ([...h.childNodes].some(n => n.nodeType === 1 && n.tagName !== 'BR')) return false;
    let i = 0;
    const frag = document.createDocumentFragment();
    h.childNodes.forEach(n => {
      if (n.nodeType === 1) { frag.appendChild(n.cloneNode()); return; }
      n.textContent.split(/(\s+)/).forEach(parte => {
        if (!parte) return;
        if (/^\s+$/.test(parte)) { frag.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span'); w.className = 'tbr-w';
        const s = document.createElement('span'); s.textContent = parte; s.style.setProperty('--tbr-i', i++);
        w.appendChild(s); frag.appendChild(w);
      });
    });
    if (!i) return false;
    h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    h.textContent = ''; h.appendChild(frag);
    h.classList.add('tbr-words');
    return true;
  }

  function limpar(el) {
    // Depois da animação, tira o transform para não interferir em nada da página
    setTimeout(() => { el.classList.remove('tbr-rv', 'tbr-in'); el.style.removeProperty('--tbr-d'); }, 2000);
  }

  function iniciar() {
    css();
    const io = new IntersectionObserver(entradas => {
      let n = 0;
      entradas.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        el.style.setProperty('--tbr-d', Math.min(n++ * 0.08, 0.4) + 's');
        el.classList.add('tbr-in');
        io.unobserve(el);
        if (el.classList.contains('tbr-rv')) limpar(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    document.querySelectorAll(TITULOS).forEach(h => {
      if (h.closest(FORA) || !visivel(h) || !abaixoDaDobra(h)) return;
      if (palavras(h)) io.observe(h);
    });
    document.querySelectorAll(BLOCOS).forEach(el => {
      if (el.closest(FORA) || !visivel(el) || !abaixoDaDobra(el)) return;
      if (el.closest('.img-hover, .tbr-m-arrow') || el.classList.contains('img-hover')) return;
      const r = el.getBoundingClientRect(); if (r.width < 90 || r.height < 90) return; // ícones e selos ficam parados
      el.classList.add('tbr-rv');
      io.observe(el);
    });
  }

  if (document.readyState === 'complete') iniciar();
  else addEventListener('load', iniciar, { once: true });
})();
