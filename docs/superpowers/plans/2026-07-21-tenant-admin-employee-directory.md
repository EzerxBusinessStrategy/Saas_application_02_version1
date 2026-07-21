# Tenant Admin Employee Directory Implementation Plan

> **For Codex:** Execute this plan only after the user approves it. Do not commit or push changes.

**Goal:** Implement Tenant Admin → Workforce → All Employees as a responsive, accessible employee directory that follows the existing TailAdmin design system and adopts the Mint frame's workflow hierarchy only.

**Architecture:** Add typed workforce data and an employee-directory feature component. Reuse the workspace shell, page header, generic TanStack `DataTable`, status treatment, empty state, and route-level loading convention. Keep data mocked behind a pagination-ready contract until a tenant-scoped backend endpoint exists.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, existing shadcn/ui primitives, Lucide React, TanStack Table.

## Constraints

- Source UX reference: Figma `MDelQNl3KuQOUBPRQLeBMR`, node `107:5089` (`Team`).
- Mint informs page layout and directory workflow only; TailAdmin tokens remain authoritative for colours, typography, spacing, borders, cards, tables, sidebar, and header.
- Do not add replacement `Button`, `Card`, `Table`, `Input`, `Select`, or layout primitives.
- Tenant context must be established server-side by the eventual API; do not accept tenant identity from browser filter state.
- No commits or pushes.

## Proposed data contract

Create `src/types/workforce.ts`:

```ts
export type ExperienceLevel = "junior" | "mid" | "senior" | "lead";
export type Availability = "available" | "partially-available" | "unavailable";
export type EmploymentStatus = "active" | "on-leave" | "inactive";
export type WorkloadRisk = "balanced" | "at-risk" | "overloaded";

export type Employee = {
  id: string;
  code: string;
  name: string;
  avatarUrl?: string;
  department: string;
  categories: string[];
  skills: string[];
  experienceLevel: ExperienceLevel;
  manager: { id: string; name: string } | null;
  workload: {
    allocatedHours: number;
    capacityHours: number;
    risk: WorkloadRisk;
  };
  availability: Availability;
  employmentStatus: EmploymentStatus;
  workGroups: { id: string; name: string }[];
};

export type EmployeeDirectoryFilters = {
  query: string;
  department?: string;
  category?: string;
  managerId?: string;
  experienceLevel?: ExperienceLevel;
  availability?: Availability;
  employmentStatus?: EmploymentStatus;
  workloadRisk?: WorkloadRisk;
};
```

Provisional endpoint: `GET /api/tenant/workforce/employees`. The API derives tenant and caller from the authenticated server context and accepts `query`, each filter above, `cursor`, `limit`, and whitelisted `sort` values. It returns `{ data, page: { nextCursor, limit, total } }`; default `limit` is 25, maximum is 100. Filtering, pagination, and authorization belong on the server. The initial UI uses typed mock data with the same shape.

## Implementation steps

### 1. Add workforce types and deterministic mock data

**Files:**

- Create: `src/types/workforce.ts`
- Create: `src/mocks/workforce.ts`
- Create: `src/mocks/workforce.test.ts`

**Work:** Define the employee and filter contract above, then create a representative tenant-scoped mock directory with all required states: departments, categories, skills, levels, managers, workload risks, availability, statuses, work groups, and profile-image fallbacks.

**Verify:** Run `pnpm test -- src/mocks/workforce.test.ts`.

### 2. Add the directory feature by composing existing components

**Files:**

- Create: `src/components/workforce/employee-directory.tsx`
- Create: `src/components/workforce/employee-directory.test.tsx`
- Modify: `src/components/shared/status-badge.tsx`
- Modify: `src/components/shared/status-badge.test.tsx`

**Work:** Compose `PageHeader`, `Card`, `DataTable`, `StatusBadge`, `EmptyState`, Lucide icons, and existing TailAdmin tokens. Extend `StatusBadge`'s semantic mapping to cover availability, employment status, and workload risk rather than creating parallel badge components. Implement a responsive filter toolbar (search plus the seven required filters), a compact mobile summary, table columns for every required employee field, accessible labels/caption, keyboard-operable row actions, and the specified empty result state.

Do not introduce a generic Avatar primitive or a second table/filter primitive. Render profile images inside the employee table cell with an accessible initials fallback. Use native controls locally until a project-wide shadcn Input/Select adoption is separately approved.

**Verify:** Add tests for filtering, table semantics, empty state, and action labels; run the focused test file.

### 3. Route and navigation integration

**Files:**

- Modify: `src/app/(app)/[workspace]/[section]/page.tsx`
- Modify: `src/lib/nav.ts`
- Modify: `src/types/domain.ts`
- Modify: `src/lib/permissions.ts`
- Modify: `src/mocks/workspaces.ts`
- Modify: `src/app/(app)/[workspace]/loading.tsx`

**Work:** Add an `employees` section route which renders only for the Tenant Admin workspace, add a Workforce/Employees navigation entry, and provide an employee-directory-specific loading skeleton. Add a narrowly named employee-read permission and grant it to the intended tenant roles.

**Authorization decision required:** introducing `employee.read` changes the permission vocabulary and role policy. Before execution, record the decision in the repository ADR process or receive explicit approval to add it; frontend navigation filtering alone is not authorization.

**Verify:** Run `pnpm check:routes`, relevant permission tests, and route rendering tests.

### 4. Validate responsive and failure states

**Files:**

- Modify: `src/app/(app)/[workspace]/error.tsx` only if its existing global error presentation cannot serve this feature.
- Modify: `docs/figma/component-map.md`
- Modify: `docs/figma/design-audit.md`
- Modify: `docs/figma/implementation-log.md`

**Work:** Confirm desktop table behavior, horizontal-scroll fallback on tablet, filter stacking and summary on mobile, loading state, empty state, error route, and permission-denied state. Document Mint as an information-architecture reference only and record the unavailable Figma screenshot retrieval caused by MCP rate limiting.

**Verify:** Use Playwright at desktop, tablet, and mobile widths if local browser tooling is available; otherwise state the limitation precisely.

### 5. Run the required quality gates

**Files:** none expected beyond test updates.

**Work:** Format changed files and run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:tokens`, `pnpm check:routes`, and `pnpm build`. Do not report completion unless every required validation succeeds.
