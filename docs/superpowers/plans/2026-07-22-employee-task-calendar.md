# Employee task calendar implementation plan

> **For Codex:** Execute this plan inline using the existing TailAdmin-based components. Do not add a calendar dependency or a second task-detail UI.

## Scope

Replace the employee milestone-only calendar with an assigned-task calendar. An employee can select a due date, inspect task assignment and deadline context, open the existing task-detail drawer, or navigate to that exact task in the employee task workspace.

## Tasks

- [x] Update `src/components/operations/employee-workspace.tsx` to render employee-scoped operational tasks in the existing month calendar, with an accessible selected-date detail panel and mobile fallback.
- [x] Reuse `TaskDetailsDrawer` with read-only controls for calendar detail, passing the existing employee work logs.
- [x] Update `src/components/operations/tasks-page.tsx` to honour a `task` URL parameter and open the matching existing task drawer once.
- [x] Extend focused component tests for date selection and direct task navigation.
- [x] Run available validation: ESLint, TypeScript, focused and full tests, production build, and local Edge verification. Prettier is not installed in this repository.

## Acceptance checks

- Calendar dates expose the count of assigned tasks and remain keyboard operable.
- Selecting a date reveals each task's manager, due date, scope, status, and SLA state.
- "Open task" links to `/employee/tasks?task=<task-id>` and opens that existing task's detail drawer.
- The implementation has no duplicate calendar, button, badge, or task-detail primitive.
