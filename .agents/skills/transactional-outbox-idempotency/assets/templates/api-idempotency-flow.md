# API Idempotency Flow

1. Validate `Idempotency-Key`.
2. Build scope from trusted tenant and actor.
3. Fingerprint request body.
4. Lock or insert key record.
5. Reject mismatched fingerprint.
6. Return in-progress duplicate response or replay completed response.
7. Execute mutation and outbox insert in one transaction.
8. Store safe completed response.
