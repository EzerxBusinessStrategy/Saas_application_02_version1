# Tenant Branding Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` task-by-task. Steps use checkbox syntax.

**Goal:** Extend the existing Super Admin tenant workflow and Tenant Admin branding screen with typed, frontend-only provisioning and preview states.

**Architecture:** Reuse `TenantCreateForm`, `TenantSettings`, existing React Hook Form/Zod, and TailAdmin cards/tabs. Store no passwords, email invitations, logo bytes, domains, or authoritative tenant state; previews are isolated to the settings UI.

**Tech Stack:** Next.js App Router, React, TypeScript, React Hook Form, Zod, Tailwind, existing shadcn primitives.

## Constraints

- No backend, database, tenant-resolution, authentication, email, upload, or real theme-application changes.
- Keep tenant branding as validated mock configuration and never claim cross-tenant enforcement.
- Reuse existing primitives and responsive patterns.

### Task 1: Extend typed frontend provisioning input

**Files:**
- Modify: `src/types/administration.ts`
- Modify: `src/components/administration/tenant-management.tsx`
- Test: `src/components/administration/tenant-management.test.tsx`

- [ ] Add validated company, administrator, limits, branding, and path-based portal metadata.
- [ ] Turn the existing create form into a compact stepper with review and prepared-request confirmation.
- [ ] Test required company details and review confirmation.

### Task 2: Upgrade Tenant Admin branding settings

**Files:**
- Modify: `src/components/tenant-administration/workforce-administration.tsx`
- Test: `src/components/tenant-administration/workforce-administration.test.tsx`

- [ ] Replace the basic branding fields with approved colour tokens, theme preference, density, controlled logo metadata, and an isolated live preview.
- [ ] Keep draft/publish messaging explicitly frontend-only.
- [ ] Test colour validation and preview updates.

### Task 3: Document and verify the frontend boundary

**Files:**
- Modify: `docs/api/provisional-contracts.md`

- [ ] Document that provisioning, invitations, domain verification, and theme publication require backend contracts.
- [ ] Run lint, typecheck, relevant tests, and production build.
