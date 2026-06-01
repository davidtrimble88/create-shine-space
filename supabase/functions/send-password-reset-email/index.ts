// Sends an email to an employee whose password was reset by an admin,
// containing their new temporary password and instructions to set their own.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PORTAL_URL = "https://learntoridevc.com/employee-login";
const CC_EMAIL = "Office@LearnToRidevc.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { recipientEmail, fullName, tempPassword } = await req.json();
    if (!recipientEmail || !tempPassword) {
      return new Response(JSON.stringify({ error: "recipientEmail and tempPassword required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const greeting = fullName ? `Hi ${fullName.split(" ")[0]},` : "Hi,";
    const subject = "Your Learn to Ride VC password has been reset";
    const body = `${greeting}

An administrator has reset your employee portal password. Below is your new temporary password and the steps to set your own.

How to sign in and choose a new password:
1. Go to ${PORTAL_URL}
2. Enter your email: ${recipientEmail}
3. Enter your temporary password: ${tempPassword}
4. You'll be prompted to set your own password immediately after signing in.
5. If you haven't set them up yet, you'll also be asked to choose security questions used for self-service password resets in the future.

If you did not expect this reset, please contact the office right away.

— Learn to Ride VC`;

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;max-width:640px;line-height:1.6">
      <p>${greeting}</p>
      <p>An administrator has reset your <strong>Learn to Ride VC</strong> employee portal password. Below is your new temporary password and the steps to set your own.</p>
      <p><strong>How to sign in and choose a new password:</strong></p>
      <ol>
        <li>Go to <a href="${PORTAL_URL}" style="color:#c2410c">${PORTAL_URL}</a></li>
        <li>Enter your email: <strong>${recipientEmail}</strong></li>
        <li>Enter your temporary password: <strong style="font-family:monospace;background:#f5f5f5;padding:2px 6px;border-radius:4px">${tempPassword}</strong></li>
        <li>You'll be prompted to set your own password immediately after signing in.</li>
        <li>If you haven't set them up yet, you'll also be asked to choose security questions used for self-service password resets in the future.</li>
      </ol>
      <p>If you did not expect this reset, please contact the office right away.</p>
      <p>— Learn to Ride VC</p>
    </div>`;

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

    // Owner BCC — silent copy if enabled in email_bcc_settings.
    try {
      const { data: bccCfg } = await supabase
        .from("email_bcc_settings")
        .select("*").eq("id", true).maybeSingle();
      const trigger = "password_reset";
      if (
        bccCfg?.enabled &&
        bccCfg.bcc_email &&
        !(bccCfg.excluded_triggers ?? []).includes(trigger) &&
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
