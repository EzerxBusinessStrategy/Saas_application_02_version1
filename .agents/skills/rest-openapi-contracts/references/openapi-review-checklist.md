# OpenAPI Review Checklist

- Document authentication and permissions.
- Document success and error responses.
- Ensure DTOs do not leak database internals.
- Include examples for important states only.
- Confirm no browser payload contains trusted tenant, role, actor, or scope fields.
- Confirm pagination and sort parameters are bounded and allowlisted.
- Confirm breaking changes include a migration plan.
