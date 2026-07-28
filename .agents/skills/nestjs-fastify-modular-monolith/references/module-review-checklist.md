# Module Review Checklist

- Does the module have a clear business owner?
- Are controllers thin and transport-only?
- Are DTOs explicit and documented in OpenAPI?
- Are request inputs validated with pipes or validated DTOs?
- Are authentication guards, permission guards, and resource-scope policies applied?
- Is business logic in services or policies, not decorators, controllers, middleware, migrations, or React code?
- Is database access isolated to the owning module repository?
- Is cross-module access performed through exported services, ports, or events?
- Are slow external operations delegated to a worker/outbox?
- Are audit, idempotency, transaction, and concurrency needs handled?
- Are unit, API integration, authorization, and tenant-isolation tests present where relevant?
- Were format, lint, typecheck, tests, and build run or explicitly reported as blocked?
