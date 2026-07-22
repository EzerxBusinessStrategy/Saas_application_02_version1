# Employee Task Review Workflow Implementation Plan

> **For agentic workers:** Execute the checked scope inline; reuse the existing TaskBoard, ConfirmationDialog, notifications surface, and mock operations API.

**Goal:** Give employees a controlled submit-for-review flow, a non-pausable active-task timer, and a manager approval/rejection workflow.

**Architecture:** Keep the workflow in the existing typed mock operations API so Employee and Manager routes share the same session state. `TasksPage` owns the employee confirmation and timer presentation; `TaskBoard` remains the reusable drag surface and receives only the allowed transition callback.

**Tech Stack:** Next.js, React, TypeScript, TanStack Query, dnd-kit, shadcn-style Dialog/Button, Vitest.

## Global constraints

- No new dependency, route, or generic UI primitive.
- Employee submission is locked at `in-progress -> review`; manager decision moves it to `done` or `rejected`.
- Mock session behavior is not backend authorization, audit, notification delivery, or durable timing.

### Task 1: Typed workflow state

**Files:**
- Modify: `src/types/operations.ts`
- Modify: `src/features/operations/api/operations-api.ts`
- Test: `src/features/operations/api/operations-api.test.ts`

- [x] Add the `rejected` task status and typed mock API methods for start, submit, approve, and reject transitions.
- [x] Keep session task overrides scoped by the existing operational API.
- [x] Verify employee and manager task lists observe the resulting state.

### Task 2: Employee board workflow

**Files:**
- Modify: `src/components/operations/tasks-page.tsx`
- Modify: `src/components/operations/task-board.tsx`
- Modify: `src/components/operations/task-details-drawer.tsx`
- Test: `src/components/operations/task-details-drawer.test.tsx`

- [x] Restrict employee drags to task start, submit-for-review, and rejected-work resumption.
- [x] Use the shared confirmation dialog for `in-progress -> review` with the formal lock warning and close control.
- [x] Show a browser-timed active-task summary with no employee pause/stop control.

### Task 3: Manager decision surface

**Files:**
- Modify: `src/components/operations/manager-workspace.tsx`
- Test: `src/components/operations/role-workspace-actions.test.tsx`

- [x] Show submitted tasks in the manager review queue and notification surface.
- [x] Approve moves a task to done; request changes moves it to rejected.

### Task 4: Validation

- [x] Run the focused tests, full unit suite, ESLint, TypeScript, production build, and Edge verification without downloading a browser or weakening SSL.
