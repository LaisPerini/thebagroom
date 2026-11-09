// Avisa a loja por e-mail quando um aluguel é pago/confirmado.
// Chamado pelo gatilho tbr_avisar_novo_aluguel (aluguel_pedidos). Envia no máximo
// um e-mail por pedido (tabela tbr_notificacoes_aluguel).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL") ?? "";
const emailFrom = Deno.env.get("EMAIL_FROM") ?? "The Bag Room <onboarding@resend.dev>";
const siteUrl = (Deno.env.get("SITE_URL") ?? "https://www.thebagroom.com.br").replace(/\/$/, "");
const PAGOS = ["pagamento_aprovado", "reserva_confirmada", "em_preparacao", "enviado", "em_uso"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const t = (v: unknown) => String(v ?? "").trim();
const esc = (v: unknown) =>
  t(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const brl = (v: unknown) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: unknown) => (t(iso) ? t(iso).slice(0, 10).split("-").reverse().join("/") : "-");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!resendApiKey || !adminEmail || !url || !key) return json({ error: "missing_configuration" }, 500);

  let pedidoId = "";
  try { pedidoId = t((await req.json())?.pedido_id); } catch { return json({ error: "invalid_json" }, 400); }
  if (!UUID.test(pedidoId)) return json({ error: "invalid_pedido" }, 400);

  const db = createClient(url, key);
  let marcou = false;
  try {
    const { data: pedido } = await db.from("aluguel_pedidos").select("*").eq("id", pedidoId).maybeSingle();
    if (!pedido || !PAGOS.includes(pedido.status)) return json({ ignored: true });

    // Garante um único aviso por pedido
    const { error: dupErr } = await db.from("tbr_notificacoes_aluguel").insert({ pedido_id: pedidoId });
    if (dupErr) return json({ ignored: true, reason: "ja_notificado" });
    marcou = true;

    const [{ data: reservas }, { data: cliente }, { data: endereco }] = await Promise.all([
      db.from("bolsa_reservas").select("data_inicio,data_fim,bolsas(nome,marca)").eq("pedido_id", pedidoId).order("data_inicio"),
      pedido.cliente_auth_id
        ? db.from("validacao_clientes").select("nome_completo,email,celular,instagram")
            .eq("usuario_auth_id", pedido.cliente_auth_id).order("created_date", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      pedido.endereco_entrega_id
        ? db.from("cliente_enderecos").select("*").eq("id", pedido.endereco_entrega_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const nome = t(cliente?.nome_completo) || "Cliente";
    const bolsas = (reservas ?? []).map((r: any) => {
      const b = Array.isArray(r.bolsas) ? r.bolsas[0] : r.bolsas;
      const n = t(b?.nome), m = t(b?.marca);
      const nomeBolsa = !n ? (m || "Bolsa") : (m && !n.toLowerCase().startsWith(m.toLowerCase()) ? `${m} ${n}` : n);
      return { nome: nomeBolsa, ini: r.data_inicio, fim: r.data_fim };
    });
    const titulo = bolsas.map((b) => b.nome).join(", ") || "Bolsa";
    const end = endereco
      ? `${esc(endereco.endereco)}, ${esc(endereco.numero)}${endereco.complemento ? " - " + esc(endereco.complemento) : ""}<br>${esc(endereco.bairro)} · ${esc(endereco.cidade)}/${esc(endereco.estado)} · CEP ${esc(endereco.cep)}`
      : "-";
    const linha = (k: string, v: string) =>
      `<tr><td style="padding:8px 0;color:#7a7268;font-size:12px;letter-spacing:.08em;text-transform:uppercase;width:150px;vertical-align:top">${k}</td><td style="padding:8px 0;font-size:15px;color:#1a1714">${v}</td></tr>`;

    const html = `
<div style="background:#f6f3ee;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7e1d8;padding:32px">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#7a7268">The Bag Room · Novo aluguel</p>
    <h1 style="margin:0 0 20px;font-family:'DM Serif Display',Georgia,serif;font-weight:400;font-size:28px;line-height:1.15;color:#1a1714">${esc(titulo)}</h1>
    <table style="width:100%;border-collapse:collapse">
      ${linha("Pedido", esc(pedido.numero || pedidoId.slice(0, 8)))}
      ${bolsas.map((b) => linha("Período", `${esc(b.nome)}<br>${dataBR(b.ini)} a ${dataBR(b.fim)}`)).join("")}
      ${linha("Cliente", esc(nome))}
      ${linha("E-mail", esc(cliente?.email || "-"))}
      ${linha("Celular", esc(cliente?.celular || "-"))}
      ${cliente?.instagram ? linha("Instagram", esc(cliente.instagram)) : ""}
      ${linha("Entrega", end)}
      ${linha("Aluguel", brl(pedido.subtotal_aluguel))}
      ${linha("Frete", brl(pedido.valor_frete))}
      ${Number(pedido.valor_desconto) ? linha("Desconto", "- " + brl(pedido.valor_desconto)) : ""}
      ${linha("Total pago", `<strong>${brl(pedido.valor_total)}</strong>`)}
      ${pedido.observacao_cliente ? linha("Observação", esc(pedido.observacao_cliente)) : ""}
    </table>
    <p style="margin:28px 0 0"><a href="${siteUrl}/admin.html" style="display:inline-block;background:#1a1714;color:#fff;text-decoration:none;padding:14px 24px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:bold">Abrir painel admin</a></p>
  </div>
</div>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: emailFrom, to: [adminEmail], subject: `Novo aluguel: ${titulo} · ${nome}`, html }),
    });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("resend_error", result);
      await db.from("tbr_notificacoes_aluguel").delete().eq("pedido_id", pedidoId); // permite tentar de novo
      return json({ error: "email_provider_error" }, 502);
    }
    return json({ ok: true, email_id: result.id });
  } catch (e) {
    console.error("notificar_aluguel_erro", e);
    if (marcou) await db.from("tbr_notificacoes_aluguel").delete().eq("pedido_id", pedidoId);
    return json({ error: "unexpected_error" }, 500);
  }
});
