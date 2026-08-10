# Feature Test Matrix

**Audit date:** 2026-08-10  
**Scope:** `D:\Saas_app_version_2` local source only. No Supabase project, production database, email service, or object-storage environment was accessed.

## Status legend

| Status | Meaning |
| --- | --- |
| **Real** | A frontend BFF route reaches a NestJS controller/service/repository and tenant-scoped PostgreSQL tables. |
| **Partial** | The core flow exists, but a required external or end-to-end step is missing or not proven. |
| **Mock** | The visible flow uses in-memory fixtures or explicitly says `mock session`. |
| **Legacy** | Code remains reachable but conflicts with the current product direction. |
| **Missing** | No source-backed implementation was found. |

## Test environments and boundaries

| Layer | Intended environment | Data policy | Current evidence |
| --- | --- | --- | --- |
| Frontend unit/component | Vitest + jsdom | Fixture-only | Existing root `src/**/*.test.{ts,tsx}` suite. |
| Backend unit/API | Vitest + Supertest + Nest Fastify | In-memory/configured test app only | Existing `apps/backend/test/unit` and `test/api`. |
| PostgreSQL integration | Testcontainers PostgreSQL 16 | Ephemeral container, migrations from `0001` through `0054` | `database-foundation.test.ts` applies every migration and validates base RLS. |
| Browser E2E | Playwright on local Next server | No production credentials or shared data | Existing suite is primarily route/UI coverage and includes explicit mock-session assertions. |
| External services | Isolated test doubles only | Never production Supabase, SMTP, or object storage | Real object storage and email delivery are not implemented/proven. |

## Source-of-truth inventory

| Area | UI/BFF/API source | Backend source | Database/workflow source | Status | Existing coverage | Required coverage |
| --- | --- | --- | --- | --- | --- | --- |
| Authentication and workspace routing | `src/app/api/auth/*`, `src/app/(auth)/*`, workspace resolver | `auth-identify`, `me`, session-policy, access-admin controllers | users, memberships, roles, session policies; `0009`, `0020`, `0049` | **Real** | API auth/session tests; frontend shell tests | Add full login/role-routing E2E using isolated Supabase Auth; expired/suspended session denial. |
| Super Admin tenants and lifecycle | `src/app/api/super-admin/tenants/*`, dashboard, audit, search | access-admin, dashboard, audit, search services | tenants, invitations, audit; `0011`-`0041` | **Real** | API and unit coverage for access administration | Add tenant create/suspend/reactivate idempotency and cross-tenant audit integration tests. |
| Super Admin configuration and alerts | BFF configuration/notifications/dashboard | configuration and notification services | platform configuration, notifications | **Partial** | API config and dashboard tests | Add persistence, RBAC, notification recipient, and realtime browser tests. |
| Tenant profile/dashboard/analytics | tenant-admin dashboard/profile/analytics BFF routes | tenant dashboard and analytics services | tenant and reporting tables | **Real** | unit/API coverage | Add tenant A/B database tests for every report query and profile mutation. |
| Client directory and contacts | `tenant-admin/clients/*` | tenant admin clients service/repository | clients, client contacts | **Real** | unit client tests | Add CRUD API + RLS cross-tenant and browser create/edit/delete coverage. |
| Services, rate cards, country calendar | tenant services/task options UI | tenant services/tasks services | service, rate-card, fiscal-year tables; `0051`, `0052` | **Partial** | unit task rate SQL assertions; financial-year unit policy | Add country-specific financial-year and rate validity integration tests. |
| Workforce directory, capacity, manager capability | employee and manager BFF routes | tenant tasks service/repository | employees, membership roles, `employee_manager_assignments`; `0048`, `0050` | **Real** | tenant task unit tests | Add promotion/demotion transaction, notification, manager-only access, and tenant isolation tests. |
| Workforce profile skills | employee profile route/component | employee profile service/repository | employee skills/profile fields | **Partial** | no focused backend tests found | Add create/update skill persistence, tenant boundary, and employee profile display E2E. |
| Work groups | work-group BFF routes and task form | tenant tasks repository | work groups/memberships | **Real** | no focused DB/API tests found | Add manager-in-group invariant, membership replacement, cross-tenant FK/RLS, and UI form tests. |
| Tenant task creation and assignment | tenant task BFF routes and task UI | tenant tasks controller/service/repository | tasks, assignments, billable entries, notifications/outbox | **Real** | unit schema and SQL shape tests | Add create task transaction integration, explicit-vs-group recipients, duplicate-recipient prevention, and idempotency tests. |
| Employee task board/calendar/dashboard | employee BFF/API and workspace components | employee dashboard/tasks services/repository | assignments/tasks/work segments | **Real** | component and mock E2E only | Add authenticated employee task/calendar E2E plus tenant A/B database visibility tests. |
| Employee timer and work log | employee task start/pause/resume/submit routes | `EmployeeTasksRepository` | `task_work_sessions`, `task_work_segments`; `0045` | **Real** | no focused timer integration tests found | Add exact segment-duration, one-open-timer, pause/resume, refresh, and concurrent-start tests. |
| Employee submission comments | employee submit API/UI | employee tasks repository | `task_submissions.task_comment`; `0047` | **Real** | no focused tests found | Add persisted comment, manager visibility, tenant visibility, and empty-comment behavior tests. |
| Manager capability inside employee portal | `/employee/manager/*` BFF and manager nav | `EmployeeManagerService` | MANAGER role plus group/employee-manager assignment scope | **Real** | no focused manager tests found | Add non-manager 403, assigned-manager success, unassigned-manager denial, approve/return workflow tests. |
| Legacy standalone manager workspace | `/manager` routes and old components | legacy route/UI surfaces | n/a | **Legacy** | Playwright `phase3-operational.spec.ts` explicitly tests it | Remove or redirect only after a separate approved product cleanup; do not treat as V1 manager verification. |
| Manager review to tenant approval | employee manager review API | `EmployeeManagerService` | task submissions, approvals, task status, notifications | **Real** | no focused DB/API tests found | Add approve and return transitions, row-lock contention, automatic timer resume, audit/outbox rows, scope denial. |
| Tenant final task approval | tenant task approval API/tab | tenant tasks repository | approvals, billable task entries; `0051` | **Real** | unit SQL assertion only | Add manager-approved-only approval, deny/return behavior, billable promotion, invoice-ready notification, concurrent decision tests. |
| Notification read state | employee/tenant/super-admin notification routes/menu | notification services | notifications and recipient rows | **Real** | unit notification tests and menu component test | Add recipient isolation, optimistic-read rollback, unread count, and API denial coverage. |
| Task notification transactional outbox | task create/submit/review services | `task-workflow-support`, `TaskNotificationOutboxWorker`, Socket.IO gateway | notifications, recipients, outbox; `0054` | **Real** | no worker/transaction integration tests found | Add bulk recipient insert, outbox claim/complete/retry, duplicate event idempotency, and Socket emission tests. |
| Employee document upload/share | employee document BFF/API | employee documents service/repository | tenant documents and recipients; `0043`, `0046` | **Partial** | no focused backend tests found | Add recipient selection/scope and audit/notification tests; browser file selection remains metadata-only until storage exists. |
| Tenant document sharing to employee/client | finance documents BFF/UI | tenant finance repository | tenant documents, recipients, notifications | **Partial** | no focused backend tests found | Add recipient/client visibility, denial, and notification outbox tests. |
| Invoice creation from completed task | finance BFF/UI, PDF preview helper | tenant finance repository/service | billable entries, invoices, invoice items; `0051` | **Real** | task repository SQL assertions | Add discounts, duplicate invoice-number, approval prerequisite, concurrent generation, tenant/client isolation tests. |
| Invoice PDF preview/download/send | `src/lib/invoice-pdf.ts`, finance UI | `sendInvoice` writes document metadata and client notification | invoices + tenant document metadata | **Partial** | no focused tests found | Test local PDF rendering and metadata transaction. Real downloadable object storage/email is **missing**, so do not claim client file delivery E2E. |
| Client portal dashboard/profile/requests | `client-portal/*` BFF/UI | client portal services | client portal accounts, client-owned records; `0042`, `0044` | **Real** | limited API/component/E2E visual coverage | Add authenticated client scope tests, request creation integration, and client A/B isolation E2E. |
| Client invoices/documents/deliverables | client portal deliverables/invoice UI | client deliverables service | tenant documents/invoices + portal accounts | **Partial** | no full invoice/document path test found | Add sent-invoice visibility and document decision permission tests; storage bytes remain missing. |
| Gamification, recognition, work logs/timesheet UI | operations components/API | no equivalent current backend service located for all actions | fixture/session state | **Mock** | component/API tests mention mock session | Exclude from release-critical operational certification until backend contracts are implemented. |

## Existing test classification

| Test family | Classification | Reason |
| --- | --- | --- |
| `apps/backend/test/integration/database-foundation.test.ts` | **Real database integration** | Starts a disposable PostgreSQL 16 container, applies all registered migrations, sets `app_runtime`, and validates foundational RLS/tenant context/audit behavior. |
| Backend API tests | **Real Nest transport, partial persistence** | Supertest validates Fastify/Nest routes and policies, but most tests do not run against an ephemeral migrated PostgreSQL database. |
| Backend unit tests | **Real unit coverage** | Exercise DTO validation, service guards, and SQL construction; they do not prove database constraints or RLS alone. |
| Root component/API tests | **Component/fixture coverage** | Useful for UI and client contracts; not proof of backend persistence. |
| `e2e/phase3-operational.spec.ts` | **Mock/legacy visual coverage** | It asserts `Decision recorded for this mock session.` and opens legacy `/manager`. |
| Other Playwright specs | **Route/UI smoke coverage unless authenticated fixtures are added** | They have no isolated database + verified role/session fixture in the current configuration. |

## Risk-prioritized automated test additions

1. **P0**: task timer segments, one-active-timer constraint, submission comment, manager return/automatic resume, tenant approval, and billable entry promotion.
2. **P0**: transactional notification recipient creation, outbox claim/complete/retry/idempotency, and Socket.IO emission.
3. **P0**: tenant A/B RLS and role denial for task, invoice, document, employee, manager, and client portal records.
4. **P1**: invoice creation/discounts/concurrent generation/client visibility; document recipient visibility and audit events.
5. **P1**: authenticated Playwright journeys for each role against disposable test infrastructure.
6. **P2**: legacy/mock operational screens either receive real backend contracts or are removed from release certification.

## Release gate

The application is **not eligible for full workflow certification** until the P0 database/API tests pass in a disposable PostgreSQL environment and authenticated browser fixtures exercise every supported role. The current source has meaningful foundation coverage, but it does not yet prove the new task, manager, finance, document, and realtime workflows end to end.
