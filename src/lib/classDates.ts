// Helpers for treating a class as a multi-day block instead of a single day.
// A schedule row stores only the START date plus a human-readable schedule
// string like "Fri 5:45pm–9:30pm, Sat 5:45am–4:30pm, Sun 6:00am–11:30am".
// The class isn't "past" until the day AFTER its last session.

const DAY_INDEX: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, weds: 3,
  thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
};

/** Parse an ISO date (YYYY-MM-DD) as a local date, avoiding UTC shifting. */
const parseISO = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

const toISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * Last calendar date the class meets, derived from the weekday names listed in
 * the schedule text. Falls back to the start date when nothing parses.
 */
export const classEndDate = (
  startDate: string | null | undefined,
  scheduleText: string | null | undefined,
): string => {
  if (!startDate) return startDate ?? "";
  const start = parseISO(startDate);
  if (Number.isNaN(start.getTime())) return startDate;

  const tokens = String(scheduleText ?? "")
    .toLowerCase()
    .match(/\b(sun|mon|tues|tue|weds|wed|thurs|thur|thu|fri|sat)\b/g);
  if (!tokens || tokens.length === 0) return startDate;

  // Walk forward from the start weekday through each listed day.
  let cursor = new Date(start);
  let cursorDow = start.getDay();
  let started = false;
  for (const t of tokens) {
    const dow = DAY_INDEX[t];
    if (dow === undefined) continue;
    if (!started) {
      started = true;
      // First token is assumed to be the start date itself.
      cursorDow = dow;
      continue;
    }
    let delta = (dow - cursorDow + 7) % 7;
    if (delta === 0) delta = 7;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + delta);
    cursorDow = dow;
  }
  return toISO(cursor);
};

/** True once the whole class has finished (i.e. the day after the last session). */
export const isClassPast = (
  startDate: string | null | undefined,
  scheduleText: string | null | undefined,
  todayISO?: string,
): boolean => {
  const today = todayISO ?? toISO(new Date());
  if (!startDate) return false;
  return classEndDate(startDate, scheduleText) < today;
};

/** Every calendar date the class meets, derived from the weekdays in the schedule text. */
export const classSessionDates = (
  startDate: string | null | undefined,
  scheduleText: string | null | undefined,
): string[] => {
  if (!startDate) return [];
  const start = parseISO(startDate);
  if (Number.isNaN(start.getTime())) return [startDate];

  const tokens = String(scheduleText ?? "")
    .toLowerCase()
    .match(/\b(sun|mon|tues|tue|weds|wed|thurs|thur|thu|fri|sat)\b/g);
  if (!tokens || tokens.length === 0) return [startDate];

  const dates: string[] = [startDate];
  let cursor = new Date(start);
  let cursorDow = start.getDay();
  let started = false;
  for (const t of tokens) {
    const dow = DAY_INDEX[t];
    if (dow === undefined) continue;
    if (!started) {
      started = true;
      cursorDow = dow;
      continue;
    }
    let delta = (dow - cursorDow + 7) % 7;
    if (delta === 0) delta = 7;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + delta);
    cursorDow = dow;
    dates.push(toISO(cursor));
  }
  return dates;
};

/** Human label listing every class day, e.g. "Fri Aug 14 · Sat Aug 15 · Sun Aug 16". */
export const formatClassDates = (
  startDate: string | null | undefined,
  scheduleText: string | null | undefined,
): string => {
  const dates = classSessionDates(startDate, scheduleText);
  if (dates.length === 0) return "";
  return dates
    .map((iso) =>
      parseISO(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    )
    .join(" · ");
};

/**
 * Registration cutoff: classes close at 5:00 PM Pacific on the Friday of the
 * class's own weekend.
 *  - Ventura Group B (starts Friday) -> that same Friday at 5pm
 *  - Ventura Group A (starts Saturday) -> the Friday right before
 *  - High Desert (starts Wednesday) -> the Friday immediately following
 * Returns the cutoff moment in ms since epoch, or null when unknown.
 */
export const registrationCloseAt = (startDate: string | null | undefined): number | null => {
  if (!startDate) return null;
  const start = parseISO(startDate);
  if (Number.isNaN(start.getTime())) return null;

  const dow = start.getDay(); // 0=Sun ... 6=Sat
  // Wed/Thu/Fri roll forward to that week's Friday; Sat/Sun (and Mon/Tue)
  // fall back to the Friday before the weekend.
  const delta = dow >= 3 && dow <= 5 ? 5 - dow : -(((dow + 7 - 5) % 7) || 7);
  const friday = new Date(start.getFullYear(), start.getMonth(), start.getDate() + delta);

  return pacificMoment(toISO(friday), 17, 0);
};

/** Convert a Pacific-time wall clock (date + hour) into epoch ms. */
const pacificMoment = (iso: string, hour: number, minute: number): number => {
  const [y, m, d] = iso.split("-").map(Number);
  // Start from the naive UTC guess, then correct by the Pacific offset.
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const offset = pacificOffsetMinutes(new Date(guess));
  return guess + offset * 60_000;
};

/** Minutes to ADD to a Pacific wall clock to get UTC (480 for PST, 420 for PDT). */
const pacificOffsetMinutes = (at: Date): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return Math.round((at.getTime() - asUTC) / 60_000);
};

/** True once registration has closed for a class with this start date. */
export const isRegistrationClosed = (startDate: string | null | undefined, now: number = Date.now()): boolean => {
  const cutoff = registrationCloseAt(startDate);
  return cutoff !== null && now >= cutoff;
};

/** Human label for the cutoff, e.g. "Fri, Sep 18 at 5:00 PM". */
export const registrationCloseLabel = (startDate: string | null | undefined): string => {
  const cutoff = registrationCloseAt(startDate);
  if (cutoff === null) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(new Date(cutoff));
};
