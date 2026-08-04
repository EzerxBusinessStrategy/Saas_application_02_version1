# ADR 0007: Tenant timed suspension and soft revocation

**Status:** Accepted

**Date:** 2026-08-04

## Decision

Super Admins may suspend an active tenant for a fixed approved duration or
reactivate a suspended tenant early. Suspension persists `suspension_ends_at`
and is enforced by the trusted request-context resolver. An authenticated
request automatically restores only expired suspensions.

Revocation is a terminal soft lifecycle state. It preserves tenant business
data and audit history, revokes active application sessions for tenant members,
and makes every tenant portal request fail server-side. A revoked tenant cannot
be reactivated through this workflow.

## Consequences

- Lifecycle changes require distinct `tenant.suspend`, `tenant.reactivate`, or
  `tenant.revoke` platform permissions and are written to immutable audit data.
- The browser provides two revoke warnings, but the backend remains the source
  of authority for all lifecycle transitions.
- The additive migration is forward-fixable. Reinstating a revoked tenant would
  require a separately approved recovery workflow; no data is deleted.
