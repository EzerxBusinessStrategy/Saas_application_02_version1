create table public.employee_manager_assignments (
  tenant_id uuid not null,
  employee_id uuid not null,
  manager_employee_id uuid not null,
  assigned_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_manager_assignments_pkey primary key (tenant_id, employee_id),
  constraint employee_manager_assignments_employee_fk foreign key (tenant_id, employee_id)
    references public.employees (tenant_id, id),
  constraint employee_manager_assignments_manager_fk foreign key (tenant_id, manager_employee_id)
    references public.employees (tenant_id, id),
  constraint employee_manager_assignments_assigned_by_fk foreign key (tenant_id, assigned_by)
    references public.tenant_memberships (tenant_id, id),
  constraint employee_manager_assignments_not_self_check check (employee_id <> manager_employee_id)
);

create index employee_manager_assignments_manager_idx
  on public.employee_manager_assignments (tenant_id, manager_employee_id);

alter table public.employee_manager_assignments enable row level security;
alter table public.employee_manager_assignments force row level security;

create policy employee_manager_assignments_select
on public.employee_manager_assignments
for select
to app_runtime, app_readonly
using (private.is_platform_admin() or private.has_tenant_context(tenant_id));

create policy employee_manager_assignments_insert
on public.employee_manager_assignments
for insert
to app_runtime
with check (private.has_tenant_context(tenant_id));

create policy employee_manager_assignments_update
on public.employee_manager_assignments
for update
to app_runtime
using (private.has_tenant_context(tenant_id))
with check (private.has_tenant_context(tenant_id));

create policy employee_manager_assignments_delete
on public.employee_manager_assignments
for delete
to app_runtime
using (private.has_tenant_context(tenant_id));

grant select, insert, update, delete on public.employee_manager_assignments to app_runtime;
grant select on public.employee_manager_assignments to app_readonly;
