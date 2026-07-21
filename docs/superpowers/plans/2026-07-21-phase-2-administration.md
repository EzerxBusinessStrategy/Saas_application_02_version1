# Phase 2 Administration Implementation Plan

> **For agentic workers:** Execute this plan inline with the existing workspace. Do not commit: the repository owner will create the commit.

**Goal:** Deliver the Super Admin and Tenant Admin workflows as TailAdmin-based, typed frontend compositions without altering the application's authorization architecture.

**Architecture:** A single typed administration contract and mock API layer supplies TanStack Query screens. Route dispatch remains under the existing workspace App Router structure; shared cards, tables, filters, dialogs, states, and responsive patterns are reused rather than replaced.

**Tech stack:** Next.js App Router, React, TypeScript, Tailwind, React Hook Form, Zod, TanStack Query/Table, Recharts, Vitest, Playwright.

## Global constraints

- Reuse the Phase 1 AppShell, route permissions, shared UI primitives, and TailAdmin tokens.
- Figma MCP is rate-limited: all new screens are pending Figma verification.
- Provisional APIs derive tenant scope server-side in a future backend; mock data does not indicate a backend integration.
- Keep forms accessible and values intact after validation failures; provide loading, empty, filtered-empty, error, permission, and mobile states.
- Do not add dependencies, weaken SSL, modify backend authorization, or commit.

### Task 1: Typed administration boundary

**Files:**

- Create: `src/types/administration.ts`
- Create: `src/mocks/administration.ts`
- Create: `src/features/administration/api/administration-api.ts`

- [ ] Define Zod-backed list, mutation, and detail contracts for tenants, plans, clients, engagements, work groups, audit events, support sessions, and administration settings.
- [ ] Add typed fixture records outside route components.
- [ ] Expose paginated, filterable mock API functions suitable for TanStack Query replacement with real HTTP endpoints.

### Task 2: Super Admin workflows

**Files:**

- Create: `src/components/administration/tenant-management.tsx`
- Create: `src/components/administration/platform-administration.tsx`
- Create: `src/app/(app)/[workspace]/tenants/[tenantId]/page.tsx`
- Create: `src/app/(app)/[workspace]/tenants/new/page.tsx`
- Modify: `src/app/(app)/[workspace]/[section]/page.tsx`, `src/lib/nav.ts`, `src/lib/route-access.ts`

- [ ] Add URL-backed tenant filtering, sorting, pagination, responsive cards, lifecycle actions, tenant detail tabs, and a validated creation form.
- [ ] Add subscription plans, reports, audit details, configuration, and visibly time-limited support-access compositions.
- [ ] Reuse existing `MetricCard`, `ChartCard`, `DataTable`, `FilterToolbar`, `ResponsiveTabs`, `ConfirmationDialog`, and state components.

### Task 3: Tenant Admin workflows

**Files:**

- Create: `src/components/tenant-administration/tenant-overview.tsx`
- Create: `src/components/tenant-administration/client-management.tsx`
- Create: `src/components/tenant-administration/workforce-administration.tsx`
- Create: `src/app/(app)/[workspace]/clients/[clientId]/page.tsx`
- Create: `src/app/(app)/[workspace]/employees/[employeeId]/page.tsx`
- Modify: `src/components/dashboard/dashboard.tsx`, `src/components/workforce/employee-directory.tsx`, `src/app/(app)/[workspace]/[section]/page.tsx`

- [ ] Replace generic Tenant Admin list placeholders with client, work-group, manager, organisation, and settings workflows.
- [ ] Add client and employee detail tabs, typed forms, controlled internal-profitability visibility, responsive directory cards, and meaningful progress states.
- [ ] Keep gamification limited to readable operational progress and onboarding/completion checklists.

### Task 4: Tests and documentation

**Files:**

- Create: focused Vitest tests under the relevant component folders.
- Modify: `docs/frontend/frontend-status.md`, `docs/frontend/frontend-implementation-plan.md`, `docs/figma/frame-inventory.md`, `docs/figma/pending-figma-verification.md`, `docs/api/provisional-contracts.md`, `docs/testing/frontend-validation.md`, `docs/frontend/gamification-strategy.md`

- [ ] Cover filters, lifecycle/form validation, tab navigation, responsive card alternatives, visibility boundaries, support banners, and progress text.
- [ ] Record Figma fallback, local shadcn fallback, contracts, implementation status, and fresh validation evidence.

### Task 5: Verification

- [ ] Run Prettier, lint, typecheck, route/token checks, Vitest, production build, and the installed Edge Playwright project.
- [ ] Verify responsive browser paths at 1440px, 1024px, 768px, and 390px with no page console errors or horizontal overflow.
