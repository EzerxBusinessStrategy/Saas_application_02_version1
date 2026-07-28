# Idempotent Mutation Contract

Use idempotency for tenant provisioning, approvals, payments, invoices, document finalization, support tickets, recognition awards, and webhooks.

- Accept an `Idempotency-Key` header for critical mutations.
- Scope the key by trusted tenant and actor where applicable.
- Store a request-body fingerprint.
- Reject reuse of the same key with a different fingerprint.
- Return a consistent response for completed duplicates where safe.
- Handle in-progress duplicates with `409` or a documented retry response.
