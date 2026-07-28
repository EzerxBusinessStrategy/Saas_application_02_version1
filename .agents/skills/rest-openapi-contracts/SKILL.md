---
name: rest-openapi-contracts
description: Create and review stable REST API contracts for this SaaS using NestJS Swagger/OpenAPI and generated frontend clients. Use when designing backend endpoints, DTOs, pagination/filtering/sorting, idempotent mutations, API error models, or frontend contract migration for the existing Next.js and TanStack Query frontend. Do not use for frontend-only UI work, generic HTTP questions, or real endpoint implementation unless the user explicitly asks for implementation.
---

# REST OpenAPI Contracts

## Workflow

1. Read `AGENTS.md`, `docs/architecture/api-contract-rules.md`, `docs/api/provisional-contracts.md`, and relevant ADRs.
2. Inspect the owning frontend types, mock data, and `src/features/*/api` functions before designing the contract.
3. Identify the consumer, use case, resource owner, authorization policy, and existing provisional contract.
4. Design the smallest stable `/api/v1` REST contract that preserves frontend compatibility where possible.
5. Use action endpoints only for meaningful state transitions, not generic field updates.
6. Define explicit request DTOs, response DTOs, error responses, and OpenAPI success/error documentation.
7. Add pagination, filtering, sorting, idempotency, optimistic concurrency, audit, and outbox requirements only where the use case needs them.
8. Do not generate real endpoints during contract-design work unless the user separately asks for implementation.

## Contract Rules

- Use `/api/v1` as the base path.
- Prefer resource-oriented endpoints.
- Never expose raw database rows as public API responses.
- Never accept authority-bearing `tenantId`, role, permission, actor, employee, client, or membership fields from the browser.
- Use bounded pagination and allowlists for filter and sort fields.
- Use cursor pagination for large or rapidly changing feeds.
- Require idempotency headers for critical mutations.
- Require optimistic concurrency or expected-version checks where competing decisions can occur.
- Document authentication and permission requirements in OpenAPI.
- Evolve contracts additively when possible; provide a version or migration plan for breaking changes.
- Do not create giant endpoints that return every nested relation.

## Output Format

Every API-design output must contain:

1. Consumer/use case
2. Endpoint
3. Authentication
4. Authorization
5. Request
6. Response
7. Errors
8. Pagination/filtering
9. Idempotency/concurrency
10. Audit/outbox impact
11. Frontend migration impact

## References

- Resource naming: `references/resource-naming.md`
- Status and error model: `references/http-status-and-error-model.md`
- Pagination/filtering/sorting: `references/pagination-filtering-sorting.md`
- Idempotent mutations: `references/idempotent-mutation-contract.md`
- OpenAPI review: `references/openapi-review-checklist.md`
- Frontend client generation: `references/frontend-client-generation.md`

## Trigger Tests

Should activate:

- "Design the REST contract for manager task approval."
- "Review the OpenAPI DTOs for client invoices."
- "Add pagination and filters to the work log API contract."

Should not activate:

- "Fix the spacing on the invoice card."
- "Explain what HTTP GET means."
- "Write a one-off script to rename files."
