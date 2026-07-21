# Anti-AI Frontend Design & Zero-Sloppiness Standard

## Purpose

This standard is mandatory for every frontend page, component, state, and breakpoint. It prevents generic AI-dashboard styling, copied template workflows, placeholder-quality UI, duplicate components, broken responsiveness, and unverified completion claims.

## Product Design Principle

The interface must be intentionally designed for its role and business workflow. Every visual element must support information importance, frequency of use, accessibility, responsiveness, and maintainability. Do not ship a renamed template, a component-library demo, a decorative concept, or a prototype presented as production software.

## Zero-Sloppiness Rule

Do not mark work complete with misalignment, inconsistent spacing, unexplained unequal card heights, truncated labels without an alternative, wrapping buttons, mobile table overflow, missing hover/focus/disabled/loading states, placeholder copy, broken empty states, inconsistent icon sizing or radius, unclear hierarchy, unreadable charts, loading layout shifts, console/hydration/type/lint errors, broken keyboard navigation, missing accessible names, unverified breakpoints, fake functionality, or unhandled long and empty values.

Completion requires visual, interaction, responsive, accessibility, and technical verification.

## Anti-Generic-AI Rules

Do not automatically use identical KPI rows, gradient heroes, unjustified purple-blue gradients, pervasive glassmorphism, decorative blobs, glowing borders, vague marketing copy, repeated welcome areas, stock illustrations, decorative charts, nested cards, excess shadows, excess status pills, a card around every section, centred dense workflows, or empty premium-looking whitespace.

Do not merely rename Customer to Client, Project to Engagement, User to Employee, or Revenue to Billing while retaining an irrelevant workflow. Adapt information model, actions, filters, states, and permissions to the SaaS domain.

Every chart, metric, table column, badge, and progress indicator must answer a known business question for a known user and action. Define missing-data behaviour and remove decorative data displays.

## Design-System Authority

TailAdmin controls colours, typography, spacing, grid, radius, shadows, controls, cards, tables, navigation, overlays, charts, loading, empty states, and responsiveness. Secondary Figma files may influence hierarchy, composition, workflow, grouping, and interaction patterns only. They must never introduce a parallel colour, type, button, card, input, table, sidebar, spacing, or chart-container system.

## Visual and Layout Quality

Use existing token scales; do not use arbitrary spacing, colours, font sizes, weights, breakpoints, z-index values, or number formats. Align page headers, card titles, controls, icons, labels, table headers, values, and mobile edges to an intentional grid. Use semantic colour with text, sufficient contrast, accessible labels, and icons where useful; never colour alone.

Use table-first layouts for directories/logs, detail-first for profiles, board-first for task workflows, timeline-first for activity, form-first for creation/settings, and chart-first only for analytics. Operational interfaces should be compact without crowding. Cards group related information; do not card every element or nest cards without hierarchy.

## Component Rules

Before creating a component, search the repository, existing shadcn components, and feature components; inspect their APIs; reuse or extend matching responsibilities. Do not duplicate MetricCard, DataTable, StatusBadge, PageHeader, chart tooltip/legend, empty state, or role-specific generic primitives.

Shared components stay generic. Feature components own business mappings. APIs must be typed, predictable, minimal, composable, accessible, and consistent. Avoid boolean-prop explosions, huge multi-purpose components, `data: any`, untyped callbacks, hidden side effects, and style props that bypass the system.

## Interaction and State Rules

Every interactive element needs default, hover, focus-visible, active, disabled, loading where applicable, error handling where applicable, keyboard behaviour, and an accessible name. Buttons use specific labels, prevent duplicate submissions, show asynchronous progress, and preserve layout. Forms use visible labels, validation, clear errors, required indication, logical keyboard order, autocomplete, retained values on failure, and destructive confirmation.

Tables need appropriate search, filtering, sorting, pagination, row actions, loading skeletons, empty/filtered-empty/error states, long-content handling, and a mobile fallback. Never force a desktop table into a 390px viewport. Dialogs and drawers must trap and restore focus, support keyboard dismissal, have accessible titles/descriptions, and protect unsaved work.

Every major page needs loading, background refresh where relevant, success, empty, filtered-empty, error, permission-denied, not-found, disabled, offline/retry where relevant, and mobile states. Skeletons resemble final layouts. Empty states explain what is missing, why, and the next action. Errors provide safe recovery where possible.

## Responsive and Accessibility Rules

Verify 1440px, 1280px, 1024px, 768px, and 390px. Desktop uses width intentionally; tablet reduces columns without clipping actions; mobile uses one-column forms, readable charts, reachable actions, adequate touch targets, usable overlays, table alternatives, and no horizontal page overflow. No page is complete until mobile is verified.

Target WCAG 2.2 AA where practical: semantic HTML, keyboard navigation, visible focus, accessible names, proper labels, contrast, logical headings, table semantics, overlay focus management, reduced motion, text alternatives, colour-independent statuses, and field-associated errors. Charts require title, unit, readable legend, accessible summary, and unusual-value explanation where relevant.

## Content, Permission, Code, and Performance Rules

Use direct operational language, not generic AI marketing copy. Do not leave lorem ipsum, unmarked example data, placeholder metrics, unexplained abbreviations, inconsistent terminology, grammar errors, or fabricated precision. Format currencies, percentages, dates, times, durations, negative values, and missing values consistently; distinguish zero from missing.

Support all approved roles and hide inaccessible navigation/actions while showing permission-denied states for direct access. Protect client users from internal profitability and employee-private data; restrict managers and employees to permitted work. Frontend checks never replace backend enforcement.

Require strict TypeScript, no undocumented `any`, no unused/dead code or duplicate utilities, no silent error swallowing, no console/hydration warnings, stable keys, predictable state ownership, correct server/client boundaries, typed API contracts, and Zod at runtime trust boundaries. Avoid unnecessary client components, large dependencies, uncontrolled re-renders, huge unpaginated tables, eager heavy UI, oversized images, layout shifts, and duplicate requests.

## Figma, Verification, and Completion

When Figma MCP is available, confirm file/node, retrieve screenshot and structured context, inspect hierarchy, map existing components, implement through TailAdmin, and verify visually. When rate-limited, do not retry repeatedly; use saved references and TailAdmin, mark work pending Figma verification, and never claim exact parity without access.

Use Playwright when available to verify route/role, desktop/tablet/mobile, states, long content, keyboard navigation, overlays, forms, tables, charts, overflow, and console errors. Capture major screenshots when practical. Never claim pixel-perfect without a real comparison.

Before completion, confirm component reuse, designed states, accessibility, all breakpoints, strict types, mock placement, permissions, and no known avoidable defects. Formatting, linting, TypeScript, relevant tests, production build, and Playwright when available must pass; document blocked checks honestly.

## Required Codex Behaviour and Definition of Done

For every frontend task, Codex must read this file and root `AGENTS.md`, inspect existing components/routes/features, reuse the design system, avoid generic AI habits, implement relevant states, verify responsiveness and accessibility, run validation, report failures honestly, and never present unfinished or unverified work as complete.

A task is done only when it is intentional, TailAdmin-based, aligned to real business workflow, non-generic, free of obvious sloppy details, state-complete, responsive, accessible, component-reusing, strictly typed, validated, and explicit about blocked verification or Figma uncertainty. “Looks okay” is not the definition of done.
