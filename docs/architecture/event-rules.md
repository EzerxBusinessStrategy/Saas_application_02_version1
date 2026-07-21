# Event rules

Use events only for justified cross-module or asynchronous work. Name events in past tense, use identifier-only job payloads, retain tenant context, make jobs idempotent, define retries/backoff/dead-letter ownership, and do not add event sourcing or async consistency changes without approval.
