# ADR 0015: Additive service blueprint activation

Status: Accepted
Date: 2026-08-16
Decision owners: Tenant operations

## Context and problem

The tenant needs a service catalogue with multiple tasks, employee-to-service capability, client package customization, responsible-person assignment, and automatic generation of real work items. The database already has services, engagements, calendar rules, rate cards, tasks, assignments, and billing. Engagements and calendar rules were unused by application code.

## Constraints

- Existing records, APIs, task workflow, billing, tenant isolation, and UI must keep working.
- No second task engine or pricing engine.
- Additive PostgreSQL only.
- No Redis/BullMQ.
- No new Nest domain module split.

## Considered options

1. New task-template tables plus a parallel generated-task workflow.
2. Overload `employee_skills` to mean services.
3. Additive capability and configuration tables, reuse calendar rules and rate items as the blueprint, and generate existing `public.tasks` inside one activation transaction.

## Decision and rationale

Option 3. Skills and services are different. Calendar rules and rate-card items already describe recurrence and price per service task type. Engagements already represent a client purchasing a service. Tasks already have `engagement_id` and `compliance_calendar_rule_id`. The missing product behavior is orchestration plus two small side tables.

## Positive and negative consequences

Positive: lowest schema risk, existing employee/task/billing/portal screens keep working, client-specific snapshots isolate later template edits.

Negative: recurrence expansion is generated at activation for the current financial year rather than by a future cron. Later periods require a follow-up generator.

## Security and operational consequences

Trusted tenant context is required. Employee, client, and service IDs are lookup inputs and are re-validated in-tenant. Activation is transactional and idempotent. Client portal still scopes to the authenticated client.

## Migration and rollback

Additive tables and indexes in `0066_service_blueprint_activation.sql`. Rollback is `DROP TABLE` of the two new tables and drop of the new unique indexes. No existing data rewrite.

## Validation plan

Unit tests for recurrence and activation idempotency. Migration runner includes the new file. Existing service/client/task tests remain green.

## Related decisions

- ADR 0004 PostgreSQL architecture
- ADR 0008 country-scoped financial years
- `docs/architecture/IMPLEMENTATION_CONTRACT.md`
