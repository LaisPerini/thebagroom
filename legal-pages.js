(() => {
 const main = document.querySelector('.tbr-legal'); if (!main) return;
 const nav = document.createElement('nav'); nav.className = 'legal-nav'; nav.setAttribute('aria-label','Informações ao cliente');
 for (const [file,label] of [['termos-de-uso.html','Termos de uso'],['politica-de-privacidade.html','Privacidade'],['politica-de-cookies.html','Cookies'],['entrega-e-devolucao.html','Entrega e devolução']]) { const a = document.createElement('a'); a.href = '/' + file; a.textContent = label; if (location.pathname.endsWith('/' + file)) a.setAttribute('aria-current','page'); nav.appendChild(a); }
 main.prepend(nav);
 const headings = [...main.querySelectorAll('h2')]; const details = document.createElement('details'); details.className = 'legal-index';
 const summary = document.createElement('summary'); summary.textContent = 'Nesta página'; details.appendChild(summary);
 const index = document.createElement('nav'); index.setAttribute('aria-label','Índice desta página');
 headings.forEach((heading,i) => { heading.id = 'secao-' + (i + 1); const a = document.createElement('a'); a.href = '#' + heading.id; a.textContent = heading.textContent; index.appendChild(a); });
 details.appendChild(index); if (headings[0]) headings[0].before(details);
})();
