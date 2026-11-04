# Architecture rules

- Apply registration confirmation session labels in the shared email sender, not individual booking screens, so online, office, payment-link, and resend paths stay consistent.
- Use the shared roster eligibility predicate for class totals and attending rows so unpaid, archived and dropped registrations cannot inflate attendance counts.