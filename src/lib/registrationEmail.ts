import { supabase } from "@/integrations/supabase/client";

export const formatScheduleDate = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
};

// Expand schedule detail like "Sat 6:45am–5:00pm, Sun 6:45am–5:00pm" into dated lines.
export const expandScheduleDetailWithDates = (
  detail: string | null | undefined,
  startIso: string | null | undefined,
): string => {
  if (!detail) return "";
  if (!startIso) return detail;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(startIso);
  if (!m) return detail;
  const dowMap: Record<string, number> = {
    sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
  };
  const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const startDow = start.getDay();
  const parts = detail.split(/\s*,\s*/).filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    const mm = /^([A-Za-z]+)\s+(.*)$/.exec(part.trim());
    if (!mm) { out.push(part); continue; }
    const dow = dowMap[mm[1].toLowerCase()];
    if (dow === undefined) { out.push(part); continue; }
    const offset = (dow - startDow + 7) % 7;
    const d = new Date(start);
    d.setDate(start.getDate() + offset);
    const dateLabel = d.toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });
    out.push(`${dateLabel} — ${mm[2]}`);
  }
  return out.join("\n");
};

export type RegistrationEmailPayload = {
  email: string;
  firstName: string;
  lastName: string;
  courseKey: string;
  courseLabel: string;
  locationLabel: string;
  location: string;
  groupName: string | null;
  scheduleDate: string | null;
  scheduleDetail: string | null;
  fee: string;
  additionalRecipients?: string[];
};

export const sendRegistrationConfirmation = async (payload: RegistrationEmailPayload) => {
  try {
    const { data, error } = await supabase.functions.invoke("send-auto-email", {
      body: {
        trigger_event: "registration_confirmation",
        recipientEmail: payload.email,
        location: payload.location,
        groupName: payload.groupName,
        course: payload.courseKey,
        additionalRecipients: payload.additionalRecipients ?? [],
        variables: {
          firstName: payload.firstName,
          lastName: payload.lastName,
          course: payload.courseLabel,
          locationLabel: payload.locationLabel,
          groupName: payload.groupName || "",
          scheduleDate: formatScheduleDate(payload.scheduleDate),
          scheduleDetail: expandScheduleDetailWithDates(payload.scheduleDetail, payload.scheduleDate),
          schedule: expandScheduleDetailWithDates(payload.scheduleDetail, payload.scheduleDate),
          scheduleTimes: payload.scheduleDetail || "",
          fee: payload.fee,
          email: payload.email,
        },
      },
    });
    if (error) throw error;
    if (data && typeof data === "object" && "skipped" in data && (data as any).skipped) {
      console.warn("Auto email was skipped:", data);
    }
    return true;
  } catch (e) {
    console.warn("Auto email failed to dispatch:", e);
    return false;
  }
};
