# Cash vs. card at checkout + Pending Payment queue

## Checkout change (student side)
At the payment step, before the card form, the student picks how they're paying:

- **Pay by card now** — continues straight into the existing secure card form. Nothing else changes.
- **Pay by cash** — no card form. Instead they see a clear notice:

  > Your registration is on hold. Seats are only reserved once payment is received, so your spot in this class is not held yet. Call our office at (805) 827-0075, Monday–Friday, 9:00 AM – 5:00 PM, to complete payment. As soon as we take your payment we'll confirm your seat and email your class details.

  Their registration (and any forms they already signed) is saved as **Pending payment — cash**, and they land on a confirmation page explaining the next step. No confirmation-of-enrollment email goes out; instead they get a short "action needed" message on screen.

## Admin: Pending Payment queue
A new **Pending Payment (Cash)** section inside the Bookings tab, visible to owner and admin:

- Lists every cash-hold registration with student name, contact info, course, the class they picked, amount owed, when they registered, and a forms status chip (waiver / registration form / model release: signed or missing).
- A **Mark Paid** action opens a short dialog: choose how the cash was received, add an optional note, confirm the amount.
- On confirm the booking flips to paid + confirmed, drops out of the pending list, appears in the main booking records, and shows up on that class's roster.
- **If their original class filled up in the meantime**, the dialog says so and shows the classes that still have open seats (same course, upcoming dates). The office picks one; the student is moved to that class, the roster and class dates update everywhere, and the registration confirmation email goes out with the new dates.
- **Cancel/release** action for people who never call, which archives the hold with a reason.

Cash holds never consume a seat while pending, so the public seat counts stay accurate.

## Technical details
- Add `pending_payment boolean not null default false` plus `pending_payment_note` and `marked_paid_at/by` to `bookings`; set `booking_status = 'pending_payment'`, `payment_status = 'unpaid'`, `payment_provider = 'cash'` for cash holds.
- Update `booking_occupies_seat(...)` and the `trg_sync_spots_on_booking` trigger to exclude `pending_payment = true`, so releasing/holding seats stays consistent (marking paid re-decrements the seat, moving classes shifts the seat to the new schedule).
- `create-booking` edge function accepts a `cash_pending` payment status and writes those fields; registration-confirmation email is suppressed for pending rows and fired from the admin "Mark Paid" step instead (reusing `sendRegistrationConfirmation`, with the new schedule's dates when the class changed).
- New `PendingCashPayments.tsx` under `src/components/admin/`, rendered from `AdminBookings.tsx` as a view toggle alongside Bookings / Cancellations; forms status reuses the existing signed-waiver matching used by the roster.
- Main bookings table filters out `pending_payment` rows so the queue is the single place they live until paid.
