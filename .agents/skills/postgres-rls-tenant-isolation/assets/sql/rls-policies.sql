-- Generic template only. Split policies per operation when rules differ.
alter table example_records enable row level security;
alter table example_records force row level security;

create policy example_records_select
on example_records
for select
to app_runtime
using (tenant_id = current_setting('app.tenant_id', true)::uuid);

create policy example_records_insert
on example_records
for insert
to app_runtime
with check (tenant_id = current_setting('app.tenant_id', true)::uuid);
