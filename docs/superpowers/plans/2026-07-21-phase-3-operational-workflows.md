# Phase 3 Operational Workflows Implementation Plan

> **For agentic workers:** Execute inline in this repository; no architectural or permission-model changes without an approved ADR.

**Goal:** Complete tenant-scoped task delivery, manager, employee, finance, reporting, client-portal, and professional-progress frontend workflows using typed mock contracts.

**Architecture:** Extend the existing dynamic workspace routes and TailAdmin-based shared components. Keep temporary data in `src/mocks`, validate feature contracts with Zod, use TanStack Query for feature reads, and keep all role scoping in route composition and mock API boundaries. Subscription plans and subscription reports are excluded by the current product decision.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, React Hook Form, Zod, TanStack Query/Table, dnd-kit, Recharts, Vitest, Playwright.

## Global constraints

- Reuse existing `AppShell`, `PageHeader`, `DataTable`, `MobileEntityCard`, `StatusBadge`, `ChartCard`, and state components.
- Use TailAdmin tokens and mark inferred screens Pending Figma verification.
- No new generic chart or component system, no new dependency, and no backend, auth, permission-model, or subscription-plan changes.
- Each screen must have permission, loading, empty, error, and mobile behaviour.

### Task 1: Typed operational contract and fixtures

**Files:**

- Create: `src/types/operations.ts`
- Modify: `src/mocks/operations.ts`
- Create: `src/features/operations/api/operations-api.ts`
- Test: `src/features/operations/api/operations-api.test.ts`

- [ ] Define task, work-log, review, invoice, payment, agreement, document, report, request, and professional-progress schemas.
- [ ] Add tenant-scoped fixtures and Zod-validated list APIs with pagination and role scope.
- [ ] Test task filtering, manager/employee/client scope, work-log validation, finance isolation, and progress-policy handling.

### Task 2: Task delivery workflow

**Files:**

- Modify: `src/components/operations/tasks-page.tsx`
- Modify: `src/components/operations/task-board.tsx`
- Create: `src/components/operations/task-details-drawer.tsx`
- Test: `src/components/operations/task-management.test.tsx`

- [ ] Add server-ready filters, accessible list/mobile cards, task creation/edit mock forms, bulk status actions, and detail drawer.
- [ ] Add checklist, attachment metadata, comments, dependencies, activity, work-log, review, and approval state.
- [ ] Preserve keyboard status changes independently of drag and drop.

### Task 3: Manager and employee workspaces

**Files:**

- Create: `src/components/operations/manager-workspace.tsx`
- Create: `src/components/operations/employee-workspace.tsx`
- Test: `src/components/operations/role-workspaces.test.tsx`

- [ ] Compose assigned-scope manager overview, review/approval queues, capacity, notifications, profile, and reports.
- [ ] Compose mobile-first employee My Day, tasks, current task, work logs, timesheet, calendar, documents, notifications, and profile.
- [ ] Include safe mock review/approval actions and clear provisional persistence messaging.

### Task 4: Finance, documents, client portal, and reports

**Files:**

- Create: `src/components/operations/finance-documents.tsx`
- Create: `src/components/operations/client-portal.tsx`
- Create: `src/components/operations/reports-workspace.tsx`
- Test: `src/components/operations/finance-client-reports.test.tsx`

- [ ] Add finance/document lists and drawers with Indian currency formatting and role-safe fields.
- [ ] Add client services, requests, finance, documents, support, notifications, and profile views with internal data excluded.
- [ ] Add business-specific operational charts with summaries and loading, empty, error, permission, and responsive states.

### Task 5: Routes, navigation, documentation, and browser checks

**Files:**

- Modify: `src/lib/nav.ts`
- Modify: `src/lib/route-access.ts`
- Modify: `src/app/(app)/[workspace]/[section]/page.tsx`
- Modify: `src/components/dashboard/dashboard.tsx`
- Modify: `docs/api/provisional-contracts.md`
- Modify: `docs/frontend/frontend-status.md`
- Modify: `docs/frontend/frontend-implementation-plan.md`
- Modify: `docs/frontend/gamification-strategy.md`
- Modify: `docs/figma/pending-figma-verification.md`
- Modify: `docs/testing/frontend-validation.md`
- Create: `e2e/phase3-operational.spec.ts`

- [ ] Route each role to only its permitted compositions while retaining existing permission vocabulary.
- [ ] Record typed mock boundaries and Figma fallback status.
- [ ] Run formatting, lint, typecheck, tests, token/routes checks, production build, and Edge browser verification at required viewports.
