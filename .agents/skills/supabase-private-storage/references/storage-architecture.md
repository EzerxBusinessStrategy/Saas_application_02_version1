# Storage Architecture

- Store bytes in private Supabase Storage.
- Store metadata, versions, grants, scanning state, and audit references in PostgreSQL.
- Use object keys scoped by tenant and document identity.
- Never derive authorization from object key alone.
- Keep service-role credentials server-only.
