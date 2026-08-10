# Work-group task notifications implementation plan

**Goal:** Let Tenant Admins create simple manager-owned work groups, select them during task creation, and notify every active work-group member through durable database records and post-commit realtime delivery.

1. [x] Simplify the work-group editor and limit manager choices to manager-capable employees.
2. [x] Bulk replace work-group memberships and task assignments with set-based PostgreSQL statements.
3. [x] Create bulk, idempotent direct and work-group notification records and recipients during task creation.
4. [x] Add a tenant-scoped transactional notification outbox and a bounded worker for employee Socket.IO delivery.
5. [x] Add the employee notification Socket.IO gateway and client subscription.
6. [x] Run root and backend typechecks, focused lint, tenant-task unit tests, and the backend production build. The frontend production build exceeded the 120-second command limit without reporting an error.
