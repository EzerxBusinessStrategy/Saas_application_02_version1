# Agent rules

1. Inspect before modifying and preserve the modular-monolith strategy unless an ADR is approved.
2. Do not alter module boundaries, tenant isolation, authentication, authorisation, public APIs, queues, caches, billing, audit controls, or infrastructure without an approved proposal and ADR.
3. Every tenant-owned operation must be tenant scoped; never trust a tenant ID supplied by an untrusted client.
4. Backend authorisation is mandatory; frontend permission checks are UX only.
5. Managers access assigned work groups only; employees access assigned or self-owned resources; client users access their own client account only.
6. Use approved business terminology, semantic naming, and the documents under `docs/architecture`.
7. Do not create cross-module repository access or log secrets/sensitive data; background jobs must be idempotent.
8. Use Figma MCP before implementing Figma-derived designs and shadcn MCP before creating new primitives.
9. Default to Server Components; keep client boundaries small and business logic outside presentational components.
10. Include permission and tenant-isolation tests; run lint, type checks, tests, and build before completion claims; report assumptions and unresolved risks.

---

# Backend Engineering Rules

These rules extend the general agent rules for backend, database, API, worker,
storage, deployment, and security work. They do not replace the frontend rules
below.

## Backend architecture and approved stack

Use this approved backend stack unless an approved ADR explicitly changes it:

- Node.js 24 LTS runtime
- Strict TypeScript
- NestJS
- Fastify adapter
- REST API
- OpenAPI/Swagger
- Supabase-managed PostgreSQL
- Drizzle ORM
- node-postgres
- Supabase Auth
- Private Supabase Storage
- PostgreSQL transactional outbox worker initially
- Redis and BullMQ only after a measured requirement and approved ADR
- Docker containers
- GitHub Actions

Preserve the modular-monolith architecture. Build business-domain modules
instead of technical mega-folders. Keep the API and worker as separate runtime
entrypoints where appropriate. Avoid microservices, Kafka, Elasticsearch,
Kubernetes, GraphQL, event sourcing, or additional infrastructure unless an ADR
explicitly approves them. Do not introduce another ORM, validation library,
queue library, cache library, or backend framework without approval.

Inspect the existing architecture before proposing structural changes. Require
a proposal and ADR before changing module boundaries, authentication,
authorization, tenancy, storage, queues, caching, billing, auditing, or
deployment architecture.

Use these expected domain modules as a boundary guide, not permission to
generate every module before it is needed:

- Platform
- Tenancy
- Subscriptions
- Identity
- Authorization
- Workforce
- Clients
- Engagements
- Work Groups
- Tasks
- Work Logs
- Billing
- Documents
- Support
- Notifications
- Professional Progress
- Audit
- Reporting

## Module boundaries and code ownership

Keep controllers thin and limited to transport concerns. Put business rules in
application services or domain policies. Put database queries in the owning
module's repository.

Never import or call another module's repository directly. Communicate across
module boundaries through exported application services, explicit
ports/interfaces, or application/domain events. Do not let generic base
repositories hide business-specific queries.

Keep shared code limited to genuinely shared infrastructure or primitives. Do
not place business logic in decorators, middleware, React code, route handlers,
or database migrations. Use explicit constructor dependencies for dependency
injection. Treat circular module dependencies as architecture problems; do not
solve them casually with forward references.

Add abstractions only when they solve a demonstrated problem. Avoid unnecessary
CQRS, handler, factory, mapper, or use-case boilerplate for simple operations.

## Trusted request and tenant context

Derive every authenticated backend request context from the verified
server-side session. Include these trusted values where applicable:

- `userId`
- `tenantId`
- `membershipId`
- `roles`
- `permissions`
- `employeeId`
- `clientId`
- `supportAccessSessionId`
- platform-admin status

Never trust authority-bearing browser values, including `tenantId`,
`actorUserId`, `membershipId`, `roles`, `permissions`, `isPlatformAdmin`, the
current employee identity, current manager identity, or current client-user
identity. Accept browser-provided resource IDs only as lookup inputs, then
verify them against the trusted actor and tenant scope.

Set transaction-local PostgreSQL tenant and actor context before tenant-owned
queries.

## Authentication and authorization

Use Supabase Auth to verify identity. Resolve application users, tenant
memberships, roles, and permissions in the backend. Keep authentication and
authorization separate. Treat frontend role checks as user-experience controls
only; backend authorization is mandatory for every protected endpoint.

Use RBAC for general action permissions, resource-scope policies for
record-level access, and PostgreSQL RLS as database-level defense in depth.
Enforce these access rules:

- `SUPER_ADMIN` performs platform-level actions only through explicit platform
  permissions.
- `TENANT_OWNER` and `TENANT_ADMIN` operate only inside their tenant.
- `FINANCE_USER` accesses financial data only when permitted.
- `HR_OPERATIONS_USER` accesses workforce and HR data only when permitted.
- `MANAGER` accesses assigned work groups, employees, clients, and related work
  only.
- `EMPLOYEE` accesses assigned or self-owned work only.
- `CLIENT_USER` accesses only their own client account and client-visible
  records.
- Temporary Super Admin support access must be reasoned, expiring, visible, and
  fully audited.
- Suspended users and suspended tenants must be denied according to documented
  policy.
- Permission-denied responses must not unnecessarily reveal whether an
  inaccessible resource exists.

Include authorization tests for both allowed and denied paths.

## PostgreSQL schema and tenant isolation

Keep PostgreSQL as the authoritative business-data source. Put `tenant_id` on
every tenant-owned table. Explicitly identify global/platform tables and
audit-owned tables. Prefer UUID identifiers unless an approved design requires
otherwise.

Support composite tenant-safe references on tenant-owned parent tables. Child
relations must use composite foreign keys such as:

```sql
FOREIGN KEY (tenant_id, client_id)
REFERENCES clients (tenant_id, id)
```

Cross-tenant foreign-key relationships must fail at the database level. Enforce
business invariants with `NOT NULL`, `UNIQUE`, `CHECK`, `FOREIGN KEY`, and
other constraints where appropriate; do not rely only on application
validation.

Enable and force Row-Level Security on tenant-owned tables. Use a
migration/table-owner role separate from the runtime role. The runtime database
role must not own tables and must not have `BYPASSRLS`. RLS policies must be
explicit for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`; missing policy
coverage must deny access. RLS tests must execute using the actual non-owner
runtime role.

Use application `WHERE tenant_id = ...` filters where useful for clarity and
performance, but never as a replacement for RLS. Never expose Supabase
service-role credentials to the frontend. Never run destructive or production
SQL without explicit approval.

## Drizzle, PostgreSQL connections and transactions

Use Drizzle as the approved ORM/query builder and node-postgres as the approved
PostgreSQL driver. Do not mix Prisma, TypeORM, Sequelize, or another ORM into
the backend.

Use a bounded connection pool and account for total connections across every
API and worker replica. A database transaction must use one checked-out
connection. Set transaction-local trusted tenant and actor context before
tenant-owned queries.

Keep transactions as short as safely possible. Do not perform email, webhook,
file scanning, or other network calls inside a database transaction. Use row
locking or expected-version checks for concurrent state transitions. Validate
the expected current state before mutating workflow records. Choose isolation
levels deliberately. Close pools and active resources during graceful shutdown.

## Database migrations

Use a reviewed migration for every schema change. Never manually modify
production tables through a dashboard. Never edit an already-applied migration.

Use expand-and-contract migrations for breaking changes. Separate schema
changes, backfills, and final constraints where necessary. Assess table locks
and migration duration. Validate existing rows before adding constraints.
Preserve rolling-deployment compatibility. Include RLS, role, and permission
implications.

Test migrations from an empty database, from the previous schema, and with
realistic existing data where relevant. Document rollback or forward-fix
strategy. Clearly identify irreversible changes. Never delete production data
without explicit approval and recovery planning.

## REST API and OpenAPI contracts

Use `/api/v1` as the versioned API base unless an approved contract says
otherwise. Use resource-oriented REST endpoints and reserve action endpoints
for meaningful workflow transitions.

Define explicit request DTOs and response DTOs. Do not return raw database rows
as public API contracts. Do not leak password hashes, internal storage keys,
internal permission implementation, tokens, or sensitive audit metadata.

Document endpoints with NestJS Swagger/OpenAPI, including authentication,
authorization, request, response, and error formats. Generate or maintain
frontend clients from OpenAPI rather than manually duplicating contracts where
possible. Preserve backward compatibility for existing frontend consumers and
document any required frontend migration before changing a contract.

Use consistent status codes and error envelopes. Validate filters, sorts, and
pagination server-side. Use allowlists for sort fields. Bound page size. Use
cursor pagination for large or rapidly changing feeds. Do not create giant
endpoints returning every nested child record; use separate compact list and
detailed resource responses.

## Workflow transitions, concurrency and idempotency

Make business state transitions explicit and validated. Do not update status
fields arbitrarily from generic patch endpoints. Task submission, manager
review, and Tenant Admin approval must follow the approved two-stage workflow.
Manager approval must not directly complete client delivery. Returned work must
follow the documented rework transition.

Persist decision remarks, actor, timestamp, and history. Use row locks or
optimistic concurrency for competing decisions. Prevent duplicate approval,
payment, invoice, provisioning, recognition, and document-finalization
operations.

Require idempotency for important mutations, including tenant provisioning,
task submission, manager approval, Tenant Admin approval, invoice creation,
payment recording, document finalization, support-ticket creation, recognition
awards, and external webhook handling.

Scope idempotency keys safely. Validate request-body fingerprints. Handle
in-progress duplicates. Replay completed responses safely where appropriate.
Use database uniqueness or locking as final protection.

## Background work and transactional outbox

Do not block normal API requests on slow, retryable, or external work. Use a
PostgreSQL transactional outbox initially. Commit the business mutation and
outbox event in one transaction. Do not send email, webhooks, or external
notifications before transaction commit.

Workers must claim bounded batches safely and assume at-least-once delivery.
Background operations must be idempotent. Use bounded retries with exponential
backoff and jitter. Move poison events to a failed or dead-letter state. Shut
workers down gracefully. Define outbox retention and cleanup. Log and measure
queue/outbox age, failures, attempts, and processing duration.

Use workers for email, notifications, invoice PDF generation, report
generation, CSV exports, malware scanning, thumbnail generation, domain
verification, webhook delivery, and cache invalidation. Require an approved ADR
and measured need before introducing BullMQ or Redis.

## Redis, caching and throttling

Keep PostgreSQL as the source of truth. Do not add Redis merely because caching
is possible; measure the actual bottleneck first. Keep TanStack Query as the
frontend server-state cache. Consider HTTP caching and conditional requests
before distributed caching.

Add Redis only for distributed throttling, BullMQ, short-lived shared cache,
distributed coordination, or measured repeated expensive reads. For every Redis
cache, document the measured problem, data owner, key structure, tenant scope,
TTL, invalidation, stampede protection, failure fallback, memory/cardinality
impact, and metrics.

Use tenant-aware and versioned cache keys, TTL jitter, stampede prevention,
bounded memory and value sizes, and safe behavior when Redis is unavailable. Do
not use a cache as the only source of truth for payments, approvals,
memberships, permissions, audit history, or document-access decisions. Invalidate
cache entries after database commit, preferably through outbox events.

Use different throttling policies for login, password recovery, uploads,
exports, document URLs, and normal authenticated APIs. Combine IP, user, and
tenant identifiers appropriately. Enforce limits across all API replicas when
running multiple instances. Return proper `429` responses and retry
information.

## Query and API performance

Measure before optimizing. Perform filtering, sorting, and pagination inside
PostgreSQL. Never load all rows and filter them in application memory. Avoid
N+1 queries. Select only the columns needed by the endpoint. Use compact DTOs
for list pages. Use joins or batched queries deliberately.

Add indexes based on real query patterns. Prefer tenant-leading indexes for
tenant-scoped queries and account for index write and storage cost. Use
`EXPLAIN (ANALYZE, BUFFERS)` only on safe development/test databases. Use
`pg_stat_statements` where available.

Investigate row-estimate errors, sequential scans, expensive sorts, lock waits,
transaction duration, pool saturation, and payload size. Use cursor pagination
for deep feeds. Do not use unbounded offset pagination. Re-measure after every
performance change and do not claim an optimization without evidence.

## Private documents and file storage

Use private Supabase Storage buckets for protected files. Store file bytes in
object storage, not PostgreSQL. Store metadata, versions, access grants, and
activity in PostgreSQL. Never expose service-role credentials to the browser.

Authorize every upload and download request in the backend. Use non-guessable
tenant-scoped object keys and short-lived signed upload/download URLs. Validate
file size, extension, declared MIME type, actual magic bytes, and allowed
document category. Confirm uploaded object metadata server-side and use
checksums where required.

Run malware scanning asynchronously. Keep new files pending or quarantined
until scanning succeeds. Do not expose permanent public URLs. Do not duplicate
physical files for every portal. Use access-grant records and immutable
document-version history. Audit uploads, downloads, permission changes, and
deletions. Enforce retention and deletion policies. Test cross-tenant file and
metadata isolation.

## Security requirements

Require security headers, a strict CORS allowlist, request-body limits,
file-size limits, search and pagination bounds, authentication throttling, and
password-recovery throttling. Use secure cookie settings where cookies are used
and CSRF protection for cookie-authenticated mutations where applicable.

Verify JWT issuer, audience, signature, and expiry safely. Validate input at
the API boundary. Do not use SQL string interpolation from untrusted data. Do
not allow mass assignment or insecure direct object references.

Do not commit secrets to Git. Do not place production credentials in tests,
examples, or logs. Do not log sensitive values. Do not create permanent signed
URLs. Do not weaken TLS or certificate verification to bypass development
issues. Run dependency, secret, and container scanning in CI. Focus security
reviews on concrete exploit and failure scenarios.

## Logging, audit and observability

Use structured Pino logging. Attach a request/correlation ID to every request.
Log route, status, and duration. Include tenant/user identifiers only where
safe and necessary.

Redact passwords, access tokens, refresh tokens, cookies, authorization
headers, service-role keys, signed URLs, private file contents, and
payment-sensitive information. Sentry may capture unexpected exceptions.
OpenTelemetry may capture traces and metrics.

Create immutable audit events for sensitive business mutations. Audit events
must include actor, tenant, action, resource, result, request ID, timestamp,
and reason/metadata where applicable. Normal application users must not update
or delete audit records. Do not confuse operational logs with immutable
business audit history. Never claim observability exists unless it is actually
connected and verified.

## Testing requirements

Classify backend tests as unit tests, API tests, repository integration tests,
PostgreSQL constraint tests, RLS tests, migration tests, concurrency tests,
worker/idempotency tests, or end-to-end tests.

Use Vitest for unit and integration orchestration, Supertest for HTTP API
tests, Testcontainers PostgreSQL for database behavior, and Testcontainers
Redis when Redis or BullMQ is introduced. Run real migrations in integration
tests. Run RLS tests with the actual runtime role.

Use Tenant A versus Tenant B isolation fixtures. Include positive and negative
authorization tests, cross-tenant foreign-key rejection tests, transaction
rollback tests, idempotency replay tests, concurrent approval/payment tests,
duplicate worker-delivery tests, and suspended user and tenant tests. Keep test
data deterministic and avoid shared mutable test state. Never claim tests
passed when they were skipped, blocked, or not executed.

Every backend feature must include tests proportionate to its security and
business risk.

## Docker, deployment and CI/CD

Use multi-stage Docker builds, frozen pnpm lockfile installation, minimal
production dependencies, non-root runtime containers, and no secrets in image
layers. Provide separate API and worker commands, health and readiness
endpoints, and graceful shutdown.

Run database migrations safely and separately from normal API replicas. GitHub
Actions must check formatting, linting, type checking, unit tests, PostgreSQL
integration tests, migration validation, RLS isolation tests, frontend and
backend builds, dependency review, secret scanning, and container scanning.

Require staging validation before production, protected production deployment,
no overlapping production deployments, and clear rollback or forward-fix
instructions. Do not deploy, run production migrations, or change production
infrastructure without explicit authorization.

## Documentation and completion requirements

Update OpenAPI when an API contract changes. Update architecture documentation
when architecture changes. Add or update an ADR for significant decisions.
Document environment variables without exposing secret values. Record
assumptions and unresolved risks. Distinguish implemented behavior from
proposed behavior. Never claim a backend, database, queue, cache, file
workflow, or security control exists unless it has been implemented and
verified. Keep unrelated frontend and backend files untouched.

Before claiming completion, run all applicable formatting, linting, TypeScript
checking, unit tests, integration tests, migration validation, production
build, and security/tenant-isolation validation commands.

The final Codex completion report for backend work must contain:

1. Summary
2. Files changed
3. Architecture or contract decisions
4. Database and migration changes
5. Authorization and tenant-isolation impact
6. API changes
7. Audit/outbox/background-work changes
8. Tests executed and results
9. Commands that could not run
10. Security considerations
11. Performance considerations
12. Remaining risks and follow-up work

---

# Figma-Driven Frontend Implementation Rules

## Objective

Build the complete frontend for this multi-tenant SaaS application using the
existing Figma references, existing implemented components, TailAdmin-derived
design tokens and the approved business architecture.

Do not stop frontend development merely because the Figma MCP Starter-plan rate
limit has been reached.

When an exact Figma frame cannot be accessed, continue by composing the screen
from the established design system and existing reusable components.

Clearly distinguish between:

- Figma-verified implementation
- Existing-design-system implementation
- Inferred implementation based on product requirements

Never claim that an inferred screen exactly matches an inaccessible Figma frame.

## Figma implementation workflow

For tasks involving Figma:

1. Use the connected Figma MCP server when access is available.
2. Use the installed Figma implementation skill.
3. Use the shadcn skill and inspect existing components before creating new primitives.
4. Apply frontend-design and web-design review guidance.
5. Apply accessibility requirements.
6. Use Playwright for browser verification when available.
7. Run verification commands before claiming completion.

Do not require the user to repeat the complete skills list for every frame.

## Figma rate-limit fallback mode

When Figma MCP is unavailable, rate-limited or blocked:

1. Do not repeatedly retry MCP calls.
2. Do not stop the complete frontend implementation.
3. Inspect all previously stored Figma information in `docs/figma/`,
   `docs/design-system/`, `public/`, existing screenshots, existing implemented
   components, Storybook stories, and previous design-token files.
4. Inspect all existing TailAdmin-derived components.
5. Use the implemented TailAdmin visual system as the source of truth.
6. Reuse already implemented page shells and component patterns.
7. Build missing screens from the existing design system and business requirements.
8. Record inaccessible frames in `docs/figma/pending-figma-verification.md`.
9. Mark inferred screens as `Design status: Pending Figma verification`.
10. Continue implementation unless a major design-system or architecture change is required.

Do not create a new visual style because a secondary Figma frame is inaccessible.

## Save Figma information when MCP is available

Whenever a Figma frame can be accessed, save the useful results locally so they
can be reused after rate limits are reached.

Update:

- `docs/figma/frame-inventory.md`
- `docs/figma/component-map.md`
- `docs/figma/implementation-log.md`
- `docs/figma/visual-differences.md`

For each frame, record the Figma file name, frame name, node ID, application
route, intended user role, screenshot and design-context availability, reusable
components, implementation status, and visual-verification status.

Do not depend on being able to call Figma MCP again later.

## Design-source priority

TailAdmin is the primary visual design system.

TailAdmin controls colours, typography, spacing, border radius, shadows,
buttons, inputs, cards, tables, navigation, drawers, dialogs, chart
containers, loading states, empty states, error states, and responsive
behaviour.

Secondary Figma files provide layout, workflow and information-hierarchy
references only:

- NEATLAB: Super Admin
- CRM Dashboard: Client management
- Dashlab: Reports and analytics
- Mint: Workforce
- Themesberg: Authentication, forms and settings
- DashboardX: Mobile and missing UX patterns

Secondary references must be translated into the established TailAdmin-based
design system. They must not introduce independent colour, typography, button,
card, input, table, sidebar, spacing, or chart-container systems.

## Existing Figma frames

Use every Figma frame that has already been successfully inspected. For each
accessible or previously inspected frame:

1. Identify what is actually present in the frame.
2. Map its sections to this SaaS domain.
3. Reuse useful page structure and information hierarchy.
4. Translate it into the TailAdmin-based design language.
5. Implement the applicable full frontend screen.
6. Do not copy irrelevant ecommerce, CRM or generic admin terminology.
7. Do not copy sample values directly into production components.

Terminology examples:

- Customer: Client
- Deal: Service Engagement
- Project: Service Engagement or Work Group
- Team Member: Employee
- Team Leader: Manager
- Company or Account: Tenant
- Revenue: Subscription revenue or client billing
- Activity: Audit activity or client activity timeline

## Missing-screen implementation

Many required application screens may not have exact Figma frames. Create them
using existing TailAdmin-based design tokens, the application shell, reusable
components, the nearest approved secondary reference, the documented business
workflow, and consistent responsive/accessibility rules.

Do not leave required application routes empty merely because an exact Figma
frame does not exist. Do not produce dozens of visually duplicated pages. Use
reusable feature components and configurable screen compositions.

## Component-reuse rules

Before creating a component:

1. Search the repository.
2. Search existing shadcn components.
3. Inspect the existing component API.
4. Reuse or extend the existing component when responsibilities match.
5. Create a new component only when the responsibility is genuinely different.

Never create duplicates such as `SuperAdminMetricCard`, `NeatlabMetricCard`,
`DashlabChartCard`, `CrmDataTable`, or `MintStatusBadge`.

Prefer shared components such as `MetricCard`, `ChartCard`, `DataTable`,
`StatusBadge`, `PageHeader`, `EntityHeader`, `EmptyState`, `ErrorState`, and
`TaskDetailsDrawer`. Business-specific chart compositions and table columns may
live in feature folders, but generic primitives must remain shared.

## Approved frontend stack

Use Next.js App Router, React, TypeScript strict mode, Tailwind CSS, shadcn/ui,
Lucide React, TanStack Query, TanStack Table, React Hook Form, Zod, Recharts
through existing shadcn Chart primitives, Zustand only for local UI state,
Motion only for restrained micro-interactions, dnd-kit, date-fns, Sonner,
Playwright, Vitest, and React Testing Library.

Do not add a second library for an already solved responsibility without
documented justification.

## Full frontend scope

Implement the complete frontend foundation and required screens.

### Authentication

- Login
- Forgot password
- Reset password
- Accept invitation
- Session-expired state
- No-permission state

### Super Admin

- Platform Overview
- Tenant List, Details, and Creation
- Subscription Plans and Tenant Subscriptions
- Global Reports and Audit Logs
- Platform Configuration
- Controlled Support Access

### Tenant Admin

- Tenant Overview
- Client List, Details, Contacts, and Service Engagements
- Work Groups and Task Management
- Employee Directory and Profile
- Manager Directory
- Departments, Categories, Skills, and Capacity Planning
- Invoices, Payments, Agreements, and Documents
- Reports, Branding Settings, Users and Roles, Notification Settings, and Organisation Settings

### Manager

- Manager Overview
- Assigned Clients, Work Groups, and Employees
- Task List, Board, and Details
- Work Logs, Review Queue, Approval Queue, Team Workload, and Manager Reports

### Employee

- My Day, My Tasks, Current Task, and Task Details
- Daily Work Logs, Timesheet, Calendar, Documents, Notifications, and Profile

### Client Portal

- Client Overview
- Active Services, Service Progress, and Requests
- Invoices, Payments, Agreements, Documents, and Support

## Data and API rules

Until backend API contracts are final:

1. Use typed provisional contracts.
2. Use Zod schemas where runtime validation is useful.
3. Keep mock data in `src/mocks`.
4. Keep API functions in feature-level `api` folders.
5. Do not place mock data directly inside page components.
6. Keep mock and real API implementations replaceable.
7. Document assumptions in `docs/api/provisional-contracts.md`.
8. Do not claim provisional contracts are final backend contracts.

Use TanStack Query for server state. Use Zustand only for sidebar state,
command menu, drawers, temporary UI preferences, and local selection state.
Do not store all clients, employees, tasks, invoices, or payments in Zustand.

## Permission-aware frontend

Support these roles:

- SUPER_ADMIN
- TENANT_OWNER
- TENANT_ADMIN
- FINANCE_USER
- HR_OPERATIONS_USER
- MANAGER
- EMPLOYEE
- CLIENT_USER

The frontend must hide unauthorised navigation and actions, show
permission-denied states, restrict manager UI to assigned work groups, restrict
employees to assigned or self-owned work, restrict client users to their own
client account, restrict finance information to authorised roles, and keep
Super Admin support access visibly audited.

Frontend permission checks are user-experience controls only. Backend
enforcement remains mandatory.

## Responsive requirements

Desktop: persistent or collapsible sidebar, full tables, multi-column
dashboards, and contextual right-side drawers.

Tablet: collapsible sidebar, reduced dashboard columns, responsive tables, and
wider drawers.

Mobile: sidebar becomes a sheet or drawer; employee, manager, and client portal
may use bottom navigation; forms become single-column; tables use compact card
alternatives when necessary; important task actions remain touch-accessible;
charts remain readable; and no miniature unreadable dashboards.

## Required UI states

Every major screen must include loading, background-refresh where relevant,
empty, filtered-empty, error, permission-denied, not-found, disabled, and
mobile states.

Do not use only a generic spinner. Use skeletons that resemble the final
screen.

## Figma inspection approval rule

Do not request approval for ordinary screen implementation that reuses the
established TailAdmin design system, existing components, approved routes, and
business requirements without changing architecture.

Request approval only before replacing the primary design system, changing core
design tokens, replacing shared primitives, adding a new chart library,
changing application or route architecture, creating a competing component
system, introducing a major dependency, or changing role/permission
architecture.

## Validation requirements

After implementation:

- Run formatting, linting, TypeScript checks, relevant unit and component tests,
  and the production build.
- Run Playwright for responsive and visual verification when the browser is available.
- Report commands that could not run.
- Do not claim completion when required validation fails.

If Playwright or shadcn downloads are blocked by a certificate-chain error,
report the blocker clearly, continue with validation that can run locally, do
not weaken SSL verification, and do not claim blocked tests passed.

## Anti-AI frontend quality standard

For every frontend task, read and follow:

`docs/design-system/anti-ai-frontend-quality-standards.md`

This standard is mandatory.

The frontend must not contain:

- Generic AI-generated dashboard styling
- Random gradients, glow, or glassmorphism
- Repetitive template layouts
- Decorative charts without business purpose
- Inconsistent spacing, typography, icons, radius, or shadows
- Duplicate components
- Placeholder-quality content
- Broken mobile layouts
- Missing loading, empty, error, or permission states
- Console, TypeScript, lint, hydration, or build errors
- Unverified claims of completion

Do not mark a frontend task complete until it has been checked for:

- Visual consistency
- Alignment and spacing
- Responsive behaviour
- Accessibility
- Interaction states
- Long-content handling
- Permission behaviour
- Component reuse
- Type safety
- Technical validation

TailAdmin remains the primary visual design system.

Figma references may influence layout and workflow, but they must not create a
separate visual language.

When Figma MCP is unavailable, continue using the established TailAdmin-based
design system and mark the screen as pending Figma verification.

Never describe an inferred implementation as pixel-perfect or Figma-verified.
