/**
 * Overbooking report logic.
 * A seat is taken by a registration that is active (not archived, not dropped),
 * paid (not pending payment) and not a retest — the same rule the database
 * uses to enforce class capacity (booking_occupies_seat).
 */

export const DEFAULT_SEAT_LIMIT = 12;

export interface OBSchedule {
  id: string;
  date: string;
  course: string;
  location_label: string;
  group_name: string | null;
  total_seats: number | null;
  schedule?: string | null;
  cancelled_at?: string | null;
}

export interface OBBooking {
  id: string;
  schedule_id: string | null;
  original_schedule_id: string | null;
  first_name: string;
  last_name: string;
  archived: boolean | null;
  dropped: boolean | null;
  is_retest: boolean | null;
  pending_payment: boolean | null;
  needs_reschedule: boolean | null;
  reschedule_reason: string | null;
  dropped_reason?: string | null;
  rescheduled_at: string | null;
  overbook_override?: boolean | null;
  overbook_reason?: string | null;
}

export interface OBMove {
  booking_id: string;
  from_schedule_id: string | null;
  to_schedule_id: string | null;
  moved_at: string;
  reason?: string | null;
}

export type DestinationKind = "class" | "waiting" | "dropped" | "removed";

export interface MovedStudent {
  bookingId: string;
  name: string;
  isRetest: boolean;
  reason: string | null;
  movedAt: string | null;
  destinationKind: DestinationKind;
  destination: OBSchedule | null;
}

export interface OverbookingRow {
  schedule: OBSchedule;
  seatLimit: number;
  seatLimitAssumed: boolean;
  seatedNow: number;
  retestsNow: number;
  unpaidNow: number;
  peakEstimate: number;
  overNow: boolean;
  likelyOverBefore: boolean;
  overrides: { name: string; reason: string | null }[];
  movedOut: MovedStudent[];
}

export const occupiesSeat = (b: Pick<OBBooking, "schedule_id" | "archived" | "dropped" | "is_retest" | "pending_payment">) =>
  !!b.schedule_id && !b.archived && !b.dropped && !b.is_retest && !b.pending_payment;

export const seatLimitFor = (s: Pick<OBSchedule, "total_seats">) =>
  s.total_seats == null
    ? { limit: DEFAULT_SEAT_LIMIT, assumed: true }
    : { limit: s.total_seats, assumed: false };

const destinationFor = (
  b: OBBooking,
  fromId: string,
  byId: Map<string, OBSchedule>,
): { kind: DestinationKind; schedule: OBSchedule | null } => {
  if (b.schedule_id && b.schedule_id !== fromId) {
    return { kind: "class", schedule: byId.get(b.schedule_id) ?? null };
  }
  if (b.needs_reschedule) return { kind: "waiting", schedule: null };
  if (b.archived) return { kind: "removed", schedule: null };
  return { kind: "dropped", schedule: null };
};

export function buildOverbookingReport(
  schedules: OBSchedule[],
  bookings: OBBooking[],
  moves: OBMove[] = [],
): OverbookingRow[] {
  const byId = new Map(schedules.map((s) => [s.id, s]));
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const inClass = new Map<string, OBBooking[]>();
  const leftClass = new Map<string, Map<string, string | null>>(); // schedule -> bookingId -> movedAt
  const moveReason = new Map<string, string>(); // `${schedule}|${booking}` -> reason given for that move

  const addLeft = (scheduleId: string, bookingId: string, at: string | null) => {
    if (!leftClass.has(scheduleId)) leftClass.set(scheduleId, new Map());
    const m = leftClass.get(scheduleId)!;
    if (!m.has(bookingId) || (at && !m.get(bookingId))) m.set(bookingId, at);
  };

  for (const b of bookings) {
    if (b.schedule_id) {
      if (!inClass.has(b.schedule_id)) inClass.set(b.schedule_id, []);
      inClass.get(b.schedule_id)!.push(b);
    }
    if (b.original_schedule_id) addLeft(b.original_schedule_id, b.id, b.rescheduled_at);
  }
  for (const m of moves) {
    if (m.from_schedule_id) {
      addLeft(m.from_schedule_id, m.booking_id, m.moved_at);
      if (m.reason) moveReason.set(`${m.from_schedule_id}|${m.booking_id}`, m.reason);
    }
  }

  const rows: OverbookingRow[] = [];
  for (const s of schedules) {
    if (s.cancelled_at) continue;
    const { limit, assumed } = seatLimitFor(s);
    const current = inClass.get(s.id) ?? [];
    const seated = current.filter(occupiesSeat);
    const seatedIds = new Set(seated.map((b) => b.id));

    const movedOut: MovedStudent[] = [];
    for (const [bookingId, movedAt] of leftClass.get(s.id) ?? []) {
      if (seatedIds.has(bookingId)) continue; // still holding a seat here
      const b = bookingById.get(bookingId);
      if (!b) continue;
      if (b.schedule_id === s.id && !b.dropped && !b.needs_reschedule && !b.archived) continue;
      const dest = destinationFor(b, s.id, byId);
      movedOut.push({
        bookingId,
        name: `${b.first_name} ${b.last_name}`.trim(),
        isRetest: !!b.is_retest,
        reason: moveReason.get(`${s.id}|${bookingId}`) || b.reschedule_reason || b.dropped_reason || null,
        movedAt,
        destinationKind: dest.kind,
        destination: dest.schedule,
      });
    }

    // Students who left would have held a seat (retests never do; removed duplicates never counted)
    const formerSeatHolders = movedOut.filter((m) => !m.isRetest && m.destinationKind !== "removed").length;
    const peakEstimate = seated.length + formerSeatHolders;
    const overrides = current
      .filter((b) => b.overbook_override)
      .map((b) => ({ name: `${b.first_name} ${b.last_name}`.trim(), reason: b.overbook_reason ?? null }));

    const overNow = seated.length > limit;
    const likelyOverBefore = peakEstimate > limit;
    if (!overNow && !likelyOverBefore && overrides.length === 0) continue;

    rows.push({
      schedule: s,
      seatLimit: limit,
      seatLimitAssumed: assumed,
      seatedNow: seated.length,
      retestsNow: current.filter((b) => b.is_retest && !b.archived && !b.dropped).length,
      unpaidNow: current.filter((b) => b.pending_payment && !b.archived && !b.dropped && !b.is_retest).length,
      peakEstimate,
      overNow,
      likelyOverBefore,
      overrides,
      movedOut: movedOut.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  return rows.sort((a, b) => b.schedule.date.localeCompare(a.schedule.date));
}
