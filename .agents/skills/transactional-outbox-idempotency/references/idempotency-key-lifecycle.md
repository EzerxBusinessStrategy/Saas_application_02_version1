# Idempotency Key Lifecycle

1. Receive key and trusted actor context.
2. Compute request fingerprint.
3. Insert or lock idempotency record.
4. Reject same key with different fingerprint.
5. Return documented in-progress response for active duplicate.
6. Execute mutation once.
7. Store response summary when safe.
8. Replay completed response when safe.
