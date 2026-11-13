import { describe, it, expect } from "vitest";
import { classesOverbookedNow } from "@/lib/seatLimits";

const today = "2026-11-12";
const paid = (schedule_id: string, extra: Record<string, unknown> = {}) => ({ schedule_id, pending_payment: false, ...extra });

describe("currently overbooked classes", () => {
  it("counts a running class with more seated students than its limit", () => {
    const r = classesOverbookedNow(
      [{ id: "a", date: "2026-11-20", total_seats: 2 }],
      [paid("a"), paid("a"), paid("a")],
      today,
    );
    expect(r).toEqual([{ schedule: { id: "a", date: "2026-11-20", total_seats: 2 }, seated: 3, limit: 2 }]);
  });

  it("does not count a class that is exactly full", () => {
    expect(classesOverbookedNow([{ id: "a", date: "2026-11-20", total_seats: 2 }], [paid("a"), paid("a")], today)).toEqual([]);
  });

  it("ignores retests, unpaid, dropped and archived students", () => {
    const r = classesOverbookedNow(
      [{ id: "a", date: "2026-11-20", total_seats: 1 }],
      [paid("a"), paid("a", { is_retest: true }), paid("a", { pending_payment: true }), paid("a", { dropped: true }), paid("a", { archived: true })],
      today,
    );
    expect(r).toEqual([]);
  });

  it("ignores finished and cancelled classes", () => {
    const r = classesOverbookedNow(
      [
        { id: "past", date: "2026-11-01", total_seats: 1 },
        { id: "gone", date: "2026-11-20", total_seats: 1, cancelled_at: "2026-11-10T00:00:00Z" },
      ],
      [paid("past"), paid("past"), paid("gone"), paid("gone")],
      today,
    );
    expect(r).toEqual([]);
  });

  it("leaves classes without a limit to the missing-limit flag", () => {
    expect(classesOverbookedNow([{ id: "a", date: "2026-11-20", total_seats: null }], [paid("a"), paid("a")], today)).toEqual([]);
  });
});
