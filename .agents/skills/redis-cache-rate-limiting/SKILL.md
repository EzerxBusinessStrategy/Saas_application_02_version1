---
name: redis-cache-rate-limiting
description: Introduce or review managed Redis only for measured caching, distributed rate limiting, locks, or ephemeral coordination needs in this SaaS. Use when a bottleneck, multi-instance throttling requirement, BullMQ dependency, tenant-aware cache design, Redis failure mode, or rate-limit policy must be designed or reviewed. Do not trigger merely because a feature could theoretically be cached.
---

# Redis Cache Rate Limiting

## Workflow

1. Read `AGENTS.md`, cache rules, API contracts, and measured performance evidence.
2. Verify PostgreSQL remains the source of truth.
3. Reject speculative Redis use when no measured problem exists.
4. Define cache owner, key, tenant scope, TTL, invalidation source, stampede control, fallback, memory/cardinality, metrics, and security risk.
5. Prefer HTTP caching or conditional requests before distributed cache when sufficient.
6. Invalidate after database commit, preferably from outbox events.
7. Define distributed throttling policies for multi-instance APIs.
8. Do not install Redis packages or modify code during skill-creation tasks.

## Rules

- Use tenant-aware and versioned keys.
- Never omit tenant scope from tenant-data cache keys.
- Use bounded TTLs with jitter.
- Prevent stampedes with single-flight locks or stale-while-revalidate.
- Avoid unbounded key cardinality.
- Define maximum value size and memory policy.
- Do not cache authoritative payments, approvals, memberships, permissions, or audit state.
- Fail safely when Redis is unavailable.
- Do not make ordinary CRUD depend entirely on cache availability.
- Scope rate limits by the right mix of IP, user, and tenant.
- Return proper retry information.
- Measure hit rate, latency, memory, and evictions.

## Cache Proposal Format

1. Measured problem
2. Data owner
3. Key
4. Tenant scope
5. TTL
6. Invalidation
7. Stampede control
8. Failure fallback
9. Memory/cardinality estimate
10. Metrics
11. Security risk

## References

- `references/cache-decision-framework.md`
- `references/key-naming.md`
- `references/cache-aside-and-invalidation.md`
- `references/stampede-prevention.md`
- `references/distributed-rate-limiting.md`
- `references/redis-failure-behavior.md`

## Trigger Tests

Should activate:

- "We measured repeated expensive reads; design a tenant-aware Redis cache."
- "Design distributed rate limits for login and exports."
- "Review Redis failure behavior for cached reports."

Should not activate:

- "Maybe cache this list someday."
- "Style the cache settings page."
- "Use TanStack Query for client-side server state."
