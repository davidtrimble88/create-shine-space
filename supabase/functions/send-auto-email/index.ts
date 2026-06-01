// Sends an automatic email based on a configured template in auto_email_templates.
// Looks up the template by trigger_event, renders {{variable}} placeholders, and
// dispatches via the Lovable Email API. If the project's email domain isn't yet
// active, the function logs and returns gracefully instead of throwing — the UI
// flow continues even when delivery isn't configured yet.
//
// Request body: { trigger_event: string, recipientEmail: string, variables: Record<string,string> }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const render = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars?.[k] ?? `{{${k}}}`));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { trigger_event, recipientEmail, variables = {} } = await req.json();
    if (!trigger_event || !recipientEmail) {
      return new Response(JSON.stringify({ error: "trigger_event and recipientEmail are required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tpl, error } = await supabase
      .from("auto_email_templates")
      .select("*")
      .eq("trigger_event", trigger_event)
      .maybeSingle();

    if (error) throw error;
    if (!tpl) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_template" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!tpl.enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "disabled" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const subject = render(tpl.subject, variables);
    let body = render(tpl.body, variables);
    const attachments = Array.isArray((tpl as any).attachments) ? (tpl as any).attachments : [];
    if (attachments.length) {
      const list = attachments.map((a: any) => `📎 ${a.name}: ${a.url}`).join("\n");
      body = `${body}\n\n— Attachments —\n${list}`;
    }

    // Try queue-based send if email infrastructure exists.
    try {
      const { error: enqErr } = await supabase.rpc("enqueue_email" as any, {
        queue_name: "transactional_emails",
        payload: {
          to: recipientEmail,
          subject,
          text: body,
          html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;font-size:14px;color:#222">${body
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`,
          template_name: `auto_${trigger_event}`,
        },
      });
      if (enqErr) throw enqErr;
      return new Response(JSON.stringify({ queued: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } catch (e) {
      console.warn("[send-auto-email] queue unavailable, email not delivered:", (e as Error).message);
      console.log("[send-auto-email] would send:", { to: recipientEmail, subject });
      return new Response(JSON.stringify({
        skipped: true,
        reason: "email_infra_not_configured",
        preview: { to: recipientEmail, subject, body },
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
  } catch (e) {
    console.error("[send-auto-email] error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
