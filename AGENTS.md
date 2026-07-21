# Agent rules

1. Inspect before modifying and preserve the modular-monolith strategy unless an ADR is approved.
2. Do not alter module boundaries, tenant isolation, authentication, authorisation, public APIs, queues, caches, billing, audit controls, or infrastructure without an approved proposal and ADR.
3. Every tenant-owned operation must be tenant scoped; never trust a tenant ID supplied by an untrusted client.
4. Backend authorisation is mandatory; frontend permission checks are UX only.
5. Managers access assigned work groups only; employees access assigned or self-owned resources; client users access their own client account only.
6. Use approved business terminology, semantic naming, and the documents under `docs/architecture`.
7. Do not create cross-module repository access or log secrets/sensitive data; background jobs must be idempotent.
8. Use Figma MCP before implementing Figma-derived designs and shadcn MCP before creating new primitives.
9. Default to Server Components; keep client boundaries small and business logic outside presentational components.
10. Include permission and tenant-isolation tests; run lint, type checks, tests, and build before completion claims; report assumptions and unresolved risks.

---

# Figma-Driven Frontend Implementation Rules

## Objective

Build the complete frontend for this multi-tenant SaaS application using the
existing Figma references, existing implemented components, TailAdmin-derived
design tokens and the approved business architecture.

Do not stop frontend development merely because the Figma MCP Starter-plan rate
limit has been reached.

When an exact Figma frame cannot be accessed, continue by composing the screen
from the established design system and existing reusable components.

Clearly distinguish between:

- Figma-verified implementation
- Existing-design-system implementation
- Inferred implementation based on product requirements

Never claim that an inferred screen exactly matches an inaccessible Figma frame.

## Figma implementation workflow

For tasks involving Figma:

1. Use the connected Figma MCP server when access is available.
2. Use the installed Figma implementation skill.
3. Use the shadcn skill and inspect existing components before creating new primitives.
4. Apply frontend-design and web-design review guidance.
5. Apply accessibility requirements.
6. Use Playwright for browser verification when available.
7. Run verification commands before claiming completion.

Do not require the user to repeat the complete skills list for every frame.

## Figma rate-limit fallback mode

When Figma MCP is unavailable, rate-limited or blocked:

1. Do not repeatedly retry MCP calls.
2. Do not stop the complete frontend implementation.
3. Inspect all previously stored Figma information in `docs/figma/`,
   `docs/design-system/`, `public/`, existing screenshots, existing implemented
   components, Storybook stories, and previous design-token files.
4. Inspect all existing TailAdmin-derived components.
5. Use the implemented TailAdmin visual system as the source of truth.
6. Reuse already implemented page shells and component patterns.
7. Build missing screens from the existing design system and business requirements.
8. Record inaccessible frames in `docs/figma/pending-figma-verification.md`.
9. Mark inferred screens as `Design status: Pending Figma verification`.
10. Continue implementation unless a major design-system or architecture change is required.

Do not create a new visual style because a secondary Figma frame is inaccessible.

## Save Figma information when MCP is available

Whenever a Figma frame can be accessed, save the useful results locally so they
can be reused after rate limits are reached.

Update:

- `docs/figma/frame-inventory.md`
- `docs/figma/component-map.md`
- `docs/figma/implementation-log.md`
- `docs/figma/visual-differences.md`

For each frame, record the Figma file name, frame name, node ID, application
route, intended user role, screenshot and design-context availability, reusable
components, implementation status, and visual-verification status.

Do not depend on being able to call Figma MCP again later.

## Design-source priority

TailAdmin is the primary visual design system.

TailAdmin controls colours, typography, spacing, border radius, shadows,
buttons, inputs, cards, tables, navigation, drawers, dialogs, chart
containers, loading states, empty states, error states, and responsive
behaviour.

Secondary Figma files provide layout, workflow and information-hierarchy
references only:

- NEATLAB: Super Admin
- CRM Dashboard: Client management
- Dashlab: Reports and analytics
- Mint: Workforce
- Themesberg: Authentication, forms and settings
- DashboardX: Mobile and missing UX patterns

Secondary references must be translated into the established TailAdmin-based
design system. They must not introduce independent colour, typography, button,
card, input, table, sidebar, spacing, or chart-container systems.

## Existing Figma frames

Use every Figma frame that has already been successfully inspected. For each
accessible or previously inspected frame:

1. Identify what is actually present in the frame.
2. Map its sections to this SaaS domain.
3. Reuse useful page structure and information hierarchy.
4. Translate it into the TailAdmin-based design language.
5. Implement the applicable full frontend screen.
6. Do not copy irrelevant ecommerce, CRM or generic admin terminology.
7. Do not copy sample values directly into production components.

Terminology examples:

- Customer: Client
- Deal: Service Engagement
- Project: Service Engagement or Work Group
- Team Member: Employee
- Team Leader: Manager
- Company or Account: Tenant
- Revenue: Subscription revenue or client billing
- Activity: Audit activity or client activity timeline

## Missing-screen implementation

Many required application screens may not have exact Figma frames. Create them
using existing TailAdmin-based design tokens, the application shell, reusable
components, the nearest approved secondary reference, the documented business
workflow, and consistent responsive/accessibility rules.

Do not leave required application routes empty merely because an exact Figma
frame does not exist. Do not produce dozens of visually duplicated pages. Use
reusable feature components and configurable screen compositions.

## Component-reuse rules

Before creating a component:

1. Search the repository.
2. Search existing shadcn components.
3. Inspect the existing component API.
4. Reuse or extend the existing component when responsibilities match.
5. Create a new component only when the responsibility is genuinely different.

Never create duplicates such as `SuperAdminMetricCard`, `NeatlabMetricCard`,
`DashlabChartCard`, `CrmDataTable`, or `MintStatusBadge`.

Prefer shared components such as `MetricCard`, `ChartCard`, `DataTable`,
`StatusBadge`, `PageHeader`, `EntityHeader`, `EmptyState`, `ErrorState`, and
`TaskDetailsDrawer`. Business-specific chart compositions and table columns may
live in feature folders, but generic primitives must remain shared.

## Approved frontend stack

Use Next.js App Router, React, TypeScript strict mode, Tailwind CSS, shadcn/ui,
Lucide React, TanStack Query, TanStack Table, React Hook Form, Zod, Recharts
through existing shadcn Chart primitives, Zustand only for local UI state,
Motion only for restrained micro-interactions, dnd-kit, date-fns, Sonner,
Playwright, Vitest, and React Testing Library.

Do not add a second library for an already solved responsibility without
documented justification.

## Full frontend scope

Implement the complete frontend foundation and required screens.

### Authentication

- Login
- Forgot password
- Reset password
- Accept invitation
- Session-expired state
- No-permission state

### Super Admin

- Platform Overview
- Tenant List, Details, and Creation
- Subscription Plans and Tenant Subscriptions
- Global Reports and Audit Logs
- Platform Configuration
- Controlled Support Access

### Tenant Admin

- Tenant Overview
- Client List, Details, Contacts, and Service Engagements
- Work Groups and Task Management
- Employee Directory and Profile
- Manager Directory
- Departments, Categories, Skills, and Capacity Planning
- Invoices, Payments, Agreements, and Documents
- Reports, Branding Settings, Users and Roles, Notification Settings, and Organisation Settings

### Manager

- Manager Overview
- Assigned Clients, Work Groups, and Employees
- Task List, Board, and Details
- Work Logs, Review Queue, Approval Queue, Team Workload, and Manager Reports

### Employee

- My Day, My Tasks, Current Task, and Task Details
- Daily Work Logs, Timesheet, Calendar, Documents, Notifications, and Profile

### Client Portal

- Client Overview
- Active Services, Service Progress, and Requests
- Invoices, Payments, Agreements, Documents, and Support

## Data and API rules

Until backend API contracts are final:

1. Use typed provisional contracts.
2. Use Zod schemas where runtime validation is useful.
3. Keep mock data in `src/mocks`.
4. Keep API functions in feature-level `api` folders.
5. Do not place mock data directly inside page components.
6. Keep mock and real API implementations replaceable.
7. Document assumptions in `docs/api/provisional-contracts.md`.
8. Do not claim provisional contracts are final backend contracts.

Use TanStack Query for server state. Use Zustand only for sidebar state,
command menu, drawers, temporary UI preferences, and local selection state.
Do not store all clients, employees, tasks, invoices, or payments in Zustand.

## Permission-aware frontend

Support these roles:

- SUPER_ADMIN
- TENANT_OWNER
- TENANT_ADMIN
- FINANCE_USER
- HR_OPERATIONS_USER
- MANAGER
- EMPLOYEE
- CLIENT_USER

The frontend must hide unauthorised navigation and actions, show
permission-denied states, restrict manager UI to assigned work groups, restrict
employees to assigned or self-owned work, restrict client users to their own
client account, restrict finance information to authorised roles, and keep
Super Admin support access visibly audited.

Frontend permission checks are user-experience controls only. Backend
enforcement remains mandatory.

## Responsive requirements

Desktop: persistent or collapsible sidebar, full tables, multi-column
dashboards, and contextual right-side drawers.

Tablet: collapsible sidebar, reduced dashboard columns, responsive tables, and
wider drawers.

Mobile: sidebar becomes a sheet or drawer; employee, manager, and client portal
may use bottom navigation; forms become single-column; tables use compact card
alternatives when necessary; important task actions remain touch-accessible;
charts remain readable; and no miniature unreadable dashboards.

## Required UI states

Every major screen must include loading, background-refresh where relevant,
empty, filtered-empty, error, permission-denied, not-found, disabled, and
mobile states.

Do not use only a generic spinner. Use skeletons that resemble the final
screen.

## Figma inspection approval rule

Do not request approval for ordinary screen implementation that reuses the
established TailAdmin design system, existing components, approved routes, and
business requirements without changing architecture.

Request approval only before replacing the primary design system, changing core
design tokens, replacing shared primitives, adding a new chart library,
changing application or route architecture, creating a competing component
system, introducing a major dependency, or changing role/permission
architecture.

## Validation requirements

After implementation:

- Run formatting, linting, TypeScript checks, relevant unit and component tests,
  and the production build.
- Run Playwright for responsive and visual verification when the browser is available.
- Report commands that could not run.
- Do not claim completion when required validation fails.

If Playwright or shadcn downloads are blocked by a certificate-chain error,
report the blocker clearly, continue with validation that can run locally, do
not weaken SSL verification, and do not claim blocked tests passed.

## Anti-AI frontend quality standard

For every frontend task, read and follow:

`docs/design-system/anti-ai-frontend-quality-standards.md`

This standard is mandatory.

The frontend must not contain:

- Generic AI-generated dashboard styling
- Random gradients, glow, or glassmorphism
- Repetitive template layouts
- Decorative charts without business purpose
- Inconsistent spacing, typography, icons, radius, or shadows
- Duplicate components
- Placeholder-quality content
- Broken mobile layouts
- Missing loading, empty, error, or permission states
- Console, TypeScript, lint, hydration, or build errors
- Unverified claims of completion

Do not mark a frontend task complete until it has been checked for:

- Visual consistency
- Alignment and spacing
- Responsive behaviour
- Accessibility
- Interaction states
- Long-content handling
- Permission behaviour
- Component reuse
- Type safety
- Technical validation

TailAdmin remains the primary visual design system.

Figma references may influence layout and workflow, but they must not create a
separate visual language.

When Figma MCP is unavailable, continue using the established TailAdmin-based
design system and mark the screen as pending Figma verification.

Never describe an inferred implementation as pixel-perfect or Figma-verified.
