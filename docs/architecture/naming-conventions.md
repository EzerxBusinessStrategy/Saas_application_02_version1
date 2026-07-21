# Naming conventions

Use Tenant, Tenant Owner, Tenant Admin, Manager, Employee, Client, Service Engagement, Work Group, Task, Work Log, Invoice, Agreement, and Document. A Manager is a tenant role, never a sub-tenant. Use kebab-case paths/files, PascalCase React symbols, camelCase values/functions, UPPER_SNAKE_CASE constants/environment variables, snake_case plural database tables, UUID IDs, tenant_id, and ISO 8601 dates.

Use `/api/v1/work-groups`, camelCase JSON, `resource.action.scope` permissions such as `task.update-status.assigned-group`, past-tense events such as `task.submitted`, and tenant-prefixed cache keys: `tenant:{tenantId}:resource:{resourceId}`. Public environment values must start `NEXT_PUBLIC_` and never contain secrets.
