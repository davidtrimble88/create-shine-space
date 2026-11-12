import { classEndDate } from "@/lib/classDates";

export interface SeatLimitSchedule {
  id: string;
  date: string;
  schedule?: string | null;
  total_seats: number | null;
  cancelled_at?: string | null;
}

/** A class without a saved seat limit cannot be protected from overbooking. */
export const hasNoSeatLimit = (s: Pick<SeatLimitSchedule, "total_seats">) =>
  s.total_seats == null || s.total_seats <= 0;

/**
 * Classes that still meet (last session today or later), are not cancelled,
 * and have no seat limit — these must be flagged to owners and admins.
 */
export const classesMissingSeatLimit = <T extends SeatLimitSchedule>(schedules: T[], todayISO: string): T[] =>
  schedules
    .filter((s) => !s.cancelled_at && hasNoSeatLimit(s) && classEndDate(s.date, s.schedule) >= todayISO)
    .sort((a, b) => a.date.localeCompare(b.date));

/** A seat limit entered by staff must be a whole number of at least 1. */
export const parseSeatLimit = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null;
  return n;
};
