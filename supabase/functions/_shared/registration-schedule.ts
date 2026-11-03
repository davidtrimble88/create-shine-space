// Only Wednesday/Friday MTC classroom sessions use Zoom; other courses stay unchanged.
export const isZoomRegistrationSession = (course: string | null, weekday: number): boolean =>
  course === "basic" && (weekday === 3 || weekday === 5);

export const labelRegistrationSchedule = (schedule: string, course: string | null): string => {
  if (course !== "basic") return schedule;
  // Support both raw comma-separated schedules and expanded dated lines.
  return schedule.replace(
    /(^|\n|,\s*)(Wed(?:nesday)?|Fri(?:day)?)([^\n]*?)(?=,\s*[A-Za-z]+\s+\d{1,2}:|\n|$)/gi,
    (line, prefix: string, day: string, rest: string) => {
      const weekday = day.toLowerCase().startsWith("wed") ? 3 : 5;
      if (!isZoomRegistrationSession(course, weekday) || /\bzoom\b/i.test(rest)) return line;
      return `${prefix}${day}${rest} — Via Zoom`;
    },
  );
};