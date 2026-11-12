# Architecture rules

- Apply registration confirmation session labels in the shared email sender, not individual booking screens, so online, office, payment-link, and resend paths stay consistent.
- Use the shared roster eligibility predicate for class totals and attending rows so unpaid, archived and dropped registrations cannot inflate attendance counts.- Log every booking class change through the database trigger into the class-move history table, and have overbooking reports combine it with the booking's last original class, because a booking only remembers its most recent previous class.
- Every class must carry a saved seat limit: the class form requires it and owners/admins see a dashboard-wide red alert (shared `src/lib/seatLimits.ts` rule) for any still-running class without one, because the database only blocks overbooking when a limit exists.
