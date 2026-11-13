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

export interface SeatCountBooking {
  schedule_id: string | null;
  archived?: boolean | null;
  dropped?: boolean | null;
  is_retest?: boolean | null;
  pending_payment?: boolean | null;
}

/** Same seat rule the database uses: paid, active, non-retest students hold a seat. */
export const holdsSeat = (b: SeatCountBooking) =>
  !!b.schedule_id && !b.archived && !b.dropped && !b.is_retest && !b.pending_payment;

/**
 * Still-running, non-cancelled classes whose seated students exceed their saved seat limit.
 * Classes without a limit are reported separately by classesMissingSeatLimit.
 */
export const classesOverbookedNow = <T extends SeatLimitSchedule>(
  schedules: T[],
  bookings: SeatCountBooking[],
  todayISO: string,
): { schedule: T; seated: number; limit: number }[] => {
  const seatedBy = new Map<string, number>();
  for (const b of bookings) {
    if (holdsSeat(b)) seatedBy.set(b.schedule_id!, (seatedBy.get(b.schedule_id!) ?? 0) + 1);
  }
  return schedules
    .filter((s) => !s.cancelled_at && !hasNoSeatLimit(s) && classEndDate(s.date, s.schedule) >= todayISO)
    .map((s) => ({ schedule: s, seated: seatedBy.get(s.id) ?? 0, limit: s.total_seats as number }))
    .filter((r) => r.seated > r.limit)
    .sort((a, b) => a.schedule.date.localeCompare(b.schedule.date));
};
