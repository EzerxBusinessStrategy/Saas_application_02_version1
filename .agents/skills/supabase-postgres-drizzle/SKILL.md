---
name: supabase-postgres-drizzle
description: Use when Codex works with Supabase-managed PostgreSQL, Drizzle ORM, Drizzle Kit, node-postgres pools, NestJS database modules, transactions, schema organization, test databases, Supabase Auth identity mapping, private Supabase Storage metadata, or RLS-compatible database access. Do not use for frontend-only work, generic SQL unrelated to this stack, or package installation requests without approval.
---

# Supabase Postgres Drizzle

Use this skill for safe database access and migration workflow in the approved NestJS backend stack. Do not install packages or modify application code while creating or loading this skill.

## Workflow

1. Inspect the repository's actual package versions, package manager, scripts, and current deployment model.
2. Inspect `AGENTS.md`, `docs/architecture/`, `docs/api/`, ADRs, and relevant frontend API boundaries.
3. Identify whether the work touches runtime access, migrations, tests, Supabase Auth, storage metadata, or RLS.
4. Document any new environment variable name before using it.
5. Design connection, pool, transaction, and migration behavior before editing.
6. Use the smallest implementation that matches the approved architecture.
7. Validate with format, lint, typecheck, tests, integration tests, and build as applicable.

## Rules

- Treat PostgreSQL as the source of truth.
- Use Drizzle as the only ORM/query builder unless an ADR approves another.
- Use node-postgres for the underlying connection and pool.
- Separate development, test, staging, and production configuration.
- Never expose a Supabase service-role key in frontend code.
- Ensure the runtime DB role is not the table owner.
- Use one checked-out connection per transaction.
- Set transaction-local RLS context before tenant queries.
- Bound pool sizes and calculate total connections across API and worker replicas.
- Organize schema files by module or database schema.
- Keep migrations immutable after application.
- Use raw SQL only when Drizzle cannot safely express the requirement, such as advanced RLS, roles, or PostgreSQL-specific constraints.
- Keep raw SQL reviewed and migration-controlled.
- Do not mutate production schema directly from the Supabase dashboard.
- Use a real disposable PostgreSQL database for integration tests.
- Validate secrets at startup and never log them.

## References

- `references/connection-strategy.md`
- `references/drizzle-schema-organisation.md`
- `references/nestjs-database-module.md`
- `references/transaction-context.md`
- `references/environment-matrix.md`
- `references/supabase-auth-boundary.md`

## Templates

Use `assets/templates/` as generic examples only. Do not copy names blindly; adapt to verified repository configuration.

## Trigger Tests

Should activate:

- "Create a NestJS database module using Drizzle and node-postgres."
- "Plan Drizzle migrations for Supabase PostgreSQL with RLS helper SQL."
- "Review whether this transaction sets tenant context before queries."

Should not activate:

- "Style the login page."
- "Explain generic SQL joins."
- "Install a random ORM for a quick script."
