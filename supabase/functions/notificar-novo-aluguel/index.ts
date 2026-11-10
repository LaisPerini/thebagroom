// E-mails de aluguel da The Bag Room.
// 1) { pedido_id }  -> chamado pelo gatilho tbr_avisar_novo_aluguel quando o aluguel é pago/confirmado:
//    avisa a loja e manda a confirmação para a cliente.
// 2) { acao: "lembretes" } -> chamado 1x por dia (pg_cron): lembra a cliente que a devolução é amanhã
//    e pede a avaliação de quem já devolveu a bolsa.
// 3) { acao: "pagamentos_pendentes" } -> de hora em hora (pg_cron): lembra quem fez o pedido e não pagou
//    e quem deixou uma bolsa na sacola (cliente logada) sem finalizar.
// Cada e-mail sai uma única vez por pedido (tabela tbr_notificacoes_aluguel, chave pedido_id + tipo).
// Só aceita chamadas com o segredo do disparador (EMAIL_WORKER_SECRET).
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL") ?? "";
const emailFrom = Deno.env.get("EMAIL_FROM") ?? "";
const workerSecret = Deno.env.get("EMAIL_WORKER_SECRET") ?? "";
const siteUrl = (Deno.env.get("SITE_URL") ?? "https://www.thebagroom.com.br").replace(/\/$/, "");
const WHATSAPP = "https://wa.me/5513996904227";
const PAGOS = ["pagamento_aprovado", "reserva_confirmada", "em_preparacao", "enviado", "em_uso"];
const RESERVA_ENCERRADA = ["cancelada", "devolvida", "caucao_liberada", "bloqueio_manual", "aguardando_pagamento"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const t = (v: unknown) => String(v ?? "").trim();
const esc = (v: unknown) =>
  t(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const brl = (v: unknown) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: unknown) => (t(iso) ? t(iso).slice(0, 10).split("-").reverse().join("/") : "-");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- visual dos e-mails ----------
const linha = (k: string, v: string) =>
  `<tr><td style="padding:8px 0;color:#7a7268;font-size:12px;letter-spacing:.08em;text-transform:uppercase;width:140px;vertical-align:top">${k}</td><td style="padding:8px 0;font-size:15px;color:#1a1714">${v}</td></tr>`;
const botao = (href: string, txt: string) =>
  `<p style="margin:28px 0 0"><a href="${href}" style="display:inline-block;background:#1a1714;color:#fff;text-decoration:none;padding:14px 24px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:bold">${txt}</a></p>`;
const moldura = (rotulo: string, titulo: string, corpo: string, rodape = true) => `
<div style="background:#f6f3ee;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7e1d8;padding:32px">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#7a7268">${rotulo}</p>
    <h1 style="margin:0 0 20px;font-family:'DM Serif Display',Georgia,serif;font-weight:400;font-size:28px;line-height:1.15;color:#1a1714">${titulo}</h1>
    ${corpo}
  </div>
  ${rodape ? `<p style="max-width:560px;margin:18px auto 0;text-align:center;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#7a7268">The Bag Room · <a href="${siteUrl}" style="color:#7a7268">thebagroom.com.br</a></p>` : ""}
</div>`;
const paragrafo = (txt: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a1714">${txt}</p>`;

// ---------- dados do pedido ----------
async function carregarPedido(db: SupabaseClient, pedidoId: string) {
  const { data: pedido } = await db.from("aluguel_pedidos").select("*").eq("id", pedidoId).maybeSingle();
  if (!pedido) return null;
  const [{ data: reservas }, { data: cadastro }, { data: endereco }] = await Promise.all([
    db.from("bolsa_reservas").select("data_inicio,data_fim,status,bolsas(nome,marca)").eq("pedido_id", pedidoId).order("data_inicio"),
    pedido.cliente_auth_id
      ? db.from("validacao_clientes").select("nome_completo,email,celular,instagram")
          .eq("usuario_auth_id", pedido.cliente_auth_id).order("created_date", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    pedido.endereco_entrega_id
      ? db.from("cliente_enderecos").select("*").eq("id", pedido.endereco_entrega_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  let email = t(cadastro?.email);
  if (!EMAIL.test(email) && pedido.cliente_auth_id) {
    const { data } = await db.auth.admin.getUserById(pedido.cliente_auth_id);
    email = t(data?.user?.email);
  }
  const bolsas = (reservas ?? []).filter((r: any) => !["cancelada"].includes(r.status)).map((r: any) => {
    const b = Array.isArray(r.bolsas) ? r.bolsas[0] : r.bolsas;
    const n = t(b?.nome), m = t(b?.marca);
    const nome = !n ? (m || "Bolsa") : (m && !n.toLowerCase().startsWith(m.toLowerCase()) ? `${m} ${n}` : n);
    return { nome, ini: r.data_inicio, fim: r.data_fim };
  });
  const enderecoHtml = endereco
    ? `${esc(endereco.endereco)}, ${esc(endereco.numero)}${endereco.complemento ? " - " + esc(endereco.complemento) : ""}<br>${esc(endereco.bairro)} · ${esc(endereco.cidade)}/${esc(endereco.estado)} · CEP ${esc(endereco.cep)}`
    : "";
  return {
    pedido, bolsas, enderecoHtml, email,
    nome: t(cadastro?.nome_completo) || "Cliente",
    primeiroNome: (t(cadastro?.nome_completo).split(/\s+/)[0]) || "",
    cadastro,
    titulo: bolsas.map((b) => b.nome).join(", ") || "Sua bolsa",
  };
}
type Dados = NonNullable<Awaited<ReturnType<typeof carregarPedido>>>;

// ---------- envio com registro (no máximo 1 por pedido e tipo) ----------
async function enviarUmaVez(db: SupabaseClient, pedidoId: string, tipo: string, para: string, assunto: string, html: string) {
  if (!EMAIL.test(para)) return "sem_email";
  const { error: dup } = await db.from("tbr_notificacoes_aluguel").insert({ pedido_id: pedidoId, tipo });
  if (dup) return "ja_enviado";
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json", "Idempotency-Key": `aluguel-${tipo}-${pedidoId}` },
      body: JSON.stringify({ from: emailFrom, to: [para], subject: assunto, html }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new Error("provider_" + resp.status);
    return "enviado";
  } catch (e) {
    console.error("email_falhou", tipo, pedidoId, e instanceof Error ? e.message : e);
    await db.from("tbr_notificacoes_aluguel").delete().eq("pedido_id", pedidoId).eq("tipo", tipo); // permite tentar de novo
    return "falhou";
  }
}

function emailLoja(d: Dados) {
  const p = d.pedido;
  const corpo = `<table style="width:100%;border-collapse:collapse">
      ${linha("Pedido", esc(p.numero || p.id.slice(0, 8)))}
      ${d.bolsas.map((b) => linha("Período", `${esc(b.nome)}<br>${dataBR(b.ini)} a ${dataBR(b.fim)}`)).join("")}
      ${linha("Cliente", esc(d.nome))}
      ${linha("E-mail", esc(d.email || "-"))}
      ${linha("Celular", esc(d.cadastro?.celular || "-"))}
      ${d.cadastro?.instagram ? linha("Instagram", esc(d.cadastro.instagram)) : ""}
      ${linha("Entrega", d.enderecoHtml || "-")}
      ${linha("Aluguel", brl(p.subtotal_aluguel))}
      ${linha("Frete", brl(p.valor_frete))}
      ${Number(p.valor_desconto) ? linha("Desconto", "- " + brl(p.valor_desconto)) : ""}
      ${linha("Total pago", `<strong>${brl(p.valor_total)}</strong>`)}
      ${p.observacao_cliente ? linha("Observação", esc(p.observacao_cliente)) : ""}
    </table>${botao(`${siteUrl}/admin.html`, "Abrir painel admin")}`;
  return { assunto: `Novo aluguel: ${d.titulo} · ${d.nome}`, html: moldura("The Bag Room · Novo aluguel", esc(d.titulo), corpo, false) };
}

function emailConfirmacao(d: Dados) {
  const p = d.pedido;
  const ola = d.primeiroNome ? `Olá, ${esc(d.primeiroNome)}.` : "Olá.";
  const corpo = `
    ${paragrafo(`${ola} Recebemos o seu pagamento e a sua reserva está confirmada. Agora a gente cuida de tudo: a bolsa passa pela nossa higienização e conferência e segue embalada para você.`)}
    <table style="width:100%;border-collapse:collapse;margin:8px 0 6px">
      ${linha("Pedido", esc(p.numero || p.id.slice(0, 8)))}
      ${d.bolsas.map((b) => linha("Bolsa", `${esc(b.nome)}<br><span style="color:#7a7268">${dataBR(b.ini)} a ${dataBR(b.fim)}</span>`)).join("")}
      ${d.enderecoHtml ? linha("Entrega", d.enderecoHtml) : ""}
      ${linha("Total pago", `<strong>${brl(p.valor_total)}</strong>`)}
    </table>
    ${paragrafo(`Você acompanha o pedido em <a href="${siteUrl}/minha-conta.html" style="color:#1a1714">Minha conta</a>. Se precisar de qualquer coisa, é só chamar a nossa curadoria no <a href="${WHATSAPP}" style="color:#1a1714">WhatsApp</a>.`)}
    ${botao(`${siteUrl}/minha-conta.html`, "Ver meu pedido")}`;
  return { assunto: `Sua reserva está confirmada · ${d.titulo}`, html: moldura("The Bag Room · Reserva confirmada", "Sua bolsa está reservada", corpo) };
}

function emailLembrete(d: Dados, fim: string) {
  const ola = d.primeiroNome ? `Olá, ${esc(d.primeiroNome)}.` : "Olá.";
  const corpo = `
    ${paragrafo(`${ola} Esperamos que você tenha aproveitado cada momento com a sua ${esc(d.titulo)}.`)}
    ${paragrafo(`Passando para lembrar que o período do seu aluguel termina <strong>amanhã, ${dataBR(fim)}</strong>. Deixe a bolsa pronta com a embalagem, o dust bag e os acessórios que vieram com ela.`)}
    ${paragrafo(`Qualquer dúvida sobre a devolução, fale com a gente pelo WhatsApp. Vai ser um prazer te receber de novo.`)}
    ${botao(WHATSAPP, "Falar com a curadoria")}`;
  return { assunto: `Sua devolução é amanhã · ${d.titulo}`, html: moldura("The Bag Room · Lembrete de devolução", "Sua devolução é amanhã", corpo) };
}

function emailPagamentoPendente(d: Dados) {
  const ola = d.primeiroNome ? `Olá, ${esc(d.primeiroNome)}.` : "Olá.";
  const b = d.bolsas[0];
  const corpo = `
    ${paragrafo(`${ola} Notamos que o seu pedido da <strong>${esc(d.titulo)}</strong> ainda está aguardando o pagamento.`)}
    ${b ? `<table style="width:100%;border-collapse:collapse;margin:8px 0 6px">${linha("Período", `${dataBR(b.ini)} a ${dataBR(b.fim)}`)}${linha("Total", `<strong>${brl(d.pedido.valor_total)}</strong>`)}</table>` : ""}
    ${paragrafo(`A reserva só é garantida depois do pagamento. Para concluir, é só abrir Minha conta e tocar em pagar. Se teve alguma dificuldade, a nossa curadoria te ajuda pelo <a href="${WHATSAPP}" style="color:#1a1714">WhatsApp</a>.`)}
    ${botao(`${siteUrl}/minha-conta.html`, "Concluir pagamento")}`;
  return { assunto: `Sua ${d.titulo} está esperando por você`, html: moldura("The Bag Room · Pagamento pendente", "Falta pouco para a sua reserva", corpo) };
}

function emailAvaliacao(d: Dados, pedidoId: string) {
  const ola = d.primeiroNome ? `Olá, ${esc(d.primeiroNome)}.` : "Olá.";
  const link = `${siteUrl}/avaliar.html?pedido=${pedidoId}`;
  const estrelas = [1, 2, 3, 4, 5].map((n) =>
    `<a href="${link}&nota=${n}" style="display:inline-block;margin:0 4px;font-size:30px;line-height:1;color:#1a1714;text-decoration:none">&#9734;</a>`).join("");
  const corpo = `
    ${paragrafo(`${ola} Recebemos a sua ${esc(d.titulo)} de volta. Obrigada por escolher a The Bag Room.`)}
    ${paragrafo(`Como foi a sua experiência? Leva menos de um minuto e ajuda muito a nossa curadoria.`)}
    <p style="margin:22px 0 4px;text-align:center">${estrelas}</p>
    <p style="margin:0;text-align:center;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7a7268">Toque para dar a sua nota</p>
    ${botao(link, "Avaliar minha experiência")}`;
  return { assunto: `Como foi a sua experiência com a ${d.titulo}?`, html: moldura("The Bag Room · Sua opinião", "Conte como foi", corpo) };
}

function emailSacola(primeiroNome: string, item: any, slug: string) {
  const ola = primeiroNome ? `Olá, ${esc(primeiroNome)}.` : "Olá.";
  const nome = esc(item?.bolsaNome || "sua bolsa");
  const img = t(item?.imagem);
  const foto = /^\/img\//.test(img) || /^https:\/\//.test(img)
    ? `<p style="margin:6px 0 18px;text-align:center"><img src="${esc(img.startsWith("/") ? siteUrl + img : img)}" alt="" width="220" style="max-width:220px;height:auto;background:#f6f4f0"></p>` : "";
  const corpo = `
    ${paragrafo(`${ola} A <strong>${nome}</strong> continua na sua sacola, esperando por você.`)}
    ${foto}
    <table style="width:100%;border-collapse:collapse;margin:8px 0 6px">
      ${item?.dataInicio ? linha("Período", `${esc(item.dataInicio)} a ${esc(item.dataFim)}`) : ""}
      ${item?.valorTotal ? linha("Total", `<strong>${brl(item.valorTotal)}</strong>`) : ""}
    </table>
    ${paragrafo(`As datas só ficam reservadas quando o aluguel é finalizado. Se tiver qualquer dúvida, a nossa curadoria te ajuda pelo <a href="${WHATSAPP}" style="color:#1a1714">WhatsApp</a>.`)}
    ${botao(`${siteUrl}/aluguel/${encodeURIComponent(slug)}.html?sacola=1`, "Voltar para a sacola")}`;
  return { assunto: `A ${t(item?.bolsaNome) || "sua bolsa"} ainda está na sua sacola`, html: moldura("The Bag Room · Sua sacola", "Ela continua esperando por você", corpo) };
}

// Sacolas paradas há 3h a 48h, sem lembrete, com a data de retirada ainda possível
async function sacolasParadas(db: SupabaseClient) {
  const agora = Date.now();
  const limite = new Date(agora - 3 * 3600e3 + 3 * 24 * 3600e3).toISOString().slice(0, 10); // retirada ≥ hoje + 3 dias
  const { data, error } = await db.from("sacolas").select("cliente_auth_id,bolsa_slug,data_inicio,dados")
    .is("lembrete_enviado_em", null)
    .lte("atualizado_em", new Date(agora - 3 * 3600e3).toISOString())
    .gte("atualizado_em", new Date(agora - 48 * 3600e3).toISOString());
  if (error) throw error;
  const resultado: Record<string, string> = {};
  for (const sac of data ?? []) {
    if (!sac.data_inicio || t(sac.data_inicio) < limite) continue;
    const [{ data: cad }, { data: u }] = await Promise.all([
      db.from("validacao_clientes").select("nome_completo,email").eq("usuario_auth_id", sac.cliente_auth_id)
        .order("created_date", { ascending: false }).limit(1).maybeSingle(),
      db.auth.admin.getUserById(sac.cliente_auth_id),
    ]);
    const para = EMAIL.test(t(cad?.email)) ? t(cad?.email) : t(u?.user?.email);
    if (!EMAIL.test(para)) continue;
    // marca antes de enviar: no máximo um lembrete por sacola
    const { data: marcada } = await db.from("sacolas").update({ lembrete_enviado_em: new Date().toISOString() })
      .eq("cliente_auth_id", sac.cliente_auth_id).is("lembrete_enviado_em", null).select("cliente_auth_id");
    if (!marcada?.length) continue;
    const e = emailSacola(t(cad?.nome_completo).split(/\s+/)[0] || "", sac.dados, sac.bolsa_slug);
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json", "Idempotency-Key": `sacola-${sac.cliente_auth_id}-${sac.bolsa_slug}-${sac.data_inicio}` },
        body: JSON.stringify({ from: emailFrom, to: [para], subject: e.assunto, html: e.html }),
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) throw new Error("provider_" + resp.status);
      resultado[sac.cliente_auth_id] = "enviado";
    } catch (err) {
      console.error("email_sacola_falhou", sac.cliente_auth_id, err instanceof Error ? err.message : err);
      await db.from("sacolas").update({ lembrete_enviado_em: null }).eq("cliente_auth_id", sac.cliente_auth_id);
      resultado[sac.cliente_auth_id] = "falhou";
    }
  }
  return resultado;
}

// ---------- rotas ----------
async function novoAluguel(db: SupabaseClient, pedidoId: string) {
  const d = await carregarPedido(db, pedidoId);
  if (!d || !PAGOS.includes(d.pedido.status)) return { ignored: true };
  const loja = emailLoja(d), cliente = emailConfirmacao(d);
  const [rLoja, rCliente] = await Promise.all([
    enviarUmaVez(db, pedidoId, "admin", adminEmail, loja.assunto, loja.html),
    enviarUmaVez(db, pedidoId, "confirmacao_cliente", d.email, cliente.assunto, cliente.html),
  ]);
  return { loja: rLoja, cliente: rCliente };
}

async function lembretes(db: SupabaseClient) {
  // "amanhã" no horário de Brasília
  const agora = new Date(Date.now() - 3 * 3600 * 1000);
  agora.setUTCDate(agora.getUTCDate() + 1);
  const amanha = agora.toISOString().slice(0, 10);
  const { data: reservas, error } = await db.from("bolsa_reservas").select("pedido_id,status,data_fim")
    .eq("data_fim", amanha).not("pedido_id", "is", null);
  if (error) throw error;
  const pedidos = [...new Set((reservas ?? []).filter((r: any) => !RESERVA_ENCERRADA.includes(r.status)).map((r: any) => r.pedido_id))];
  const resultado: Record<string, string> = {};
  for (const id of pedidos) {
    const d = await carregarPedido(db, id);
    if (!d || !PAGOS.includes(d.pedido.status)) continue;
    const e = emailLembrete(d, amanha);
    resultado[id] = await enviarUmaVez(db, id, "lembrete_devolucao", d.email, e.assunto, e.html);
  }
  return { data: amanha, pedidos: pedidos.length, resultado, avaliacoes: await pedirAvaliacoes(db) };
}

// Pede a avaliação de quem devolveu a bolsa (status devolvido/caução liberada) há pelo menos 20h e no máximo 14 dias
async function pedirAvaliacoes(db: SupabaseClient) {
  const agora = Date.now();
  const { data, error } = await db.from("aluguel_pedidos").select("id,updated_at")
    .in("status", ["devolvido", "caucao_liberada"])
    .lte("updated_at", new Date(agora - 20 * 3600e3).toISOString())
    .gte("updated_at", new Date(agora - 14 * 24 * 3600e3).toISOString());
  if (error) throw error;
  const resultado: Record<string, string> = {};
  for (const { id } of data ?? []) {
    const { data: ja } = await db.from("avaliacoes").select("id").eq("pedido_id", id).maybeSingle();
    if (ja) continue;
    const d = await carregarPedido(db, id);
    if (!d) continue;
    const e = emailAvaliacao(d, id);
    resultado[id] = await enviarUmaVez(db, id, "pedido_avaliacao", d.email, e.assunto, e.html);
  }
  return resultado;
}

// Lembra quem fez o pedido entre 2h e 72h atrás e ainda não pagou (só se a data de retirada não passou)
async function pagamentosPendentes(db: SupabaseClient) {
  const agora = Date.now();
  const hoje = new Date(agora - 3 * 3600e3).toISOString().slice(0, 10);
  const { data, error } = await db.from("aluguel_pedidos").select("id")
    .eq("status", "aguardando_pagamento")
    .lte("created_at", new Date(agora - 2 * 3600e3).toISOString())
    .gte("created_at", new Date(agora - 72 * 3600e3).toISOString());
  if (error) throw error;
  const resultado: Record<string, string> = {};
  for (const { id } of data ?? []) {
    const d = await carregarPedido(db, id);
    if (!d || d.pedido.status !== "aguardando_pagamento") continue;
    if (!d.bolsas.length || d.bolsas.some((b) => t(b.ini) < hoje)) continue;
    const e = emailPagamentoPendente(d);
    resultado[id] = await enviarUmaVez(db, id, "pagamento_pendente", d.email, e.assunto, e.html);
  }
  return resultado;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!workerSecret || req.headers.get("Authorization") !== `Bearer ${workerSecret}`) return json({ error: "unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!resendApiKey || !adminEmail || !emailFrom || !url || !key) return json({ error: "missing_configuration" }, 500);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const db = createClient(url, key);
  try {
    if (body?.acao === "lembretes") return json(await lembretes(db));
    if (body?.acao === "pagamentos_pendentes") return json({ pedidos: await pagamentosPendentes(db), sacolas: await sacolasParadas(db) });
    const pedidoId = t(body?.pedido_id);
    if (!UUID.test(pedidoId)) return json({ error: "invalid_pedido" }, 400);
    return json(await novoAluguel(db, pedidoId));
  } catch (e) {
    console.error("emails_aluguel_erro", e);
    return json({ error: "unexpected_error" }, 500);
  }
});
