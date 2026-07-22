# End-to-end coverage

## Browser project

Playwright uses the installed Microsoft Edge stable channel through the `msedge`
project. No browser download or SSL bypass is required.

## Covered representative workflows

| Workflow                        | Route or action                                                                             | Breakpoints                          |
| ------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------ |
| Authentication and state routes | Login, reset, invitation, permission states                                                 | Desktop and tablet                   |
| Super Admin administration      | Tenant management, creation, support access, reports, audit                                 | Desktop, tablet, mobile              |
| Tenant Admin operations         | Client details, work-group creation, employee mobile cards, tenant audit                    | Desktop, tablet, mobile              |
| Manager scope                   | Review queue and approval decision feedback                                                 | Desktop                              |
| Employee workflow               | Task filtering, work-log route, responsive calendar month navigation                        | Tablet and mobile                    |
| Client portal                   | Service overview, finance visibility, support-request form                                  | Mobile                               |
| Shell/accessibility             | Sidebar, mobile navigation, direct permission boundary, horizontal overflow, console errors | 1440px, 1280px, 1024px, 768px, 390px |

Every browser helper checks that the main landmark loads, the document has no
horizontal overflow, and no browser-console error is emitted during page load.

## 2026-07-22 Phase 4 verification

- `corepack pnpm exec playwright test --project=msedge`: 12 passed using the
  installed Microsoft Edge stable channel.
- The suite covers 1440px, 1280px, 1024px, 768px, and 390px, including
  authentication UI, support access, permission boundaries, tenant isolation,
  responsive navigation, operational role flows, and the Employee Calendar.
- `playwright.config.ts` uses one worker because concurrent on-demand route
  compilation by the shared Windows Next development server caused aborted
  navigations despite already-rendered pages. This changes test scheduling only;
  it does not alter application behaviour or browser security.

## Not browser-verifiable without backend integration

- Real login, logout, password reset, invitation acceptance, and session expiry.
- Durable role/tenant authorization, RLS, and audit persistence.
- Tenant Owner, Finance User, and HR/Operations User role journeys, because
  they do not yet have approved frontend workspace routing.
