# RLS Migration Checklist

- Does every tenant-owned table have `tenant_id`?
- Are tenant-safe composite keys in place before policies rely on joins?
- Is RLS enabled and forced?
- Are policies explicit per operation?
- Does missing policy coverage deny access?
- Does the runtime role lack ownership and `BYPASSRLS`?
- Do tests run as the runtime role?
- Are Tenant A/B read, write, delete, and FK attacks tested?
