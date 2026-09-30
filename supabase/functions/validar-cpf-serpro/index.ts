const allowedOrigins = new Set([
  "https://www.thebagroom.com.br",
  "https://thebagroom.com.br",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://www.thebagroom.com.br",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function validCpf(value: string) {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let size = 9; size <= 10; size++) {
    let sum = 0;
    for (let index = 0; index < size; index++) sum += Number(cpf[index]) * (size + 1 - index);
    let digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;
    if (digit !== Number(cpf[size])) return false;
  }
  return true;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { valid: false }, 405);

  const clientId = Deno.env.get("SERPRO_CONSUMER_KEY");
  const clientSecret = Deno.env.get("SERPRO_CONSUMER_SECRET");
  const consultationUrl = Deno.env.get("SERPRO_CPF_URL");
  const tokenUrl = Deno.env.get("SERPRO_TOKEN_URL") || "https://gateway.apiserpro.serpro.gov.br/token";
  if (!clientId || !clientSecret || !consultationUrl) {
    return json(req, { valid: false, configured: false }, 503);
  }

  try {
    const input = await req.json();
    const cpf = String(input?.cpf || "").replace(/\D/g, "");
    const dataNascimento = String(input?.dataNascimento || "");
    if (!validCpf(cpf) || !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
      return json(req, { valid: false, configured: true, reason: "invalid_input" }, 400);
    }

    const tokenResponse = await fetchWithTimeout(tokenUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
    if (!tokenResponse.ok) throw new Error(`token_${tokenResponse.status}`);
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) throw new Error("token_missing");

    const cpfResponse = await fetchWithTimeout(consultationUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ cpf, dataNascimento }),
    });

    if ([400, 404, 409, 422].includes(cpfResponse.status)) {
      return json(req, { valid: false, configured: true, reason: "mismatch" });
    }
    if (!cpfResponse.ok) throw new Error(`consulta_${cpfResponse.status}`);
    const result = await cpfResponse.json();
    const situation = String(
      result?.situacao?.descricao || result?.situacaoCadastral?.descricao || result?.situacao || ""
    ).toUpperCase();
    const situationCode = result?.situacao?.codigo ?? result?.situacaoCadastral?.codigo;
    const regular = situation === "REGULAR" || situation.includes("REGULAR") || String(situationCode) === "0";
    return json(req, {
      valid: regular,
      configured: true,
      reason: regular ? "regular" : "irregular",
      status: regular ? "REGULAR" : "IRREGULAR",
    });
  } catch (error) {
    console.error("SERPRO CPF validation failed", error instanceof Error ? error.message : error);
    return json(req, { valid: false, configured: true, reason: "unavailable" }, 503);
  }
});
