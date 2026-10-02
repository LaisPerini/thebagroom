import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
});

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const adminEmail = "thebagroom.br@gmail.com";
    // Until a custom domain is verified in Resend, Gmail and other public
    // addresses cannot be used as the sender. Resend's onboarding sender is
    // valid for deliveries to the account owner's verified email.
    const fromEmail =
      Deno.env.get("RESEND_FROM_EMAIL") ||
      "The Bag Room <onboarding@resend.dev>";

    if (!resendApiKey) return json({ error: "RESEND_API_KEY is not configured" }, 503);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    await req.json().catch(() => ({}));

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: cliente, error: clienteError } = await adminClient
      .from("validacao_clientes")
      .select("id,nome_completo,email,celular,instagram,cidade,estado,status,created_date")
      .eq("usuario_auth_id", userData.user.id)
      .eq("status", "pendente")
      .order("created_date", { ascending: false })
      .limit(1)
      .single();

    if (clienteError || !cliente) return json({ error: "Cadastro not found" }, 404);

    const painelUrl = "https://www.thebagroom.com.br/admin.html?panel=clientes&filter=pendente";
    const nome = escapeHtml(cliente.nome_completo || "Nova cliente");
    const email = escapeHtml(cliente.email || "-");
    const celular = escapeHtml(cliente.celular || "-");
    const instagram = escapeHtml(cliente.instagram ? `@${cliente.instagram}` : "-");
    const localidade = escapeHtml([cliente.cidade, cliente.estado].filter(Boolean).join(" - ") || "-");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `novo-cliente-${cliente.id}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [adminEmail],
        subject: `Novo cadastro para aprovação | ${cliente.nome_completo || "The Bag Room"}`,
        html: `
          <div style="margin:0;padding:38px 18px;background:#f4f1ec;font-family:Arial,sans-serif;color:#171613">
            <table role="presentation" style="width:100%;max-width:620px;margin:auto;border-collapse:collapse;background:#fff">
              <tr><td style="padding:34px 38px 18px;text-align:center;border-bottom:1px solid #e4dfd7">
                <div style="font-family:Georgia,serif;font-size:22px;letter-spacing:6px">THE BAG ROOM</div>
              </td></tr>
              <tr><td style="padding:38px">
                <p style="margin:0 0 12px;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#777">Validação de clientes</p>
                <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:34px;font-weight:400">Novo cadastro aguardando aprovação</h1>
                <p style="margin:0 0 28px;line-height:1.7;color:#5d5952">Uma nova cliente enviou os dados e documentos para análise.</p>
                <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
                  <tr><td style="padding:10px 0;border-bottom:1px solid #eee9e2;color:#777">Nome</td><td style="padding:10px 0;border-bottom:1px solid #eee9e2;text-align:right"><strong>${nome}</strong></td></tr>
                  <tr><td style="padding:10px 0;border-bottom:1px solid #eee9e2;color:#777">E-mail</td><td style="padding:10px 0;border-bottom:1px solid #eee9e2;text-align:right">${email}</td></tr>
                  <tr><td style="padding:10px 0;border-bottom:1px solid #eee9e2;color:#777">Celular</td><td style="padding:10px 0;border-bottom:1px solid #eee9e2;text-align:right">${celular}</td></tr>
                  <tr><td style="padding:10px 0;border-bottom:1px solid #eee9e2;color:#777">Instagram</td><td style="padding:10px 0;border-bottom:1px solid #eee9e2;text-align:right">${instagram}</td></tr>
                  <tr><td style="padding:10px 0;color:#777">Cidade</td><td style="padding:10px 0;text-align:right">${localidade}</td></tr>
                </table>
                <div style="margin-top:32px;text-align:center">
                  <a href="${painelUrl}" style="display:inline-block;padding:15px 24px;background:#171613;color:#fff;text-decoration:none;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase">Analisar cadastro</a>
                </div>
                <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#777">Os documentos permanecem protegidos no Supabase e devem ser consultados apenas pelo painel administrativo.</p>
              </td></tr>
            </table>
          </div>`,
      }),
    });

    if (!response.ok) {
      console.error("Resend error", response.status, await response.text());
      return json({ error: "Unable to send notification" }, 502);
    }

    return json({ sent: true });
  } catch (error) {
    console.error("Customer notification failed", error instanceof Error ? error.message : error);
    return json({ error: "Unable to send notification" }, 500);
  }
});
