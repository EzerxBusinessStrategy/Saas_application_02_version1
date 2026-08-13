# Portal-Specific Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase Auth sign-in with independent Super Admin, Tenant, Employee, and Client credential/session flows, without portal discovery or sequential role probing.

**Architecture:** Store application-owned credentials, opaque sessions, password-reset tokens, and login audit records in a private `authn` schema. The existing Supabase PostgreSQL instance remains the deployable logical auth boundary until a separately provisioned Auth database and `AUTH_DATABASE_URL` are supplied. Each login endpoint accepts only its own portal credentials, verifies Argon2id hashes, creates a server-side session, and issues exactly one portal cookie.

**Tech Stack:** NestJS, Fastify, TypeScript, node-postgres, Drizzle schema, PostgreSQL, Argon2id, Next.js App Router, React Hook Form, Zod, Vitest.

## Global Constraints

- Preserve existing tenant isolation, RBAC, resource-scope authorization, and RLS.
- Enforce one globally unique normalized email across every credential type and application user.
- Store only Argon2id password hashes and SHA-256 opaque-session/reset-token hashes.
- Never expose tokens or hashes to frontend JavaScript or logs.
- Use `sa_session`, `tenant_session`, `employee_session`, and `client_session` with `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`.
- Do not call Supabase Auth, select a workspace, or probe another portal during login.
- Keep the auth schema private and revoke `anon`/`authenticated` access.
- Use new immutable migrations; do not edit existing migrations.

---

### Task 1: Record the Accepted Authentication Boundary

**Files:**
- Create: `docs/architecture/adr/0013-portal-specific-authentication.md`
- Modify: `docs/architecture/adr/index.md`

**Interfaces:** Documents that `authn` owns credentials/sessions while `public` owns RBAC and business authorization.

- [ ] **Step 1: Record the decision and migration order**

Document compatible schema/code deployment, credential provisioning, cookie-route cutover, a session-expiry window, and only then retirement of legacy Supabase routes.

### Task 2: Add Private Auth Persistence

**Files:**
- Create: `apps/backend/drizzle/migrations/0057_portal_authentication.sql`
- Create: `apps/backend/src/database/schema/authn/authentication.schema.ts`
- Modify: `apps/backend/src/database/schema/index.ts`
- Modify: `apps/backend/src/database/schema/public/identity.schema.ts`
- Test: `apps/backend/test/integration/portal-authentication-schema.test.ts`

**Interfaces:**
- `authn.credentials`: globally unique `email_normalized`, portal type, business identity references, Argon2id hash, credential state, lockout fields.
- `authn.sessions`: portal type, identity/scope ids, unique SHA-256 `token_hash`, expiry/revocation fields, IP, user-agent.
- `authn.password_reset_tokens` and `authn.login_audit_events`.

- [ ] **Step 1: Write failing schema tests**

Assert cross-portal duplicate email rejection, unique token hashes, revoked Data API access, and nullable legacy `users.supabase_auth_user_id` compatibility.

- [ ] **Step 2: Create an immutable migration**

Create private schema/tables/indexes/checks/foreign keys/timestamp triggers; revoke `PUBLIC`, `anon`, and `authenticated` access; make legacy Supabase ID nullable rather than drop it.

- [ ] **Step 3: Add Drizzle schema and validate**

Run: `corepack pnpm --filter @saas-app/backend test:db -- portal-authentication-schema.test.ts`

Expected: migration constraints pass on a disposable PostgreSQL database.

### Task 3: Implement Credential and Opaque Session Services

**Files:**
- Create: `apps/backend/src/auth/core/password.service.ts`
- Create: `apps/backend/src/auth/core/opaque-session-token.service.ts`
- Create: `apps/backend/src/auth/core/portal-auth.repository.ts`
- Create: `apps/backend/src/auth/core/portal-auth.service.ts`
- Create: `apps/backend/src/auth/core/portal-auth.dto.ts`
- Create: `apps/backend/src/auth/guards/portal-session.guard.ts`
- Modify: `apps/backend/src/auth/request-context.ts`
- Modify: `apps/backend/src/auth/request-context-resolver.service.ts`
- Modify: `apps/backend/src/auth/auth.module.ts`
- Test: `apps/backend/test/unit/portal-auth.service.test.ts`
- Test: `apps/backend/test/api/auth/portal-auth.api.test.ts`

**Interfaces:**
- `PasswordService.hash(password)` and `verify(hash, password)` use Argon2id.
- `PortalAuthService.login({ portalType, email, password }, metadata)` uses only the requested portal and returns an opaque token plus fixed redirect.
- `PortalSessionGuard` reads only its required cookie and attaches trusted portal/identity information.

- [ ] **Step 1: Add a pinned Argon2id dependency**

Run: `corepack pnpm --filter @saas-app/backend add argon2@<resolved-version>`.

- [ ] **Step 2: Write failing service/API tests**

Cover valid login, generic invalid credentials, account lock, user/tenant suspension, fixed portal redirect, opaque token hashing, logout revocation, and portal mismatch.

- [ ] **Step 3: Implement the minimal services**

Use Argon2id with memory cost 19456 KiB, time cost 2, parallelism 1. Generate 256-bit random session tokens, store `sha256(token)`, and atomically update failed-login counters.

- [ ] **Step 4: Replace bearer-token request authentication**

Resolve trusted request context by session `user_id` and fixed portal type. Retain RBAC, scope, and RLS guards; reject a session used against a different portal.

- [ ] **Step 5: Run focused tests**

Run: `corepack pnpm --filter @saas-app/backend test -- portal-auth.service.test.ts portal-auth.api.test.ts`.

Expected: all auth isolation tests pass.

### Task 4: Add Portal Endpoints and Provisioning

**Files:**
- Create: `apps/backend/src/auth/super-admin/super-admin-auth.controller.ts`
- Create: `apps/backend/src/auth/tenant/tenant-auth.controller.ts`
- Create: `apps/backend/src/auth/employee/employee-auth.controller.ts`
- Create: `apps/backend/src/auth/client/client-auth.controller.ts`
- Modify: `apps/backend/src/auth/access-admin.service.ts`
- Modify: `apps/backend/src/auth/access-admin.repository.ts`
- Modify: `apps/backend/src/auth/access-admin.dto.ts`
- Modify: employee/client provisioning services
- Test: `apps/backend/test/api/auth/portal-auth.api.test.ts`

**Interfaces:**
- `POST /api/v1/auth/{super-admin|tenant|employee|client}/login`
- `POST /api/v1/auth/{portal}/logout`
- `GET /api/v1/auth/{portal}/session`

- [ ] **Step 1: Add portal controllers**

Each controller supplies a fixed portal type to the shared service. No endpoint accepts a trusted role, tenant, or portal value from the browser.

- [ ] **Step 2: Change tenant/employee/client provisioning**

Reject globally used emails before business writes. Create `INVITED` credentials and hashed activation tokens instead of calling Supabase Admin Auth.

- [ ] **Step 3: Change protected controllers**

Replace `SupabaseAuthGuard` with portal session guards while retaining `ActiveRequestContextGuard` and `PermissionGuard`.

- [ ] **Step 4: Run API verification**

Run: `corepack pnpm --filter @saas-app/backend test:api -- portal-auth.api.test.ts`.

Expected: cross-portal denial, unique-email checks, and login/session/logout paths pass.

### Task 5: Connect Next.js Login and Proxies

**Files:**
- Create: `src/app/super-admin/login/page.tsx`
- Create: `src/app/admin/login/page.tsx`
- Create: `src/app/employee/login/page.tsx`
- Create: `src/app/client/login/page.tsx`
- Create: `src/app/api/auth/super-admin/login/route.ts`
- Create: `src/app/api/auth/tenant/login/route.ts`
- Create: `src/app/api/auth/employee/login/route.ts`
- Create: `src/app/api/auth/client/login/route.ts`
- Create: `src/app/api/auth/[portal]/logout/route.ts`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/components/auth/auth-form.tsx`
- Modify: `src/lib/auth-cookies.ts`
- Modify: `src/lib/server/*-backend-proxy.ts`
- Modify: `src/app/(app)/[workspace]/layout.tsx`
- Test: `src/components/auth/auth-form.test.tsx`

**Interfaces:** `/login` is a static selector. Each portal login posts only to its matching route. Proxies forward one matching HttpOnly cookie to the backend, never a browser bearer token.

- [ ] **Step 1: Define cookie helpers**

Replace shared workspace and Supabase access/refresh cookies with four portal cookies.

- [ ] **Step 2: Add fixed portal forms/routes**

Reuse the form design but fix its portal, endpoint, redirect, copy, and no identification/workspace-selection phase.

- [ ] **Step 3: Update layouts and proxies**

Require the matching portal cookie for each workspace and redirect unauthenticated users to the corresponding login path.

- [ ] **Step 4: Write and run frontend tests**

Run: `corepack pnpm test -- auth-form.test.tsx portal-login.route.test.ts`.

Expected: selector, endpoint, and cross-portal cookie isolation tests pass.

### Task 6: Validate and Retire Legacy Paths

**Files:**
- Modify: `docs/architecture/phase-0-architecture-decision-lock.md`
- Modify: `docs/frontend/simple-frontend-user-guide.md`
- Modify: `docs/api/provisional-contracts.md`
- Modify: `apps/backend/src/config/app-config.ts`
- Remove after proof: legacy Supabase login/JWT/session policy handlers and callers

- [ ] **Step 1: Verify legacy references**

Run: `rg -n "signInSuperAdminWithPassword|authenticatedWorkspaceCookie|superAdminAccessTokenCookie|session-policy|/api/auth/login" src apps/backend/src`.

- [ ] **Step 2: Run full checks**

Run: `corepack pnpm lint; corepack pnpm typecheck; corepack pnpm test; corepack pnpm build; corepack pnpm backend:lint; corepack pnpm backend:typecheck; corepack pnpm backend:test; corepack pnpm backend:build`.

- [ ] **Step 3: Run browser smoke coverage**

Verify four login pages, correct redirects, logout, missing-cookie redirects, invalid credentials, and cross-portal route denial against a responsive local server.

- [ ] **Step 4: Apply and verify the approved remote migration**

Apply only the reviewed migration, validate private-schema permissions and constraints, run advisors, then provision the initial Super Admin credential through an activation/reset flow.
