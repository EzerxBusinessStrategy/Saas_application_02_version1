# Supabase Auth Boundary

- Let Supabase Auth verify identity.
- Resolve application user, tenant membership, roles, permissions, employee scope, manager scope, and client scope in the backend.
- Do not trust browser-supplied tenant, role, membership, employee, manager, or client values.
- Do not store authority only in unvalidated JWT metadata.
- Keep service-role credentials server-only.
- Store private Supabase Storage object metadata in PostgreSQL; do not expose internal object keys as authorization.
