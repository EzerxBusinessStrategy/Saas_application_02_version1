---
name: nestjs-fastify-modular-monolith
description: Use when Codex is asked to create or modify NestJS backend modules, design module boundaries, add controllers, services, policies, or repositories, configure NestJS with the Fastify adapter, or review modular-monolith backend architecture. Do not use for frontend-only work, generic JavaScript questions, small scripts, or unrelated infrastructure tasks.
---

# NestJS Fastify Modular Monolith

Use this skill only for approved backend work or architecture review in this repository.

## Workflow

1. Inspect `AGENTS.md`, `docs/architecture/`, `docs/architecture/adr/`, `docs/api/`, and relevant security/testing docs.
2. Inspect the owning frontend contract in `src/features/**/api/`, `src/types/`, and `src/mocks/`.
3. Identify the business domain owner before naming files or modules.
4. Propose module and dependency boundaries before editing.
5. Ask for approval if boundaries, tenancy, authorization, API contracts, queues, caches, storage, billing, audit, or deployment architecture change.
6. Implement the smallest coherent slice that satisfies the approved request.
7. Validate controllers, services, policies, repositories, DTOs, guards, database behavior, and tests affected by the change.
8. Report changed files, decisions, tests, and remaining risks.

## Rules

- Use Node.js with strict TypeScript.
- Use NestJS with the Fastify adapter.
- Preserve the modular-monolith architecture.
- Build business-domain modules, not technical mega-folders.
- Keep controllers thin and transport-focused.
- Put business logic in application services and domain policies.
- Put database access in the owning module's repository.
- Never access another module's repository directly.
- Communicate across modules through exported application services, explicit ports, or application/domain events.
- Use constructor dependency injection.
- Use explicit request and response DTOs.
- Use NestJS guards for authentication and authorization.
- Use pipes or validated DTOs for request input.
- Use exception filters or consistent domain-to-HTTP error mapping.
- Use interceptors only for genuine cross-cutting concerns.
- Avoid unnecessary microservices and CQRS boilerplate.
- Let API and worker processes share modules but use different entrypoints where appropriate.
- Delegate slow external work to the worker/outbox.
- Document endpoints with Swagger/OpenAPI.
- Add unit, integration, authorization, and tenant-isolation tests proportionate to risk.
- Run format, lint, typecheck, tests, and build before claiming completion.

## References

- `references/module-boundary-rules.md`
- `references/recommended-folder-structure.md`
- `references/controller-service-repository-example.md`
- `references/module-review-checklist.md`

## Templates

Use `assets/nest-module-template/` only as small non-production starting points. Adapt names, contracts, policies, and tests to the real domain.

## Trigger Tests

Should activate:

- "Create a NestJS Tasks module with controller, service, policy, repository, DTOs, and tests."
- "Review whether the Billing and Documents modules violate modular-monolith boundaries."
- "Configure the backend bootstrap to use NestJS with the Fastify adapter."

Should not activate:

- "Fix the mobile sidebar CSS on the employee portal."
- "Explain how JavaScript promises work."
- "Write a small script to rename image files."
