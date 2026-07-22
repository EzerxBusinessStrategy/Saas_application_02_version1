# Authenticated Shell Sidebar Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the authenticated shell use one responsive grid so sidebar and page content cannot overlap.

**Architecture:** Keep `WorkspaceShell` as the only shell component. Add the sidebar dimensions and desktop grid rule to the existing global token stylesheet; use the shell's existing local state for collapse and mobile drawer state. Preserve navigation filtering and the existing Radix mobile dialog.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, existing shadcn button/dialog primitives, Vitest, Playwright.

## Global Constraints

- Keep TailAdmin tokens, navigation configuration, role filtering, and routes unchanged.
- Use 256px expanded and 76px collapsed desktop widths; mobile remains an overlay drawer.
- Do not add dependencies, download a browser, or weaken SSL verification.
- Respect reduced-motion settings and keep the browser-verified layout overflow-free.

---

### Task 1: Make shell columns share sidebar state

**Files:**

- Modify: `src/app/globals.css`
- Modify: `src/components/app-shell/workspace-shell.tsx`

**Interfaces:**

- Consumes: `sidebarCollapsed: boolean` owned by `WorkspaceShell`.
- Produces: `.app-shell[data-sidebar]` controlling `--sidebar-width` and desktop grid columns.

- [ ] **Step 1: Add token values and the desktop grid rule**

```css
:root {
  --sidebar-expanded-width: 256px;
  --sidebar-collapsed-width: 76px;
}
.app-shell[data-sidebar="collapsed"] {
  --sidebar-width: var(--sidebar-collapsed-width);
}
@media (min-width: 1024px) {
  .app-shell {
    display: grid;
    grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  }
}
```

- [ ] **Step 2: Render the persistent sidebar in the first grid column**

```tsx
<div
  className="app-shell"
  data-sidebar={sidebarCollapsed ? "collapsed" : "expanded"}
>
  <aside className="hidden lg:block">...</aside>
  <div className="min-w-0">...</div>
</div>
```

- [ ] **Step 3: Remove independent fixed positioning and content padding offsets**

```tsx
<main id="main-content" className="min-w-0 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
  {children}
</main>
```

- [ ] **Step 4: Verify the component test and desktop overflow check**

Run: `corepack pnpm exec vitest run src/components/app-shell/workspace-shell.test.tsx`

Expected: PASS.

### Task 2: Put collapse, labels, and nested navigation inside the sidebar

**Files:**

- Modify: `src/components/app-shell/workspace-shell.tsx`
- Test: `src/components/app-shell/workspace-shell.test.tsx`

**Interfaces:**

- Consumes: existing `NavigationItem[]`, `isActiveItem`, and filtered items.
- Produces: an in-sidebar toggle, visually hidden collapsed labels, and a keyboard-accessible child flyout.

- [ ] **Step 1: Write tests for in-sidebar toggle and collapsed labels**

```tsx
fireEvent.click(screen.getByRole("button", { name: "Collapse navigation" }));
expect(screen.getByLabelText("Dashboard")).toBeVisible();
expect(screen.queryByText("Dashboard")).not.toBeVisible();
```

- [ ] **Step 2: Move the existing toggle into the brand row**

```tsx
<Button
  aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
  onClick={onToggle}
>
  {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
</Button>
```

- [ ] **Step 3: Keep labels in the DOM and transition opacity/translation**

```tsx
<span
  aria-hidden={collapsed}
  className={cn(
    "transition-[opacity,transform]",
    collapsed && "-translate-x-1 opacity-0",
  )}
>
  {item.label}
</span>
```

- [ ] **Step 4: Render collapsed group children in a labelled flyout**

```tsx
<div role="group" aria-label={`${item.label} navigation`}>
  {item.children.map(renderFlyoutItem)}
</div>
```

- [ ] **Step 5: Verify unit tests**

Run: `corepack pnpm exec vitest run src/components/app-shell/workspace-shell.test.tsx`

Expected: PASS.

### Task 3: Simplify header and verify responsive behavior

**Files:**

- Modify: `src/components/app-shell/workspace-shell.tsx`
- Modify: `e2e/phase1-foundation.spec.ts`

**Interfaces:**

- Consumes: existing search, notification, user-menu, tenant-context, and mobile dialog controls.
- Produces: breadcrumbs at left; useful authorised controls at right; no desktop duplicate toggle.

- [ ] **Step 1: Remove the desktop header collapse control and redundant disabled workspace switcher**

```tsx
<header>
  <Breadcrumbs ... />
  <div>{user.role === "SUPER_ADMIN" ? <TenantSwitcher /> : null}<SearchButton /><NotificationMenu /><UserMenu /></div>
</header>
```

- [ ] **Step 2: Extend browser verification for expanded, collapsed, nested, and mobile layouts**

```ts
await page.getByRole("button", { name: "Collapse navigation" }).click();
await expect(page.getByLabel("Dashboard")).toBeVisible();
await expectHealthyPage(page);
```

- [ ] **Step 3: Run the required validation**

Run: `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build`, `corepack pnpm exec playwright test --project=msedge`

Expected: all commands exit 0.
