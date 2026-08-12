// Owner-only Square refund. Refunds a recorded payment transaction (full or partial)
// and stores the refund with a mandatory comment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  transactionId: z.string().uuid(),
  amountCents: z.number().int().positive().max(1000000),
  comment: z.string().trim().min(3).max(1000),
});

function regionCreds(region: string) {
  const env = (k: string) => (Deno.env.get(k) ?? "").trim();
  if (region === "high_desert") {
    return { token: env("SQUARE_HIGH_DESERT_ACCESS_TOKEN") };
  }
  return { token: env("SQUARE_VENTURA_ACCESS_TOKEN") };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "owner")
      .maybeSingle();
    if (!roleRow) return json({ error: "Only owners can issue refunds" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
    }
    const { transactionId, amountCents, comment } = parsed.data;
    console.log("refund request", { transactionId, amountCents, user: userData.user.id });

    const { data: tx } = await admin
      .from("payment_transactions")
      .select("*")
      .eq("id", transactionId)
      .maybeSingle();
    if (!tx) return json({ error: "Transaction not found" }, 404);

    const remaining = (tx.amount_cents ?? 0) - (tx.refunded_cents ?? 0);
    if (amountCents > remaining) {
      return json({ error: `Refund exceeds remaining balance ($${(remaining / 100).toFixed(2)})` }, 400);
    }

    let refundId: string | null = null;

    if (tx.provider_payment_id) {
      const { token } = regionCreds(tx.region ?? "ventura");
      if (!token) return json({ error: "Square is not configured for this region" }, 500);

      const sqRes = await fetch("https://connect.squareup.com/v2/refunds", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Square-Version": "2024-10-17",
        },
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          payment_id: tx.provider_payment_id,
          amount_money: { amount: amountCents, currency: "USD" },
          reason: comment.slice(0, 190),
        }),
      });
      const sqData = await sqRes.json();
      if (!sqRes.ok || sqData?.errors?.length) {
        console.error("Square refund failed:", JSON.stringify(sqData));
        return json({ error: sqData?.errors?.[0]?.detail ?? "Refund failed" }, 402);
      }
      refundId = sqData?.refund?.id ?? null;
    }

    const { error: insErr } = await admin.from("payment_refunds").insert({
      transaction_id: transactionId,
      provider_refund_id: refundId,
      amount_cents: amountCents,
      comment,
      created_by: userData.user.id,
    });
    if (insErr) {
      console.error("Refund recorded at Square but not saved:", insErr);
      return json({ error: "Refund processed but could not be saved: " + insErr.message }, 500);
    }

    const newRefunded = (tx.refunded_cents ?? 0) + amountCents;
    await admin
      .from("payment_transactions")
      .update({
        refunded_cents: newRefunded,
        status: newRefunded >= (tx.amount_cents ?? 0) ? "refunded" : "partially_refunded",
      })
      .eq("id", transactionId);

    return json({ success: true, refundId, refundedCents: newRefunded });
  } catch (err) {
    console.error("square-refund error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
