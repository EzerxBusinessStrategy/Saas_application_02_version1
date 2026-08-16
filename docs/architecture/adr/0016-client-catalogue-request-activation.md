# ADR 0016: Client catalogue request then tenant accept activation

Status: Accepted
Date: 2026-08-16
Decision owners: Tenant operations

## Context and problem

The tenant shop is the service master: each service contains tasks, due dates,
recurrence, and prices. Employees are mapped to the services they handle.
A client should tick one or more of those services, optionally change the
booklet, and send a request. The client may also send a custom request that is
not tied to a catalogue service.

Tenant Admin then accepts the request and allots the responsible employee per
service. Acceptance must generate the same real `public.tasks` as the existing
Configure services activate path. Client tick-and-send without tenant accept
must not create tasks.

## Constraints

- Do not create a second task, pricing, client, or portal system.
- Reuse `POST /tenant-admin/clients/:clientId/service-onboarding/activate`.
- Keep the tenant-initiated Configure services wizard.
- Keep `client_task_requests` for ad-hoc work on already-active services.
- Additive PostgreSQL only. No existing record rewrite.

## Considered options

1. Teach `client_task_requests` to carry multi-service booklets and employee
   assignment, then generate tasks from that table.
2. Let the client call activate directly after ticking services.
3. Additive `client_service_requests` that snapshot the selected booklets.
   Tenant accept allots employees and calls the existing activate transaction.

## Decision and rationale

Option 3. The missing product behavior is a request queue, not a new work
engine. Catalogue requests store the client-edited booklet. Tenant accept
supplies `assignedEmployeeId` per service and reuses activation so recurrence,
engagements, rate cards, assignments, billing entries, and notifications stay
on the approved path. Custom requests are reviewed without activation until
the tenant maps them to a real service.

Employee allotment is a tenant action after accept, matching the later product
wording. The client does not pick the employee.

## Positive and negative consequences

Positive: one activation engine, tenant shop remains the master, client portal
can show unpublished-to-that-client catalogue services, already-active
services stay blocked from duplicate catalogue requests.

Negative: two request tables exist until ad-hoc `client_task_requests` is later
folded into the same queue. Custom requests do not auto-create a service.

## Security and operational consequences

Trusted `tenantId` and authenticated `clientId` only. Browser-supplied tenant,
client, employee, or role values are ignored. Accept is transactional with
activate. Idempotent create and accept. Permission-denied responses do not
leak whether another tenant's request exists.

## Migration and rollback

Additive tables in `0067_client_service_requests.sql`. Rollback is
`DROP TABLE` of the two new tables. No existing data rewrite.

## Validation plan

Unit tests for create, idempotent replay, already-active rejection, accept
reusing activate, custom accept without activate, and migration registration.
Existing client, service, task, and activation tests remain green.

## Related decisions

- ADR 0015 Additive service blueprint activation
- `docs/architecture/IMPLEMENTATION_CONTRACT.md`
