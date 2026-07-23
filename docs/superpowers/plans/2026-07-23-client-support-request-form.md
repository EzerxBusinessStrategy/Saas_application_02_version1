# Client Support Request Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing Client Portal ticket dialog into a complete, business-impact-led support-request workflow.

**Architecture:** Extend the existing `SupportTicket` Zod contract and operations mock API. Reuse the current ticket workspace, shadcn-style controls, dialog, query refresh, and browser-local persistence; no route, permission, or generic-primitive changes.

**Tech Stack:** Next.js, React, TypeScript, Zod, TanStack Query, existing Tailwind/shadcn-style controls, Vitest, Playwright.

## Global Constraints

- Business impact replaces ticket priority in the client workflow.
- Client, tenant, requester, and assigned-manager data remain derived from the existing scoped mock context.
- Attachments, notifications, drafts, help articles, and duplicate detection are frontend/mock behaviours until a backend contract is approved.
- Client tickets remain visible only to the client account, assigned manager, and tenant admin UI scopes.

### Task 1: Extend the typed ticket contract

**Files:**
- Modify: `src/types/operations.ts`
- Modify: `src/mocks/operations.ts`
- Modify: `src/features/operations/api/operations-api.ts`
- Test: `src/features/operations/api/operations-api.test.ts`

- [x] Add ticket business impact, affected users, affected URL, contact preferences, attachment metadata, and response-time fields to the Zod contract.
- [x] Replace priority values with low, medium, high, and critical business-impact values and use Open as the initial ticket status.
- [x] Reject an equivalent active client ticket on create and generate a client-facing ticket identifier.

### Task 2: Build the complete client request form

**Files:**
- Modify: `src/components/operations/support-ticket-workspace.tsx`
- Test: `src/components/operations/role-workspace-actions.test.tsx`

- [x] Replace the priority control with business impact and its critical-impact warning.
- [x] Add dynamic service categories, prefilled requester context, helpful articles, character counters, affected users/URL, contact preference, safe attachment intake, draft persistence, and duplicate warning.
- [x] Keep the form responsive, visibly labelled, keyboard accessible, and disabled until its required fields are valid.

### Task 3: Confirm and verify the workflow

**Files:**
- Modify: `src/components/operations/support-ticket-workspace.tsx`
- Modify: `docs/api/provisional-contracts.md`

- [x] Add a confirmation state with ticket ID, Open status, expected response time, View request, and Create another request actions.
- [x] Document frontend-only attachment/draft/notification limitations and backend requirements.
- [x] Run lint, TypeScript, the full Vitest suite, the production build, installed-Edge verification, and restore local hot reload. Prettier is not installed in this repository, so formatting could not be run without adding a dependency.
