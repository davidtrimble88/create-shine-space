import { describe, it, expect } from "vitest";
import { classesMissingSeatLimit, hasNoSeatLimit, parseSeatLimit } from "@/lib/seatLimits";

const today = "2026-11-12";

describe("seat limit red flag", () => {
  it("flags an upcoming class with no seat limit", () => {
    const r = classesMissingSeatLimit([{ id: "a", date: "2026-11-20", schedule: "Sat, Sun", total_seats: null }], today);
    expect(r.map((s) => s.id)).toEqual(["a"]);
  });

  it("does not flag a class that has a seat limit", () => {
    expect(classesMissingSeatLimit([{ id: "a", date: "2026-11-20", total_seats: 12 }], today)).toEqual([]);
  });

  it("treats a zero seat limit as missing", () => {
    expect(hasNoSeatLimit({ total_seats: 0 })).toBe(true);
  });

  it("does not flag cancelled classes", () => {
    expect(classesMissingSeatLimit([{ id: "a", date: "2026-11-20", total_seats: null, cancelled_at: "2026-11-01" }], today)).toEqual([]);
  });

  it("does not flag classes that have fully finished", () => {
    expect(classesMissingSeatLimit([{ id: "a", date: "2026-11-01", schedule: "Sat, Sun", total_seats: null }], today)).toEqual([]);
  });

  it("still flags a multi-day class that started but has not finished", () => {
    // Wed Nov 11 start, meets Wed, Sat, Sun -> ends Sun Nov 15
    const r = classesMissingSeatLimit([{ id: "a", date: "2026-11-11", schedule: "Wed 6pm, Sat 7am, Sun 7am", total_seats: null }], today);
    expect(r.map((s) => s.id)).toEqual(["a"]);
  });

  it("only accepts whole-number seat limits of 1 or more", () => {
    expect(parseSeatLimit("12")).toBe(12);
    expect(parseSeatLimit("0")).toBeNull();
    expect(parseSeatLimit("")).toBeNull();
    expect(parseSeatLimit("10.5")).toBeNull();
  });
});
