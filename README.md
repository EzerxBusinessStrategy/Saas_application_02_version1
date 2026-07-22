# SaaS Demo

Multi-tenant operations UI built with Next.js App Router, strict TypeScript, Tailwind, Radix-backed shadcn-compatible primitives, TanStack Query/Table, RHF/Zod, Zustand, Motion, and Recharts.

## Start

```bash
corepack pnpm install
corepack pnpm dev
```

Copy `.env.example` to `.env.local` and use placeholders only. `NEXT_PUBLIC_API_BASE_URL` is not wired until a backend contract is supplied.

## Commands

`corepack pnpm lint` · `corepack pnpm typecheck` · `corepack pnpm test` · `corepack pnpm test:e2e` · `corepack pnpm storybook` · `corepack pnpm build-storybook` · `corepack pnpm build`

## Structure

`src/app` holds thin routes; `src/components` holds reusable UI; `src/lib` holds permissions, navigation, and theme rules; `src/mocks` holds typed fixtures. Tenant branding is validated in `src/lib/tenant-theme.ts`; frontend permission checks are presentation-only.

## MCP

See `docs/mcp/setup.md`. Supply a specific Figma frame URL before Figma visual work begins. shadcn components are source-owned under `src/components/ui`.

## Contribution

Follow `AGENTS.md`, reuse semantic tokens, add focused tests for changed behavior, and never commit credentials.
