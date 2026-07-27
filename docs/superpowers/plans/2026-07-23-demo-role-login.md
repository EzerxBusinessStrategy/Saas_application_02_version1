# Demo Role-Aware Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add approved hardcoded demo login and role-based portal routing.

**Architecture:** A small auth helper owns the approved demo credentials and workspace mapping. Route handlers create and clear an HTTP-only demo cookie; middleware and the workspace layout reject a session whose role does not own the requested workspace. Existing role permissions remain the UI layer only.

**Tech Stack:** Next.js App Router route handlers and middleware, React Hook Form, Zod, Vitest, React Testing Library, Playwright.

## Global Constraints

- Demo credentials only: never describe this as production authentication.
- All demo portal roles use `abcd1234@gmail.com` and `1234` with an explicit role selector.
- Keep existing TailAdmin UI primitives and role permissions.
- Enforce workspace-route denial before application content renders.

---

### Task 1: Define demo account and session rules

**Files:**
- Create: `src/lib/demo-auth.ts`
- Test: `src/lib/demo-auth.test.ts`

- [ ] Write tests for shared credential validation and role-to-workspace mapping.
- [ ] Implement `validateDemoLogin`, `workspaceForRole`, `isWorkspaceAllowed`, and the cookie key constant.
- [ ] Run `corepack pnpm exec vitest run src/lib/demo-auth.test.ts`.

### Task 2: Add login, logout, and recovery endpoints

**Files:**
- Create: `src/app/api/demo-auth/login/route.ts`
- Create: `src/app/api/demo-auth/logout/route.ts`
- Create: `src/app/api/demo-auth/recovery/route.ts`

- [ ] Validate request bodies using the helper and set only an HTTP-only, same-site demo session cookie after valid login.
- [ ] Clear the cookie on logout and return a non-enumerating recovery response.
- [ ] Run TypeScript validation.

### Task 3: Guard workspace URLs and wire authenticated UI

**Files:**
- Create: `middleware.ts`
- Modify: `src/app/(app)/[workspace]/layout.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/app-shell/user-menu.tsx`

- [ ] Reject mismatched workspace URLs in middleware and in the server layout.
- [ ] Redirect the root route to `/login` when no demo session exists.
- [ ] Make sign out clear the cookie before navigating to `/login`.
- [ ] Add focused route/helper tests.

### Task 4: Update login and forgot-password interaction

**Files:**
- Modify: `src/components/auth/auth-form.tsx`
- Modify: `src/components/auth/auth-form.test.tsx`
- Modify: `src/app/(auth)/forgot-password/page.tsx`

- [ ] Show a role selector and email field for every demo portal role.
- [ ] Submit to the login endpoint and navigate to the permitted workspace only after success.
- [ ] Keep URL and password handling accessible, show generic credential failures, and make recovery accept email.
- [ ] Run focused auth tests.

### Task 5: Verify the complete demo flow

**Files:**
- Modify: `docs/frontend/frontend-status.md`

- [ ] Run lint, typecheck, tests, production build, and browser checks for successful login, cross-workspace denial, client login, recovery, and logout.
- [ ] Record the demo-only security limitation and validation evidence.

## Completion

- [x] Demo credentials and role-to-workspace rules implemented and unit-tested.
- [x] Login, logout, recovery, middleware, layout, and root-route session handling implemented.
- [x] Shared email and accessible password controls implemented.
- [x] Browser verification completed for login, client login, cross-workspace denial, recovery, and sign out.
- [x] Lint, TypeScript, full unit suite, and production build passed.
