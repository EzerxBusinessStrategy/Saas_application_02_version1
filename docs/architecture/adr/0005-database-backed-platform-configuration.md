# ADR 0005: Database-backed platform configuration

**Status:** Accepted

**Date:** 2026-08-03

## Decision

Store the global platform name, default brand colour, and email sender name in
`public.platform_configurations`. The backend exposes a Super Admin-only
read/update API and records every update through the existing immutable audit
function.

## Consequences

- `0033_platform_configuration.sql` seeds the three values, enables and forces
  RLS, and grants only `app_runtime`/`app_readonly` access through platform-admin
  policies.
- Only `SUPER_ADMIN` receives `platform.configuration.read` and
  `platform.configuration.update`.
- The Super Admin shell reads the API value on load and updates its name and
  colour after a successful mutation. Browser storage is not a source of truth.
- The additive migration can be forward-fixed; no existing tenant data changes.
