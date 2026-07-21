// Sends an email to an employee whose password was reset by an admin,
// containing their new temporary password and instructions to set their own.
// Loads subject/body from auto_email_templates (trigger_event='password_reset')
// so admins can edit the copy from the Auto Emails admin page.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PORTAL_URL = "https://learntoridevc.com/employee-login";
const CC_EMAIL = "Office@LearnToRidevc.com";
const TRIGGER = "password_reset";

const FALLBACK_SUBJECT = "Your Learn to Ride VC password has been reset";
const FALLBACK_BODY = `<p>Hi {{firstName}},</p>
<p>An administrator has reset your <strong>Learn to Ride VC</strong> employee portal password. Below is your new temporary password and the steps to set your own.</p>
<p><strong>How to sign in and choose a new password:</strong></p>
<ol>
  <li>Go to <a href="{{portalUrl}}" style="color:#c2410c">{{portalUrl}}</a></li>
  <li>Enter your email: <strong>{{email}}</strong></li>
  <li>Enter your temporary password: <strong style="font-family:monospace;background:#f5f5f5;padding:2px 6px;border-radius:4px">{{tempPassword}}</strong></li>
  <li>You'll be prompted to set your own password immediately after signing in.</li>
</ol>
<p>If you did not expect this reset, please contact the office right away.</p>
<p>— Learn to Ride VC</p>`;

const substitute = (s: string, vars: Record<string, string>) =>
  s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");

const htmlToText = (html: string) =>
  html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    // Require an authenticated admin/owner — only admins reset passwords for
    // employees; this must never be callable anonymously.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id, _role: "admin",
    });
    const { data: isOwner } = await supabase.rpc("has_role", {
      _user_id: userData.user.id, _role: "owner",
    });
    if (!isAdmin && !isOwner) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { recipientEmail, fullName, tempPassword } = await req.json();
    if (!recipientEmail || !tempPassword) {
      return new Response(JSON.stringify({ error: "recipientEmail and tempPassword required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let subjectTpl = FALLBACK_SUBJECT;
    let bodyTpl = FALLBACK_BODY;
    try {
      const { data: tpl } = await supabase
        .from("auto_email_templates")
        .select("subject, body, enabled")
        .eq("trigger_event", TRIGGER)
        .eq("enabled", true)
        .maybeSingle();
      if (tpl?.subject) subjectTpl = tpl.subject;
      if (tpl?.body) bodyTpl = tpl.body;
    } catch (e) {
      console.warn("[send-password-reset-email] template load failed, using fallback:", (e as Error).message);
    }

    const firstName = (fullName || "").split(" ")[0] || "there";
    const vars: Record<string, string> = {
      firstName,
      fullName: fullName || "",
      email: recipientEmail,
      tempPassword,
      portalUrl: PORTAL_URL,
    };

    const subject = substitute(subjectTpl, vars);
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;max-width:640px;line-height:1.6">${substitute(bodyTpl, vars)}</div>`;
    const body = htmlToText(substitute(bodyTpl, vars));

    const ensureToken = async (email: string) => {
      const { data: existing } = await supabase
        .from("email_unsubscribe_tokens")
        .select("token").eq("email", email).maybeSingle();
      if (existing?.token) return existing.token;
      const t = crypto.randomUUID();
      const { data: ins } = await supabase
        .from("email_unsubscribe_tokens")
        .insert({ email, token: t }).select("token").maybeSingle();
      return ins?.token || t;
    };

    const enqueue = async (to: string, subj: string, suffix = "") => {
      const key = `password-reset${suffix}-${to}-${Date.now()}`;
      const token = await ensureToken(to);
      const { error } = await supabase.rpc("enqueue_email" as any, {
        queue_name: "transactional_emails",
        payload: {
          to,
          from: "Learn to Ride VC <notify@learntoridevc.com>",
          sender_domain: "notify.learntoridevc.com",
          subject: subj,
          text: body,
          html,
          template_name: `auto_password_reset${suffix}`,
          label: `auto_password_reset${suffix}`,
          purpose: "transactional",
          idempotency_key: key,
          message_id: key,
          unsubscribe_token: token,
        },
      });
      if (error) throw error;
    };

    await enqueue(recipientEmail, subject);
    if (recipientEmail.toLowerCase() !== CC_EMAIL.toLowerCase()) {
      try {
        await enqueue(CC_EMAIL, `[CC: ${recipientEmail}] ${subject}`, "_cc");
      } catch (e) {
        console.warn("[send-password-reset-email] CC enqueue failed:", (e as Error).message);
      }
    }

    try {
      const { data: bccCfg } = await supabase
        .from("email_bcc_settings")
        .select("*").eq("id", true).maybeSingle();
      if (
        bccCfg?.enabled &&
        bccCfg.bcc_email &&
        !(bccCfg.excluded_triggers ?? []).includes(TRIGGER) &&
        bccCfg.bcc_email.toLowerCase() !== recipientEmail.toLowerCase() &&
        bccCfg.bcc_email.toLowerCase() !== CC_EMAIL.toLowerCase()
      ) {
        await enqueue(bccCfg.bcc_email, subject, "_bcc");
      }
    } catch (e) {
      console.warn("[send-password-reset-email] BCC failed:", (e as Error).message);
    }

    return new Response(JSON.stringify({ queued: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-password-reset-email]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
