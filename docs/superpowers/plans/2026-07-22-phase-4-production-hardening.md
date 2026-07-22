# Phase 4 Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the confirmed Phase 4 frontend usability, accessibility, interaction, and verification gaps without changing the approved route, authentication, or permission architecture.

**Architecture:** Keep the App Router workspace dispatch, TailAdmin token system, typed mock API boundaries, and existing shared components. Feature-level screens own business interactions; no new design-system primitive or dependency is introduced. Authentication remains explicitly mock-only, because replacing it requires an approved backend/authentication design.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, shadcn-style local primitives, TanStack Query, date-fns, Vitest, Playwright with installed Microsoft Edge.

## Global Constraints

- Do not restore subscription plans; client-requested Service Engagements and Work Groups remain the delivery model.
- Reuse the existing TailAdmin-derived tokens, `PageHeader`, `Card`, `Button`, `StatusBadge`, `EmptyState`, and `LoadingState` components.
- Do not add dependencies, weaken SSL, replace shared primitives, or change authentication/permission architecture.
- Preserve mock-versus-backend boundaries and label session-local behaviour honestly.
- Validate at desktop, tablet, and mobile breakpoints with the installed Edge project.

---

### Task 1: Replace the employee milestone list with an accessible calendar view

**Files:**

- Modify: `src/components/operations/employee-workspace.tsx`
- Create: `src/components/operations/employee-workspace.test.tsx`

**Interfaces:**

- Consumes: `milestones: Array<{ id: string; label: string; date: string; complete: boolean }>` from `getOperationalWorkspace("employee")`.
- Produces: a month grid with previous/next month controls, per-day milestone links, an accessible event summary, and the existing compact list as the mobile fallback.

- [x] **Step 1: Write component tests**

```tsx
render(<EmployeeWorkspace section="calendar" />);
expect(
  await screen.findByRole("table", { name: /delivery calendar/i }),
).toBeInTheDocument();
expect(screen.getByRole("button", { name: /next month/i })).toBeInTheDocument();
expect(
  screen.getByText("Northstar onboarding evidence complete"),
).toBeInTheDocument();
```

- [x] **Step 2: Run focused calendar coverage.**

Run: `corepack pnpm test -- src/components/operations/employee-workspace.test.tsx`

- [x] **Step 3: Implement the smallest calendar composition**

```tsx
const days = eachDayOfInterval({ start, end });
<table aria-label="Delivery calendar for July 2026">...</table>;
```

Use `date-fns` to calculate the displayed month. Render only assigned milestones, include text plus status badges, use native buttons for month navigation, and retain a readable milestone list below the grid on narrow screens.

- [x] **Step 4: Run the focused test and verify it passes.**

### Task 2: Repair report comprehension and inert dashboard controls

**Files:**

- Modify: `src/components/administration/platform-administration.tsx`
- Modify: `src/components/dashboard/platform-overview-dashboard.tsx`
- Modify: `src/components/dashboard/platform-overview-dashboard.test.tsx`

**Interfaces:**

- Consumes: `platformOverview.tenantHealth` typed tenant-health data.
- Produces: labelled chart axes and a non-interactive reporting-period label instead of a button with no action.

- [x] **Step 1: Add regression assertions**

```tsx
expect(screen.getByText("Northstar Labs")).toBeInTheDocument();
expect(
  screen.queryByRole("button", { name: /last 30 days/i }),
).not.toBeInTheDocument();
```

- [x] **Step 2: Run focused dashboard coverage.**

Run: `corepack pnpm test -- src/components/dashboard/platform-overview-dashboard.test.tsx`

- [x] **Step 3: Make the chart legible and remove the fake control**

```tsx
<XAxis dataKey="name" interval={0} />
<p aria-label="Reporting period">Last 30 days</p>
```

Retain the existing TailAdmin `ChartCard`, Recharts chart, text summary, and responsive styling. Do not add a second chart component.

- [x] **Step 4: Run the focused test and verify it passes.**

### Task 3: Make visible employee, manager, and client actions truthful

**Files:**

- Modify: `src/components/operations/employee-workspace.tsx`
- Modify: `src/components/operations/manager-workspace.tsx`
- Modify: `src/components/operations/client-portal.tsx`
- Create: `src/components/operations/role-workspace-actions.test.tsx`

**Interfaces:**

- Consumes: existing workspace routes and typed client request fixtures.
- Produces: route links for navigation actions and explicit session-local feedback for actions that are not backed by a mutation API.

- [x] **Step 1: Add visible-action outcome tests**

```tsx
expect(screen.getByRole("link", { name: /add work log/i })).toHaveAttribute(
  "href",
  "/employee/work-logs",
);
fireEvent.click(screen.getByRole("button", { name: /mark updates reviewed/i }));
expect(screen.getByText(/updates marked as reviewed/i)).toBeInTheDocument();
```

- [x] **Step 2: Run focused visible-action coverage.**

Run: `corepack pnpm test -- src/components/operations/role-workspace-actions.test.tsx`

- [x] **Step 3: Implement only real navigation or explicit mock feedback**

Use `Link` with the existing `Button` component for work-log/task navigation. Record manager notification acknowledgement and client support-request preparation only in the current mock session, with `role="status"` feedback. Do not imply a backend write.

- [x] **Step 4: Run the focused test and verify it passes.**

### Task 4: Add regression coverage and update Phase 4 readiness records

**Files:**

- Modify: `e2e/phase3-operational.spec.ts`
- Modify: `docs/frontend/full-frontend-gap-analysis.md`
- Modify: `docs/frontend/frontend-implementation-plan.md`
- Modify: `docs/frontend/frontend-status.md`
- Create: `docs/frontend/production-readiness.md`
- Modify: `docs/testing/frontend-validation.md`
- Modify: `docs/testing/e2e-coverage.md`

**Interfaces:**

- Consumes: the implemented calendar, chart, role-workspace actions, route registry, existing validation scripts, and Edge Playwright project.
- Produces: a truthful route-completeness matrix, confirmation of known backend blockers, and a representative browser regression test.

- [x] **Step 1: Add a Playwright calendar assertion at mobile width**

```ts
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("/employee/calendar");
await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
await expect(page.locator("body")).toHaveJSProperty(
  "scrollWidth",
  expect.any(Number),
);
```

- [x] **Step 2: Update documentation with the actual route and mock-integration status**

Record that login is form-only, backend authorization is still mandatory, Figma verification is pending due to the documented rate limit, and Tenant Owner/Finance/HR personas require an approved access-model decision before routes can be added.

- [x] **Step 3: Run complete validation**

Run: `corepack pnpm dlx prettier@3.5.3 --write src docs e2e`

Run: `corepack pnpm lint`

Run: `corepack pnpm typecheck`

Run: `corepack pnpm test`

Run: `corepack pnpm check:tokens`

Run: `corepack pnpm check:routes`

Run: `corepack pnpm build`

Run: `corepack pnpm exec playwright test --project=msedge`

Result: all listed formatting, static, unit, build, and installed-Edge browser
checks passed. `corepack pnpm audit --prod` is externally blocked by
`ECONNREFUSED 127.0.0.1:9`; no SSL or proxy bypass was used.
