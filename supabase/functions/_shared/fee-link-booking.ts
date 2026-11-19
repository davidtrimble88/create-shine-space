// Decides what a paid staff payment link does to the student's registration.
// Shared by square-charge-fee and unit tests so the rule lives in one place.

export type FeeLinkBooking = {
  archived?: boolean | null;
  dropped?: boolean | null;
  pending_payment?: boolean | null;
  payment_status?: string | null;
  fee?: string | null;
  discount_amount_cents?: number | null;
};

/** Course-fee links ("other" from Bookings / Cash Payments, "balance" from deposits). */
export const isCourseFeeLink = (feeType: string): boolean =>
  feeType === "other" || feeType === "balance";

/** Dollar text like "$425" or "425.00" → cents. Unknown → 0. */
export const feeTextToCents = (fee: string | null | undefined): number => {
  const n = Number(String(fee ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};

/** Links on removed (archived) registrations must never take money. */
export const feeLinkBlockedReason = (booking: FeeLinkBooking): string | null =>
  booking.archived
    ? "This registration is no longer active, so this link can't be used. Please call the office."
    : null;

/** True when paying this link will put the student back on the roster (takes a seat). */
export const feeLinkWillTakeSeat = (feeType: string, booking: FeeLinkBooking): boolean =>
  isCourseFeeLink(feeType) && !booking.archived && !booking.dropped && booking.pending_payment === true;

/**
 * Booking changes after a successful course-fee charge, or null when the
 * booking should be left alone (e.g. reschedule/retest fees, already paid).
 */
export const bookingUpdateAfterFeePaid = (
  feeType: string,
  amountCents: number,
  booking: FeeLinkBooking,
  nowIso: string,
): Record<string, unknown> | null => {
  if (!isCourseFeeLink(feeType) || booking.archived) return null;
  const needsConfirm =
    booking.pending_payment === true ||
    booking.payment_status === "unpaid" ||
    (feeType === "balance" && booking.payment_status !== "paid");
  if (!needsConfirm) return null;

  const due = Math.max(feeTextToCents(booking.fee) - (booking.discount_amount_cents ?? 0), 0);
  const fullyPaid = feeType === "balance" || due === 0 || amountCents >= due;
  return {
    payment_status: fullyPaid ? "paid" : "partial",
    booking_status: "confirmed",
    pending_payment: false,
    payment_provider: "square",
    marked_paid_at: nowIso,
  };
};
