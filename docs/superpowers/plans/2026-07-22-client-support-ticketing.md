# Client Support Ticketing Implementation Plan

> **For agentic workers:** Execute this plan inline with the existing typed mock operations API, ClientPortal, ManagerWorkspace, and tenant-admin route patterns.

**Goal:** Replace the client support request form with a professional ticket portal that routes tickets to the assigned manager and tenant administrators, who can assign a ticket to an employee and resolve it.

**Architecture:** Add one typed `SupportTicket` contract and session-backed mock API in the existing operations feature. Reuse the existing page shell, form controls, cards, status badges, dialogs, and TanStack Query refresh patterns; no new generic UI primitives or routes outside current workspace sections.

**Tech Stack:** Next.js, React, TypeScript, Zod, TanStack Query, shadcn-style controls, Vitest.

## Global constraints

- Client visibility is restricted to the client account's tickets.
- Manager visibility is restricted to tickets for their assigned client.
- Tenant admins can view and dispatch tickets within the tenant.
- Frontend permissions are UX only; backend enforcement and real notification delivery remain required.
- No new dependency or separate support system.

### Task 1: Typed ticket contract and session API

**Files:**
- Modify: `src/types/operations.ts`
- Modify: `src/mocks/operations.ts`
- Modify: `src/features/operations/api/operations-api.ts`
- Test: `src/features/operations/api/operations-api.test.ts`

- [x] Add a Zod-validated support ticket model, creation input, status/priority fields, assignee, activity, and resolution state.
- [x] Add typed create, list, assign, reply, and resolve mock API methods with workspace-scoped visibility.
- [x] Persist mock ticket state in browser storage so role-route changes retain the submitted ticket.

### Task 2: Client ticket portal

**Files:**
- Modify: `src/components/operations/client-portal.tsx`

- [x] Replace the title-only dialog with a labelled ticket form for subject, service, category, priority, and description.
- [x] Display ticket summaries, status, owner, updated time, and client-visible activity.
- [x] Include loading, empty, validation, and submitted states using existing components.

### Task 3: Manager and tenant-admin ticket queues

**Files:**
- Modify: `src/components/operations/manager-workspace.tsx`
- Modify: `src/components/tenant-administration/workforce-administration.tsx` or the existing tenant-admin section dispatcher
- Modify: `src/lib/nav.ts`
- Modify: `src/lib/route-access.ts`
- Modify: `src/app/(app)/[workspace]/[section]/page.tsx`

- [x] Add permission-filtered ticket queue entry points for Manager and Tenant Admin.
- [x] Show assigned-client/tenant ticket lists and status detail.
- [x] Let Manager and Tenant Admin assign an available employee, reply, and resolve a ticket.

### Task 4: Tests and validation

**Files:**
- Modify: `src/components/operations/role-workspace-actions.test.tsx`
- Test: `src/features/operations/api/operations-api.test.ts`

- [x] Add focused API and component-test coverage for ticket creation, manager visibility, assignment, and resolution.
- [x] Run the full Vitest suite, ESLint, TypeScript, production build, and local Edge verification. Prettier is not installed in this repository, so formatting could not be run without adding a dependency.
