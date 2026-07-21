# Multi-tenant rules

Tenant identity comes from trusted membership/platform context, never request input. Tenant-owned records require tenant_id, tenant-leading indexes, tenant-scoped unique constraints, composite tenant foreign keys, RLS, tenant-aware caches/jobs/rooms/storage/logs, and automated Tenant A/B isolation tests. Frontend checks are not security controls.
