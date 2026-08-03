# Subscription architecture

Status: Proposed
Date: 2026-07-28

This document defines the initial subscription boundary for the SaaS App
backend. It is documentation only and does not create tables, migrations,
endpoints, billing-provider integration, or frontend changes.

## Purpose

The Subscriptions module owns the platform plan catalogue, each tenant's active
commercial subscription, entitlement snapshots, subscription lifecycle events,
and audit/outbox records for subscription changes.

Subscriptions are not portal-specific copies. A tenant has one authoritative
subscription state that every portal reads through authorized backend APIs.

## Ownership

| Concern | Owner |
| --- | --- |
| Plan catalogue | Subscriptions module with Platform authorization |
| Tenant subscription lifecycle | Subscriptions module |
| Tenant lifecycle effects such as suspension | Tenancy module through exported services/events |
| Invoice generation and payment recording | Billing module |
| Entitlement checks used by other modules | Subscriptions module exported application service or explicit port |
| Audit trail | Audit module records emitted by Subscriptions |
| Async email/notification/provider delivery | Transactional outbox and worker |

No module may read or write subscription tables through the Subscriptions
repository directly unless it is inside the Subscriptions module.

## Proposed entities

| Entity | Table | Scope | Notes |
| --- | --- | --- | --- |
| Plan | `subscription_plans` | Platform/global | Public catalogue of available plans and limits. |
| Tenant Subscription | `tenant_subscriptions` | Tenant-owned | Current tenant commercial state and selected plan. |
| Subscription Event | `subscription_events` | Tenant-owned | Append-only lifecycle history. |
| Entitlement Snapshot | `tenant_entitlement_snapshots` | Tenant-owned | Calculated limits captured after plan/subscription changes. |

Keep these source tables normalized. Do not copy plan names, current limits, or
subscription status into every tenant-owned feature table.

## Lifecycle

Initial lifecycle states:

```text
trialing -> active -> past_due -> suspended -> cancelled
trialing -> cancelled
active -> cancelled
past_due -> active
suspended -> active
```

State transitions must be explicit. Do not update subscription status from a
generic patch endpoint.

Each decision stores:

- Actor.
- Tenant.
- Previous state.
- Next state.
- Reason.
- Timestamp.
- Optional provider reference.
- Audit event reference.

## Authorization

- `SUPER_ADMIN` may manage global plans and tenant subscriptions only through
  explicit platform permissions.
- `TENANT_OWNER` and `TENANT_ADMIN` may view their tenant subscription when
  permitted.
- Tenant-scoped users never manage another tenant's subscription.
- Frontend role checks are UX only.
- The backend derives tenant, actor, roles, and permissions from the trusted
  Supabase-authenticated context.
- PostgreSQL RLS must protect tenant-owned subscription rows.

Add subscription permissions before implementation, for example:

- `subscription.plan.read`
- `subscription.plan.manage`
- `subscription.read`
- `subscription.change`
- `subscription.cancel`

Exact permission names require approval before code is written.

## Entitlements

Entitlements should answer whether a tenant may use a capability; they should
not replace feature-specific authorization.

Examples:

- Maximum active users.
- Enabled modules.
- Storage limit.
- Client/account limit.
- Report export limit.
- Support tier.

Modules that need entitlement checks call the Subscriptions application service
or an explicit entitlement port. They do not import subscription repositories.

## Billing boundary

Subscriptions determine commercial plan state. Billing owns invoices, invoice
lines, payments, allocations, agreements, and financial posting.

When a subscription change requires financial work:

```text
Subscriptions transaction
  -> change subscription state
  -> append subscription event
  -> write audit event
  -> write outbox event for Billing/notification/provider work
```

Invoice creation and payment recording remain Billing operations and must be
idempotent.

## Provider boundary

No payment provider is approved in Phase 0.

If a provider is added later, provider webhooks must:

- Be authenticated.
- Be idempotent.
- Verify request-body fingerprints where applicable.
- Load authoritative tenant/subscription state before mutating.
- Use outbox or database uniqueness as final duplicate protection.
- Avoid storing unnecessary provider payloads.

## API shape

Initial proposed endpoints:

- `GET /api/v1/subscription-plans`
- `GET /api/v1/tenants/{tenantId}/subscription`
- `POST /api/v1/tenants/{tenantId}/subscription/change`
- `POST /api/v1/tenants/{tenantId}/subscription/cancel`

These routes are proposals only. All tenant IDs in paths are lookup inputs.
The backend must verify platform or tenant authority from trusted context.

Mutation endpoints require idempotency keys and audit events.

## Database and RLS

Global tables:

- `subscription_plans`

Tenant-owned tables:

- `tenant_subscriptions`
- `subscription_events`
- `tenant_entitlement_snapshots`

Tenant-owned tables require:

- `tenant_id uuid not null`.
- `unique (tenant_id, id)` where needed for composite references.
- Composite foreign keys to tenant-owned parents.
- Tenant-leading indexes for list and lookup paths.
- `ENABLE ROW LEVEL SECURITY`.
- `FORCE ROW LEVEL SECURITY`.
- Explicit `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies where needed.

## Audit and outbox

Audit subscription events for:

- Plan creation and changes.
- Tenant subscription creation.
- Subscription state transitions.
- Limit overrides.
- Cancellation.
- Suspension and reactivation.
- Provider webhook decisions.

Outbox events are appropriate for:

- Tenant subscription created.
- Subscription changed.
- Subscription suspended.
- Subscription reactivated.
- Billing cycle started.
- Provider sync required.
- Notification required.

Outbox delivery is at-least-once. Consumers must be idempotent.
Workers must claim bounded batches safely, for example with `FOR UPDATE SKIP
LOCKED` or an approved equivalent, and failed events must retry with bounded
backoff before moving to a failed or dead-letter state.

## Testing

Minimum tests before implementation is complete:

- Platform actor can manage plans when permitted.
- Tenant actor cannot manage platform plans.
- Tenant A cannot read or mutate Tenant B subscription.
- Suspended tenant behaviour matches approved policy.
- Idempotent subscription mutation replays safely.
- Concurrent subscription changes resolve with row locks or expected versions.
- Runtime database role cannot bypass RLS.
- Audit is written for sensitive subscription changes.

## Open decisions

- Trial support and default trial duration.
- Whether cancellation is immediate or end-of-period.
- Grace period after failed payment.
- Subscription suspension effects on user access.
- Manual billing versus provider integration.
- Provider name, if any.
- Whether plan limits are hard blocks, warnings, or admin-only overrides.
- Exact subscription permission names.
