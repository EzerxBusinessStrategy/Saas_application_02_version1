# When To Use BullMQ

Use BullMQ only after a measured or approved need for:

- delayed jobs,
- higher worker throughput,
- distributed workers,
- queue-specific retries or controls,
- per-queue concurrency.

Keep PostgreSQL as the source of truth.
