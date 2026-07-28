# Expand-Contract Pattern

1. Expand schema with backward-compatible additions.
2. Deploy code that can read/write both old and new shape.
3. Backfill existing data safely.
4. Validate data and constraints.
5. Switch reads to the new shape.
6. Contract old schema only after no deployed code depends on it.

Do not combine every step into one risky migration when production compatibility matters.
