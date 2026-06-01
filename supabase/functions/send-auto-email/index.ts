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
    const { trigger_event, recipientEmail, variables = {}, location = null, groupName = null, course = null } = await req.json();
    if (!trigger_event || !recipientEmail) {
      return new Response(JSON.stringify({ error: "trigger_event and recipientEmail are required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all enabled templates for this trigger, pick the most specific match.
    const { data: candidates, error } = await supabase
      .from("auto_email_templates")
      .select("*")
      .eq("trigger_event", trigger_event)
      .eq("enabled", true);

    if (error) throw error;
    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_template" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const score = (t: any) => {
      const locOk = !t.match_location || t.match_location === location;
      const grpOk = !t.match_group || t.match_group === groupName;
      const crsOk = !t.match_course || t.match_course === course;
      if (!locOk || !grpOk || !crsOk) return -1;
      return (t.match_course ? 4 : 0) + (t.match_location ? 2 : 0) + (t.match_group ? 1 : 0);
    };
    const tpl = candidates
      .map((t) => ({ t, s: score(t) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)[0]?.t;

    if (!tpl) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_matching_template" }), {
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

    const linkify = (escapedText: string) =>
      escapedText.replace(
        /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]}'"])/g,
        '<a href="$1" style="color:#c2410c;text-decoration:underline" target="_blank" rel="noopener">$1</a>'
      );

    const textToHtml = (text: string) => {
      const esc = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const paras = esc.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
      const htmlBody = paras
        .map((p) => `<p style="margin:0 0 16px 0;line-height:1.6">${linkify(p).replace(/\n/g, "<br>")}</p>`)
        .join("");
      const attachmentBlock = attachments.length
        ? `<div style="margin-top:24px;padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa"><div style="font-weight:bold;margin-bottom:8px">Attachments</div>${attachments
            .map(
              (a: any) =>
                `<div style="margin:6px 0">📎 <a href="${a.url}" style="color:#c2410c;text-decoration:underline" target="_blank" rel="noopener">${a.name}</a></div>`
            )
            .join("")}</div>`
        : "";
      return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;max-width:640px;line-height:1.6">${htmlBody}${attachmentBlock}</div>`;
    };


    // Try queue-based send if email infrastructure exists.
    try {
      // Get or create unsubscribe token for this recipient
      let unsubscribeToken: string | null = null;
      const { data: existingTok } = await supabase
        .from("email_unsubscribe_tokens")
        .select("token")
        .eq("email", recipientEmail)
        .maybeSingle();
      if (existingTok?.token) {
        unsubscribeToken = existingTok.token;
      } else {
        const newToken = crypto.randomUUID();
        const { data: inserted } = await supabase
          .from("email_unsubscribe_tokens")
          .insert({ email: recipientEmail, token: newToken })
          .select("token")
          .maybeSingle();
        unsubscribeToken = inserted?.token || newToken;
      }

      const idempotencyKey = `auto-${trigger_event}-${recipientEmail}-${Date.now()}`;
      const { error: enqErr } = await supabase.rpc("enqueue_email" as any, {
        queue_name: "transactional_emails",
        payload: {
          to: recipientEmail,
          from: "Learn to Ride VC <notify@learntoridevc.com>",
          sender_domain: "notify.learntoridevc.com",
          subject,
          text: body,
          html: textToHtml(body),
          template_name: `auto_${trigger_event}`,
          label: `auto_${trigger_event}`,
          purpose: "transactional",
          idempotency_key: idempotencyKey,
          message_id: idempotencyKey,
          unsubscribe_token: unsubscribeToken,
        },
      });
      if (enqErr) throw enqErr;

      // CC the office on every auto-generated email by enqueuing a copy.
      const ccEmail = "Office@LearnToRidevc.com";
      if (recipientEmail.toLowerCase() !== ccEmail.toLowerCase()) {
        const ccSubject = `[CC: ${recipientEmail}] ${subject}`;
        const ccIdempotencyKey = `auto-${trigger_event}-cc-${recipientEmail}-${Date.now()}`;
        let ccUnsubToken: string | null = null;
        const { data: ccTok } = await supabase
          .from("email_unsubscribe_tokens")
          .select("token")
          .eq("email", ccEmail)
          .maybeSingle();
        if (ccTok?.token) {
          ccUnsubToken = ccTok.token;
        } else {
          const newTok = crypto.randomUUID();
          const { data: ins } = await supabase
            .from("email_unsubscribe_tokens")
            .insert({ email: ccEmail, token: newTok })
            .select("token")
            .maybeSingle();
          ccUnsubToken = ins?.token || newTok;
        }
        const { error: ccErr } = await supabase.rpc("enqueue_email" as any, {
          queue_name: "transactional_emails",
          payload: {
            to: ccEmail,
            from: "Learn to Ride VC <notify@learntoridevc.com>",
            sender_domain: "notify.learntoridevc.com",
            subject: ccSubject,
            text: body,
            html: textToHtml(body),
            template_name: `auto_${trigger_event}_cc`,
            label: `auto_${trigger_event}_cc`,
            purpose: "transactional",
            idempotency_key: ccIdempotencyKey,
            message_id: ccIdempotencyKey,
            unsubscribe_token: ccUnsubToken,
          },
        });
        if (ccErr) console.warn("[send-auto-email] CC enqueue failed:", ccErr.message);
      }

      return new Response(JSON.stringify({ queued: true, cc: ccEmail }), {
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
