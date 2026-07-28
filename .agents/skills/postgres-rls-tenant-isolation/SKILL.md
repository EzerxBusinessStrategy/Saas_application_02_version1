---
name: postgres-rls-tenant-isolation
description: Use when Codex designs, implements, or reviews tenant-owned PostgreSQL tables, Row-Level Security policies, tenant isolation, composite foreign keys, runtime database roles, support-access policies, or tenant-isolation tests for the project's shared-database multi-tenant architecture. Do not use for frontend route guards alone, CSS or UI work, general SQL unrelated to tenancy, or separate-database-per-tenant designs unless explicitly approved.
---

# Postgres RLS Tenant Isolation

Use this skill for shared-database multi-tenant PostgreSQL design and review. Do not execute SQL against a real or production database unless the user explicitly asks and approves the target.

## Workflow

1. Identify which tables are tenant-owned, global, or audit-owned.
2. Map every actor and data-access path.
3. Define trusted session context from the server, not browser authority.
4. Define constraints before policies.
5. Define policies per operation: `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
6. Test with the true non-owner runtime role.
7. Test direct and indirect cross-tenant attacks.
8. Review indexes and query plans.
9. Document exceptional platform access and support sessions.
10. Report unresolved risks.

## Rules

- Put `tenant_id` on every tenant-owned table.
- Derive tenant IDs from trusted server context, never browser authority.
- Use composite uniqueness and composite tenant-safe foreign keys.
- Make cross-tenant references fail at the database level.
- Enable `ROW LEVEL SECURITY`.
- Force `ROW LEVEL SECURITY`.
- Separate migration/table-owner and non-owner runtime roles.
- Ensure the runtime role cannot `BYPASSRLS`.
- Create explicit policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
- Default to deny when no policy applies.
- Use PostgreSQL transaction-local trusted context.
- Handle platform Super Admin and temporary support sessions safely.
- Use tenant-leading indexes for tenant-scoped access.
- Never rely only on application `WHERE tenant_id` clauses.
- Never expose service-role secrets in frontend code.
- Use real PostgreSQL tenant-isolation tests.
- Review migration and rollback risk.

## References

- `references/rls-design-pattern.md`
- `references/composite-foreign-key-pattern.md`
- `references/runtime-role-pattern.md`
- `references/support-access-pattern.md`
- `references/tenant-isolation-test-matrix.md`

## Templates

Use `assets/sql/` templates as generic examples only. Adapt and review them before creating migrations.

## Trigger Tests

Should activate:

- "Add RLS policies for tenant-owned task tables."
- "Review whether this client_id foreign key can cross tenants."
- "Create Tenant A and Tenant B integration tests for runtime role isolation."

Should not activate:

- "Hide the admin navigation item in the React sidebar."
- "Write a SQL query to count rows in a single-user script."
- "Design a separate database per tenant without an approved ADR."
