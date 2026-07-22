# Frontend production-readiness assessment

## Summary

The current application is a validated, TailAdmin-based frontend prototype with
typed mock API boundaries. It is ready for backend integration work, but it is
not deployable as a production multi-tenant service until authentication,
server-side authorization, durable data APIs, and remaining role decisions are
implemented.

## Route audit

| Exact route set                                                                                                                                                                                                                                                                                   | Allowed demo role      | Current status and data source                                      | States and responsive status                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `/`, `/login`, `/forgot-password`, `/reset-password`, `/accept-invitation`, `/session-expired`, `/no-permission`, `/tenant-suspended`, `/account-suspended`, `/invitation-expired`                                                                                                                | Public                 | UI complete; local form/session state only                          | Validation, success feedback, error copy, and keyboard labels                             |
| `/super-admin`, `/super-admin/tenants`, `/super-admin/tenants/new`, `/super-admin/tenants/[id]`, `/super-admin/reports`, `/super-admin/audit-log`, `/super-admin/platform-settings`, `/super-admin/support-access`                                                                                | Super Admin            | Frontend complete; typed platform/admin fixtures                    | Loading, empty, error, permission, desktop/mobile tables and charts                       |
| `/admin`, `/admin/tasks`, `/admin/clients`, `/admin/clients/[id]`, `/admin/work-groups`, `/admin/employees`, `/admin/employees/[id]`, `/admin/managers`, `/admin/organisation`, `/admin/invoices`, `/admin/documents`, `/admin/reports`, `/admin/audit-log`, `/admin/branding`, `/admin/settings` | Tenant Admin           | Frontend complete; typed administration/operations fixtures         | URL filters, pagination, forms, drawers, mobile cards, tenant-scoped audit fixture        |
| `/manager`, `/manager/tasks`, `/manager/clients`, `/manager/work-groups`, `/manager/employees`, `/manager/review-queue`, `/manager/approval-queue`, `/manager/workload`, `/manager/documents`, `/manager/reports`, `/manager/notifications`, `/manager/profile`                                   | Manager                | Assigned-scope mock workflows complete; scoped operational fixtures | Loading, empty, error, approval/review feedback, responsive layouts                       |
| `/employee`, `/employee/tasks`, `/employee/work-logs`, `/employee/timesheet`, `/employee/calendar`, `/employee/documents`, `/employee/notifications`, `/employee/profile`                                                                                                                         | Employee               | Assigned-work mock workflows complete; scoped operational fixtures  | My Day, tasks, work logs, timesheet, semantic calendar table/mobile list, documents       |
| `/employee/achievements`, `/employee/recognition`, `/employee/preferences`                                                                                                                                                                                                                        | Employee               | Private professional-progress mock workflows                        | Achievement catalogue, received recognition, and personal settings                        |
| `/manager/recognition`, `/admin/gamification`                                                                                                                                                                                                                                                     | Manager / Tenant Admin | Session-local recognition and tenant policy workflows               | Validated recognition form and tenant policy controls                                     |
| `/client`, `/client/services`, `/client/onboarding`, `/client/deliverables`, `/client/requests`, `/client/documents`, `/client/invoices`, `/client/payments`, `/client/reports`, `/client/notifications`, `/client/profile`, `/client/support`                                                    | Client User            | Own-client mock workflows complete; client-filtered fixtures        | Services, onboarding, authorised deliverables, requests, finance/documents, mobile layout |

All existing navigation routes resolve to feature screens. The former generic
section fallback was removed to prevent placeholder routes from shipping.

## Roles and permissions

- Current demo workspaces: Super Admin, Tenant Admin, Manager, Employee, and
  Client User.
- Navigation and route boundaries use typed frontend permissions. Manager task
  and document views use assigned-scope fixtures; Employee documents use their
  assigned task-client scope; Client finance/documents are client filtered.
- Frontend permission checks are UX controls only. Backend authorization,
  tenant context derivation, RLS, tenant-safe foreign keys, and audit
  enforcement remain mandatory.
- Tenant Owner, Finance User, and HR/Operations User are typed domain roles but
  do not have approved personas/workspaces. Their route and permission design
  must be approved before implementation.

## Integrations and deployment blockers

- All feature APIs are typed, Zod-validated mock boundaries under
  `src/features/*/api`; no HTTP backend is connected.
- Login, reset-password, invitations, support access, role selection, and all
  mutations are frontend/session-local demonstrations only.
- Figma MCP remains rate limited. Screens are TailAdmin-based and marked
  Pending Figma verification; no implementation is claimed pixel-perfect.
- The official shadcn registry remains blocked by a local self-signed
  certificate. Existing local components are reused; SSL verification was not
  weakened.
- `corepack pnpm audit --prod` could not reach the npm audit endpoint because
  this environment redirected the connection to `127.0.0.1:9`, which refused
  it. No audit result is claimed; rerun it from a network with npm registry
  access before release.

## Accessibility and responsive status

- Shared shell includes a skip link, main landmark, focus-visible controls,
  responsive sidebar/dialog navigation, and reduced-motion CSS.
- Major lists provide loading, empty, filtered-empty, error, and permission
  compositions. Desktop data tables use mobile card fallbacks where applicable.
- The Employee Calendar now provides labelled month navigation, semantic day
  cells, status text, and a mobile list fallback. Charts include text summaries
  and readable tenant values.
- Browser checks cover 1440px, 1280px, 1024px, 768px, and 390px; remaining
  production accessibility verification requires live backend/auth flows.

## Validation evidence

On 2026-07-22, formatting, ESLint, TypeScript, design-token, and route checks
passed. Vitest passed 27 test files and 43 tests. The optimized Next.js build
passed. The installed Microsoft Edge Playwright project passed all 12 end-to-end
tests. The npm production audit remains blocked as described above.

## Recommended next steps

1. Approve and implement the authentication/session and real role-routing
   architecture.
2. Implement tenant-scoped backend APIs with server-derived context, PostgreSQL
   RLS, tenant-safe foreign keys, audits, idempotent mutations, and tenant A/B
   isolation tests.
3. Replace mock API implementations incrementally and retain the documented UI
   loading/error/empty contracts.
4. Define Tenant Owner, Finance User, and HR/Operations User workspace scope.
5. Re-run Figma visual verification after the MCP rate limit is available.
