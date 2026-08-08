// Backfills payment_transactions from Square for site-made bookings only.
// Owner-only. Matches Square payments to bookings that were paid through the
// website (payment_provider = 'square' and not manually added).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Region = "ventura" | "high_desert";

function regionCreds(region: Region) {
  const env = (k: string) => (Deno.env.get(k) ?? "").trim();
  return region === "ventura"
    ? { token: env("SQUARE_VENTURA_ACCESS_TOKEN"), locationId: env("SQUARE_VENTURA_LOCATION_ID") }
    : { token: env("SQUARE_HIGH_DESERT_ACCESS_TOKEN"), locationId: env("SQUARE_HIGH_DESERT_LOCATION_ID") };
}

interface SquarePayment {
  id: string;
  created_at: string;
  amount_money?: { amount?: number };
  note?: string;
  status?: string;
  refunded_money?: { amount?: number };
  card_details?: { card?: { card_brand?: string; last_4?: string } };
}

async function listPayments(region: Region, beginTime: string): Promise<SquarePayment[]> {
  const { token, locationId } = regionCreds(region);
  if (!token || !locationId) return [];
  const out: SquarePayment[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 40; page++) {
    const url = new URL("https://connect.squareup.com/v2/payments");
    url.searchParams.set("location_id", locationId);
    url.searchParams.set("begin_time", beginTime);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, "Square-Version": "2024-10-17" },
    });
    const data = await res.json();
    if (!res.ok || data?.errors?.length) {
      console.error("Square list payments failed", region, JSON.stringify(data));
      break;
    }
    out.push(...((data.payments ?? []) as SquarePayment[]));
    cursor = data.cursor;
    if (!cursor) break;
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth: must be a signed-in owner
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id);
    if (!(roles ?? []).some((r: { role: string }) => r.role === "owner")) {
      return json({ error: "Owner access required" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const since: string = typeof body.since === "string" ? body.since : "2025-01-01T00:00:00Z";

    // Bookings paid through the website only.
    const { data: bookings, error: bErr } = await admin
      .from("bookings")
      .select("id, first_name, last_name, email, course, location, location_label, schedule_date, fee, created_at, manually_added, payment_provider, payment_status")
      .eq("payment_provider", "square")
      .eq("manually_added", false)
      .eq("payment_status", "paid")
      .gte("created_at", since);
    if (bErr) return json({ error: bErr.message }, 500);

    const { data: existingTx } = await admin
      .from("payment_transactions")
      .select("booking_id, provider_payment_id");
    const haveBooking = new Set((existingTx ?? []).map((t: any) => t.booking_id).filter(Boolean));
    const havePayment = new Set((existingTx ?? []).map((t: any) => t.provider_payment_id).filter(Boolean));

    const payments: Record<Region, SquarePayment[]> = {
      ventura: await listPayments("ventura", since),
      high_desert: await listPayments("high_desert", since),
    };

    const used = new Set<string>();
    const inserts: any[] = [];
    const unmatched: string[] = [];

    for (const b of bookings ?? []) {
      if (haveBooking.has(b.id)) continue;
      const region: Region = (b.location ?? "").toLowerCase().includes("high") ? "high_desert" : "ventura";
      const candidates = payments[region] ?? [];
      const bTime = new Date(b.created_at).getTime();
      const nameKey = norm(`${b.first_name ?? ""}${b.last_name ?? ""}`);
      const lastKey = norm(b.last_name ?? "");

      let best: SquarePayment | null = null;
      let bestDelta = Infinity;
      for (const p of candidates) {
        if (!p.id || used.has(p.id) || havePayment.has(p.id)) continue;
        if ((p.status ?? "").toUpperCase() !== "COMPLETED") continue;
        const noteKey = norm(p.note ?? "");
        const nameMatch = (nameKey && noteKey.includes(nameKey)) || (lastKey.length > 2 && noteKey.includes(lastKey));
        if (!nameMatch) continue;
        const delta = Math.abs(new Date(p.created_at).getTime() - bTime);
        if (delta > 3 * 24 * 3600 * 1000) continue; // must be within 3 days of the booking
        if (delta < bestDelta) { best = p; bestDelta = delta; }
      }

      if (!best) { unmatched.push(`${b.first_name} ${b.last_name}`); continue; }
      used.add(best.id);
      const card = best.card_details?.card ?? {};
      inserts.push({
        booking_id: b.id,
        student_email: b.email ?? null,
        student_name: `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim() || null,
        region,
        provider: "square",
        provider_payment_id: best.id,
        amount_cents: best.amount_money?.amount ?? 0,
        refunded_cents: best.refunded_money?.amount ?? 0,
        card_brand: card.card_brand ?? null,
        card_last4: card.last_4 ?? null,
        description: `${b.course ?? "Course"} — ${b.location_label ?? ""} ${b.schedule_date ?? ""}`.trim(),
        status: (best.refunded_money?.amount ?? 0) > 0
          ? ((best.refunded_money?.amount ?? 0) >= (best.amount_money?.amount ?? 0) ? "refunded" : "partially_refunded")
          : "completed",
        created_at: best.created_at,
      });
    }

    let imported = 0;
    if (inserts.length) {
      // Duplicates are already filtered above; a partial unique index guards
      // against races, so insert row-by-row and skip conflicts silently.
      for (const row of inserts) {
        const { error: insErr } = await admin.from("payment_transactions").insert(row);
        if (insErr) {
          if (!/duplicate key/i.test(insErr.message)) {
            console.warn("insert failed", insErr.message);
          }
          continue;
        }
        imported++;
      }
    }

    return json({
      success: true,
      scannedBookings: (bookings ?? []).length,
      squarePayments: payments.ventura.length + payments.high_desert.length,
      imported,
      unmatched: unmatched.length,
      unmatchedNames: unmatched.slice(0, 25),
    });
  } catch (err) {
    console.error("square-backfill-transactions error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
