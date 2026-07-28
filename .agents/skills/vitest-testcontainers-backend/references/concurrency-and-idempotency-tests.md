# Concurrency And Idempotency Tests

- Start duplicate requests with the same idempotency key.
- Start conflicting requests with different keys.
- Verify request-body fingerprints reject key reuse with different payloads.
- Use row locks or expected versions in the code path under test.
- Assert only one approval, payment, or finalization succeeds.
- Test worker duplicate delivery.
