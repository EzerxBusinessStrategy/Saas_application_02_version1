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

- The Tenant Admin Tasks section now shows the client service-request inbox
  (accept opens the employee allotment dialog, reject requires a remark) plus
  a Submitted-for-review tab for final task approval. The Create task action
  and the separate Service requests page were removed; the old route redirects
  to Tasks. Reuses PageHeader, ResponsiveTabs, Card, DataTable, Dialog,
  StatusBadge, and TaskDetailsDrawer. Figma MCP was not used.
- Client Active services lists every taken month with its price. This month
  due and next month due are the remaining open installments for those months.
  Total task amount is the sum of listed prices. Any billing discount is shown
  separately with the discount percent, then Amount due. Assigned employees are
  not shown to clients. The Service catalogue card was removed from this page
  because clients already tick services from Requests. Comments notify Tenant
  Admins and Owners with the client name. Reuses Card, StatusBadge, Button, and
  the existing textarea pattern. Figma MCP was not used.
