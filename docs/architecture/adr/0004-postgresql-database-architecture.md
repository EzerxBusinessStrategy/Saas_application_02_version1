# ADR: PostgreSQL database architecture

Status: Proposed
Date: 2026-07-27
Decision owners: [TODO: user input required]

## Context and problem

The current repository is a validated frontend prototype with typed mock data.
Production needs a durable PostgreSQL schema for tenants, users, roles, clients,
employees, engagements, work groups, tasks, work logs, billing, documents,
support, notifications, reports, and audit.

The schema must stay easy to understand, avoid redundant source data, remain
normalized, and still enforce multi-tenant isolation in the database.

## Constraints

- Preserve the modular-monolith strategy.
- Do not trust tenant IDs supplied by browsers.
- Backend authorization is mandatory; frontend permissions are UX only.
- Tenant-owned operations must be tenant scoped.
- Use composite tenant-safe foreign keys, PostgreSQL RLS, `FORCE ROW LEVEL SECURITY`,
  separate runtime/migration roles, tenant-leading indexes, safe migrations, and
  Tenant A/B isolation tests.
- Documents and invoices require private object storage and tenant-scoped metadata.

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
- Every sensitive mutation must write an append-only audit event.
- Support access must be reasoned, expiring, and audited.

## Migration and rollback

Create migrations in phases: platform, identity/RBAC, organisation/workforce,
clients/engagements/work groups, tasks/work logs, billing/documents/support,
audit/idempotency/outbox, RLS, and views.

Rollback before production can drop unreleased tables. After production, use
backward-compatible migrations and data-retention-aware rollback plans.

## Validation plan

- Schema migration dry run on an empty database.
- Constraint tests for tenant-safe foreign keys.
- RLS tests for Tenant A/B isolation.
- Role/scope tests for Super Admin, Tenant Admin, Manager, Employee, Client User,
  Finance User, HR Operations User, and Tenant Owner.
- Query-plan review for main list pages and report views.
- Backup/restore test before production launch.

## Related decisions

- [0001: Demo role-aware login and route guard](0001-demo-role-login.md)
- [0002: Manager review followed by tenant approval for client tasks](0002-manager-tenant-task-approval-gate.md)
- [0003: Secure document and invoice storage and access service](0003-secure-document-and-invoice-storage.md)
