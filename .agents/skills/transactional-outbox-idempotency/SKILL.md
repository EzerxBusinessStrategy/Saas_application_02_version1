---
name: transactional-outbox-idempotency
description: Implement and review PostgreSQL transactional outbox processing, idempotent API mutations, and idempotent background consumers for this SaaS. Use when designing reliable async side effects, worker claiming, retry/dead-letter policy, duplicate request handling, critical mutation idempotency, or outbox observability. Do not use to build a worker during skill creation or to claim exactly-once delivery.
---

# Transactional Outbox Idempotency

## Workflow

1. Read `AGENTS.md`, background-job rules, event rules, API contracts, and the mutation flow.
2. Decide whether the operation needs a database transaction only, idempotent API mutation, outbox event, background worker, queue, or external delivery deduplication.
3. Commit the business mutation and outbox event in one transaction.
4. Do not perform email, webhook, report generation, scanning, or other external work before commit.
5. Scope idempotency keys by trusted tenant and actor where appropriate.
6. Store request-body fingerprints and reject conflicting reuse.
7. Make consumers idempotent because delivery is at least once.
8. Define bounded retries, jitter, failed/dead-letter handling, retention, audit, and metrics.
9. Test duplicates, crashes, retries, and concurrent requests.

## Rules

- Use `FOR UPDATE SKIP LOCKED` or an approved equivalent for worker claims.
- Use bounded batches.
- Include stable event ID, tenant, type, aggregate, and payload.
- Minimize sensitive payload data.
- Use database uniqueness or locking as final protection for financial and approval operations.
- Handle in-progress duplicate requests consistently.
- Replay completed idempotent responses only where safe.
- Never describe the system as exactly once when it is at least once.
- Do not build the worker during skill-creation tasks.

## References

- `references/outbox-schema.md`
- `references/worker-claiming.md`
- `references/idempotency-key-lifecycle.md`
- `references/idempotent-consumer-patterns.md`
- `references/retry-and-dead-letter-policy.md`
- `references/outbox-observability.md`

## Trigger Tests

Should activate:

- "Design idempotency for invoice creation."
- "Review the transactional outbox worker claiming query."
- "Make document finalization safe against duplicate requests."

Should not activate:

- "Send a toast after saving a form."
- "Explain JavaScript promises."
- "Add BullMQ immediately without an ADR."
