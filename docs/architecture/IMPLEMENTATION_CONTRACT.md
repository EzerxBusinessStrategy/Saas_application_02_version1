# Implementation Contract: Service Blueprint Activation

Status: Frozen for implementation  
Date: 2026-08-16  
Design status for new UI: Pending Figma verification

## Goal

Connect the existing service catalogue, employee roster, client records, engagements, rate cards, compliance calendar rules, tasks, assignments, billing, and client portal into one additive onboarding workflow:

Service Blueprint → Employee Service Capability → Client selects services → Client-specific customization → Responsible employee assignment → Activate → Generate existing `public.tasks` → Existing task workflow → Client portal progress.

## Non-negotiable constraints

- Do not create a second task system, pricing system, client system, or portal.
- Do not drop, rename, or change types of existing columns or tables.
- Do not backfill or rewrite existing clients, services, tasks, or rates.
- Existing create-service, create-client, and manual create-task APIs must keep working.
- Clients without configuration rows must keep working.
- Every tenant-owned write uses trusted `tenantId` from the session, never from the browser.
- Activation is one database transaction. Failure rolls back everything.
- Replaying the same activation must not create duplicate engagements or tasks.

## Reuse

| Concern | Existing owner |
|---|---|
| Service catalogue | `services`, `tenant-admin-services.*` |
| Recurrence template | `compliance_calendar_rules` |
| Default and client rates | `rate_cards`, `rate_card_items` |
| Client purchase | `engagements` |
| Actual work | `tasks`, `task_assignments`, `billable_task_entries` |
| Employees / capacity | `employees.default_capacity_minutes_per_week` |
| Skills (unchanged) | `skills`, `employee_skills` |
| Client portal services | `client-portal-dashboard.*` |
| Task UI / employee workflow | existing `/admin/tasks` and employee task screens |

## Additive schema only

1. `employee_service_capabilities` — which employees can handle which services.
2. `engagement_service_configurations` — client-specific snapshot, assigned employee, estimated total, idempotency.

Additive unique indexes:

- Active/draft engagement uniqueness per `(tenant_id, client_id, service_id)`.
- Generated task uniqueness per engagement occurrence.

## API contracts

Base: `/api/v1`. Browser traffic continues through existing Next.js tenant-admin proxies.

### Service blueprint

- `GET /tenant-admin/services/:serviceId/blueprint` — `client.read`
- `PUT /tenant-admin/services/:serviceId/blueprint` — `client.update`

Blueprint tasks are stored as tenant-default `rate_card_items` plus `compliance_calendar_rules`. The original `POST /tenant-admin/services` one-task create path remains.

### Employee capabilities

- `GET /tenant-admin/employees/:employeeId/service-capabilities` — `employee.read`
- `PUT /tenant-admin/employees/:employeeId/service-capabilities` — `employee.read`

Skills remain a separate concept. This mapping is service capability, not skill proficiency.

### Client onboarding

- `GET /tenant-admin/clients/:clientId/service-onboarding/catalog` — `client.read`
- `GET /tenant-admin/clients/:clientId/service-onboarding/assignees?serviceId=` — `client.read`
- `POST /tenant-admin/clients/:clientId/service-onboarding/activate` — `client.update`

Activate body includes `idempotencyKey` and one or more selected services, each with customized tasks and `assignedEmployeeId`.

Activate transaction per selected service:

1. Validate tenant-owned client, service, employee, capability, and country financial year.
2. Reuse an existing active engagement for the same client+service, or create one.
3. Persist `engagement_service_configurations` snapshot.
4. Create client-specific `rate_cards` / `rate_card_items` only when a price is overridden.
5. Expand recurrence for the current financial year from the activation date.
6. Insert `tasks` with `engagement_id` and `compliance_calendar_rule_id` when a matching template rule exists.
7. Insert `task_assignments` and `billable_task_entries`.
8. Write `SERVICE_ACTIVATED` audit.
9. Notify the client and assigned employee once per service, not once per generated task.

If any step fails, roll back.

## Frontend surfaces

- Services: keep `TenantServiceDirectory`; add Manage tasks blueprint editor.
- Employees: keep assignment dialog; add Services handled multi-select.
- Clients: keep create-client identity flow; after create, open Configure services wizard.
- Wizard steps: Select → Customize → Assign → Review & Activate.
- Client portal: enrich Active services with assigned employee, value, task list, and calculated progress.

No new visual system. TailAdmin / existing shared components only.

## Progress

Do not store `progress_percent`. Client and tenant UIs calculate:

`completed service tasks / total service tasks * 100`

Cancelled tasks are excluded.

## Files that may be modified

- Additive migration `0066_service_blueprint_activation.sql` and `migrations.ts`
- `operations.schema.ts`
- New isolated `tenant-admin-service-blueprints.*` and `tenant-admin-client-service-activation.*` files
- `platform.module.ts` registration only
- `tenant-admin-clients.repository.ts` engagement read join only
- `client-portal-dashboard.*` response enrichment
- Frontend service, employee, client, and portal screens listed above
- Tests for recurrence, activation idempotency, and migration registration

## Files that must not be rewritten

- `tenant-admin-tasks.repository.ts` create-task path
- Existing billing invoice workflow
- Existing client create identity/portal-account path
- Existing employee skills upsert
- Module boundaries / new Nest domain modules

## Regression risks

- Existing clients with zero engagements must still load.
- Editing a master blueprint after activation must not change stored snapshots or already generated tasks.
- Tenant A must not read or activate Tenant B resources.
- Double-click Activate / replayed idempotency key must not duplicate tasks.
- Manual task creation remains available beside generated tasks.
