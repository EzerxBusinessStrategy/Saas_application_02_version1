# 0009: Request-path performance and authenticated-context caching

- Status: Accepted
- Date: 2026-08-10
- Decision makers: Product owner and engineering

## Context

Authenticated requests currently repeatedly resolve identity, tenant membership,
roles, permissions, session policy, and tenant suspension state. They also update
the session activity timestamp and issue several separate `set_config` queries.
This creates avoidable database writes, connection work, and row-lock contention.

## Decision

- Keep a protected session-policy read for every authenticated request.
- Update `last_seen_at` only when it is at least one minute old.
- Store a short-lived, bounded, process-local resolved-auth-context cache. Cache
  entries are accepted only when their stored session context version matches the
  version returned by the protected session-policy query.
- Increment session context versions on user, membership, tenant, role, and
  permission changes so cached authorization is rejected immediately after a
  relevant change.
- Set all transaction-local PostgreSQL context settings in one parameterized
  statement.
- Run expired tenant-suspension restoration through bounded platform maintenance,
  not as part of normal request handling.
- Configure TanStack Query with modest defaults so cached page data stays visible
  during background refreshes. Do not use full-screen loaders for normal API
  refetches.

## Consequences

Normal authenticated requests make fewer writes and reuse safe context in a
single API process. A cache miss still resolves against PostgreSQL. Multi-process
cache entries are protected by the version check on the session policy row.
The maintenance timer is best-effort per API process; the restoration function is
idempotent, so overlapping invocations are safe.
