# Phase 0 architecture decision lock

Status: Approved for Phase 1 backend foundation shell
Date: 2026-07-28

This document records the Phase 0 backend architecture alignment for the SaaS
App. It is documentation only. It does not create backend runtime code,
migrations, tables, Supabase resources, API endpoints, CI workflows, Docker
files, or deployment changes.

Phase 1 must not start until the open decisions in this document are approved.
Approval note: on 2026-07-28, the user approved starting the narrowed Phase 1
backend foundation shell in `apps/backend`. The broader authentication,
database, RLS, worker, Supabase, storage, billing, and tenant-context roadmap
items remain deferred to later approved phases.

## 1. Current-state findings

Confirmed repository facts:

- The repository is a Next.js 15 App Router frontend with React, strict
  TypeScript, Tailwind CSS, shadcn/Radix-backed UI, TanStack Query/Table, Zod,
  Zustand, Vitest, Playwright, and Storybook
  (`package.json`, `docs/architecture/repository-architecture-audit.md`).
- The repository currently has no backend application, database, ORM, Redis,
  queue, generated API client, production authentication provider, CI workflow,
  or persistent tenant context
  (`docs/architecture/repository-architecture-audit.md`).
- Demo login uses one hardcoded email and password, `abcd1234@gmail.com` and
  `1234`, with an HTTP-only cookie that stores the selected demo role
  (`src/lib/demo-auth.ts`, `src/app/api/demo-auth/login/route.ts`).
- Workspace routing derives the demo role from the cookie and redirects
  mismatched workspaces to `/no-permission`
  (`src/app/(app)/[workspace]/layout.tsx`).
- Frontend permissions are role-based UI controls only
  (`src/lib/permissions.ts`, `docs/api/provisional-contracts.md`).
- Current data comes from typed fixtures and feature-level mock APIs
  (`src/mocks`, `src/features/administration/api/administration-api.ts`,
  `src/features/operations/api/operations-api.ts`).
- Current frontend contracts explicitly require a future backend to derive
  tenant, actor, client, manager, employee, and work-group scope from the
  authenticated server session, not browser input
  (`docs/api/provisional-contracts.md`).
- ADR 0001, 0002, and 0003 are accepted only for frontend mock behaviour where
  stated. ADR 0004 is still Proposed (`docs/architecture/adr/index.md`).

Confirmed architecture rules:

- Preserve the modular-monolith strategy (`AGENTS.md`,
  `docs/architecture/architecture-conventions.md`).
- Use Node.js 24 LTS, strict TypeScript, NestJS with Fastify, REST/OpenAPI,
  Supabase-managed PostgreSQL, Drizzle, node-postgres, Supabase Auth, private
  Supabase Storage, and a PostgreSQL transactional outbox initially
  (`AGENTS.md`).
- Do not add Redis, BullMQ, microservices, Kafka, Elasticsearch, Kubernetes,
  GraphQL, event sourcing, another ORM, another backend framework, or
  additional infrastructure without an approved ADR (`AGENTS.md`).
- Tenant-owned tables need `tenant_id`, composite tenant-safe references, RLS,
  forced RLS, separate migration/runtime roles, and Tenant A/B isolation tests
  (`AGENTS.md`, `docs/architecture/multi-tenant-rules.md`).

## 2. Contradiction register

| ID | Contradiction | Resolution |
| --- | --- | --- |
| C-001 | `docs/architecture/postgresql-database-architecture.md` listed `auth_identities.password_hash` and `sessions.refresh_token_hash`, but the approved stack uses Supabase Auth. | Revise the proposal so Supabase Auth owns credentials, MFA, password recovery, refresh tokens, and provider identities. PostgreSQL stores only application users, Supabase auth mappings, memberships, roles, permissions, invitations, and audit. |
| C-002 | Demo login covers `TENANT_ADMIN`, `MANAGER`, `EMPLOYEE`, and `CLIENT_USER`, while `SUPER_ADMIN` now uses Supabase Auth through the backend bootstrap model. Domain roles also include `TENANT_OWNER`, `FINANCE_USER`, and `HR_OPERATIONS_USER`. | Treat demo tenant roles as frontend prototype coverage only. Production identity must support all domain roles or explicitly defer unsupported roles through an approved decision. |
| C-003 | The frontend exposes role/workspace-scoped mock filters, but no production backend authorization exists. | Keep frontend checks as UX only. Phase 1 must build backend guards, scope policies, RLS, and negative authorization tests before production use. |
| C-004 | Mock document and invoice workflows store metadata in browser/session storage and validate UI payloads only. | Production must use private Supabase Storage, PostgreSQL metadata/grants/versions, signed URLs, scanning, idempotency, audit, and RLS. |
| C-005 | Current docs mention subscriptions in platform scope but no dedicated subscription ownership, lifecycle, entitlement, or API plan existed. | Add `docs/architecture/subscription-architecture.md` as a proposed subscription boundary. |
| C-006 | `MANAGER` currently has `invoice.create` in UI permissions, while backend rules say finance data requires finance permission. | Do not treat the current UI role map as final backend authorization. Decide whether managers can draft invoices, request invoices, or only view assigned client billing summaries. |
| C-007 | A tenant-only RLS sample can accidentally override manager/employee/client record scope if implemented as a permissive `for all` policy. | Use restrictive tenant-context policies plus explicit operation-specific actor-scope policies, or combine tenant and actor scope in each operation policy. |

## 3. Decision register

Resolved for Phase 0:

- Use one shared Supabase-managed PostgreSQL database, not one schema or
  database per tenant.
- Use normalized source tables with report views for derived dashboard values.
- Use Supabase Auth for production identity verification.
- Store no application-owned password hashes, refresh-token hashes, or raw
  provider credentials in application tables.
- Resolve trusted user, tenant, membership, roles, permissions, employee,
  client, support access, and platform-admin status in the backend.
- Use transaction-local PostgreSQL settings before tenant-owned queries.
- Use RLS and forced RLS as database defense in depth.
- Use Drizzle and node-postgres for database access.
- Use private Supabase Storage for protected file bytes.
- Store document metadata, versions, access grants, scanning state, and audit
  references in PostgreSQL.
- Use a PostgreSQL transactional outbox before Redis/BullMQ.
- Keep API and worker as separate runtime entrypoints when backend runtime work
  begins.
- Keep ADR 0004 Proposed until the user explicitly approves it.

Deferred product decisions are listed in section 13.

## 4. Proposed modules

Use these modules as boundaries, not scaffolding permission:

| Module | Owns | Notes |
| --- | --- | --- |
| Platform | Platform config, global reports, platform audit views | Platform-only operations need explicit platform permissions. |
| Tenancy | Tenants, domains, branding, provisioning lifecycle | Tenant provisioning is first implementation scope. |
| Subscriptions | Plans, tenant subscriptions, entitlement snapshots | See `docs/architecture/subscription-architecture.md`. |
| Identity | Application users, Supabase auth mappings, invitations | Supabase Auth remains credential source. |
| Authorization | Roles, permissions, membership roles, scope policies | No frontend role value is trusted. |
| Workforce | Departments, employees, skills, capacity, manager history | Employee scope is tenant membership based. |
| Clients | Clients, contacts, client user links | Client users access only their own client account. |
| Engagements | Services, engagements, milestones | Links client work to services. |
| Work Groups | Work groups and memberships | Source of manager/employee work scope. |
| Tasks | Tasks, checklist, comments, dependencies, task decisions | Must preserve manager review then tenant approval workflow. |
| Work Logs | Work logs and review decisions | Employee self-owned creation, manager review. |
| Billing | Invoices, lines, payments, allocations, agreements | Financial mutations need idempotency and audit. |
| Documents | Documents, versions, grants, activity, storage metadata | Owns metadata, not object bytes. |
| Support | Tickets, activity, attachments, client requests | Client scope and manager assignment required. |
| Notifications | Notification events and receipts | Outbox-driven delivery. |
| Professional Progress | Achievements, goals, recognition, policy | Recognition is idempotent and audited where sensitive. |
| Audit | Append-only audit events | Runtime users cannot update or delete audit rows. |
| Reporting | Read models/views for dashboards | Avoid source-of-truth duplication. |

## 5. Recommended backend package layout

Add a backend package only after ADR approval. The recommended workspace shape
is:

```text
apps/
  web/                       # existing Next.js frontend when/if split is approved
  api/
    src/
      main-api.ts
      main-worker.ts
      modules/
        tenancy/
          tenancy.module.ts
          api/
            tenants.controller.ts
            dto/
          application/
            tenancy.service.ts
          domain/
            tenancy.policy.ts
            tenant.errors.ts
          infrastructure/
            tenants.repository.ts
            tenants.repository.port.ts
          tests/
        identity/
        authorization/
        subscriptions/
        audit/
      shared/
        auth/
        database/
        errors/
        observability/
```

Keep this as a recommendation. Do not create empty backend folders before Phase
1 needs them. If the repository remains a single package initially, the same
module shape can live under `src/backend/` until a workspace split is approved.

## 6. Supabase Auth data model

Supabase Auth owns:

- Credential verification.
- Password hashes.
- Refresh tokens and sessions.
- MFA state.
- OAuth/provider identities.
- Password recovery and email confirmation token mechanics.

Application PostgreSQL owns:

- `users`: global application profile keyed by email and status.
- `user_auth_mappings`: maps `users.id` to `auth.users.id` and provider
  metadata needed by the app.
- `tenant_memberships`: tenant relationship, membership status, display
  profile, and tenant-specific active state.
- `roles`, `permissions`, `role_permissions`, and `membership_roles`:
  application authorization model.
- `invitations`: tenant invitation lifecycle and acceptance state. Store
  application invitation token hashes only when required by the app workflow;
  do not duplicate Supabase credential tokens.
- `support_access_sessions`: explicit, reasoned, expiring platform access into
  a tenant.

Trusted request context is built server-side after Supabase Auth verifies the
session:

```text
Supabase session -> auth user id -> users -> tenant_memberships
  -> roles/permissions -> employee/client scope -> support access scope
  -> transaction-local PostgreSQL context
```

For multi-tenant users, an active tenant selector may submit a tenant ID only as
a lookup input. The backend must verify that the user has an active membership
in that tenant, the tenant is not suspended, the user is not suspended, and any
platform support access is active and unexpired before setting trusted context.

The browser may send resource IDs as lookup inputs only. It must not choose
`tenantId`, `actorUserId`, `membershipId`, `role`, `permission`,
`isPlatformAdmin`, `employeeId`, `managerEmployeeId`, or `clientId` as trusted
authority.

## 7. Database implementation phases

| Phase | Scope | Gate |
| --- | --- | --- |
| DB-0 | Extensions, schemas, roles, grants, RLS helper functions, migration verification harness | Empty-database migration and runtime-role denial tests pass. |
| DB-1 | Platform, Tenancy, Identity, Authorization, Subscriptions, Audit, idempotency, outbox | Tenant provisioning can be implemented with trusted context and audit. |
| DB-2 | Workforce, Clients, Engagements, Work Groups | Manager/employee/client scope sources exist. |
| DB-3 | Tasks and Work Logs | Two-stage task workflow and work-log review can be enforced. |
| DB-4 | Billing, Documents, Support, Notifications | Private storage and financial/support idempotency can be enforced. |
| DB-5 | Professional Progress and Reporting views | Derived reports avoid source duplication. |

Use expand-and-contract migration sequencing for breaking changes. Do not edit
already-applied migrations.

## 8. Initial module dependency diagram

```text
API entrypoint
  -> shared/auth
  -> shared/database
  -> modules/*

Tenancy -> Identity, Authorization, Subscriptions, Audit, Outbox
Identity -> Authorization, Audit
Authorization -> Identity, Audit
Subscriptions -> Tenancy, Billing, Audit, Outbox
Workforce -> Tenancy, Identity, Authorization, Audit
Clients -> Tenancy, Identity, Authorization, Audit
Engagements -> Clients, Workforce, Audit
Work Groups -> Engagements, Workforce, Audit
Tasks -> Work Groups, Clients, Documents, Audit, Outbox
Work Logs -> Tasks, Workforce, Audit
Billing -> Clients, Engagements, Documents, Audit, Outbox
Documents -> Clients, Engagements, Tasks, Audit, Outbox
Support -> Clients, Documents, Notifications, Audit, Outbox
Notifications -> Identity, Audit, Outbox
Professional Progress -> Workforce, Tasks, Work Logs, Audit, Outbox
Reporting -> read-only queries/views through owning module services or approved read ports
Worker entrypoint -> Outbox -> module-owned handlers
```

Repository rule: a module may not import another module's repository. Use
exported application services, explicit ports, or domain/application events.

## 9. Initial request, auth, and database flow

```text
Browser request
  -> NestJS Fastify adapter
  -> authentication guard verifies Supabase JWT/session
  -> trusted context resolver loads user, tenant membership, roles, permissions, scope
  -> controller validates DTO and calls application service
  -> service evaluates RBAC and resource-scope policy
  -> service starts transaction when needed
  -> transaction sets app.user_id, app.tenant_id, app.membership_id,
     app.role_codes, app.permission_codes, app.support_access_session_id
  -> owning repository executes Drizzle/node-postgres query
  -> PostgreSQL constraints and restrictive/operation-specific RLS policies
     enforce tenant isolation and record scope
  -> service writes audit/outbox/idempotency rows in the same transaction when required
  -> controller returns explicit DTO or consistent error envelope
```

## 10. First migration scope

First migration scope after approval:

- Enable required extensions and schemas: `public`, `private`, `audit`.
- Create database roles: migrator/table-owner and non-owner runtime role.
- Create helper functions for transaction-local trusted context.
- Create core tables for tenants, users, Supabase auth mappings,
  memberships, roles, permissions, role permissions, membership roles,
  subscription plans, tenant subscriptions, audit events, idempotency keys, and
  outbox events.
- Add RLS and forced RLS for tenant-owned tables.
- Define audit writes through a narrow append-only function or equivalent
  reviewed path, while revoking direct audit table DML from `app_runtime`.
- Define idempotency uniqueness, request-hash comparison, and in-progress
  locking.
- Define outbox claim, retry, dead-letter, and retention fields.
- Add tenant-leading indexes for the first list/API access patterns only.
- Add Tenant A/Tenant B tests and runtime-role RLS tests.

Do not include task, billing, document, support, or professional-progress
feature tables in the first migration unless the Phase 1 slice explicitly needs
them.

## 11. First API scope

First API scope after approval:

- `GET /api/v1/session`: returns trusted current user, active tenant
  membership, roles, permissions, employee/client scope summaries, and
  support-access state.
- `GET /api/v1/tenants`: platform tenant list for authorized platform actors.
- `GET /api/v1/tenants/{tenantId}`: platform tenant detail, with support
  access handled by a separate audited workflow.
- `POST /api/v1/tenants`: tenant provisioning request with idempotency key.
- `GET /api/v1/subscription-plans`: active plan catalogue.
- `GET /api/v1/tenants/{tenantId}/subscription`: authorized tenant/platform
  subscription view.
- `POST /api/v1/support-access-sessions`: reasoned, expiring platform support
  access request.

All endpoints need explicit request DTOs, response DTOs, error envelopes,
authorization documentation, and OpenAPI coverage. No endpoint may trust
browser-supplied tenant or actor authority.

## 12. Testing foundation

Required backend validation foundation before feature implementation:

- Vitest unit tests for services, policies, DTO validation, and error mapping.
- Supertest API tests for guards, status codes, response DTOs, and denied
  paths.
- Testcontainers PostgreSQL integration tests for migrations, repositories,
  constraints, transactions, and RLS.
- Tenant A/Tenant B fixtures.
- Runtime-role RLS tests, not table-owner tests.
- Same-tenant out-of-scope manager, employee, and client denial tests.
- Cross-tenant foreign-key rejection tests.
- Idempotency replay and in-progress duplicate tests.
- Idempotency body-hash mismatch tests.
- Transaction rollback tests.
- Worker duplicate-claim, retry, and dead-letter tests.
- Support-access expiry and audit tests.
- Signed URL authorization and quarantine-denial tests.
- Migration tests from empty database and previous schema.

Do not claim backend completion until formatting, linting, type checking,
applicable tests, migration validation, tenant-isolation validation, and build
commands have actually run or are explicitly reported as blocked.

## 13. Decisions requiring user input

- Confirm whether Phase 1 should start with tenant provisioning/session context
  or a narrower read-only session endpoint.
- Confirm production tenant identifier policy: generated UUID only, human
  tenant code, or both.
- Confirm whether `TENANT_OWNER`, `FINANCE_USER`, and `HR_OPERATIONS_USER`
  need demo workspaces or are production-only roles for now.
- Confirm whether managers may create invoice drafts, request invoices, or only
  view billing records for assigned clients.
- Confirm subscription plan dimensions: user limits, module limits, storage
  limits, billing interval, trialing, cancellation, suspension, and grace
  period behaviour.
- Confirm whether billing is manual initially or integrated with a payment
  provider later.
- Confirm document retention and legal deletion requirements.
- Confirm malware-scanning provider and quarantine policy.
- Confirm support access maximum duration and approval requirements.
- Confirm production deployment target before Docker/CI/CD work.

## 14. Phase-by-phase implementation roadmap

| Phase | Objective | Exit criteria |
| --- | --- | --- |
| 0 | Architecture and decision alignment | This document, subscription architecture, revised DB proposal, revised ADR 0004, and security review are complete. |
| 1 | Backend foundation shell | NestJS Fastify backend package, configuration validation, logging, request IDs, error envelope, health endpoints, OpenAPI shell, and tests. No business modules, database, Supabase Auth, tenant context, RLS, workers, or storage are implemented in this phase. |
| 2 | Platform, tenancy, subscriptions | Tenant provisioning, plan catalogue, tenant subscription state, support access, audit and outbox. |
| 3 | Identity, authorization, workforce, clients | Memberships, roles, scope policies, employees, clients, contacts, work groups. |
| 4 | Tasks and work logs | Two-stage workflow, manager review, tenant approval, rework, history, idempotency, concurrency tests. |
| 5 | Billing, documents, support | Financial operations, private storage, support tickets, notifications, scanning/outbox, audit. |
| 6 | Reporting and professional progress | Read models, reports, achievements, recognitions, performance validation. |
| 7 | Hardening and release | Security review, operational readiness, CI/CD, Docker, backups, restore tests, production deployment approval. |

## 15. Security review notes

Security review must verify:

- Supabase Auth is the only credential/session authority.
- Browser-provided authority fields are rejected or ignored.
- Backend RBAC, resource-scope policies, and RLS are designed together.
- Runtime database role cannot bypass RLS or mutate audit history.
- Private storage never exposes service-role keys or permanent public URLs.
- Idempotency and outbox semantics are at-least-once, not exactly-once.
- ADR 0004 remains Proposed until explicit approval.

Findings from the read-only security review should be recorded in the Phase 0
completion report, not silently merged into application code.
