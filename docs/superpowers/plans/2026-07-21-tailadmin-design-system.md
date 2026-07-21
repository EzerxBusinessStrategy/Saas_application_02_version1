# TailAdmin Design System Implementation Plan

> **For agentic workers:** Execute the checked tasks in order. This repository is intentionally uncommitted; do not create a commit.

**Goal:** Apply the approved TailAdmin `Analytics Dashboard` frame (`17:577`) as the reusable visual system for existing multi-tenant screens.

**Architecture:** Keep route, permission, tenant, and mock-data code unchanged. Update the shared CSS tokens and existing UI primitives, then let the existing shell, dashboard, and operational pages inherit the TailAdmin visual language.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS v4, existing shadcn-style primitives, Lucide React.

## Global Constraints

- Preserve tenant isolation and permission filtering behavior.
- Reuse `Card`, `Button`, `Badge`, and `WorkspaceShell`; do not add duplicate primitives.
- Desktop values follow Figma node `17:577`: 280px sidebar, 80px header, #1C2434 sidebar, #E2E8F0 border, 2px cards, 4px controls.
- Use Lucide only where its glyph clearly matches the Figma icon intent.
- Do not add dependencies or commits.

---

### Task 1: Establish semantic TailAdmin tokens

**Files:**

- Modify: `src/app/globals.css`
- Modify: `scripts/check-design-tokens.ts`
- Modify: `docs/design-system/design-tokens.md`

- [x] Replace the temporary blue/slate values with TailAdmin semantic variables: `--primary: #3c50e0`, `--foreground: #212b36`, `--muted-foreground: #64748b`, `--border: #e2e8f0`, `--sidebar: #1c2434`.
- [x] Expose the tokens through Tailwind v4 and set the Figma-derived 80px header, 280px sidebar, 2px card radius, and #00000012 card shadow variables.
- [x] Extend the token check so it fails when TailAdmin’s primary, sidebar, card-radius, or card-shadow tokens are absent.
- [x] Run `corepack pnpm check:tokens`; expected result: `Verified 9 design tokens.`

### Task 2: Restyle the existing shared primitives

**Files:**

- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/shared/metric-card.tsx`

- [x] Change `Card` to `rounded-[var(--radius-card)] border bg-card shadow-[var(--shadow-card)]`.
- [x] Change controls to 4px corners and 40px default height, preserving the existing variants and focus ring.
- [x] Change badges to TailAdmin’s compact 4px-corner 12px pattern while retaining semantic status tones.
- [x] Reuse the revised card in `MetricCard`; make metric value typography use TailAdmin’s 28px/34px heading scale.

### Task 3: Refactor the shell and existing screen patterns

**Files:**

- Modify: `src/components/app-shell/workspace-shell.tsx`
- Modify: `src/components/dashboard/dashboard.tsx`
- Modify: `src/components/operations/entity-list.tsx`
- Modify: `src/components/operations/task-board.tsx`
- Modify: `src/components/operations/tasks-page.tsx`

- [x] Set the desktop navigation column to `w-[var(--sidebar-width)]`, its brand area to 80px, and the top bar to `h-[var(--header-height)]`.
- [x] Use TailAdmin menu spacing (15px horizontal, 8px vertical, 10px icon gap) and the #333A48 active state.
- [x] Add a controlled, accessible mobile navigation dialog using the existing Radix dialog primitive; desktop behavior remains fixed sidebar.
- [x] Restyle dashboard cards, dashboard metric strip, inputs, tables, task columns, and view controls with the shared semantic primitives rather than page-specific colours.

### Task 4: Record the approved Figma decision and verify

**Files:**

- Modify: `docs/figma/component-map.md`
- Modify: `docs/figma/design-audit.md`
- Modify: `docs/figma/implementation-log.md`
- Modify: `docs/figma/visual-differences.md`

- [x] Record node `17:577`, its screenshot review, and the exact mapping to existing shared components.
- [x] Record that Figma only supplied a desktop frame; the mobile sheet behavior is an implementation inference requiring later mobile-frame comparison.
- [x] Run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, and `corepack pnpm build`.
