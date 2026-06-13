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
    const body = render(tpl.body, variables);

    const linkify = (escapedText: string) =>
      escapedText.replace(
        /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]}'"])/g,
        '<a href="$1" style="color:#c2410c;text-decoration:underline" target="_blank" rel="noopener">$1</a>'
      );

    // Detect if the template body already contains HTML markup (tags, entities, or images).
    // If so, pass through as-is (only converting blank lines/newlines for spacing) instead
    // of escaping every < and >, which would otherwise render tags like <img>, <strong>,
    // and <mark> as literal text in the email.
    const looksLikeHtml = (text: string) =>
      /<\/?[a-zA-Z][^>]*>|&[a-zA-Z#0-9]+;/.test(text);

    const replaceEmailHighlights = (html: string) =>
      html.replace(/<mark\b[^>]*>([\s\S]*?)<\/mark>/gi, (_match, content) => {
        const cleaned = String(content).trim();
        return `<strong style="display:inline-block;background:#fff59d;background-color:#fff59d;color:#111111;padding:2px 6px;font-weight:700;mso-highlight:yellow;text-decoration:none;">${cleaned}</strong>`;
      });

    const textToHtml = (text: string) => {
      const isHtml = looksLikeHtml(text);
      const paras = (isHtml ? text : text)
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean);
      const htmlBody = paras
        .map((p) => {
          if (isHtml) {
            const withBreaks = p.replace(/\n/g, "<br>");
            const linked = withBreaks.replace(
              /(?<!href=["'])(https?:\/\/[^\s<"']+[^\s<.,;:!?)\]}'"])/g,
              '<a href="$1" style="color:#c2410c;text-decoration:underline" target="_blank" rel="noopener">$1</a>'
            );
            return `<div style="margin:0 0 16px 0;line-height:1.6">${replaceEmailHighlights(linked)}</div>`;
          }
          const esc = p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          return `<p style="margin:0 0 16px 0;line-height:1.6">${linkify(esc).replace(/\n/g, "<br>")}</p>`;
        })
        .join("");
      const inner = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;max-width:640px;line-height:1.6">${htmlBody}</div>`;
      // Wrap in a full email document so clients (Gmail, Outlook) reliably
      // preserve inline styles like background-color on <span> tags instead
      // of stripping them as part of "stray fragment" sanitization.
      return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email</title></head><body style="margin:0;padding:16px;background:#ffffff">${inner}</body></html>`;
    };

    // Build a real plain-text alternative by stripping HTML tags. Mail clients
    // showing the text/plain part would otherwise see raw tags or nothing.
    const htmlToPlainText = (input: string) => {
      const normalized = replaceEmailHighlights(input);
      if (!looksLikeHtml(normalized)) return normalized;
      return normalized
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
        .replace(/<li[^>]*>/gi, "• ")
        .replace(/<strong\b[^>]*background(?:-color)?\s*:[^>]*>([\s\S]*?)<\/strong>/gi, "$1")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
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
          text: htmlToPlainText(body),
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
      const enqueueExtra = async (toAddr: string, subj: string, suffix: string) => {
        const key = `auto-${trigger_event}-${suffix}-${toAddr}-${Date.now()}`;
        let tok: string | null = null;
        const { data: existing } = await supabase
          .from("email_unsubscribe_tokens")
          .select("token").eq("email", toAddr).maybeSingle();
        if (existing?.token) {
          tok = existing.token;
        } else {
          const nt = crypto.randomUUID();
          const { data: ins } = await supabase
            .from("email_unsubscribe_tokens")
            .insert({ email: toAddr, token: nt }).select("token").maybeSingle();
          tok = ins?.token || nt;
        }
        return supabase.rpc("enqueue_email" as any, {
          queue_name: "transactional_emails",
          payload: {
            to: toAddr,
            from: "Learn to Ride VC <notify@learntoridevc.com>",
            sender_domain: "notify.learntoridevc.com",
            subject: subj,
            text: htmlToPlainText(body),
            html: textToHtml(body),
            template_name: `auto_${trigger_event}_${suffix}`,
            label: `auto_${trigger_event}_${suffix}`,
            purpose: "transactional",
            idempotency_key: key,
            message_id: key,
            unsubscribe_token: tok,
          },
        });
      };

      if (recipientEmail.toLowerCase() !== ccEmail.toLowerCase()) {
        const { error: ccErr } = await enqueueExtra(ccEmail, `[CC: ${recipientEmail}] ${subject}`, "cc");
        if (ccErr) console.warn("[send-auto-email] CC enqueue failed:", ccErr.message);
      }

      // Owner BCC — silent copy based on email_bcc_settings.
      try {
        const { data: bccCfg } = await supabase
          .from("email_bcc_settings")
          .select("*").eq("id", true).maybeSingle();
        if (
          bccCfg?.enabled &&
          bccCfg.bcc_email &&
          !(bccCfg.excluded_triggers ?? []).includes(trigger_event) &&
          bccCfg.bcc_email.toLowerCase() !== recipientEmail.toLowerCase() &&
          bccCfg.bcc_email.toLowerCase() !== ccEmail.toLowerCase()
        ) {
          const { error: bccErr } = await enqueueExtra(bccCfg.bcc_email, subject, "bcc");
          if (bccErr) console.warn("[send-auto-email] BCC enqueue failed:", bccErr.message);
        }
      } catch (e) {
        console.warn("[send-auto-email] BCC settings lookup failed:", (e as Error).message);
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
