# Super Admin Platform Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Super Admin platform overview using NEATLAB `Analytics` (`23499:120079`) for information hierarchy while retaining the existing TailAdmin visual system.

**Architecture:** Keep `WorkspaceShell`, TailAdmin CSS tokens, and existing shared primitives unchanged. Introduce only missing composition components: a feature-neutral page header, chart card, and typed TanStack table; the Super Admin dashboard composes them from platform-scoped mock data.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS v4, existing shadcn-style `Card`/`Button`/`Badge`, Lucide React, TanStack Table, Recharts.

## Global Constraints

- Use NEATLAB only for layout, hierarchy, analytics arrangement, and workflows; do not copy its visual styling.
- Preserve TailAdmin tokens and reuse `WorkspaceShell`, `Card`, `Button`, `MetricCard`, and `StatusBadge`.
- Do not add a dependency, change tenant/permission rules, create duplicate primitives, commit, or push.
- Super Admin data is platform-scoped only; no tenant selector is trusted from the client.

---

### Task 1: Define typed platform overview data

**Files:**

- Create: `src/types/platform-overview.ts`
- Create: `src/mocks/platform-overview.ts`
- Test: `src/mocks/platform-overview.test.ts`

**Interfaces:**

- Produces `PlatformOverview`, `PlatformMetric`, `TenantHealthRow`, `SubscriptionSlice`, `PlatformActivity`, `PlatformAlert`, and `AuditEvent`.
- `platformOverview` exports the exact data consumed by `PlatformOverviewDashboard`.

- [x] **Step 1: Write the failing shape test**

```ts
import { expect, test } from "vitest";
import { platformOverview } from "@/mocks/platform-overview";

test("contains all required platform metrics", () => {
  expect(platformOverview.metrics.map((metric) => metric.label)).toEqual([
    "Total tenants",
    "Active tenants",
    "Suspended tenants",
    "Subscription revenue",
    "Active platform users",
  ]);
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `corepack pnpm test -- src/mocks/platform-overview.test.ts`

Expected: module-not-found failure for `@/mocks/platform-overview`.

- [x] **Step 3: Add the minimal typed fixture**

```ts
export const platformOverview: PlatformOverview = {
  metrics: [
    {
      label: "Total tenants",
      value: "52",
      trend: "up",
      change: "+4 this month",
    },
    {
      label: "Active tenants",
      value: "48",
      trend: "up",
      change: "92% of total",
    },
    {
      label: "Suspended tenants",
      value: "4",
      trend: "down",
      change: "2 require review",
    },
    {
      label: "Subscription revenue",
      value: "$182k",
      trend: "up",
      change: "+12.4%",
    },
    {
      label: "Active platform users",
      value: "2,843",
      trend: "up",
      change: "+8.1%",
    },
  ],
  tenantHealth: [],
  subscriptionDistribution: [],
  recentActivity: [],
  alerts: [],
  auditEvents: [],
  revenueTrend: [],
};
```

- [x] **Step 4: Run the focused test**

Run: `corepack pnpm test -- src/mocks/platform-overview.test.ts`

Expected: PASS.

### Task 2: Add only the missing reusable compositions

**Files:**

- Create: `src/components/shared/page-header.tsx`
- Create: `src/components/dashboard/chart-card.tsx`
- Create: `src/components/operations/data-table.tsx`
- Test: `src/components/shared/page-header.test.tsx`

**Interfaces:**

- `PageHeader({ eyebrow, title, description, actions? })` provides consistent page context without styling changes to primitives.
- `ChartCard({ title, description, children, action? })` composes the existing `Card` slots around a chart.
- `DataTable<TData>({ caption, columns, data, emptyState })` renders the existing TailAdmin table pattern using TanStack Table.

- [x] **Step 1: Write the failing header test**

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { PageHeader } from "@/components/shared/page-header";

test("renders dashboard context", () => {
  render(
    <PageHeader
      eyebrow="Platform"
      title="Platform overview"
      description="Tenant health across the platform"
    />,
  );
  expect(
    screen.getByRole("heading", { name: "Platform overview" }),
  ).toBeInTheDocument();
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `corepack pnpm test -- src/components/shared/page-header.test.tsx`

Expected: module-not-found failure for `@/components/shared/page-header`.

- [x] **Step 3: Implement compositions using existing primitives**

```tsx
export function ChartCard({ title, description, children }: ChartCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
```

- [x] **Step 4: Run the focused test**

Run: `corepack pnpm test -- src/components/shared/page-header.test.tsx`

Expected: PASS.

### Task 3: Compose the Super Admin dashboard

**Files:**

- Create: `src/components/dashboard/platform-overview-dashboard.tsx`
- Modify: `src/components/dashboard/dashboard.tsx`
- Modify: `src/app/(app)/[workspace]/loading.tsx`
- Test: `src/components/dashboard/platform-overview-dashboard.test.tsx`

**Interfaces:**

- `PlatformOverviewDashboard({ overview }: { overview: PlatformOverview })` renders the Super Admin-only overview.
- `Dashboard` routes `workspace === "super-admin"` to `PlatformOverviewDashboard`; all other workspace dashboards remain unchanged.

- [x] **Step 1: Write the failing composition test**

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { PlatformOverviewDashboard } from "@/components/dashboard/platform-overview-dashboard";
import { platformOverview } from "@/mocks/platform-overview";

test("renders all Super Admin dashboard sections", () => {
  render(<PlatformOverviewDashboard overview={platformOverview} />);
  expect(
    screen.getByRole("heading", { name: "Subscription distribution" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Global audit activity" }),
  ).toBeInTheDocument();
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `corepack pnpm test -- src/components/dashboard/platform-overview-dashboard.test.tsx`

Expected: module-not-found failure for `@/components/dashboard/platform-overview-dashboard`.

- [x] **Step 3: Implement this TailAdmin component hierarchy**

```text
PlatformOverviewDashboard
├── PageHeader: Platform Overview + period control
├── MetricCard strip: total, active, suspended, revenue, users
├── ChartCard: subscription revenue trend
├── ChartCard: subscription distribution
├── Card: tenant health
├── Card: recent platform activity
├── Card: platform alerts
└── DataTable: global audit activity
```

- [x] **Step 4: Run the focused test**

Run: `corepack pnpm test -- src/components/dashboard/platform-overview-dashboard.test.tsx`

Expected: PASS.

### Task 4: Record the reference and verify

**Files:**

- Modify: `docs/figma/design-audit.md`
- Modify: `docs/figma/component-map.md`
- Modify: `docs/figma/implementation-log.md`

- [x] Record NEATLAB frame `23499:120079`, its image-backed structured context, and its role as hierarchy-only reference.
- [x] Record that TailAdmin tokens/components remain unchanged and that all platform data is mock-only pending a platform API.
- [x] Run `corepack pnpm check:tokens`, `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, and `corepack pnpm build`.
