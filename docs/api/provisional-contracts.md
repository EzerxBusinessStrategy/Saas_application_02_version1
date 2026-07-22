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

## Phase 2 administration contracts

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
- `CreateTenantInput`, `ClientContactInput`, and `SupportAccessRequest` are
  Zod-validated UI payloads. `WorkGroupInput` is
  validated for an explicitly session-local mock create/edit flow. None perform
  backend writes. Future mutations require server authorization, tenant-safe
  foreign keys/RLS where applicable, audit records, and idempotency rules.

List filters, sort fields, and pagination are browser-controlled presentation
parameters only. A live endpoint must validate and bound them server-side.
Support access requires a server-created, reasoned, expiring audit session; the
frontend mock only renders the required visible banner and exit control.

## Phase 3 operational contracts

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
- Manager notification acknowledgement, task updates, reviews, approvals, and
  work-group changes remain frontend mocks. They require authenticated,
  tenant-scoped mutation contracts, idempotency, audit records, and cache
  invalidation before production use.
- Login, password reset, invitation acceptance, and role selection have no
  authentication API connection. A backend identity/session contract is a
  deployment prerequisite.

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
