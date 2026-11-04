type RosterEligibility = {
  archived?: boolean | null;
  dropped?: boolean | null;
  pending_payment?: boolean | null;
};

export const isActiveRosterBooking = (booking: RosterEligibility): boolean =>
  !booking.archived && !booking.dropped && booking.pending_payment === false;