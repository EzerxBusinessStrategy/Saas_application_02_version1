# Frontend validation

## Phase 1 foundation

The Phase 1 foundation requires format, lint, TypeScript, component tests,
build, route/token checks, and Playwright when a compatible browser is
available. Results are updated after each completion run; no backend integration
is implied by the typed frontend fixtures.

### Browser checks

The intended browser matrix is 1440px, 1280px, 1024px, 768px, and 390px. It
covers the expanded/collapsed sidebar, drawer, header controls, context menus,
breadcrumbs, filters, pagination, mobile entity card, authentication states,
long labels, focus, and horizontal overflow. Playwright execution results are
recorded with the final Phase 1 validation command.

### Environmental constraints

- The official shadcn registry is blocked by a local self-signed certificate.
  SSL verification was not disabled and the registry was not retried.
- If Playwright cannot use a compatible installed browser, this document records
  the exact error rather than treating browser verification as passed.

### 2026-07-21 results

- Formatting: passed with `corepack pnpm dlx prettier@3.5.3 --write src scripts docs`.
- ESLint: passed with `corepack pnpm lint`.
- TypeScript: passed with `corepack pnpm typecheck`.
- Token and navigation checks: passed with `corepack pnpm check:tokens` and
  `corepack pnpm check:routes`.
- Unit/component suite: passed with `corepack pnpm test` - 18 test files and
  25 tests.
- Production build: passed with `corepack pnpm build`.
- Playwright: passed with the installed Microsoft Edge stable channel:
  `corepack pnpm exec playwright test --project=msedge` - 5 tests passed.
  It verified auth routes at 1440px and 768px, sidebar and permission state at
  1024px, mobile navigation at 390px, no horizontal overflow, and no browser
  console errors. Edge was detected at
  `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.

  The Playwright-managed Chromium download remains blocked by
  `SELF_SIGNED_CERT_IN_CHAIN`, but no browser download or SSL configuration is
  needed for the Edge project.

### 2026-07-21 Phase 2 results

- Formatting: passed with `corepack pnpm dlx prettier@3.5.3 --check src docs scripts e2e`.
- ESLint and TypeScript: passed with `corepack pnpm lint` and
  `corepack pnpm typecheck`.
- Design token and route checks: passed with `corepack pnpm check:tokens` and
  `corepack pnpm check:routes`.
- Unit/component suite: passed with `corepack pnpm test` — 22 test files and
  34 tests, including tenant and client URL filters, tenant creation,
  visible support access, permission denial, and
  validated session-local work-group creation.
- Production build: passed with `corepack pnpm build`.
- Playwright: passed with the installed Microsoft Edge stable channel using
  `corepack pnpm exec playwright test --project=msedge` — 8 tests passed.
  The suite exercised authentication, tenant isolation, permission boundaries,
  tenant creation route wiring, controlled support access, client detail,
  work-group creation, employee mobile cards, navigation, and no horizontal
  overflow at 1440px, 1024px, 768px, and 390px. The page-health checks found no
  browser console errors at the validated page loads.

  Next.js dev server emitted its documented future `allowedDevOrigins` warning
  for `127.0.0.1` requests. It is a development-server notice, not a browser
  console error; no configuration was changed as part of this frontend phase.

### 2026-07-21 subscription-model removal

- Removed the subscription-plan model from Super Admin navigation, tenant
  records, mock fixtures, reports, platform overview, configuration, and tests.
  Client-requested Service Engagement and Work Group workflows remain in place.
- Formatting, ESLint, TypeScript, token checks, and route checks passed.
- Unit/component suite: 21 test files and 33 tests passed.
- Production build passed.
- Playwright: 8 Microsoft Edge tests passed at the existing desktop, tablet,
  and mobile viewports. The development-server `allowedDevOrigins` notice
  remains non-blocking.

### 2026-07-21 Phase 3 operational workflows

- Formatting, ESLint, TypeScript, design-token checks, and route checks passed.
- Unit/component suite: 23 test files and 37 tests passed. It covers task
  filtering, assigned manager/employee/client scope, work-log validation,
  client finance/document isolation, task status/checklist controls, optional
  progress at 0% and 100%, tenant-disabled progress, and reduced-motion data.
- Production build passed.
- Playwright: 11 Microsoft Edge tests passed. Phase 3 checks covered manager
  review decisions at 1440px, employee task cards at 768px, client portal and
  invoices at 390px, and reports at 1280px without horizontal overflow or
  browser console errors.

  The Next.js development-server `allowedDevOrigins` warning for `127.0.0.1`
  remains a non-blocking development notice; SSL verification was not changed.

### 2026-07-22 Professional progress workflows

- Formatting, ESLint, TypeScript, design-token checks, and route checks passed.
- Unit/component suite: 28 test files and 46 tests passed, including scheduled
  work-log exclusions, client-visible progress isolation, and duplicate
  recognition prevention.
- Production build passed with `corepack pnpm build`.
- Playwright: 13 installed Microsoft Edge tests passed with
  `corepack pnpm exec playwright test --project=msedge`. The new workflow
  covers Employee work-log progress and achievements, Manager recognition,
  Client onboarding/deliverable approval at 390px, and Tenant policy settings.
  Existing desktop, tablet, mobile, permission, route, and overflow checks
  remain green.

  The development-server `allowedDevOrigins` notice for `127.0.0.1` remains
  non-blocking. No browser was downloaded and SSL verification was unchanged.

### 2026-07-22 global theme system

- Formatting: passed for the theme-system change set with
  `corepack pnpm dlx prettier@3.5.3 --write` and `--check`. Prettier was used
  through a temporary package runner; no project dependency was added.
- ESLint, TypeScript, design-token checks, and route checks passed with
  `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm check:tokens`,
  and `corepack pnpm check:routes`.
- Unit/component suite passed with `corepack pnpm test`: 29 test files and 53
  tests. This includes theme persistence/cooldown, reduced-motion suppression,
  owl rendering, overlay cleanup, and app-shell integration.
- Production build passed with `corepack pnpm build` after temporarily stopping
  and then restarting the local hot-reload server on port 4008.
- Installed Microsoft Edge stable browser verification passed at 1440px, 1280px,
  1024px, 768px, and 390px. It verified the header toggle, dark class,
  dark-page surface, owl visual, visible short-lived shooting-star overlay,
  no horizontal overflow, and no browser console errors. Light-ray and
  shooting-star transition screenshots were visually reviewed at 1440px.

### 2026-07-22 shooting-star and owl refinement

- Replaced the shared three-star 780ms effect with five configured individual
  star elements. Edge confirmed a fixed, non-transformed, pointer-event-free
  overlay; five distinct per-star computed transforms, delays, and durations;
  a 24px owl; overlay cleanup after 2.8 seconds; no overflow; and no console
  errors at 1440px, 1280px, 1024px, 768px, and 390px.
