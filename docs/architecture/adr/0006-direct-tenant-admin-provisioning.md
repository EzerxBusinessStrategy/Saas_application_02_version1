# ADR 0006: Direct Tenant Administrator provisioning

**Status:** Accepted

**Date:** 2026-08-03

## Decision

Super Admin tenant creation provisions the first Tenant Administrator as a
confirmed Supabase Auth email/password account. The password is sent only to
Supabase Auth and is never stored in application tables, audit metadata, or
frontend state after submission. The existing membership activation function is
completed immediately and the new tenant becomes active through an audited,
Super Admin-only database function.

## Consequences

- The first Tenant Administrator logs in through the verified Tenant Admin
  portal; no invitation email or activation link is sent.
- Revoked, suspended, or inactive memberships remain denied by the trusted
  request-context and session-policy guards.
- A verified Super Admin with `tenant.update` may set a new password for the
  active Tenant Administrator through Supabase Auth. Each request, failure,
  and success is audited without password material.
- Verified Tenant Administrator sign-in and explicit sign-out are recorded as
  immutable tenant audit events. The Super Admin tenant list derives access
  status and timestamps from those events.
- `0034_direct_tenant_admin_provisioning.sql` is additive and forward-fixable.
  It does not delete historical invitation records.
