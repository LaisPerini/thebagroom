// Cálculo de frete da The Bag Room (Melhor Envio), no lugar do servidor do Render.
// POST { from: { postal_code }, to: { postal_code } } -> lista de serviços (mesmo formato do Melhor Envio).
// Um dos dois CEPs precisa ser o da loja (ida ou devolução). O token fica no segredo MELHOR_ENVIO_TOKEN.
const TOKEN = Deno.env.get("MELHOR_ENVIO_TOKEN") ?? "";
const LOJA = "11060003";
const ORIGENS = /^https:\/\/(www\.)?thebagroom\.com\.br$|^http:\/\/localhost(:\d+)?$/;
const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 6 * 3600 * 1000;

function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGENS.test(origin) ? origin : "https://www.thebagroom.com.br",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, apikey, Authorization, x-client-info",
    "Vary": "Origin",
  };
}
const cep = (v: unknown) => String(v ?? "").replace(/\D/g, "");

Deno.serve(async (req) => {
  const h = cors(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...h, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method === "GET") return json({ ok: true, configurado: !!TOKEN }); // usado só para "acordar"
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!TOKEN) return json({ error: "missing_configuration" }, 500);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const from = cep(body?.from?.postal_code), to = cep(body?.to?.postal_code);
  if (from.length !== 8 || to.length !== 8) return json({ error: "cep_invalido" }, 400);
  if (from !== LOJA && to !== LOJA) return json({ error: "rota_nao_permitida" }, 400);

  const chave = `${from}:${to}`;
  const salvo = cache.get(chave);
  if (salvo && Date.now() - salvo.at < TTL) return json(salvo.data);

  try {
    const resp = await fetch("https://melhorenvio.com.br/api/v2/me/shipment/calculate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${TOKEN}`,
        "User-Agent": "The Bag Room (contato@thebagroom.com.br)",
      },
      body: JSON.stringify({
        from: { postal_code: from },
        to: { postal_code: to },
        products: [{ id: "1", width: 30, height: 10, length: 30, weight: 1, insurance_value: 2000, quantity: 1 }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await resp.json();
    if (!resp.ok || !Array.isArray(data)) {
      console.error("melhor_envio_erro", resp.status, JSON.stringify(data).slice(0, 300));
      return json({ error: "frete_indisponivel" }, 502);
    }
    // Só o que o site usa
    const enxuto = data.map((s: any) => ({
      id: s.id, name: s.name, price: s.price, custom_price: s.custom_price,
      delivery_time: s.delivery_time, custom_delivery_time: s.custom_delivery_time,
      error: s.error, company: s.company ? { id: s.company.id, name: s.company.name } : undefined,
    }));
    cache.set(chave, { at: Date.now(), data: enxuto });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return json(enxuto);
  } catch (e) {
    console.error("frete_falhou", e instanceof Error ? e.message : e);
    return json({ error: "frete_indisponivel" }, 502);
  }
});
