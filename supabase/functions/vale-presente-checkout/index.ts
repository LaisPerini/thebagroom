// Compra de vale-presente da The Bag Room (cliente logada).
// POST { valor: 300|500|1000, destinatario_nome, destinatario_email, mensagem? } -> { checkout_url }
// Cria o vale "aguardando_pagamento" e a preferência do Mercado Pago (referência = id do vale).
// O webhook atual do Mercado Pago confirma o pagamento (tbr_processar_pagamento_mp -> tbr_processar_vale_mp).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const mpToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") ?? "";
const siteUrl = (Deno.env.get("SITE_URL") ?? "https://www.thebagroom.com.br").replace(/\/$/, "");
const VALORES = [300, 500, 1000];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const t = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceRoleKey || !mpToken) return json({ error: "missing_server_configuration" }, 500);
  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!token) return json({ error: "login_required" }, 401);
    const db = createClient(supabaseUrl, serviceRoleKey);
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "invalid_user" }, 401);

    const body = await req.json().catch(() => ({}));
    const valor = Number(body?.valor);
    const destinatario_nome = t(body?.destinatario_nome, 80);
    const destinatario_email = t(body?.destinatario_email, 200).toLowerCase();
    const mensagem = t(body?.mensagem, 400) || null;
    if (!VALORES.includes(valor)) return json({ error: "valor_invalido" }, 400);
    if (!destinatario_nome) return json({ error: "nome_obrigatorio" }, 400);
    if (!EMAIL.test(destinatario_email)) return json({ error: "email_invalido" }, 400);

    const { data: cad } = await db.from("validacao_clientes").select("nome_completo")
      .eq("usuario_auth_id", auth.user.id).order("created_date", { ascending: false }).limit(1).maybeSingle();

    const { data: vale, error: valeError } = await db.from("vales_presente").insert({
      comprador_auth_id: auth.user.id, comprador_nome: cad?.nome_completo ?? null,
      destinatario_nome, destinatario_email, mensagem, valor,
    }).select("id").single();
    if (valeError || !vale) { console.error("vale_insert", valeError); return json({ error: "vale_record_error" }, 500); }

    const preference = {
      items: [{ id: vale.id, title: `Vale-presente The Bag Room · R$ ${valor}`, description: `Para ${destinatario_nome}`, quantity: 1, currency_id: "BRL", unit_price: valor }],
      payer: { email: auth.user.email },
      external_reference: vale.id,
      back_urls: {
        success: `${siteUrl}/vale-presente.html?vale=${vale.id}&pagamento=success`,
        failure: `${siteUrl}/vale-presente.html?vale=${vale.id}&pagamento=failure`,
        pending: `${siteUrl}/vale-presente.html?vale=${vale.id}&pagamento=pending`,
      },
      payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }, { id: "prepaid_card" }], installments: 3 },
      auto_return: "approved",
      notification_url: `${supabaseUrl}/functions/v1/mercado-pago-webhook`,
      statement_descriptor: "THE BAG ROOM",
      metadata: { pedido_id: vale.id, tipo: "vale_presente" },
    };
    const resp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${mpToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(preference),
      signal: AbortSignal.timeout(15000),
    });
    const pref = await resp.json();
    if (!resp.ok) { console.error("mp_preference_error", JSON.stringify(pref).slice(0, 300)); return json({ error: "mercado_pago_error" }, 502); }
    const checkout_url = pref.init_point ?? pref.sandbox_init_point;
    await db.from("vales_presente").update({ checkout_url }).eq("id", vale.id);
    return json({ checkout_url, vale_id: vale.id });
  } catch (e) {
    console.error("vale_checkout_erro", e instanceof Error ? e.message : e);
    return json({ error: "unexpected_error" }, 500);
  }
});
