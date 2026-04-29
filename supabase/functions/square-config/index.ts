// Returns PUBLIC Square config (App ID + Location ID) for a given region.
// These are not secrets — they are required by Square's browser SDK.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const region = (url.searchParams.get("region") || "").toLowerCase();

  let appId: string | undefined;
  let locationId: string | undefined;

  if (region === "ventura") {
    appId = Deno.env.get("SQUARE_VENTURA_APP_ID");
    locationId = Deno.env.get("SQUARE_VENTURA_LOCATION_ID");
  } else if (region === "high_desert" || region === "highdesert" || region === "high-desert") {
    appId = Deno.env.get("SQUARE_HIGH_DESERT_APP_ID");
    locationId = Deno.env.get("SQUARE_HIGH_DESERT_LOCATION_ID");
  } else {
    return new Response(JSON.stringify({ error: "Invalid region" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!appId || !locationId) {
    return new Response(JSON.stringify({ error: "Square not configured for this region" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ appId, locationId, environment: "production" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
