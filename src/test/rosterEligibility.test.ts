import { describe, expect, it } from "vitest";
import { isActiveRosterBooking } from "../lib/rosterEligibility";

describe("roster enrollment eligibility", () => {
  it("excludes the two unpaid December 2 HD registrations from the registered count", () => {
    const registrations = [
      ...Array.from({ length: 5 }, () => ({ pending_payment: false })),
      { pending_payment: true },
      { pending_payment: true },
    ];
    expect(registrations.filter(isActiveRosterBooking)).toHaveLength(5);
  });

  it("excludes archived duplicates", () => {
    expect(isActiveRosterBooking({ pending_payment: false, archived: true })).toBe(false);
  });

  it("excludes dropped students", () => {
    expect(isActiveRosterBooking({ pending_payment: false, dropped: true })).toBe(false);
  });

  it("includes active retests without changing their separate classification", () => {
    const retest = { pending_payment: false, is_retest: true };
    expect(isActiveRosterBooking(retest)).toBe(true);
  });
});