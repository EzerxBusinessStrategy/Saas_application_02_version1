# Repository architecture audit

## Confirmed current state

The repository is a Next.js 15 App Router frontend with React, strict TypeScript, Tailwind, Radix-backed UI source, TanStack dependencies, Zod, RHF, Zustand, Vitest, Playwright, and Storybook. It has no backend, database, ORM, Redis, queue, API client, authentication provider, CI workflow, or persistent tenant context. Routes are `src/app/(app)/[workspace]`; fixtures are in `src/mocks`; role visibility is in `src/lib/permissions.ts`.

## Module boundaries and risks

The current UI treats a workspace URL as the persona and renders shared fixture data for all workspaces. This is acceptable only as a prototype. Confirmed security risk: UI-only permissions and unscoped fixtures cannot provide tenant isolation. No production tenant-isolation, authentication, audit, cache, job, or event strategy exists to inspect.

## Approval-bound recommendations

Adopt a NestJS modular monolith, PostgreSQL RLS, trusted tenant context, and backend policy enforcement only after a proposal and ADR. Do not infer an isolation strategy from this frontend.
