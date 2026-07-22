# Super Admin Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve alignment, role context, and restrained interaction quality across Super Admin screens without changing other role portals.

**Architecture:** Extend existing shared components with optional styling hooks, then opt into the refinements only from Super Admin compositions. Keep motion in the existing global TailAdmin stylesheet and use existing Card, Badge, Button, DataTable, PageHeader, and Lucide components.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, existing shadcn components, Vitest, Playwright.

## Global Constraints

- TailAdmin remains the visual source of truth.
- Do not change routes, permissions, mock data, or other role portals.
- Do not add dependencies, subscription-plan UI, or a second animation system.
- Motion must be subtle and disabled by `prefers-reduced-motion`.
- Do not commit changes.

---

### Task 1: Add scoped shared-component hooks

**Files:**

- Modify: `src/components/shared/page-header.tsx`
- Modify: `src/components/shared/status-badge.tsx`
- Modify: `src/components/operations/data-table.tsx`
- Modify: `src/components/dashboard/chart-card.tsx`
- Test: `src/components/shared/page-header.test.tsx`

**Interfaces:**

- `PageHeader` adds `eyebrowIcon?: LucideIcon`.
- `StatusBadge` adds `className?: string`.
- `DataTable` and `ChartCard` add `className?: string`.

- [ ] **Step 1: Add a failing role-context test**

```tsx
render(<PageHeader eyebrow="Super Admin" eyebrowIcon={ShieldCheck} title="Platform overview" />);
expect(screen.getByLabelText("Page context: Super Admin")).toBeInTheDocument();
```

- [ ] **Step 2: Add optional hooks without changing default rendering**

```tsx
const EyebrowIcon = eyebrowIcon;
<p aria-label={EyebrowIcon ? `Page context: ${eyebrow}` : undefined}>
  {EyebrowIcon ? <EyebrowIcon aria-hidden="true" /> : null}
  {eyebrow}
</p>
```

- [ ] **Step 3: Verify shared-component tests**

Run: `corepack pnpm exec vitest run src/components/shared/page-header.test.tsx src/components/shared/status-badge.test.tsx`

Expected: both files pass.

### Task 2: Apply Super Admin-only alignment and interaction polish

**Files:**

- Modify: `src/app/globals.css`
- Modify: `src/components/dashboard/platform-overview-dashboard.tsx`
- Modify: `src/components/dashboard/metric-card.tsx`
- Modify: `src/components/administration/platform-administration.tsx`
- Modify: `src/components/administration/tenant-management.tsx`
- Modify: `src/components/app-shell/notification-menu.tsx`
- Test: `src/components/dashboard/platform-overview-dashboard.test.tsx`

**Interfaces:**

- `.super-admin-portal` scopes button feedback.
- `.super-admin-surface`, `.super-admin-row`, `.super-admin-table`, and `.super-admin-signal` scope visual behavior.

- [ ] **Step 1: Add failing dashboard structure assertions**

```tsx
expect(screen.getByLabelText("Page context: Super Admin")).toBeInTheDocument();
expect(container.querySelectorAll(".super-admin-signal")).toHaveLength(3);
expect(screen.getByText("on track").closest("li")).toHaveClass("items-center");
```

- [ ] **Step 2: Align list rows and status badges**

```tsx
<li className="super-admin-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
  <div className="min-w-0">...</div>
  <StatusBadge className="shrink-0 whitespace-nowrap" status={status} />
</li>
```

- [ ] **Step 3: Add four restrained signal animations and scoped hover feedback**

```css
.super-admin-signal { animation: super-admin-signal 1600ms ease-in-out infinite; }
.super-admin-surface:hover { transform: translateY(-1px); }
.super-admin-portal button:not(:disabled):active { transform: translateY(0); }
```

- [ ] **Step 4: Apply role markers and scoped table/card classes to Super Admin screens**

```tsx
<PageHeader eyebrow="Super Admin" eyebrowIcon={ShieldCheck} ... />
<DataTable className="super-admin-table" ... />
```

- [ ] **Step 5: Verify focused dashboard and shell tests**

Run: `corepack pnpm exec vitest run src/components/dashboard/platform-overview-dashboard.test.tsx src/components/app-shell/notification-menu.test.tsx`

Expected: both files pass.

### Task 3: Validate responsive and reduced-motion behavior

**Files:**

- Modify: `e2e/phase2-administration.spec.ts`

**Interfaces:**

- Browser checks use the existing `msedge` Playwright project.

- [ ] **Step 1: Verify the role badge, aligned statuses, and reduced-motion fallback**

```ts
await expect(page.getByLabel("Page context: Super Admin")).toBeVisible();
await page.emulateMedia({ reducedMotion: "reduce" });
expect(await page.locator(".super-admin-signal").first().evaluate((node) => getComputedStyle(node).animationDuration)).toBe("0.00001s");
```

- [ ] **Step 2: Check 1440px, 1280px, 1024px, 768px, and 390px for overflow**

Run: `corepack pnpm exec playwright test e2e/phase2-administration.spec.ts --project=msedge`

Expected: all Phase 2 Edge tests pass.

- [ ] **Step 3: Run the full quality gate**

Run: Prettier, ESLint, TypeScript, unit/component tests, production build, and `corepack pnpm exec playwright test --project=msedge`.

Expected: every command exits 0.
