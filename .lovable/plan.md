# Capture every registration payment failure

## Changes
- Make payment-attempt tracking durable even when the original browser-side attempt row was not created or cannot be updated.
- Record distinct payment stages: provider setup, card tokenization, backend request, and processor decline/error.
- Include the registration attempt ID in the payment request so backend failures are captured before a payment reaches the processor.
- Preserve the most recent payment error if the customer retries or exits, including the minor registration path.
- Validate both adult and minor registration paths and deploy the updated payment function.

## Technical details
- Add a server-side fallback logger to the payment function using the existing `registration_attempts` record and visitor ownership model.
- Improve client logging so failed attempt creation or update cannot silently erase payment errors.
- Keep card data out of all logs; only stage, processor error code/message, student/contact context, amount, and timestamps are stored.
