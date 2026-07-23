# ADR: Secure document and invoice storage and access service

Status: Accepted for frontend mock UI only
Date: 2026-07-23
Decision owners: [TODO: user input required]

## Context

The current repository is a Next.js frontend prototype. Documents and invoices
are typed fixtures in `src/mocks/operations.ts`; there is no database schema,
object-storage provider, signed-upload/download endpoint, malware scan, or
backend document/invoice authorisation service.

The requested workflow requires durable files, one physical object per record,
tenant-safe recipient access, immutable audit activity, and server-enforced
authorisation. It cannot be secured with browser state or public URLs.

## Proposed decision

Add backend-owned Documents and Billing module APIs backed by private object
storage and tenant-scoped metadata/access tables. The server derives actor,
tenant, client, manager/work-group scope, and recipient eligibility from the
authenticated session; it never trusts IDs or recipient visibility supplied by
the browser.

Use private, non-guessable tenant-scoped object keys and short-lived signed
upload/download URLs. Persist one document/invoice metadata record plus access
records rather than copying a file for each portal. Enforce tenant-safe foreign
keys, RLS, tenant-leading indexes, durable audit events, validation, and
idempotency for mutations.

## Required product decision

Choose the production storage and backend integration owner before replacing the frontend mock:

- [TODO: user input required] storage provider and private bucket/container
- [TODO: user input required] backend repository/module that owns APIs and migrations
- [TODO: user input required] malware-scanning and retention policy

## Consequences

- The frontend can then use typed metadata/list/upload-session contracts and
  refresh each authorised portal through TanStack Query invalidation.
- Direct object URLs, localStorage/sessionStorage files, and frontend-only
  recipient checks remain prohibited.
- Existing fixture screens stay available until the backend contract is ready.
