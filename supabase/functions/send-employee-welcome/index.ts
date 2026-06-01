// Sends a welcome email to a newly created employee with login instructions
// and their one-time temporary password. CCs Office@LearnToRidevc.com.
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
    const subject = "Welcome to the Learn to Ride VC Employee Portal";
    const body = `${greeting}

Welcome to the Learn to Ride VC team! Your employee portal account has been created.

How to sign in for the first time:
1. Go to ${PORTAL_URL}
2. Enter your email: ${recipientEmail}
3. Enter your temporary password: ${tempPassword}
4. You'll be prompted to set your own password right after signing in.
5. After setting a new password, you'll be guided to set up security questions used for self-service password resets.

Once you're in, you'll have access to the schedule, rosters, and other tools based on your assigned role. If you ever forget your password, use the "Forgot your password?" link on the login page.

If you have any questions, reply to this email or contact the office.

— Learn to Ride VC`;

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;max-width:640px;line-height:1.6">
      <p>${greeting}</p>
      <p>Welcome to the <strong>Learn to Ride VC</strong> team! Your employee portal account has been created.</p>
      <p><strong>How to sign in for the first time:</strong></p>
      <ol>
        <li>Go to <a href="${PORTAL_URL}" style="color:#c2410c">${PORTAL_URL}</a></li>
        <li>Enter your email: <strong>${recipientEmail}</strong></li>
        <li>Enter your temporary password: <strong style="font-family:monospace;background:#f5f5f5;padding:2px 6px;border-radius:4px">${tempPassword}</strong></li>
        <li>You'll be prompted to set your own password right after signing in.</li>
        <li>After setting a new password, you'll be guided to set up security questions used for self-service password resets.</li>
      </ol>
      <p>Once you're in, you'll have access to the schedule, rosters, and other tools based on your assigned role. If you ever forget your password, use the "Forgot your password?" link on the login page.</p>
      <p>If you have any questions, reply to this email or contact the office.</p>
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
      const key = `employee-welcome${suffix}-${to}-${Date.now()}`;
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
          template_name: `auto_employee_welcome${suffix}`,
          label: `auto_employee_welcome${suffix}`,
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
        console.warn("[send-employee-welcome] CC enqueue failed:", (e as Error).message);
      }
    }

    return new Response(JSON.stringify({ queued: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-employee-welcome]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
