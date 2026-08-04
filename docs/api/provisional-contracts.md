# Provisional frontend contracts

All current data is typed fixture data in `src/mocks`. It is not a final backend
contract.

- Workspace identity and actor are derived from authenticated route context.
- Future list endpoints derive tenant scope server-side and accept only filters,
  sorting, and pagination values from the browser.
- Employee directory filters and pagination are URL-backed; its fixture model is
  defined in `src/types/workforce.ts`.
- The shared pagination composition accepts `page`, `pageSize`, `pageCount`,
  `totalItems`, and callbacks, so future list contracts can expose server-side
  pagination without changing the visual API.
- Notification and tenant-context fixture models are under `src/types/app-shell.ts`
  and `src/mocks/app-shell.ts`. Notification read state is frontend-local only.
  Tenant context switching is intentionally disabled until a controlled,
  audited support-session contract exists; tenant-only roles never receive a
  tenant switcher.
- New feature API functions belong in feature-level `api` folders and should use
  TanStack Query for server state.

## Document and invoice frontend-mock contracts

`src/features/operations/api/operations-api.ts` exposes `listSharedDocuments`,
`createSharedDocument`, `updateSharedDocumentAccess`, `listSharedInvoices`, and
`createSharedInvoice`. The payloads and returned metadata are Zod-validated and
the browser stores metadata only for mock workflow continuity. File bytes are
never uploaded, persisted, previewed, downloaded, or exposed through public
URLs.

- Role filtering is a frontend experience only: Tenant Administration, assigned
  manager, explicitly assigned employee, and matching client views are modelled
  from fixtures.
- A live API must derive actor, tenant, client, manager, and work-group scope
  from the authenticated server session; it must not trust browser-supplied IDs
  or recipient lists.
- Production requires private object storage, short-lived signed upload and
  download URLs, malware scanning, durable immutable audit records, retention
  policy, tenant-safe database relations/RLS, idempotency, and server-side
  authorization.

## Phase 2 administration contracts

## Tenant provisioning and white-label frontend boundary

The Super Admin tenant request and Tenant Admin branding screen are validated
frontend workflows only. They do not create tenants, memberships, invitations,
passwords, emails, domains, storage namespaces, cache entries, or audit events.
Branding is rendered only in an isolated live preview and is never applied to
another portal or tenant session.

A production implementation requires a server-owned tenant context, tenant-safe
database constraints/RLS, private logo storage, invitation and email delivery,
domain verification, authenticated theme resolution, audit logging, and
transactional provisioning. Browser-provided tenant IDs, logo paths, or theme
values must not be trusted.

`src/features/administration/api/administration-api.ts` is a replaceable typed
mock boundary. It validates fixtures with Zod and exposes the following
provisional frontend operations:

- `listTenants(TenantListRequest)` and `getTenant(tenantId)`; the eventual API
  must derive platform and tenant visibility from the authenticated actor, not
  a browser-provided tenant context.
- `listAuditRecords(AuditListRequest)`, `listClients(ClientListRequest)`,
  `getClient(clientId)`,
  `listClientContacts()`, `listEngagements()`, `listWorkGroups()`, and
  `listManagers()`. Audit list filtering, sorting, and pagination are validated
  by the same mock boundary as tenant and client lists.
- `CreateTenantInput` and `ClientContactInput` are Zod-validated UI payloads.
  `WorkGroupInput` is
  validated for an explicitly session-local mock create/edit flow. None perform
  backend writes. Future mutations require server authorization, tenant-safe
  foreign keys/RLS where applicable, audit records, and idempotency rules.

List filters, sort fields, and pagination are browser-controlled presentation
parameters only. A live endpoint must validate and bound them server-side.

## Phase 3 operational contracts

### Tenant analytics

`GET /api/v1/super-admin/tenant-analytics` is a database-backed, Super
Admin-only reporting read endpoint. It accepts an optional `tenantId` and
either a tenant `financialYearId` or a paired `from` and `to` date range. It
returns turnover, collections, outstanding amounts, task and SLA measures,
employee/client counts, monthly financial trend, and top client turnover.
No migration is required: it reads the existing tenants, financial years,
invoices, payments, clients, employees, tasks, and assignments tables.

`src/features/operations/api/operations-api.ts` is a replaceable, typed mock
boundary for task, work-log, invoice, payment, document, client-request, and
professional-progress reads. It filters manager, employee, and client views
to their fixture scope; a live API must derive that scope from the authenticated
actor and tenant context rather than browser input.

`OperationalTask`, `WorkLog`, `Invoice`, `Payment`, `OperationalDocument`,
`ClientRequest`, and professional-progress types are defined in
`src/types/operations.ts`. Work-log input is Zod-validated. All current edits,
reviews, approvals, and create actions are session-local frontend mocks; live
mutations require authorised tenant-scoped endpoints, durable audit history,
and idempotency rules.

Manager approval and tenant approval are a two-stage session-local mock flow:
manager approval sets `reviewStatus: approved` and `approvalStatus: pending`;
the Tenant Admin then approves delivery (`done`) or returns it for rework
(`rejected`). A live mutation must derive the actor and tenant from the server
session, enforce manager work-group scope and Tenant Admin authority, persist
decision remarks/evidence/history, and write immutable tenant-scoped audit
events.

## Phase 4 hardening boundaries

- `listAuditRecords(request, { tenantName })` scopes fixture audit records
  before filtering and pagination for the Tenant Admin composition. This
  optional second argument is an internal mock boundary; a live endpoint must
  derive tenant scope from the authenticated actor and must not trust a browser
  supplied tenant name.
- `getOperationalWorkspace("manager" | "employee")` limits document fixtures
  to the client IDs present in that actor's scoped task results. Live services
  must enforce the same rule in the database/API layer.
- Client support-ticket creation, assignment, client-visible replies, and
  resolution are Zod-validated frontend mocks. Client tickets are visible to
  the matching assigned manager and tenant administration in the same browser
  through local storage; this is a demonstration handoff, not authorization or
  durable notification delivery. A live API must derive client, manager, and
  tenant scope from the authenticated actor; audit each action; enforce
  tenant-safe access; provide idempotency; and deliver notifications to the
  relevant manager, administrator, and assigned employee.
- Support-request drafts, attachment progress, contact preferences, duplicate
  warnings, and suggested help articles are browser-only UX. Attachment bytes
  are not uploaded or persisted by this frontend mock; a live implementation
  requires malware scanning, object-storage authorization, per-file validation,
  signed upload URLs, retention controls, and notification delivery.
- Manager notification acknowledgement, task updates, reviews, approvals, and
  work-group changes remain frontend mocks. They require authenticated,
  tenant-scoped mutation contracts, idempotency, audit records, and cache
  invalidation before production use.
- `POST /api/demo-auth/login`, `/logout`, and `/recovery` are hardcoded demo
  routes only. The session cookie and route guard prevent ordinary browser URL
  switching between the selected role's portals, but do not provide production
  identity, password storage, tenant isolation, audit, rate limiting, or
  backend authorisation. A backend identity/session contract remains a
  deployment prerequisite.

## Backend access-administration contracts

The backend now owns the first real administrator-controlled access-management
slice:

- `GET /api/v1/super-admin/platform-configuration` and
  `PATCH /api/v1/super-admin/platform-configuration` are authenticated,
  Super Admin-only APIs for the persistent platform name, default brand colour,
  and email sender name. Updates are validated, written atomically, and audited;
  the browser must not treat local storage as a configuration source.

- `POST /api/v1/super-admin/tenants` creates an `active` tenant, financial
  year, and `TENANT_ADMIN` membership. The Super Admin supplies the first
  administrator email and password; the password is sent directly to Supabase
  Auth and is never returned or persisted in application tables.
- `POST /api/v1/invitations` creates a tenant-scoped invitation with an
  administrator-selected role. The tenant, actor, and inviter authority come
  from the verified backend request context, not the browser payload.
- `POST /api/v1/invitations/{invitationId}/accept` accepts a pending invitation
  only when the verified Supabase email matches the invitation email. The
  backend creates or activates the application user, tenant membership, and
  one active membership role.
- `POST /api/v1/invitations/{invitationId}/cancel` and
  `POST /api/v1/invitations/{invitationId}/revoke` close pending invitations.
- `POST /api/v1/memberships/{membershipId}/revoke` changes membership access to
  `revoked`, revokes active membership roles, cancels pending invitations for
  that user in the tenant, and retains historical business records.
- `POST /api/v1/memberships/{membershipId}/reactivate` reactivates a membership
  with one reviewed role instead of restoring all previous authority.

Supabase Auth remains the identity provider. No service-role or secret key may
be placed in frontend code. Suspending a tenant or revoking its active
membership prevents its Tenant Administrator from obtaining or refreshing a
workspace session.

## Professional progress contracts

`src/features/operations/api/operations-api.ts` exposes typed mock contracts
for `getGamificationWorkspace`, `getWorkLogConsistency`,
`saveGamificationPreferences`, `saveGamificationTenantPolicy`,
`createRecognition`, and `updateDeliverableReview`.

- Reads are scoped by the existing workspace fixture. Client reads return only
  client-visible onboarding steps and that client’s deliverables; employee
  reads return private achievements and permitted recognition only.
- Recognition creation validates recipient, category, reason, visibility, and
  notification preference with Zod. The mock prevents a repeated recognition
  by recipient, category, related work, and message for the current session.
- A live API must derive tenant and actor context server-side, validate policy
  and visibility, paginate recognition feeds, use an idempotency key for awards
  and recognitions, and enforce RLS/tenant-safe relations.
- Streaks and work-log consistency must be calculated by the backend using the
  actor’s IANA timezone, tenant working calendar, approved leave, and holidays.
  The local calculation is display-only and intentionally not authoritative.
- Deliverable actions are mock-only. Live approval/change requests require
  authorised files, audit history, revision ownership, notifications, and
  idempotent mutation handling.
