---
name: vitest-testcontainers-backend
description: Create and review reliable backend unit, API, PostgreSQL integration, RLS, migration, idempotency, worker, and concurrency tests using Vitest, Supertest, and Testcontainers. Use when planning or implementing NestJS backend tests, tenant-isolation fixtures, real PostgreSQL constraint tests, runtime-role RLS tests, or concurrent mutation tests. Do not use for frontend-only component tests, adding dependencies during skill creation, or modifying existing tests unless requested.
---

# Vitest Testcontainers Backend

## Workflow

1. Read `AGENTS.md`, test scripts in `package.json`, architecture docs, and the behavior under test.
2. Classify each behavior as unit, integration, API, database-security, worker/idempotency, concurrency, migration, or end-to-end.
3. Use unit tests for pure service and policy logic.
4. Use API tests for guards, DTOs, status codes, and response contracts.
5. Use Testcontainers PostgreSQL for repository, transaction, migration, constraint, and RLS behavior.
6. Use the true non-owner runtime database role for RLS tests.
7. Use Testcontainers Redis only when Redis or BullMQ is actually introduced.
8. Test happy paths and denial paths.
9. Clean containers, pools, and app instances reliably.
10. Report skipped or blocked tests honestly.

## Rules

- Use Vitest for orchestration.
- Use Supertest for HTTP API tests.
- Run real migrations in integration tests.
- Do not mock PostgreSQL constraints or RLS.
- Build Tenant A and Tenant B fixtures.
- Test transaction rollback, idempotency replay, duplicate requests, concurrent approvals/payments/workflow transitions, and duplicate worker delivery where applicable.
- Keep data deterministic.
- Avoid shared mutable test state.
- Do not add dependencies or modify existing tests during skill-creation tasks.

## References

- `references/testing-pyramid.md`
- `references/nestjs-vitest-setup.md`
- `references/testcontainers-postgres.md`
- `references/rls-isolation-tests.md`
- `references/concurrency-and-idempotency-tests.md`
- `references/api-contract-tests.md`

## Trigger Tests

Should activate:

- "Add RLS tests proving Tenant A cannot read Tenant B rows."
- "Write a Supertest API test for the invoice endpoint guards."
- "Plan a concurrency test for duplicate task approvals."

Should not activate:

- "Test this React dropdown component."
- "Install Testcontainers."
- "Run the existing Vitest suite."
