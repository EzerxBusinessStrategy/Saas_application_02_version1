# RLS Design Pattern

1. Classify the table as tenant-owned, global, or audit-owned.
2. Add `tenant_id uuid not null` to tenant-owned tables.
3. Enable and force RLS before production use.
4. Grant access to the non-owner runtime role only through explicit policies.
5. Use `current_setting('app.tenant_id', true)` and related trusted context set inside the transaction.
6. Keep helper functions in a private schema when policies become hard to read.
7. Index columns referenced by policies.

Base tenant policy shape:

```sql
alter table example_records enable row level security;
alter table example_records force row level security;

create policy example_records_select
on example_records
for select
to app_runtime
using (tenant_id = current_setting('app.tenant_id', true)::uuid);
```
