import { supabase } from "@/integrations/supabase/client";
import { classEndDate } from "@/lib/classDates";
import { formatScheduleDate } from "@/lib/registrationEmail";

/** Last clock time mentioned in a schedule string, e.g. "Sat 8am–5pm, Sun 8am–3:30pm" -> 15:30. */
const lastEndMinutes = (scheduleText: string | null | undefined): number | null => {
  const matches = String(scheduleText ?? "").match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(last);
  if (!m) return null;
  let hour = Number(m[1]) % 12;
  if (m[3].toLowerCase() === "pm") hour += 12;
  return hour * 60 + Number(m[2] ?? 0);
};

const minutesToLabel = (mins: number): string => {
  const h24 = Math.floor(mins / 60);
  const mm = mins % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
};

/** Retests happen during R2 testing, so students arrive 30 minutes before class ends. */
export const retestArrivalTime = (scheduleText: string | null | undefined): string => {
  const end = lastEndMinutes(scheduleText);
  if (end === null) return "";
  return minutesToLabel(Math.max(0, end - 30));
};

export type RetestEmailPayload = {
  email: string;
  firstName: string;
  lastName: string;
  courseKey: string;
  courseLabel: string;
  location: string;
  locationLabel: string;
  scheduleDate: string | null;
  scheduleDetail: string | null;
  retestType?: string | null;
};

/**
 * Emails a scheduled retest student their arrival time and location only —
 * never the full multi-day class schedule.
 */
export const sendRetestScheduledEmail = async (payload: RetestEmailPayload) => {
  const email = (payload.email || "").trim();
  if (!email || email === "retest@placeholder.com" || !email.includes("@")) {
    return { skipped: true as const, reason: "no_email" };
  }

  const endIso = classEndDate(payload.scheduleDate, payload.scheduleDetail);
  const arrivalTime = retestArrivalTime(payload.scheduleDetail);
  const classEndTime = (() => {
    const end = lastEndMinutes(payload.scheduleDetail);
    return end === null ? "" : minutesToLabel(end);
  })();

  const retestLabel =
    payload.retestType === "skill" ? "Skill Retest"
      : payload.retestType === "knowledge" ? "Knowledge Retest"
        : payload.retestType === "both" ? "Skill & Knowledge Retest"
          : "Retest";

  const { data, error } = await supabase.functions.invoke("send-auto-email", {
    body: {
      trigger_event: "retest_scheduled",
      recipientEmail: email,
      location: payload.location,
      course: payload.courseKey,
      variables: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        course: `${payload.courseLabel}, Retest`,
        retestType: retestLabel,
        locationLabel: payload.locationLabel,
        retestDate: formatScheduleDate(endIso),
        arrivalTime,
        classEndTime,
        email,
      },
    },
  });

  if (error) return { skipped: true as const, reason: error.message };
  return { sent: true as const, data };
};
