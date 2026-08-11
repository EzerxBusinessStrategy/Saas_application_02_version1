# User Localization Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every authenticated user an independently persisted UI locale and IANA time-zone preference across every portal.

**Architecture:** Add an identity-owned `user_preferences` row keyed to `public.users.id`, accessed only through trusted current-user context. Use `next-intl` for curated UI messages while keeping routes, business data, enum values, and API contracts language-neutral. Hydrate the authenticated shell from `/me`, persist selector changes through a protected endpoint, and format the server-synchronized instant in the selected IANA zone.

**Tech Stack:** Next.js App Router, React, TypeScript, `next-intl`, NestJS, Drizzle, PostgreSQL RLS, Supabase Auth, Vitest, Playwright.

## Global Constraints

- Supported locales are exactly `en`, `bn`, `hi`, and `or`; English is the readable fallback.
- Supported initial clock zones are `Asia/Kolkata`, `America/New_York`, `Europe/London`, `Asia/Singapore`, `Australia/Sydney`, and `Europe/Berlin`.
- Never accept a user, membership, tenant, role, or permission identifier from the browser to select the preference row.
- Do not translate user-entered or business data, database enum values, API field names, or audit facts.
- Do not perform live machine translation.
- Do not deploy or run the database migration without explicit approval.

---

### Task 1: Approve and apply the preference data contract

**Files:**
- Modify: `docs/architecture/adr/0011-user-localization-preferences.md`
- Create: `apps/backend/drizzle/migrations/0055_user_localization_preferences.sql`
- Modify: `apps/backend/src/database/schema/public/identity.schema.ts`
- Test: `apps/backend/test/db/user-preferences.rls.test.ts`

**Interfaces:**
- Produces `public.user_preferences(user_id uuid primary key, locale text, timezone text, created_at timestamptz, updated_at timestamptz)`.
- Produces `userPreferences` Drizzle table export.

- [ ] **Step 1: Write the database/RLS tests**

```ts
it("allows the authenticated user to read only their own preference row", async () => {
  await setTrustedDatabaseContext(client, { authUserId: userA.supabaseAuthUserId });
  const rows = await client.query("select user_id from public.user_preferences");
  expect(rows.rows).toEqual([{ user_id: userA.id }]);
});

it("rejects an update to another user's preference row", async () => {
  await setTrustedDatabaseContext(client, { authUserId: userA.supabaseAuthUserId });
  await expect(client.query(
    "update public.user_preferences set locale = 'bn' where user_id = $1",
    [userB.id],
  )).rejects.toThrow();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm --filter @saas-app/backend test:db -- user-preferences.rls.test.ts`

Expected: FAIL because `public.user_preferences` does not exist.

- [ ] **Step 3: Add an additive migration and schema definition**

```sql
create table public.user_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  locale text not null default 'en' check (locale in ('en', 'bn', 'hi', 'or')),
  timezone text not null default 'Asia/Kolkata' check (timezone in (
    'Asia/Kolkata', 'America/New_York', 'Europe/London',
    'Asia/Singapore', 'Australia/Sydney', 'Europe/Berlin'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Add RLS policies that compare `user_id` with the identity resolved from trusted
database context, then grant only the required runtime operations.

- [ ] **Step 4: Run database validation**

Run: `corepack pnpm --filter @saas-app/backend test:db -- user-preferences.rls.test.ts`

Expected: PASS for owner access and cross-user denial.

### Task 2: Expose protected current-user preferences

**Files:**
- Modify: `apps/backend/src/auth/me.dto.ts`
- Modify: `apps/backend/src/auth/auth-context.repository.ts`
- Modify: `apps/backend/src/auth/me.service.ts`
- Modify: `apps/backend/src/auth/me.controller.ts`
- Test: `apps/backend/test/api/auth/me-preferences.api.test.ts`

**Interfaces:**
- `MeResponseDto.preferences` returns `{ locale: "en" | "bn" | "hi" | "or"; timezone: string }`.
- `PATCH /api/v1/me/preferences` accepts `{ locale, timezone }` for the verified actor only.

- [ ] **Step 1: Write API tests**

```ts
it.each(["super-admin", "admin", "employee", "client"])(
  "returns and updates only the caller's preferences for %s",
  async (portal) => {
    await request(app.getHttpServer())
      .patch("/api/v1/me/preferences")
      .set(authHeadersFor(portal, userA))
      .send({ locale: "bn", timezone: "Asia/Kolkata" })
      .expect(200)
      .expect(({ body }) => expect(body.preferences).toEqual({ locale: "bn", timezone: "Asia/Kolkata" }));
  },
);
```

- [ ] **Step 2: Run the API tests to verify they fail**

Run: `corepack pnpm --filter @saas-app/backend test:api -- me-preferences.api.test.ts`

Expected: FAIL because `PATCH /me/preferences` is not registered.

- [ ] **Step 3: Implement repository, DTO, service, and controller**

The repository upserts the preference record using `context.userId`; the
controller keeps `SupabaseAuthGuard`, `ActiveRequestContextGuard`, and
`PermissionGuard`; Zod validates only the four locale values and six IANA
values; the `MeService` includes preferences in every `/me` result.

- [ ] **Step 4: Run the API tests**

Run: `corepack pnpm --filter @saas-app/backend test:api -- me-preferences.api.test.ts`

Expected: PASS for Super Admin, Tenant Admin, Employee/Manager, and Client User.

### Task 3: Install and configure deterministic UI localization

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `next.config.ts`
- Create: `src/i18n/config.ts`
- Create: `src/i18n/request.ts`
- Create: `messages/en.json`
- Create: `messages/bn.json`
- Create: `messages/hi.json`
- Create: `messages/or.json`
- Modify: `src/app/layout.tsx`
- Test: `src/i18n/config.test.ts`

**Interfaces:**
- `AppLocale = "en" | "bn" | "hi" | "or"`.
- `getAppMessages(locale: AppLocale)` supplies curated message content.

- [ ] **Step 1: Write configuration tests**

```ts
it("uses English for an unsupported locale", () => {
  expect(normalizeLocale("fr")).toBe("en");
});

it("has the same message keys in every supported locale", () => {
  expect(findMissingMessageKeys(en, bn)).toEqual([]);
  expect(findMissingMessageKeys(en, hi)).toEqual([]);
  expect(findMissingMessageKeys(en, or)).toEqual([]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm test -- src/i18n/config.test.ts`

Expected: FAIL because the localization configuration and dictionaries are absent.

- [ ] **Step 3: Add `next-intl` and the message architecture**

Run: `corepack pnpm add next-intl`

Use the Next plugin with `src/i18n/request.ts`; read the locale from trusted
server-provided `/me` preferences in the authenticated layout, with English as
the fallback. Add only curated, reviewed strings to the three non-English JSON
files. Do not call an external translation service.

- [ ] **Step 4: Run the configuration tests**

Run: `corepack pnpm test -- src/i18n/config.test.ts`

Expected: PASS.

### Task 4: Persist and render per-user shell controls

**Files:**
- Modify: `src/lib/server/super-admin-auth.ts`
- Modify: `src/types/domain.ts`
- Modify: `src/app/(app)/[workspace]/layout.tsx`
- Modify: `src/components/app-shell/live-world-clock.tsx`
- Create: `src/components/app-shell/language-selector.tsx`
- Modify: `src/components/app-shell/workspace-shell.tsx`
- Test: `src/components/app-shell/language-selector.test.tsx`
- Test: `src/components/app-shell/live-world-clock.test.tsx`

**Interfaces:**
- `User.preferences` carries the verified user's locale and timezone.
- `LanguageSelector` shows `Languages`, the locale abbreviation, and an option menu.
- `LiveWorldClock` accepts a saved timezone and calls `PATCH /me/preferences` only after selection.

- [ ] **Step 1: Write component tests**

```tsx
it("shows the current locale abbreviation and saves a new locale", async () => {
  render(<LanguageSelector locale="en" timezone="Asia/Kolkata" />);
  await userEvent.click(screen.getByRole("button", { name: /change language/i }));
  await userEvent.click(screen.getByRole("menuitem", { name: /বাংলা/i }));
  expect(fetch).toHaveBeenCalledWith("/api/me/preferences", expect.objectContaining({ method: "PATCH" }));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm test -- src/components/app-shell/language-selector.test.tsx src/components/app-shell/live-world-clock.test.tsx`

Expected: FAIL because the selector and saved preference props are absent.

- [ ] **Step 3: Implement shell hydration and controls**

The server layout passes preferences from verified `/me` data. The language
selector renders `Languages` plus `EN`, `BN`, `HI`, or `OR`; its menu uses
native-language labels and saves both current values through a same-origin
route proxy that forwards the authenticated token. The clock uses its saved
IANA zone, retains server-time offset synchronization, updates on exact-second
boundaries, and saves country changes through the same protected endpoint.

- [ ] **Step 4: Run the component tests**

Run: `corepack pnpm test -- src/components/app-shell/language-selector.test.tsx src/components/app-shell/live-world-clock.test.tsx`

Expected: PASS.

### Task 5: Translate shared navigation and shell chrome

**Files:**
- Modify: `src/lib/nav.ts`
- Modify: `src/components/shared/breadcrumbs.tsx`
- Modify: `src/components/app-shell/command-menu.tsx`
- Modify: `src/components/app-shell/workspace-shell.tsx`
- Modify: `messages/en.json`
- Modify: `messages/bn.json`
- Modify: `messages/hi.json`
- Modify: `messages/or.json`
- Test: `src/lib/nav.test.ts`

**Interfaces:**
- Navigation stores stable `labelKey` values and renders translated labels at the view boundary.
- Breadcrumbs and command menu use the same keys.

- [ ] **Step 1: Write navigation translation tests**

```ts
it("uses stable translation keys rather than English labels", () => {
  expect(flattenNavigation(navigationFor("admin"))).toEqual(
    expect.arrayContaining([expect.objectContaining({ labelKey: "Navigation.tasks" })]),
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm test -- src/lib/nav.test.ts`

Expected: FAIL because navigation items currently store English labels only.

- [ ] **Step 3: Convert shared chrome to message keys**

Keep route hrefs, permissions, enum storage, and business names unchanged.
Translate common navigation, breadcrumbs, search, refresh labels, notification
labels, theme controls, and generic loading/error/empty states.

- [ ] **Step 4: Run the focused tests**

Run: `corepack pnpm test -- src/lib/nav.test.ts`

Expected: PASS.

### Task 6: Roll out portal content in independently reviewable batches

**Files:**
- Modify: `src/components/administration/**`
- Modify: `src/components/employee/**`
- Modify: `src/components/client-portal/**`
- Modify: `src/components/manager/**`
- Modify: `messages/*.json`
- Create: `scripts/check-translations.ts`
- Modify: `package.json`

**Interfaces:**
- `pnpm check:translations` exits nonzero when `en.json` keys are missing from `bn.json`, `hi.json`, or `or.json`.

- [ ] **Step 1: Add a dictionary completeness test script**

```ts
const missing = locales.flatMap((locale) => findMissingMessageKeys(en, messages[locale]).map((key) => `${locale}: ${key}`));
if (missing.length) throw new Error(`Translation validation FAILED\n${missing.join("\n")}`);
```

- [ ] **Step 2: Run it to verify a missing key fails**

Run: `corepack pnpm check:translations`

Expected: FAIL after temporarily removing one non-English key in a local test fixture.

- [ ] **Step 3: Translate each portal batch**

Migrate Super Admin, Tenant Admin, Employee/Manager, and Client Portal in
separate reviewable commits. Translate static UI strings, validation messages,
toast messages, statuses, priority labels, table headers, and empty/error
states. Preserve user-entered record names and descriptions exactly.

- [ ] **Step 4: Run the translation check**

Run: `corepack pnpm check:translations`

Expected: PASS with no missing keys.

### Task 7: Validate behavior, locale rendering, and independence

**Files:**
- Create: `e2e/user-localization-preferences.spec.ts`
- Modify: `.github/workflows/ci.yml` if the repository already runs frontend checks there

**Interfaces:**
- E2E coverage proves preferences are owned by the authenticated user, not the workspace.

- [ ] **Step 1: Add an independent-preferences scenario**

```ts
test("users retain independent locale and time-zone preferences", async ({ browser }) => {
  const superAdmin = await browser.newContext();
  const tenantAdmin = await browser.newContext();
  // Sign in each user, save different locale/timezone pairs, reload, and assert both remain distinct.
});
```

- [ ] **Step 2: Run focused E2E tests**

Run: `corepack pnpm test:e2e -- e2e/user-localization-preferences.spec.ts`

Expected: PASS for Super Admin, Tenant Admin, Employee/Manager, and Client User sessions.

- [ ] **Step 3: Run required verification**

Run: `corepack pnpm lint && corepack pnpm typecheck && corepack pnpm test && corepack pnpm build && corepack pnpm backend:lint && corepack pnpm backend:typecheck && corepack pnpm backend:test`

Expected: PASS.

## Self-Review

- Spec coverage: Tasks 1-2 implement independent authenticated persistence; Tasks 3-5 implement curated locale loading, the language selector, server-synchronized zone rendering, and shared shell translation; Task 6 migrates all portals with deterministic dictionaries; Task 7 verifies independence and release quality.
- Placeholder scan: No implementation task delegates unspecified behavior. The only intentionally staged work is portal content migration, split by portal to permit native-language review and safe release.
- Type consistency: The persisted data contract is named `preferences` from backend DTO through the server layout, `User`, language selector, and clock.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-11-user-localization-preferences.md`.

1. Subagent-Driven (recommended): execute one task per review checkpoint.
2. Inline Execution: execute tasks in this session, with migration approval before Task 1.
