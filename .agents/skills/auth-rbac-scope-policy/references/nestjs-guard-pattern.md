# NestJS Guard Pattern

- Authentication guard verifies the session/JWT.
- Context resolver loads trusted user, tenant membership, roles, permissions, employee/client scope, and support session.
- Permission guard checks action-level permission.
- Resource policy checks record-level scope in the service or policy layer.
- RLS context is set before tenant-owned database queries.

Do not trust request body or query fields for tenant, role, actor, membership, employee, manager, or client identity.
