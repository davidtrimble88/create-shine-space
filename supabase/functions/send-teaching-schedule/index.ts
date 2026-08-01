// Daily job: emails instructors (and the office) their teaching schedule.
// Sends an "assigned" notice the first time an instructor is put on a class,
// a re-notice if their duties change, and a reminder 3 days and 1 day out.
// Also sends the office a digest of tomorrow's staffing.
// Restricted: only callers presenting the service role key may invoke.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OFFICE_EMAIL = "Office@LearnToRidevc.com";
const PORTAL_URL = "https://learntoridevc.com/employee-dashboard";

const ROLE_LABELS: Record<string, string> = {
  instructor_1: "Instructor 1",
  instructor_2: "Instructor 2",
  range_assistant: "Range Assistant",
  instructor_candidate: "Instructor Candidate",
  c1: "C1 (Classroom 1)",
  r1: "R1 (Range 1)",
  c2: "C2 (Classroom 2)",
  r2: "R2 (Range 2)",
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function daysBetween(target: Date, today: Date): number {
  const ms = 1000 * 60 * 60 * 24;
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / ms);
}

function prettyDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

async function hashRoles(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  const authHeader = req.headers.get("Authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!bearer || !timingSafeEqual(bearer, serviceRoleKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const horizon = new Date(today.getTime() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const { data: schedules, error: schedErr } = await supabase
      .from("schedules")
      .select("id, course, date, schedule, location, location_label, group_name, cancelled_at")
      .gte("date", todayStr)
      .lte("date", horizon)
      .order("date");
    if (schedErr) throw schedErr;

    const active = (schedules || []).filter((s) => !s.cancelled_at);
    const schedIds = active.map((s) => s.id);
    if (!schedIds.length) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: assignments } = await supabase
      .from("instructor_assignments")
      .select("schedule_id, employee_id, assignment_role, part")
      .in("schedule_id", schedIds);

    const empIds = Array.from(new Set((assignments || []).map((a) => a.employee_id)));
    const { data: emps } = await supabase
      .from("employees")
      .select("id, user_id, full_name, email")
      .in("id", empIds.length ? empIds : ["00000000-0000-0000-0000-000000000000"]);
    const empMap = new Map((emps || []).map((e) => [e.id, e]));
    const schedMap = new Map(active.map((s) => [s.id, s]));

    // group assignments by schedule + employee
    const grouped = new Map<string, { schedule_id: string; employee_id: string; roles: string[] }>();
    for (const a of assignments || []) {
      const key = `${a.schedule_id}|${a.employee_id}`;
      const label = ROLE_LABELS[a.assignment_role] || a.assignment_role;
      const text = a.part ? `${a.part}: ${label}` : label;
      const g = grouped.get(key) || { schedule_id: a.schedule_id, employee_id: a.employee_id, roles: [] };
      if (!g.roles.includes(text)) g.roles.push(text);
      grouped.set(key, g);
    }

    const { data: sentRows } = await supabase
      .from("assignment_notifications_sent")
      .select("schedule_id, employee_id, milestone, roles_hash")
      .in("schedule_id", schedIds);
    const sentMap = new Map(
      (sentRows || []).map((r) => [`${r.schedule_id}|${r.employee_id}|${r.milestone}`, r]),
    );

    const enqueueEmail = async (to: string, subject: string, body: string, key: string, label: string) => {
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
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.6;max-width:640px">${
        body.split("\n\n").map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("")
      }</div>`;
      return supabase.rpc("enqueue_email" as any, {
        queue_name: "transactional_emails",
        payload: {
          to,
          from: "Learn to Ride VC <notifications@notify.learntoridevc.com>",
          sender_domain: "notify.learntoridevc.com",
          subject,
          text: body,
          html,
          template_name: label,
          label,
          purpose: "transactional",
          idempotency_key: key,
          message_id: key,
          unsubscribe_token: tok,
        },
      });
    };

    const footer =
      `Log in to your portal to view your full schedule: ${PORTAL_URL}\n` +
      `If you cannot teach this class, request a replacement through the Sub Coverage tab in your portal — do not arrange changes by text or phone alone.`;

    // Owner/office copies of assignment notices
    const { data: bccCfg } = await supabase
      .from("email_bcc_settings")
      .select("enabled, bcc_email")
      .eq("id", true)
      .maybeSingle();
    const copyTargets = [OFFICE_EMAIL];
    if (bccCfg?.enabled && bccCfg?.bcc_email) copyTargets.push(bccCfg.bcc_email);

    let processed = 0;

    for (const g of grouped.values()) {
      const s = schedMap.get(g.schedule_id);
      const emp = empMap.get(g.employee_id);
      if (!s || !emp?.email) continue;

      const delta = daysBetween(new Date(s.date + "T00:00:00"), today);
      const rolesText = g.roles.sort().join(", ");
      const rolesHash = await hashRoles(rolesText);

      const where = `${s.location_label || s.location}${s.group_name ? ` — Group ${s.group_name}` : ""}`;
      const details =
        `Course: ${s.course}\n` +
        `Date: ${prettyDate(s.date)}\n` +
        `Class days & times: ${s.schedule}\n` +
        `Location: ${where}\n` +
        `Your assignment: ${rolesText}`;

      const milestones: string[] = [];
      const prev = sentMap.get(`${g.schedule_id}|${g.employee_id}|assigned`);
      if (!prev) milestones.push("assigned");
      else if (prev.roles_hash && prev.roles_hash !== rolesHash) milestones.push(`updated-${rolesHash}`);
      if (delta === 3) milestones.push("reminder_3d");
      if (delta === 1) milestones.push("reminder_1d");

      for (const milestone of milestones) {
        if (sentMap.has(`${g.schedule_id}|${g.employee_id}|${milestone}`)) continue;

        const isUpdate = milestone.startsWith("updated");
        const subject = isUpdate
          ? `Updated teaching assignment — ${s.course}, ${prettyDate(s.date)}`
          : milestone === "assigned"
            ? `You're scheduled to teach — ${s.course}, ${prettyDate(s.date)}`
            : `Reminder: you teach ${s.course} in ${milestone === "reminder_1d" ? "1 day" : "3 days"}`;

        const lead = isUpdate
          ? `Your assignment for the class below has been updated.`
          : milestone === "assigned"
            ? `You have been scheduled to teach the following class.`
            : `This is a reminder of your upcoming teaching assignment.`;

        const body = `Hi ${emp.full_name},\n\n${lead}\n\n${details}\n\n${footer}\n\n— Learn to Ride VC`;
        const key = `assign-${g.schedule_id}-${g.employee_id}-${milestone}`;

        await enqueueEmail(emp.email, subject, body, key, "instructor_schedule_notice");

        // Copy the office and owner on new / changed assignments
        if (milestone === "assigned" || isUpdate) {
          const copySubject = isUpdate
            ? `Assignment updated — ${emp.full_name} — ${s.course}, ${prettyDate(s.date)}`
            : `Instructor assigned — ${emp.full_name} — ${s.course}, ${prettyDate(s.date)}`;
          const copyBody =
            `${isUpdate ? "An instructor's assignment has been updated." : "An instructor has been scheduled to teach."}\n\n` +
            `Instructor: ${emp.full_name} (${emp.email})\n${details}\n\n` +
            `View or change staffing in the portal: ${PORTAL_URL}\n\n— Learn to Ride VC`;
          for (const target of copyTargets) {
            await enqueueEmail(
              target,
              copySubject,
              copyBody,
              `${key}-copy-${target.toLowerCase()}`,
              "instructor_schedule_notice_copy",
            );
          }
        }

        if (emp.user_id) {
          await supabase.from("notifications").insert({
            user_id: emp.user_id,
            type: "schedule_assignment",
            title: subject,
            body: `${s.course} — ${prettyDate(s.date)} — ${where}. Your assignment: ${rolesText}.`,
            link: "/employee-dashboard?tab=schedule",
          });
        }

        await supabase.from("assignment_notifications_sent").insert({
          schedule_id: g.schedule_id,
          employee_id: g.employee_id,
          milestone,
          roles_hash: rolesHash,
        });

        // keep the "assigned" row's hash current so future changes are detected
        if (isUpdate) {
          await supabase.from("assignment_notifications_sent")
            .update({ roles_hash: rolesHash })
            .eq("schedule_id", g.schedule_id)
            .eq("employee_id", g.employee_id)
            .eq("milestone", "assigned");
        }

        processed += 1;
      }
    }

    // Office digest of tomorrow's classes and staffing
    const tomorrowStr = new Date(today.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10);
    const tomorrowClasses = active.filter((s) => s.date === tomorrowStr);
    if (tomorrowClasses.length) {
      const blocks = tomorrowClasses.map((s) => {
        const staff = Array.from(grouped.values())
          .filter((g) => g.schedule_id === s.id)
          .map((g) => `  • ${empMap.get(g.employee_id)?.full_name || "Unknown"} — ${g.roles.sort().join(", ")}`)
          .join("\n");
        return `${s.course} — ${s.location_label || s.location}${s.group_name ? ` (Group ${s.group_name})` : ""}\n${s.schedule}\n${staff || "  • NO INSTRUCTORS ASSIGNED"}`;
      }).join("\n\n");

      const body = `Classes scheduled for ${prettyDate(tomorrowStr)}:\n\n${blocks}\n\nView or change staffing in the portal: ${PORTAL_URL}`;
      await enqueueEmail(
        OFFICE_EMAIL,
        `Tomorrow's classes & instructor staffing — ${prettyDate(tomorrowStr)}`,
        body,
        `office-digest-${tomorrowStr}`,
        "office_schedule_digest",
      );
      processed += 1;
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-teaching-schedule] error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
