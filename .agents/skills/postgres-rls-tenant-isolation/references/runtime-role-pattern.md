# Runtime Role Pattern

- Use a migration/table-owner role for DDL.
- Use a non-owner runtime role for API and worker queries.
- Do not grant `BYPASSRLS` to the runtime role.
- Do not let the runtime role own application tables.
- Run RLS integration tests as the runtime role.
- Set trusted context transaction-locally before tenant queries:

```sql
set local app.user_id = '<trusted-user-uuid>';
set local app.tenant_id = '<trusted-tenant-uuid>';
set local app.membership_id = '<trusted-membership-uuid>';
set local app.is_platform_admin = 'false';
```
