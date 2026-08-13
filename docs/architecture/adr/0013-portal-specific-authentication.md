# ADR 0013: Portal-Specific Authentication

## Status

Accepted 2026-08-13

## Decision

Replace universal Supabase Auth password sign-in and workspace discovery with four explicit portal authentication flows: Super Admin, Tenant, Employee, and Client. Credentials are application-owned Argon2id hashes in the private `authn` persistence boundary. Sessions are opaque 256-bit tokens stored only as SHA-256 hashes and issued through one HttpOnly cookie per portal.

All credential emails are globally unique, case-insensitively. Tenant, employee, and client login therefore use email/password only; tenant code is not part of authentication. RBAC, tenant membership, employee/client scope, and RLS remain business-data authorization concerns after authentication.

## Consequences

The Next.js application exposes `/super-admin/login`, `/admin/login`, `/employee/login`, and `/client/login`; `/login` is a selector. Backend routes authenticate only the matching portal cookie and do not probe other portals. Super Admin bootstraps the first credential; Super Admin tenant creation and Tenant employee/client creation each persist the associated business account and its scoped `authn.credentials` record atomically. Passwords are accepted only at creation, hashed immediately, and never returned.

Session policy is fixed per portal: Super Admin sessions expire after two hours or 30 minutes of inactivity; Tenant sessions expire after eight hours or 60 minutes of inactivity; Employee sessions expire after eight hours; Client sessions expire after 24 hours. Login database statements have an eight-second ceiling, while database connection acquisition remains capped at five seconds. Timeouts are reported as service failures, never as invalid credentials.

The initial deploy uses a private `authn` schema in the existing managed PostgreSQL instance. A physical dedicated Auth database is a future deployment topology change enabled by `AUTH_DATABASE_URL`; it requires a provisioned database, secrets, and connection operations before it can be activated.

## Supersedes

The Supabase Auth credential and session decision in `phase-0-architecture-decision-lock.md` is superseded for application sign-in. Supabase remains the managed PostgreSQL and Storage provider.
