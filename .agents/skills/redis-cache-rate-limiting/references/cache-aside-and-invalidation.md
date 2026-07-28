# Cache Aside And Invalidation

- Read cache, load from PostgreSQL on miss, then set with TTL.
- Invalidate after database commit.
- Prefer outbox events for cross-process invalidation.
- Keep PostgreSQL authoritative.
- Define behavior for stale values and Redis outages.
