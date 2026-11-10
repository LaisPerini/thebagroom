// Etiquetas automáticas no Melhor Envio (o site nunca paga nem gera a etiqueta: só coloca no carrinho).
// POST { acao: "carrinho", pedido_id } -> aluguel pago: coloca no carrinho o envio (loja -> cliente) e a devolução (cliente -> loja)
// POST { acao: "rastreios" }            -> de hora em hora: busca o código de rastreio das etiquetas já pagas/geradas
//                                          e grava no pedido (o que dispara o e-mail "Sua bolsa está a caminho").
// GET                                   -> diagnóstico simples (token funcionando?), sem dados pessoais.
// POST exige o segredo do disparador (EMAIL_WORKER_SECRET). Token do Melhor Envio: segredo MELHOR_ENVIO_TOKEN.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOKEN = Deno.env.get("MELHOR_ENVIO_TOKEN") ?? "";
const workerSecret = Deno.env.get("EMAIL_WORKER_SECRET") ?? "";
const API = "https://melhorenvio.com.br/api/v2/me";
const SEDEX = 2;
const SEGURO = 2000; // mesmo valor usado na cotação do site
const LOJA = {
  name: "The Bag Room", phone: "13996904227", email: "contato@thebagroom.com.br",
  company_document: "67639754000167", state_register: "ISENTO",
  address: "Avenida Ana Costa", number: "471", complement: "", district: "Gonzaga",
  city: "Santos", state_abbr: "SP", postal_code: "11060003", country_id: "BR",
};
const t = (v: unknown) => String(v ?? "").trim();
const so = (v: unknown) => t(v).replace(/\D/g, "");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function me(path: string, init: RequestInit = {}) {
  const r = await fetch(API + path, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}`,
      "User-Agent": "The Bag Room (contato@thebagroom.com.br)", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20000),
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

// "Entrega: SEDEX - R$ 31.68" / "Devolucao: Retirar - R$ 0" (gravado pelo checkout)
function modo(obs: string, rotulo: string) {
  const m = obs.match(new RegExp(rotulo + ":\\s*([^\\n-]+)", "i"));
  return t(m?.[1]);
}

async function carrinho(db: SupabaseClient, pedidoId: string) {
  const { data: p } = await db.from("aluguel_pedidos").select("id,numero,status,cliente_auth_id,endereco_entrega_id,endereco_devolucao_id,observacao_cliente").eq("id", pedidoId).maybeSingle();
  if (!p || !["pagamento_aprovado", "reserva_confirmada"].includes(p.status)) return { ignored: true };
  const obs = t(p.observacao_cliente);
  const ida = modo(obs, "Entrega"), volta = modo(obs, "Devolucao");
  const endereco = (id: string | null) => id ? db.from("cliente_enderecos").select("*").eq("id", id).maybeSingle() : Promise.resolve({ data: null });
  const [{ data: item }, { data: cli }, { data: endIda }, { data: endVolta }] = await Promise.all([
    db.from("aluguel_itens").select("bolsas(nome,marca)").eq("pedido_id", pedidoId).limit(1).maybeSingle(),
    db.from("validacao_clientes").select("nome_completo,email,celular,cpf").eq("usuario_auth_id", p.cliente_auth_id).order("created_date", { ascending: false }).limit(1).maybeSingle(),
    endereco(p.endereco_entrega_id),
    endereco(p.endereco_devolucao_id || p.endereco_entrega_id),
  ]);
  if (!cli) return { ignored: true, motivo: "sem_cadastro" };
  const b: any = Array.isArray((item as any)?.bolsas) ? (item as any).bolsas[0] : (item as any)?.bolsas;
  const nomeBolsa = t(b?.nome) || "Bolsa";
  const cliente = (end: any) => end && ({
    name: t(end.nome_destinatario) || t(cli.nome_completo), phone: so(cli.celular), email: t(cli.email),
    document: so(cli.cpf), address: t(end.endereco), number: t(end.numero), complement: t(end.complemento),
    district: t(end.bairro), city: t(end.cidade), state_abbr: t(end.estado).toUpperCase().slice(0, 2), postal_code: so(end.cep), country_id: "BR",
  });
  const pedidoNum = t(p.numero) || pedidoId.slice(0, 8);
  const corpo = (tipo: "envio" | "devolucao", cli: unknown) => ({
    service: SEDEX,
    from: tipo === "envio" ? LOJA : cli,
    to: tipo === "envio" ? cli : LOJA,
    products: [{ name: `Bolsa em aluguel (${nomeBolsa})`, quantity: 1, unitary_value: SEGURO }],
    volumes: [{ height: 10, width: 30, length: 30, weight: 1 }],
    options: {
      insurance_value: SEGURO, receipt: false, own_hand: false, reverse: false, non_commercial: true,
      reminder: tipo === "envio" ? `Pedido ${pedidoNum}` : `Devolução ${pedidoNum}`,
      tags: [{ tag: `${pedidoNum}-${tipo}`, url: null }],
    },
  });
  const resultado: Record<string, unknown> = {};
  for (const tipo of ["envio", "devolucao"] as const) {
    const escolha = tipo === "envio" ? ida : volta;
    if (!/sedex/i.test(escolha)) { resultado[tipo] = "sem_envio (" + (escolha || "?") + ")"; continue; }
    const dest = cliente(tipo === "envio" ? endIda : endVolta);
    if (!dest) { resultado[tipo] = "sem_endereco"; continue; }
    // uma etiqueta por pedido e tipo
    const { error: dup } = await db.from("melhor_envio_envios").insert({ pedido_id: pedidoId, tipo, status: "enviando" });
    if (dup) { resultado[tipo] = "ja_existe"; continue; }
    const r = await me("/cart", { method: "POST", body: JSON.stringify(corpo(tipo, dest)) });
    if (!r.ok || !r.body?.id) {
      console.error("me_cart_erro", tipo, r.status, JSON.stringify(r.body).slice(0, 400));
      await db.from("melhor_envio_envios").update({ status: "erro", erro: JSON.stringify(r.body).slice(0, 500) }).eq("pedido_id", pedidoId).eq("tipo", tipo);
      resultado[tipo] = "erro";
      continue;
    }
    await db.from("melhor_envio_envios").update({ status: "no_carrinho", me_order_id: r.body.id, protocolo: r.body.protocol ?? null, erro: null })
      .eq("pedido_id", pedidoId).eq("tipo", tipo);
    resultado[tipo] = "no_carrinho";
  }
  return resultado;
}

async function rastreios(db: SupabaseClient) {
  const { data: envios, error } = await db.from("melhor_envio_envios").select("pedido_id,tipo,me_order_id")
    .not("me_order_id", "is", null).is("rastreio", null)
    .gte("created_at", new Date(Date.now() - 60 * 864e5).toISOString()).limit(100);
  if (error) throw error;
  if (!envios?.length) return { pendentes: 0 };
  const r = await me("/shipment/tracking", { method: "POST", body: JSON.stringify({ orders: envios.map((e) => e.me_order_id) }) });
  if (!r.ok) { console.error("me_tracking_erro", r.status, JSON.stringify(r.body).slice(0, 300)); return { erro: r.status }; }
  const resultado: Record<string, string> = {};
  for (const e of envios) {
    const info = r.body?.[e.me_order_id];
    if (!info) continue;
    const codigo = t(info.tracking);
    await db.from("melhor_envio_envios").update({ status: t(info.status) || null, ...(codigo ? { rastreio: codigo } : {}) })
      .eq("pedido_id", e.pedido_id).eq("tipo", e.tipo);
    if (!codigo) { resultado[`${e.pedido_id}:${e.tipo}`] = t(info.status) || "sem_status"; continue; }
    const dados = { codigo_rastreio: codigo, transportadora: "Correios", url_rastreio: `https://www.melhorrastreio.com.br/rastreio/${encodeURIComponent(codigo)}` };
    const { data: existente } = await db.from("rastreamentos_aluguel").select("id,codigo_rastreio").eq("pedido_id", e.pedido_id).eq("tipo", e.tipo).maybeSingle();
    if (existente) { if (t(existente.codigo_rastreio) !== codigo) await db.from("rastreamentos_aluguel").update(dados).eq("id", existente.id); }
    else await db.from("rastreamentos_aluguel").insert({ pedido_id: e.pedido_id, tipo: e.tipo, ...dados });
    resultado[`${e.pedido_id}:${e.tipo}`] = "rastreio_" + codigo;
  }
  return resultado;
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    if (!TOKEN) return json({ token: false });
    const [carrinhoAtual, cotacao] = await Promise.all([
      me("/cart"),
      me("/shipment/calculate", { method: "POST", body: JSON.stringify({ from: { postal_code: "11060003" }, to: { postal_code: "01310100" }, products: [{ id: "1", width: 30, height: 10, length: 30, weight: 1, insurance_value: SEGURO, quantity: 1 }] }) }),
    ]);
    return json({ token: true, carrinho: carrinhoAtual.ok ? "ok" : carrinhoAtual.status, cotacao: cotacao.ok ? "ok" : cotacao.status });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!workerSecret || req.headers.get("Authorization") !== `Bearer ${workerSecret}`) return json({ error: "unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!TOKEN || !url || !key) return json({ error: "missing_configuration" }, 500);
  const body = await req.json().catch(() => ({}));
  const db = createClient(url, key);
  try {
    if (body?.acao === "carrinho" && /^[0-9a-f-]{36}$/i.test(t(body?.pedido_id))) return json(await carrinho(db, t(body.pedido_id)));
    if (body?.acao === "rastreios") return json(await rastreios(db));
    return json({ error: "acao_invalida" }, 400);
  } catch (e) {
    console.error("melhor_envio_erro", e instanceof Error ? e.message : e);
    return json({ error: "unexpected_error" }, 500);
  }
});
