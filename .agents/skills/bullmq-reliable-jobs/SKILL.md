---
name: bullmq-reliable-jobs
description: Design and implement reliable BullMQ jobs on managed Redis only when the PostgreSQL outbox worker is no longer sufficient because delayed jobs, higher throughput, distributed workers, or queue-specific controls justify the added infrastructure. Use when reviewing outbox-to-BullMQ bridges, job IDs, retries, backoff, fairness, dead-letter handling, or queue observability after an approved need. Do not use to add BullMQ speculatively.
---

# BullMQ Reliable Jobs

## Workflow

First answer:

1. Why is the PostgreSQL worker insufficient?
2. Which queue owns the job?
3. What makes the job idempotent?
4. What happens after every retry fails?
5. How is it observed and manually recovered?

Then design the smallest queue flow that preserves PostgreSQL as the authoritative business state.

## Rules

- Bridge database commits to queue publication through the transactional outbox.
- Make queue publication retryable and idempotent.
- Use stable job IDs or deduplication keys.
- Put identifiers in payloads, not unnecessary sensitive snapshots.
- Reload authoritative data before acting.
- Assume at-least-once execution.
- Make processors idempotent.
- Configure bounded attempts, timeout, stalled-job handling, and exponential backoff with jitter.
- Use queue-specific concurrency and respect third-party rate limits.
- Avoid retry storms.
- Provide per-tenant fairness when one tenant could dominate.
- Define dead-letter handling, retention, cleanup, graceful shutdown, metrics, and recovery.
- Test duplicates, crashes, Redis outages, and poison jobs.
- Do not install BullMQ or Redis during skill-creation tasks.

## References

- `references/when-to-use-bullmq.md`
- `references/outbox-to-bullmq-bridge.md`
- `references/job-design.md`
- `references/retries-backoff-timeouts.md`
- `references/concurrency-and-fairness.md`
- `references/dead-letter-and-recovery.md`
- `references/queue-observability.md`

## Trigger Tests

Should activate:

- "The outbox worker cannot handle delayed report jobs; design BullMQ."
- "Review this BullMQ processor for duplicate delivery safety."
- "Plan queue fairness so one tenant cannot dominate exports."

Should not activate:

- "Send an email after signup with the existing outbox."
- "Install Redis because queues are popular."
- "Fix a frontend loading spinner."
