# Request-path performance implementation plan

> **For Codex:** Execute these steps incrementally without weakening tenant or permission checks.

**Goal:** Reduce repeated request-path database work while retaining server-side authentication, authorization, tenant scoping, and RLS guarantees.

**Architecture:** Keep the database as the source of truth. Session policy validation remains a protected database read on every authenticated request, but its activity timestamp is touched at most once per minute. A bounded, short-lived process-local cache stores only resolved auth context and is invalidated by a database-backed session context version. Tenant-suspension restoration moves to bounded application maintenance.

**Tech stack:** NestJS, node-postgres, PostgreSQL, Drizzle migrations, Next.js, TanStack Query.

## Tasks

1. [x] Add an auth-session context-version migration, conditional `last_seen_at` touch, and platform-wide expired-suspension maintenance function.
2. [x] Consolidate transaction-local PostgreSQL context setup into one parameterized statement and add safe pool keep-alive settings.
3. [x] Add bounded, version-checked auth-context caching and use it in HTTP and notification WebSocket authentication.
4. [x] Run expired-suspension restoration from a bounded NestJS maintenance timer rather than request guards.
5. [x] Configure shared React Query cache defaults, debounce client search input, and preserve cached content during background refreshes.
6. [x] Dynamically load workspace section modules so a route does not eagerly import unrelated portals.
7. [x] Apply optimistic notification state updates and run focused type/lint checks.
