// Sends a Web Push notification to every device a user has subscribed.
// Triggered by the `notifications_push_fanout` trigger on the public.notifications table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = "BCe7N9K_HFUKC5MBNVKObMeP2bPtYTEKsYfhqzXX2VLSRlqFYjkra-Ns9z_zDPhmQWMLo6KD5zaTFCDkHe6yObA";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:Office@LearnToRidevc.com";

if (VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  } catch (e) {
    console.error("[send-push] setVapidDetails failed:", (e as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    if (!VAPID_PRIVATE) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_vapid_private_key" }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { user_id, title, body, link, type, notification_id } = await req.json();
    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "user_id and title required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (error) {
      console.error("[send-push] sub fetch error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title,
      body: body ?? "",
      url: link ?? "/employee-dashboard",
      tag: type ?? "notification",
      notification_id,
    });

    const stale: string[] = [];
    const results = await Promise.allSettled(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 * 60 * 24 }
          );
        } catch (e: any) {
          const code = e?.statusCode ?? 0;
          if (code === 404 || code === 410) stale.push(s.id);
          else console.error("[send-push] push error", code, e?.body ?? e?.message);
          throw e;
        }
      })
    );

    if (stale.length) {
      await supabase.from("push_subscriptions").delete().in("id", stale);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return new Response(JSON.stringify({ sent, failed: results.length - sent, pruned: stale.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-push] fatal:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
