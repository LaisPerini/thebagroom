// "Avise-me quando estiver livre" na página da bolsa.
// A cliente deixa a data desejada e o e-mail; quando a bolsa fica livre para essa data, recebe um e-mail.
(function () {
  'use strict';
  if (typeof BOLSA_SLUG === 'undefined') return;
  const API = 'https://zpyjnqkrsmgpwszqlcrs.supabase.co/rest/v1/avisos_disponibilidade';
  const KEY = 'sb_publishable_48rLPZfPRNtRX1kpYm0aWg_aVI1Hi2b';
  const AUTH = 'sb-zpyjnqkrsmgpwszqlcrs-auth-token';
  const dia = soma => { const d = new Date(); d.setDate(d.getDate() + soma); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const sessao = () => { try { const s = JSON.parse(localStorage.getItem(AUTH) || 'null'); return s && s.access_token && s.expires_at * 1000 > Date.now() + 30000 ? s : null; } catch (e) { return null; } };

  function css() {
    const st = document.createElement('style');
    st.textContent = `
.tbr-avise{margin:10px 0 0}
.tbr-avise-abrir{background:none!important;border:0!important;min-height:0!important;padding:4px 0!important;text-transform:none!important;letter-spacing:0!important;font:400 13px/1.5 Inter,Arial,sans-serif!important;color:#5f574e;text-decoration:underline;text-underline-offset:4px;cursor:pointer;text-align:left}
.tbr-avise form{margin:12px 0 0;padding:18px;border:1px solid #e7e1d8;background:#fffdf9;display:grid;gap:12px}
.tbr-avise p{margin:0;font:400 13px/1.55 Inter,Arial,sans-serif;color:#5f574e}
.tbr-avise label{display:grid;gap:6px;font:600 10px/1 Inter,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#1a1714}
.tbr-avise input{min-height:46px;padding:10px 12px;border:1px solid #e7e1d8;background:#fff;border-radius:0;font:400 15px/1.4 Inter,Arial,sans-serif;letter-spacing:0;text-transform:none;color:#1a1714;width:100%;box-sizing:border-box}
.tbr-avise button[type=submit]{min-height:48px;border:1px solid #1a1714;background:#1a1714;color:#fff;font:600 11px/1 Inter,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;cursor:pointer}
.tbr-avise button[disabled]{opacity:.5}
.tbr-avise .ok{padding:14px 16px;background:#f6f1e8;border-left:2px solid #1a1714;color:#1a1714}
.tbr-avise .erro{color:#9b2c2c}`;
    document.head.appendChild(st);
  }

  function montar() {
    const ancora = document.getElementById('calendarioStatus') || document.getElementById('dataInicio');
    if (!ancora || document.querySelector('.tbr-avise')) return;
    css();
    const box = document.createElement('div');
    box.className = 'tbr-avise';
    box.innerHTML = `<button type="button" class="tbr-avise-abrir" aria-expanded="false">A data que você quer está ocupada? Avise-me quando ficar livre</button>
      <form hidden novalidate>
        <p>Deixe a data e o seu e-mail. Se ela ficar disponível, a gente te avisa na hora.</p>
        <label>Data desejada<input type="date" name="data" required min="${dia(3)}" max="${dia(365)}"></label>
        <label>Seu e-mail<input type="email" name="email" required maxlength="200" autocomplete="email"></label>
        <p class="msg" aria-live="polite"></p>
        <button type="submit">Me avise</button>
      </form>`;
    ancora.after(box);
    const abrir = box.querySelector('.tbr-avise-abrir'), form = box.querySelector('form'), msg = box.querySelector('.msg');
    const s = sessao();
    if (s && s.user && s.user.email) form.email.value = s.user.email;
    abrir.addEventListener('click', () => {
      const on = form.hidden; form.hidden = !on; abrir.setAttribute('aria-expanded', String(on));
      if (on) form.data.focus();
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      msg.className = 'msg'; msg.textContent = '';
      const data = form.data.value, email = form.email.value.trim();
      if (!data || data < dia(3)) { msg.className = 'msg erro'; msg.textContent = 'Escolha uma data a partir de ' + dia(3).split('-').reverse().join('/') + '.'; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.className = 'msg erro'; msg.textContent = 'Confira o seu e-mail.'; return; }
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
      const dias = Number(document.querySelector('.opcoes input:checked')?.value) || 4;
      const s2 = sessao();
      try {
        const r = await fetch(API, {
          method: 'POST',
          headers: Object.assign({ apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, s2 ? { Authorization: 'Bearer ' + s2.access_token } : {}),
          body: JSON.stringify({ bolsa_slug: BOLSA_SLUG, email, data_desejada: data, dias, cliente_auth_id: s2 ? s2.user.id : null })
        });
        if (!r.ok && r.status !== 409) throw new Error('aviso_' + r.status);
        form.innerHTML = `<p class="ok">Pronto! Se a bolsa ficar livre para ${data.split('-').reverse().join('/')}, você recebe um e-mail em ${email.replace(/[<>&"]/g, '')}.</p>`;
      } catch (err) {
        console.warn(err);
        msg.className = 'msg erro'; msg.textContent = 'Não foi possível registrar agora. Tente de novo em instantes.';
        btn.disabled = false;
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar, { once: true });
  else montar();
})();
