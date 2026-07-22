// All timestamps in the app are displayed in Pacific Time (Los Angeles),
// which handles PST/PDT transitions automatically.
const TZ = "America/Los_Angeles";

type DateInput = Date | string | number | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === "") return null;
  const d = input instanceof Date ? input : new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

export function formatPST(
  input: DateInput,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }
): string {
  const d = toDate(input);
  if (!d) return "";
  return d.toLocaleString("en-US", { timeZone: TZ, ...options });
}

export function formatPSTDate(
  input: DateInput,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }
): string {
  const d = toDate(input);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { timeZone: TZ, ...options });
}

export function formatPSTTime(
  input: DateInput,
  options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }
): string {
  const d = toDate(input);
  if (!d) return "";
  return d.toLocaleTimeString("en-US", { timeZone: TZ, ...options });
}
