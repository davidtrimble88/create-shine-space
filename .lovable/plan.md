## Guided Question Wizard for CMSP Registration Form

Replace the current "overlay-on-PDF" approach with a clean step-by-step wizard. Each question appears one at a time in a card, the user answers, hits Next, and moves on. When they finish, the answers are stamped into the PDF server-side (same code path we already have) and they sign the completed document.

### User flow

1. User reaches the "CMSP Registration Form" step in registration.
2. A card shows **Question 1 of 12** with a progress bar.
3. User picks/types the answer, clicks **Next** (or **Back**).
4. After the last question, a **Review** screen lists all answers with edit links.
5. User clicks **Generate & Sign** → the filled PDF renders (read-only preview) → they sign with the existing SharedDocuSignPad → PDF is stamped and stored.

### Questions covered (matches the current PDF)

- Autofilled shown for confirmation only (name, address, DOB, phone, email, ID row) — user can tap to correct any field.
- Q1 Have you ridden before? (Yes/No)
- Q2 Miles ridden last year (<500 / 500–2000 / >2000)
- Q3 Type of bike (optional text)
- Q4 Have a permit? (Yes/No)
- Q5 Permit number (optional text)
- Q6 Own a street bike? (Yes/No + optional cc)
- Q7 Primary reason (Commuting / Recreation / Other + optional text)
- Q8 On-street accident? (Yes/No)
- Q9a Called for MTC info? (Yes/No)
- Q9b How did you hear? (multi-select from the 10 real PDF options + Other explain)
- Q10 Called DMV? (Yes/No)
- Q11 Taken course before? (Yes/No)
- Q12 May CMSP contact you? (Yes/No)
- Guardian block (only if minor) — same fields as today.

### What stays the same

- The stamped PDF template and server function (`record-registration-form`) — offsets stay locked; we just feed answers into it.
- Signature capture (`SharedDocuSignPad`), storage bucket, download link, and post-sign dialog.
- Model Release DocuSign flow — untouched.

### What gets removed

- The interactive yellow overlay on top of the PDF preview.
- The `?calibrate=1` UI in this component (still available on Model Release).
- Fake PDF options **DMV** and **Brochure** (not on the physical form).

### Files

- `src/components/RegistrationFormDocuSign.tsx` — rewrite as a wizard (`step` state 0–N, one `<Card>` per step, Back/Next buttons, review screen, then sign).
- `supabase/functions/record-registration-form/index.ts` — remove DMV/Brochure from allowed hear-about values; otherwise unchanged.
- No DB migration needed.

### Out of scope

- No changes to Model Release, Waiver, payment, or roster.
- No new tables, secrets, or edge functions.

Approve and I'll build it.
