---
name: postgres-query-performance
description: Measure, diagnose, and improve PostgreSQL query performance for tenant-scoped NestJS APIs without speculative caching or speculative indexes. Use when investigating slow PostgreSQL endpoints, query plans, N+1 patterns, pagination performance, tenant-leading indexes, connection pools, transaction duration, lock waits, or pg_stat_statements evidence. Do not use for production diagnostics, frontend-only performance work, or unrelated generic SQL questions.
---

# Postgres Query Performance

## Workflow

1. Read `AGENTS.md`, database architecture docs, and the endpoint or repository under review.
2. Capture the actual SQL, safe parameters, query count, baseline data size, and baseline latency.
3. Run `EXPLAIN (ANALYZE, BUFFERS)` only on safe development or test data.
4. Inspect `pg_stat_statements` when available.
5. Diagnose row estimates, scans, sorts, nested-loop growth, spills, N+1 patterns, lock waits, transaction duration, and pool saturation.
6. Propose the smallest measurable change.
7. Account for write cost, storage cost, and tenant isolation before recommending indexes.
8. Re-run the same workload after changes before claiming improvement.

## Rules

- Measure before optimizing.
- Keep filtering, sorting, and pagination inside PostgreSQL.
- Select only columns needed by the endpoint.
- Use compact list DTOs.
- Prefer tenant-leading indexes for tenant-scoped access.
- Match index order to `WHERE`, equality, range, and `ORDER BY` patterns.
- Avoid indexing every column.
- Avoid unbounded `OFFSET` pagination; use cursor pagination for deep feeds.
- Review connection-pool saturation separately from query latency.
- Recommend caching only after proving repeated expensive reads.
- Do not execute diagnostics on production.
- Do not change application queries during skill-creation or review-only tasks.

## Report Format

1. Endpoint/use case
2. Baseline data size
3. Baseline latency
4. SQL/query count
5. Explain-plan evidence
6. Root cause
7. Proposed minimal change
8. Trade-offs
9. Post-change measurement
10. Remaining risks

## References

- `references/query-diagnosis-workflow.md`
- `references/explain-plan-reading.md`
- `references/index-design.md`
- `references/pagination-patterns.md`
- `references/n-plus-one-review.md`
- `references/connection-pool-review.md`

## Trigger Tests

Should activate:

- "This tenant task list API is slow; analyze the Postgres query."
- "Review whether this index helps the work log feed."
- "Find N+1 queries in the client detail endpoint."

Should not activate:

- "Make the dashboard chart render faster in React."
- "Explain SQL joins generally."
- "Add Redis because this endpoint might be cached later."
