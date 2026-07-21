# Frontend Implementation Plan

## Phase 1: Foundation and route access

Status: code-complete. Validation is recorded in
`docs/testing/frontend-validation.md`.

1. Completed shared loading, error, pagination, responsive entity-card, filter,
   input/select, menu, confirmation-dialog, and action-menu compositions
   without replacing existing primitives.
2. Completed typed route access, nested permission-filtered navigation, direct
   section boundaries, route metadata breadcrumbs, desktop collapse state, and
   a responsive mobile drawer.
3. Completed typed shell fixtures for tenant context and notifications. They
   remain provisional frontend data; no tenant switch or notification backend is
   implied.
4. Completed baseline route, permission, sidebar, switcher, notification,
   breadcrumb, pagination, filter, mobile-card, long-content, and state tests.

## Phase 2: Authentication and Super Admin

Status: code-complete; validation results are recorded in
`docs/testing/frontend-validation.md`.

1. Completed tenant list, details, creation, URL-backed global audit
   filtering/sorting/pagination and detail drawer, configuration,
   and visibly audited support access with typed mock data.
2. Completed a TailAdmin-based global reporting composition with a readable
   tenant-health chart summary.
3. Completed Tenant Admin overview, client, validated session-local work-group
   create/edit, employee-profile, manager, organisation, capacity, and settings
   compositions without replacing the Phase 1 shell or shared primitives.

## Phase 3: Operational workflows

Status: code-complete with typed mock integrations.

1. Completed operational task list, board, details, work logs, reviews,
   approvals, manager scope, employee workflows, client portal, finance,
   documents, and operational reports without restoring subscription plans.
2. Completed session-local task, review, approval, and create interactions.
   Future authorised mutations require tenant-scoped backend contracts.
3. Completed optional professional-progress views that protect leave/holidays
   and avoid public rankings, overtime incentives, and punitive streaks.

## Phase 4: Delivery, finance, documents, and settings

1. Complete task detail, work-log, review, approval, and workload flows.
2. Add invoices, payments, agreements, and document list/detail compositions.
3. Add branding, organisation, users/roles, notifications, and safe settings
   forms.

## Phase 5: Role workspaces and reports

1. Build manager, employee, and client-portal routes as scoped compositions of
   shared features rather than separate applications.
2. Add business-specific report charts through the existing Recharts and
   ChartCard stack, with summaries, readable labels, and responsive fallbacks.
3. Add restrained, data-driven progress/checklist components only where a
   business workflow benefits from them.

## Phase 6: Quality gates

1. Add focused unit/component tests per feature, route-permission tests, and
   Playwright desktop/tablet/mobile journeys.
2. Run formatting, linting, type checking, tests, token/route checks, build,
   and browser verification.
3. Record Figma availability and visual differences in `docs/figma`.

## Current execution slice

The first implementation slice is shared UI state completion and replacing the
generic section route with a typed feature dispatch. It creates no parallel
design system and preserves the current route architecture.
