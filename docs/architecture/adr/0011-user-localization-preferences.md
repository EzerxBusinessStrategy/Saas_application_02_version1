# 0011: User-owned localization and time-zone preferences

- Status: Proposed
- Date: 2026-08-11
- Decision makers: Product owner and engineering

## Context and problem

The application currently renders English strings from component literals and
the header clock keeps its country selection only in browser memory. Membership
time zones describe a tenant relationship and must not be repurposed as a
personal display preference. Each authenticated user needs an independent
locale and IANA time zone that follows them across portals and devices.

## Constraints

- Supported UI locales are `en`, `bn`, `hi`, and `or`; English is the fallback.
- UI translations are curated message dictionaries. Business data, database
  enum values, API field names, and user-entered content remain unchanged.
- Preferences belong to the verified application user, not a tenant or a
  browser-supplied identifier.
- The clock uses server UTC time plus an IANA zone. Daylight-saving rules must
  come from `Intl.DateTimeFormat`, not fixed UTC offsets.
- Existing authenticated URLs and role/tenant authorization remain unchanged.

## Considered options

1. Store locale and time zone only in browser storage.
2. Store them on `tenant_memberships`.
3. Add a user-owned `user_preferences` record and expose it through a
   protected current-user API.

## Decision and rationale

Adopt option 3. Add one optional, user-owned row per `public.users` record,
with controlled locale and IANA-zone values. The backend derives the target
user solely from the verified request context. It returns and updates only the
current user's preferences, with no `userId`, membership, tenant, or role
selection accepted from the browser.

Use `next-intl` with the current, unprefixed application routes. Message files
are the canonical translation source. A client selector persists the selected
locale and time zone through the protected API, then refreshes the current
route. `Intl.DateTimeFormat` handles localized dates, numbers, currencies, and
the server-synchronized clock.

## Positive and negative consequences

Users can choose language and clock zone independently across Super Admin,
Tenant Admin, Manager, Employee, and Client portals. The change avoids live
machine translation and does not alter business records.

The application must maintain message keys, perform dictionary completeness
validation, and obtain native-language review before a locale is released.
Adding every screen to the dictionary is a phased content migration, not a
single safe search-and-replace.

## Security and operational consequences

`user_preferences` is identity-owned and is not tenant-owned. RLS permits a
runtime actor to read or update only their own row through trusted user context.
The service must never trust a client-supplied user ID. Preference updates do
not change permissions, tenant context, or authorization cache versions.

## Migration and rollback

Create a new additive migration only. It creates the table, safe defaults,
allowlist checks, primary/foreign keys, RLS policies, grants, and an
`updated_at` trigger if that is the established schema pattern. Existing users
receive defaults on first read via an idempotent create-on-read/update path;
there is no destructive backfill. Rolling back application code leaves the
additive table unused. Do not drop it during rollback.

## Validation plan

Run backend unit/API/RLS tests for all roles and a denial path that attempts to
target another user. Run dictionary-key validation and frontend type/lint/build
checks. Use Playwright to verify each portal can independently persist a
locale/time-zone pair, refresh, and retain the expected localized UI and clock.

## Related decisions

- [0004: PostgreSQL database architecture](0004-postgresql-database-architecture.md)
- [0009: Request-path performance and authenticated-context caching](0009-request-path-performance.md)
