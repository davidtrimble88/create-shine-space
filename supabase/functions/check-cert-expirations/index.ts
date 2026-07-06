// Daily job: sends 30/10/1 day expiration warnings and expired notice for
// instructor certifications. Notifies both the instructor and the office.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OFFICE_EMAIL = "Office@LearnToRidevc.com";

const CERT_LABELS: Record<string, string> = {
  cmsp_expires: "CMSP",
  irc_expires: "IRC (Instructor)",
  arc_expires: "ARC (Advanced Rider Course)",
  cpr_expires: "CPR",
};

// Milestones: positive = days before expiration; 0 = day of; negative = days after
const MILESTONES: { key: string; days: number; label: string }[] = [
  { key: "30d", days: 30, label: "30 days" },
  { key: "10d", days: 10, label: "10 days" },
  { key: "1d", days: 1, label: "1 day" },
  { key: "expired", days: -1, label: "expired" },
];

function daysBetween(target: Date, today: Date): number {
  const ms = 1000 * 60 * 60 * 24;
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / ms);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: certs, error } = await supabase
      .from("instructor_certifications")
      .select("user_id, cmsp_expires, irc_expires, arc_expires, cpr_expires");
    if (error) throw error;

    const userIds = Array.from(new Set((certs || []).map((c) => c.user_id)));
    const { data: emps } = await supabase
      .from("employees")
      .select("user_id, full_name, email")
      .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const empMap = new Map((emps || []).map((e) => [e.user_id, e]));

    const today = new Date();
    const results: any[] = [];

    for (const cert of certs || []) {
      const emp = empMap.get(cert.user_id);
      if (!emp?.email) continue;

      for (const field of Object.keys(CERT_LABELS)) {
        const dateStr = (cert as any)[field];
        if (!dateStr) continue;
        const expDate = new Date(dateStr + "T00:00:00");
        const delta = daysBetween(expDate, today);

        let milestone: typeof MILESTONES[number] | null = null;
        if (delta === 30) milestone = MILESTONES[0];
        else if (delta === 10) milestone = MILESTONES[1];
        else if (delta === 1) milestone = MILESTONES[2];
        else if (delta === -1) milestone = MILESTONES[3];
        if (!milestone) continue;

        // Dedupe: check if we've already sent this milestone
        const { data: existing } = await supabase
          .from("certification_notifications_sent")
          .select("id")
          .eq("user_id", cert.user_id)
          .eq("cert_type", field)
          .eq("expires_on", dateStr)
          .eq("milestone", milestone.key)
          .maybeSingle();
        if (existing) continue;

        const certLabel = CERT_LABELS[field];
        const prettyDate = expDate.toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        });

        const isExpired = milestone.key === "expired";
        const subjectInstructor = isExpired
          ? `Your ${certLabel} certification has expired`
          : `Reminder: Your ${certLabel} certification expires in ${milestone.label}`;
        const subjectOffice = isExpired
          ? `${emp.full_name}: ${certLabel} certification EXPIRED`
          : `${emp.full_name}: ${certLabel} expires in ${milestone.label}`;

        const bodyInstructor = isExpired
          ? `Hi ${emp.full_name},\n\nYour ${certLabel} certification expired on ${prettyDate}. Please renew as soon as possible and send updated documentation to the office.\n\n— Learn to Ride VC`
          : `Hi ${emp.full_name},\n\nThis is a reminder that your ${certLabel} certification is set to expire on ${prettyDate} (${milestone.label} from today). Please schedule renewal and provide updated documentation to the office before that date.\n\n— Learn to Ride VC`;

        const bodyOffice = isExpired
          ? `${emp.full_name} (${emp.email}) — ${certLabel} certification expired on ${prettyDate}. Follow up on renewal documentation.`
          : `${emp.full_name} (${emp.email}) — ${certLabel} certification expires on ${prettyDate} (${milestone.label} from today). Follow up to confirm renewal is scheduled.`;

        const enqueueEmail = async (to: string, subject: string, body: string, suffix: string) => {
          let tok: string | null = null;
          const { data: ex } = await supabase.from("email_unsubscribe_tokens")
            .select("token").eq("email", to).maybeSingle();
          if (ex?.token) tok = ex.token;
          else {
            const nt = crypto.randomUUID();
            const { data: ins } = await supabase.from("email_unsubscribe_tokens")
              .insert({ email: to, token: nt }).select("token").maybeSingle();
            tok = ins?.token || nt;
          }
          const key = `cert-${field}-${dateStr}-${milestone!.key}-${suffix}-${to}`;
          const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.6;max-width:640px">${
            body.split("\n\n").map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("")
          }</div>`;
          return supabase.rpc("enqueue_email" as any, {
            queue_name: "transactional_emails",
            payload: {
              to,
              from: "Learn to Ride VC <notify@learntoridevc.com>",
              sender_domain: "notify.learntoridevc.com",
              subject,
              text: body,
              html,
              template_name: `cert_expiration_${milestone!.key}`,
              label: `cert_expiration_${milestone!.key}`,
              purpose: "transactional",
              idempotency_key: key,
              message_id: key,
              unsubscribe_token: tok,
            },
          });
        };

        await enqueueEmail(emp.email, subjectInstructor, bodyInstructor, "instructor");
        if (emp.email.toLowerCase() !== OFFICE_EMAIL.toLowerCase()) {
          await enqueueEmail(OFFICE_EMAIL, subjectOffice, bodyOffice, "office");
        }

        await supabase.from("certification_notifications_sent").insert({
          user_id: cert.user_id,
          cert_type: field,
          expires_on: dateStr,
          milestone: milestone.key,
        });

        results.push({ user: emp.email, cert: field, milestone: milestone.key });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[check-cert-expirations] error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
