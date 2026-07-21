# Full Frontend Gap Analysis

## Current architecture

- Next.js App Router with public authentication routes and a workspace-scoped
  authenticated route group: `src/app/(app)/[workspace]`.
- `WorkspaceShell` owns the TailAdmin-derived 280px/72px desktop sidebar, 80px
  header, mobile navigation dialog, route-derived breadcrumb, permission-aware
  command navigation, context controls, notifications, and user menu.
- `src/types/domain.ts`, `src/lib/permissions.ts`, and `src/lib/nav.ts` provide
  the current typed role, permission, and navigation model.
- Static fixtures live in `src/mocks`; data is not yet fetched through feature
  API clients or TanStack Query.

## Existing routes and screens

| Route                                                                                                  | Status              | Notes                                                                               |
| ------------------------------------------------------------------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------- |
| `/login`, `/forgot-password`, `/reset-password`, `/accept-invitation`                                  | Foundation complete | Validated forms and safe frontend-only feedback.                                    |
| `/session-expired`, `/no-permission`, `/tenant-suspended`, `/account-suspended`, `/invitation-expired` | Foundation complete | Auth state routes that do not imply backend remediation.                            |
| `/[workspace]`                                                                                         | Partial             | Super Admin overview is implemented; other roles share a generic dashboard.         |
| `/[workspace]/tasks`                                                                                   | Partial             | Task list/board composition exists.                                                 |
| `/admin/employees`                                                                                     | Partial             | Typed workforce directory, URL filters, table/cards, and permission boundary exist. |
| Remaining `[section]` routes                                                                           | Placeholder         | `EntityList` renders generic mock rows rather than business workflows.              |

## Existing reusable components

- Shell and navigation: `WorkspaceShell`, typed `navigationFor`.
- Shared: `PageHeader`, `MetricCard`, `StatusBadge`, `EmptyState`,
  `PermissionBoundary`.
- Operations: TanStack `DataTable`, `TaskBoard`, `TasksPage`, `EntityList`.
- Analytics: `ChartCard`, `PlatformOverviewDashboard` using Recharts.
- UI primitives: `Button`, `Card`, `Badge`, and Radix `Dialog`.

## Complete, partial, and missing areas

- Complete enough for a foundation: workspace shell, persona routing, nested
  permission filtering, route boundaries, global loading/error, auth states,
  shared filters/pagination/mobile cards, task board, Super Admin overview,
  and employee directory.
- Partial: dashboard composition, charts, and feature-specific API/query
  integration.
- Missing: tenant lifecycle screens, clients and engagements, organisation
  structure, finance/documents, reports, manager/employee/client workflows,
  notification/command centres, typed API layer, query integration, shared form
  controls, reusable error/loading/mobile-entity states, and route-level test
  coverage.

## Design, Figma, and token audit

- TailAdmin tokens are in `src/app/globals.css`; semantic tokens are enforced
  by `scripts/check-design-tokens.ts`.
- TailAdmin Analytics Dashboard (`17:577`) is documented in
  `docs/figma/component-map.md`.
- NEATLAB Super Admin information hierarchy is documented and implemented.
- Mint Workforce context was retrieved, but its screenshot was blocked by the
  Figma MCP Starter-plan rate limit.
- Dashlab Reports has not been inspected because Figma MCP is rate-limited.
- Secondary-reference implementations must be marked Pending Figma verification
  until direct comparison is possible.

## Role and permission gaps

- All eight roles are typed, but only the existing section permissions are
  modelled.
- A typed route-access registry protects all current `[section]` routes.
  It remains a frontend usability boundary; server-side authorization is still
  required before live data access.

## Data and testing gaps

- Typed mock fixtures exist for platform, operations, workforce, and workspace
  personas but have no feature-level API interface, Zod validation, or TanStack
  Query boundary.
- Component tests cover selected dashboard, employee directory, permissions,
  auth forms, errors, sidebar collapse, mobile navigation, switcher visibility,
  user menu, notifications, breadcrumbs, pagination, filters, and mobile cards.
  Browser coverage remains dependent on Playwright execution.
- Existing Playwright coverage is tenant-isolation focused; UI visual regression
  scenarios are documented but not implemented.

## Recommended implementation order

1. Finish shared UI states, responsive list patterns, route-access registry, and
   typed feature data contracts.
2. Complete authentication and Super Admin tenant-management workflows.
3. Build tenant client, engagement, work-group, and workforce workflows.
4. Build manager, employee, and client-portal task flows.
5. Add finance, documents, settings, and reports through shared compositions.
6. Add browser coverage and visual verification for each completed slice.
