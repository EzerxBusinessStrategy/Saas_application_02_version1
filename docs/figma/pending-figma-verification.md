# Pending Figma verification

- Dashlab Reports node `601:3646`: unavailable because Figma MCP is
  rate-limited; reports compositions remain Pending Figma verification.
- Mint Workforce node `107:5089`: structured context was retrieved, but the
  screenshot is unavailable due to the same rate limit; workforce screens remain
  Pending Figma verification.

## Phase 1 app-shell and foundation compositions

Design status: Pending Figma verification.

Figma MCP is rate limited. The expanded/collapsed sidebar, header controls,
menus, breadcrumbs, filters, pagination, mobile entity cards, and auth states
were composed from existing TailAdmin-derived tokens and local reusable
components. They are not claimed to be pixel-perfect or Figma-verified.

## Phase 2 administration compositions

Design status: Pending Figma verification.

- Super Admin tenant management, tenant detail, tenant creation, reports,
  global audit logs, and platform configuration
  use the existing TailAdmin system and the previously recorded NEATLAB
  hierarchy only. Audit sort and pagination remain a TailAdmin-based inferred
  implementation.
- Tenant Admin overview, client management, work groups, employee profile,
  manager directory, organisation structure, capacity planning, and tenant
  settings retain TailAdmin visual rules while applying previously recorded CRM
  and Mint workflow ideas.
- Figma MCP was not retried after the documented rate limit. These screens are
  inferred design-system implementations, not pixel-perfect Figma matches.

## Phase 3 operational compositions

Design status: Pending Figma verification.

- Task delivery, manager, employee, finance, reports, and client portal
  workflows are inferred TailAdmin-based implementations. The existing Mint
  workforce and Dashlab reporting references were used only for previously
  recorded hierarchy guidance; Figma MCP was not retried while rate limited.

## Phase 4 hardening compositions

Design status: Pending Figma verification.

- The Employee Calendar month view, tenant-scoped audit screen, and report
  label refinements use existing TailAdmin tokens and responsive patterns.
  They are inferred design-system implementations, not pixel-perfect Figma
  matches.
- The client Task calendar reuses the tenant calendar workspace: month, week,
  and agenda views, compact day cells, click-to-select days, overflow lists,
  hover previews, and a task detail drawer. Client filters are Search,
  Service, Assigned to, More filters (due window, frequency, priority), and
  quick chips (All, Due soon, Overdue, This month). Status is toggled from
  the Scheduled / In progress / Completed KPI cards, not a Status dropdown.
  Event cards show title, service, and assignee · status. Data still comes
  from `/api/client-portal/task-calendar`. Design status: Pending Figma
  verification.

## Professional progress compositions

Design status: Pending Figma verification.

- Daily progress, work-log completion, achievements, recognition, onboarding,
  deliverable review, and policy settings reuse existing TailAdmin cards,
  dialogs, controls, badges, and responsive layouts. Figma MCP was not retried
  while rate limited.

## Service blueprint activation compositions

Design status: Pending Figma verification.

- Service task booklet editor, employee services-handled mapping, client
  service onboarding wizard (select, customize, assign, review/activate), and
  client portal active-service enrichment reuse existing TailAdmin cards,
  dialogs, tables, buttons, and empty states. Figma MCP was not used for these
  screens. They are inferred design-system implementations, not pixel-perfect
  Figma matches.

## Tenant dashboard date filter and request comments

Design status: Pending Figma verification.

- Tenant Admin operations overview date-range filter (presets and custom From/To)
  reuses PageHeader, FilterToolbar, Input, Select, and Button. Metrics, deadlines,
  and activity are loaded from the tenant-scoped dashboard API for the selected
  dates. Figma MCP was not used.
- Client request send now opens ConfirmationDialog for a required comment. Tenant
  Service requests show that comment with the request. Figma MCP was not used.
- The client Request services dialog stacks each booklet task (include, name,
  frequency, due, price) using the same labelled field pattern as the service
  blueprint editor, so values stay readable in the dialog. Figma MCP was not used.

## Client portal date filter and catalogue requests

Design status: Pending Figma verification.

- Client portal overview, Active services, Requests, and Invoices include a
  date-range filter (presets and custom From/To) that reuses PageHeader,
  FilterToolbar, Input, Select, and Button. Metrics, services, requests, and
  invoices load from the client-scoped dashboard API for the selected dates.
  Pending and completed task counts come from that client's tasks in the same
  range. Open requests only count work still waiting (not leftover submitted
  requests after the service was activated). Figma MCP was not used.
- Client portal tick-and-send Requests and Tenant Admin Service requests
  reuse PageHeader, Card, Dialog, Button, ClientServiceCustomizer, and
  ServiceEmployeeSelector. Figma MCP was not used. They are inferred
  design-system implementations, not pixel-perfect Figma matches.

## Simplified tenant Tasks section and client catalogue

Design status: Pending Figma verification.

- The Tenant Admin Allocated work section lists live tasks after allotment
  (client, service, task, assigned employee, assigned at, due at, status).
  Row click reuses TaskDetailsDrawer. At-risk reasons open from the client
  overview count. Reuses PageHeader, Card, FilterToolbar, DataTable, DatePicker,
  SearchableFilterSelect, and Dialog. Figma MCP was not used.

  (accept opens the employee allotment dialog, reject requires a remark).
  Employee-submitted work is a separate Task review page under People & Teams,
  with the same TaskBoard drag targets as manager review (Returned and Done).
  Legacy `/admin/tasks?task=` notification links redirect to Task review.
  Reuses PageHeader, Card, DataTable, Dialog, StatusBadge, TaskBoard, and
  TaskDetailsDrawer. Figma MCP was not used.
- Client dashboard Active services use a compact 2/3 + 1/3 layout (services
  left, recent requests and upcoming billing right, `align-items: start`).
  Compact cards show status as Active (not On track), next due, assigned
  employee, progress, and a compact billing strip from the dashboard API.
  Task lists and the message form open in a drawer/dialog, not on every
  dashboard card. Duplicate engagement/service titles are collapsed. Money
  amounts omit forced `.00`. Reuses Card, Badge, Button, Dialog, EmptyState,
  and Link. Figma MCP was not used.
- Client Active services is a two-column service portfolio (one card per
  service). Filters are Search, Status, Assigned to, and one compact date-range
  control with presets inside the popover. Cards show next due, assignee,
  progress as completed-of-total, and a billing strip. Tasks open in a service
  drawer (Overview / Tasks / Billing). The message action is labelled Message
  team. Design status: Pending Figma verification.

## Optional related client on Tenant Admin document upload

Design status: Pending Figma verification.

- The Tenant Admin Upload document dialog lets a file go to a client, an
  employee, or both. Related client is optional for ordinary documents and
  still required for agreements. Reuses Dialog, Input, Select, and Button.
  Figma MCP was not used.

## Grouped invoicing

Design status: Pending Figma verification.

- Tenant Admin Invoices now shows Ready to bill group cards (Ready / Waiting)
  and a right-side Review & create drawer. Invoice list summaries use
  Service · N items. The client invoice list shows the same grouped summary
  and line items. Reuses PageHeader, Card, Dialog, Badge, Button, Input,
  Select, and DatePicker. Figma MCP was not used.

## Shared profile photo editor

Design status: Pending Figma verification.

- Profile photo crop, header avatar, and account photo controls were composed
  from the existing TailAdmin system. Figma MCP was not used.
