import { describe, expect, it } from "vitest";
import {
  bookingUpdateAfterFeePaid,
  feeLinkBlockedReason,
  feeLinkWillTakeSeat,
} from "../../supabase/functions/_shared/fee-link-booking";

const NOW = "2026-11-19T12:00:00.000Z";

describe("paying a staff payment link", () => {
  it("puts a cash-hold student on the roster when they pay the full course fee", () => {
    const upd = bookingUpdateAfterFeePaid("other", 42500, { pending_payment: true, payment_status: "unpaid", fee: "$425" }, NOW);
    expect(upd).toMatchObject({ pending_payment: false, booking_status: "confirmed", payment_status: "paid" });
  });

  it("marks a cash-hold student partial (but still on the roster) when they pay less than the fee", () => {
    const upd = bookingUpdateAfterFeePaid("other", 22500, { pending_payment: true, payment_status: "unpaid", fee: "$425" }, NOW);
    expect(upd).toMatchObject({ pending_payment: false, payment_status: "partial" });
  });

  it("leaves the booking alone for a rescheduling fee", () => {
    expect(bookingUpdateAfterFeePaid("reschedule", 5000, { pending_payment: false, payment_status: "paid", fee: "$425" }, NOW)).toBeNull();
  });

  it("never revives a removed registration", () => {
    expect(bookingUpdateAfterFeePaid("other", 42500, { archived: true, pending_payment: true, payment_status: "unpaid", fee: "$425" }, NOW)).toBeNull();
    expect(feeLinkBlockedReason({ archived: true })).not.toBeNull();
    expect(feeLinkBlockedReason({ archived: false })).toBeNull();
  });

  it("only checks for an open seat when the payment moves a cash hold onto the roster", () => {
    expect(feeLinkWillTakeSeat("other", { pending_payment: true })).toBe(true);
    expect(feeLinkWillTakeSeat("other", { pending_payment: false })).toBe(false);
    expect(feeLinkWillTakeSeat("reschedule", { pending_payment: true })).toBe(false);
  });
});
