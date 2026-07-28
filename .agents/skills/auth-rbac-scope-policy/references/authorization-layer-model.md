# Authorization Layer Model

Evaluate in this order:

1. Authentication verifies identity.
2. Tenant membership proves the user belongs to the tenant.
3. RBAC permits the action type.
4. Resource-scope policy permits the specific record.
5. RLS limits database rows for defense in depth.

Do not skip scope policy because a role has a broad permission. A manager with task access still needs assigned work-group scope.
