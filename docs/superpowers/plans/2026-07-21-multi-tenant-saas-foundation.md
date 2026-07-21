# Multi-tenant SaaS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable, role-aware Next.js frontend foundation with reusable SaaS UI, typed mock data, representative operational views, validation, and setup documentation.

**Architecture:** A server-rendered App Router shell selects a typed workspace configuration from the URL and keeps interactive pieces inside small client components. Domain fixtures live in `src/mocks`; permissions, navigation, tenant theming, and UI primitives are shared libraries. A single reusable operational workspace renders list, board, and detail views without duplicating feature UI.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Tailwind CSS, Radix primitives, TanStack Query/Table, React Hook Form, Zod, Zustand, Recharts, Motion, dnd-kit, next-themes, Sonner, Vitest, Testing Library, Playwright.

## Global Constraints

- Use Figma MCP before implementing a supplied Figma frame; none was supplied for this implementation.
- Use semantic CSS tokens; feature components must not hardcode repeated design values.
- Keep server components as default and client boundaries focused.
- Keep API data out of Zustand and use typed mock data while no API URL is supplied.
- Frontend permissions only shape the UI; backend enforcement remains required.
- Include keyboard focus, responsive behavior, reduced motion, and loading/empty/error states.
- Do not store credentials in the repository.

---

### Task 1: Establish the application and documentation baseline

**Files:**

- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `components.json`, `.env.example`
- Create: `.vscode/mcp.json`, `.vscode/settings.json`, `.vscode/extensions.json`, `AGENTS.md`, `README.md`
- Create: `docs/architecture/repository-audit.md`, `docs/mcp/setup.md`, `docs/figma/pending-figma-input.md`

- [ ] Define strict TypeScript, development, lint, unit-test, e2e, Storybook, and build scripts.
- [ ] Configure the requested project-local MCP servers without secrets.
- [ ] Record the empty-workspace audit, unavailable Figma input, MCP status, and project decisions.
- [ ] Verify JSON and TypeScript configuration can be read by the selected package manager.

### Task 2: Build foundation libraries and UI primitives

**Files:**

- Create: `src/lib/{utils,permissions,tenant-theme,formatters,nav}.ts`
- Create: `src/types/{domain,navigation}.ts`, `src/mocks/{tenant,workspaces,operations}.ts`
- Create: `src/components/ui/*`, `src/components/shared/*`, `src/components/providers.tsx`
- Create: `src/app/layout.tsx`, `src/app/globals.css`

- [ ] Define role, permission, tenant-theme, navigation, table-row, and dashboard types.
- [ ] Implement permission checks, navigation filtering, tenant-color validation, and accessible primitive components.
- [ ] Add tenant-aware theme variables and a single query/theme/toast provider boundary.
- [ ] Add direct unit tests for permissions, theming, navigation, and status mappings.

### Task 3: Implement app shell and workspace dashboards

**Files:**

- Create: `src/components/app-shell/*`, `src/components/dashboard/*`
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/[workspace]/page.tsx`, `src/app/page.tsx`
- Create: `src/app/(auth)/*/page.tsx`

- [ ] Render a typed, permission-filtered sidebar, header, user menu, search dialog, responsive navigation, breadcrumbs, and skip link.
- [ ] Render five data-driven dashboards for Super Admin, Tenant Admin, Manager, Employee, and Client personas.
- [ ] Add loading, error, and not-found boundaries plus client-visible no-permission states.
- [ ] Verify all dashboard variants render from the same shell with different navigation and metrics.

### Task 4: Implement representative operational UI

**Files:**

- Create: `src/components/operations/{data-table,task-board,task-card,task-drawer,entity-list}.tsx`
- Create: `src/app/(app)/[workspace]/[section]/page.tsx`
- Create: `src/app/(app)/[workspace]/tasks/page.tsx`

- [ ] Create reusable searchable data tables with empty, loading, and error states.
- [ ] Create task list, board, calendar-ready status grouping, and an accessible detail dialog using typed mock tasks.
- [ ] Use route metadata and permission boundaries to block unauthorised sections.
- [ ] Verify tenant/user/client operational routes display only their permitted mock content.

### Task 5: Add quality controls and handoff material

**Files:**

- Create: `vitest.config.ts`, `playwright.config.ts`, `src/**/*.test.ts(x)`, `e2e/*.spec.ts`
- Create: `.storybook/{main.ts,preview.tsx}`, `src/components/**/*.stories.tsx`
- Create: `docs/{architecture,design-system,figma,testing}/*.md`, `scripts/*.ts`, `public/branding/*.svg`

- [ ] Add focused unit/component/e2e coverage for permission checks, theming, task display, and tenant isolation UI.
- [ ] Add concise documentation for architecture, routing, tenant theming, design tokens, accessibility, testing, Figma status, and visual regression process.
- [ ] Add lightweight token and route-permission check scripts.
- [ ] Install dependencies and run lint, type check, tests, Storybook build, Playwright, and production build; document any environment blockers.

## Self-review

The plan covers the required foundation, role-aware dashboards, shared table/task UI, MCP setup, testing, documentation, and build validation. It intentionally does not pretend to implement a Figma frame without its URL, and collapses the long list of feature routes into one typed, reusable operational route until real APIs and frames define feature-specific behavior.
