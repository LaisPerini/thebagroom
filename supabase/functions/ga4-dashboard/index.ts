import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
});

function base64Url(value: Uint8Array | string) {
  const text = typeof value === "string" ? value : String.fromCharCode(...value);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToBytes(pem: string) {
  const normalized = pem.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function googleAccessToken(email: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey("pkcs8", pemToBytes(privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${payload}`)));
  const assertion = `${header}.${payload}.${base64Url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error(`Google OAuth: ${response.status}`);
  return (await response.json()).access_token as string;
}

async function runReport(token: string, propertyId: string, body: Record<string, unknown>) {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`GA4 Data API: ${response.status} ${await response.text()}`);
  return response.json();
}

function metrics(report: any) {
  const row = report.rows?.[0];
  const names = report.metricHeaders?.map((item: any) => item.name) || [];
  return Object.fromEntries(names.map((name: string, index: number) => [name, Number(row?.metricValues?.[index]?.value || 0)]));
}

function rows(report: any) {
  const dimensions = report.dimensionHeaders?.map((item: any) => item.name) || [];
  const metricNames = report.metricHeaders?.map((item: any) => item.name) || [];
  return (report.rows || []).map((row: any) => ({
    ...Object.fromEntries(dimensions.map((name: string, index: number) => [name, row.dimensionValues?.[index]?.value || ""])),
    ...Object.fromEntries(metricNames.map((name: string, index: number) => [name, Number(row.metricValues?.[index]?.value || 0)])),
  }));
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
    if (adminError || !isAdmin) return json({ error: "Forbidden" }, 403);

    const configuredProperty = Deno.env.get("GA4_PROPERTY_ID") || "538615957";
    const requestedProperty = String((await req.json().catch(() => ({}))).propertyId || configuredProperty);
    if (requestedProperty !== configuredProperty) return json({ error: "Invalid property" }, 400);
    const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY");
    if (!email || !privateKey) return json({ error: "GA4 credentials are not configured" }, 503);

    const token = await googleAccessToken(email, privateKey);
    const commonMetrics = [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }];
    const [todayReport, monthReport, pagesReport, sourcesReport, devicesReport, citiesReport, eventsReport] = await Promise.all([
      runReport(token, configuredProperty, { dateRanges: [{ startDate: "today", endDate: "today" }], metrics: commonMetrics }),
      runReport(token, configuredProperty, { dateRanges: [{ startDate: "30daysAgo", endDate: "today" }], metrics: commonMetrics }),
      runReport(token, configuredProperty, { dateRanges: [{ startDate: "30daysAgo", endDate: "today" }], dimensions: [{ name: "pagePath" }], metrics: [{ name: "screenPageViews" }], orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 10000 }),
      runReport(token, configuredProperty, { dateRanges: [{ startDate: "30daysAgo", endDate: "today" }], dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 10 }),
      runReport(token, configuredProperty, { dateRanges: [{ startDate: "30daysAgo", endDate: "today" }], dimensions: [{ name: "deviceCategory" }], metrics: [{ name: "activeUsers" }] }),
      runReport(token, configuredProperty, { dateRanges: [{ startDate: "30daysAgo", endDate: "today" }], dimensions: [{ name: "city" }], metrics: [{ name: "activeUsers" }], orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }], limit: 10 }),
      runReport(token, configuredProperty, { dateRanges: [{ startDate: "30daysAgo", endDate: "today" }], dimensions: [{ name: "eventName" }], metrics: [{ name: "eventCount" }], dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: ["view_item", "begin_checkout", "sign_up", "add_payment_info", "purchase", "rental_confirmed"] } } } }),
    ]);

    return json({
      propertyId: configuredProperty,
      generatedAt: new Date().toISOString(),
      today: metrics(todayReport),
      month: metrics(monthReport),
      topPages: rows(pagesReport),
      pagesTotal: pagesReport.rowCount || 0,
      sources: rows(sourcesReport),
      devices: rows(devicesReport),
      cities: rows(citiesReport),
      funnelEvents: rows(eventsReport),
    });
  } catch (error) {
    console.error(error);
    return json({ error: "Unable to load Google Analytics data" }, 502);
  }
});
