import { describe, expect, it } from "vitest";
import { buildOverbookingReport, type OBBooking, type OBSchedule } from "../lib/overbooking";

const cls = (id: string, total_seats: number | null = 12): OBSchedule => ({
  id, date: `2026-10-${id.padStart(2, "0")}`, course: "basic", location_label: "Ventura County — Somis", group_name: "Group A", total_seats,
});

let n = 0;
const student = (schedule_id: string | null, extra: Partial<OBBooking> = {}): OBBooking => ({
  id: `b${++n}`, schedule_id, original_schedule_id: null, first_name: "S", last_name: String(n),
  archived: false, dropped: false, is_retest: false, pending_payment: false, needs_reschedule: false,
  reschedule_reason: null, rescheduled_at: null, ...extra,
});
const many = (count: number, schedule_id: string, extra: Partial<OBBooking> = {}) =>
  Array.from({ length: count }, () => student(schedule_id, extra));

describe("overbooking report", () => {
  it("flags a class with more paid students than its seat limit", () => {
    const rows = buildOverbookingReport([cls("1")], many(13, "1"));
    expect(rows).toHaveLength(1);
    expect(rows[0].overNow).toBe(true);
    expect(rows[0].seatedNow).toBe(13);
  });

  it("does not flag a class that is exactly full", () => {
    expect(buildOverbookingReport([cls("1")], many(12, "1"))).toHaveLength(0);
  });

  it("does not count retests or unpaid registrations as seats", () => {
    const bookings = [...many(12, "1"), student("1", { is_retest: true }), student("1", { pending_payment: true })];
    expect(buildOverbookingReport([cls("1")], bookings)).toHaveLength(0);
  });

  it("uses 12 seats when a class has no seat limit saved", () => {
    const rows = buildOverbookingReport([cls("1", null)], many(13, "1"));
    expect(rows[0].seatLimit).toBe(12);
    expect(rows[0].seatLimitAssumed).toBe(true);
  });

  it("flags a class that was likely over before a student was moved out, and shows where they went", () => {
    const moved = student("2", { original_schedule_id: "1", rescheduled_at: "2026-10-01T00:00:00Z" });
    const rows = buildOverbookingReport([cls("1"), cls("2")], [...many(12, "1"), moved]);
    expect(rows).toHaveLength(1);
    expect(rows[0].overNow).toBe(false);
    expect(rows[0].peakEstimate).toBe(13);
    expect(rows[0].movedOut[0].destinationKind).toBe("class");
    expect(rows[0].movedOut[0].destination?.id).toBe("2");
  });

  it("marks a moved-out student still waiting for a new class", () => {
    const waiting = student("1", { dropped: true, needs_reschedule: true, original_schedule_id: "1" });
    const rows = buildOverbookingReport([cls("1")], [...many(12, "1"), waiting]);
    expect(rows[0].movedOut[0].destinationKind).toBe("waiting");
  });

  it("uses the class move history to find students moved out", () => {
    const moved = student("2");
    const rows = buildOverbookingReport([cls("1"), cls("2")], [...many(12, "1"), moved], [
      { booking_id: moved.id, from_schedule_id: "1", to_schedule_id: "2", moved_at: "2026-10-01T00:00:00Z" },
    ]);
    expect(rows[0].peakEstimate).toBe(13);
  });

  it("lists a class where staff used the overbook override", () => {
    const rows = buildOverbookingReport([cls("1")], [student("1", { overbook_override: true, overbook_reason: "Owner OK" })]);
    expect(rows[0].overrides).toEqual([{ name: expect.any(String), reason: "Owner OK" }]);
  });
});
