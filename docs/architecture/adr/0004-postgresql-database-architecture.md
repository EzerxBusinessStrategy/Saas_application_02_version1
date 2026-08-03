# ADR: PostgreSQL database architecture

Status: Accepted
Date: 2026-07-27
Decision owners: User-approved for implementation on 2026-07-28

## Context and problem

The current repository is a validated frontend prototype with typed mock data.
Production needs a durable PostgreSQL schema for tenants, users, roles, clients,
employees, engagements, work groups, tasks, work logs, billing, documents,
support, notifications, reports, and audit.

The schema must stay easy to understand, avoid redundant source data, remain
normalized, and still enforce multi-tenant isolation in the database.

The approved production identity boundary uses Supabase Auth. Application
PostgreSQL must not become a parallel credential store.

## Constraints

- Preserve the modular-monolith strategy.
- Do not trust tenant IDs supplied by browsers.
- Backend authorization is mandatory; frontend permissions are UX only.
- Tenant-owned operations must be tenant scoped.
- Use composite tenant-safe foreign keys, PostgreSQL RLS, `FORCE ROW LEVEL SECURITY`,
  separate runtime/migration roles, tenant-leading indexes, safe migrations, and
  Tenant A/B isolation tests.
- Documents and invoices require private object storage and tenant-scoped metadata.
- Supabase Auth owns password hashes, refresh tokens, MFA, OAuth/provider
  identities, password recovery, and session mechanics.
- Application PostgreSQL stores users, Supabase auth mappings, tenant
  memberships, roles, permissions, support access sessions, audit, idempotency,
  and outbox facts.

## Considered options

1. One schema per tenant. Rejected because it increases migration and operations
   complexity without solving authorization by itself.
2. Single shared schema with only `tenant_id` filters. Rejected because one
   missing filter or wrong join can leak data.
3. Single shared schema with tenant-safe composite keys, RLS, and normalized
   source tables. Proposed because it is the simplest architecture that still
   gives database-enforced isolation.

## Decision and rationale

Adopt the architecture in
[`docs/architecture/postgresql-database-architecture.md`](../postgresql-database-architecture.md).

Use one shared PostgreSQL database with normalized tables, tenant-safe composite
foreign keys, RLS, tenant-leading indexes, private document metadata, audit
events, and report views.

Use Supabase Auth as the identity verifier. Map verified Supabase Auth users to
application `users` and tenant memberships before authorizing requests. Do not
store application-owned password hashes or refresh-token hashes in the proposed
application schema.

## Positive and negative consequences

- The schema maps directly to the existing portals without duplicating data per
  portal.
- Dashboard counts and progress values are computed from normalized source
  tables.
- Tenant isolation is enforced by PostgreSQL, not only by application filters.
- Composite foreign keys add some DDL verbosity, but they prevent cross-tenant
  references.

## Security and operational consequences

- The backend must set trusted request context in transaction-local PostgreSQL
  settings.
- Runtime and migration database roles must be separate.
- Tenant-owned tables must enable and force RLS before production use.
- RLS must not rely on broad permissive tenant-only policies for record-scoped
  tables; use restrictive tenant-context policies plus operation-specific scope
  policies, or combine tenant and actor scope in each operation policy.
- Every sensitive mutation must write an append-only audit event.
- Support access must be reasoned, expiring, and audited.
- Protected files must use private Supabase Storage with PostgreSQL metadata,
  versions, access grants, scan state, and audit records.
- Slow or external work must use the PostgreSQL transactional outbox initially.

## Migration and rollback

Create migrations in phases: platform, identity/RBAC, organisation/workforce,
clients/engagements/work groups, tasks/work logs, billing/documents/support,
audit/idempotency/outbox, and views. Each tenant-owned slice must enable and
force RLS before runtime grants or runtime code use that slice.

Rollback before production can drop unreleased tables. After production, use
backward-compatible migrations and data-retention-aware rollback plans. Test
backup and restore before production launch, and clearly mark irreversible
changes before they are approved.

## Validation plan

- Schema migration dry run on an empty database.
- Constraint tests for tenant-safe foreign keys.
- RLS tests for Tenant A/B isolation.
- Same-tenant out-of-scope manager, employee, and client denial tests.
- Runtime-role tests for missing trusted context and direct audit-table DML
  denial.
- Role/scope tests for Super Admin, Tenant Admin, Manager, Employee, Client User,
  Finance User, HR Operations User, and Tenant Owner.
- Idempotency and outbox concurrency/retry/dead-letter tests.
- Query-plan review for main list pages and report views.
- Backup/restore test before production launch.
- OpenAPI review for the first API slice before implementation.
- Security review for authentication, authorization, RLS, private storage,
  idempotency, and outbox boundaries.

## Related decisions

- [0001: Demo role-aware login and route guard](0001-demo-role-login.md)
- [0002: Manager review followed by tenant approval for client tasks](0002-manager-tenant-task-approval-gate.md)
- [0003: Secure document and invoice storage and access service](0003-secure-document-and-invoice-storage.md)
- [Phase 0 architecture decision lock](../phase-0-architecture-decision-lock.md)
- [Subscription architecture](../subscription-architecture.md)
