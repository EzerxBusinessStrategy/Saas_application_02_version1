create table public.client_task_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid not null,
  task_id uuid not null,
  invoice_id uuid not null,
  employee_id uuid not null,
  task_rating smallint not null,
  employee_rating smallint not null,
  submitted_by_user_id uuid not null references public.users (id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint client_task_feedback_tenant_id_id_unique unique (tenant_id, id),
  constraint client_task_feedback_idempotency_unique unique (tenant_id, idempotency_key),
  constraint client_task_feedback_task_unique unique (tenant_id, task_id),
  constraint client_task_feedback_task_rating_check check (task_rating between 1 and 5),
  constraint client_task_feedback_employee_rating_check check (employee_rating between 1 and 5),
  constraint client_task_feedback_client_fk
    foreign key (tenant_id, client_id)
    references public.clients (tenant_id, id),
  constraint client_task_feedback_task_fk
    foreign key (tenant_id, task_id)
    references public.tasks (tenant_id, id),
  constraint client_task_feedback_invoice_fk
    foreign key (tenant_id, invoice_id)
    references public.invoices (tenant_id, id),
  constraint client_task_feedback_employee_fk
    foreign key (tenant_id, employee_id)
    references public.employees (tenant_id, id)
);

create index client_task_feedback_tenant_created_idx
  on public.client_task_feedback (tenant_id, created_at desc, id);

create index client_task_feedback_tenant_employee_created_idx
  on public.client_task_feedback (tenant_id, employee_id, created_at desc, id);

create index client_task_feedback_tenant_client_created_idx
  on public.client_task_feedback (tenant_id, client_id, created_at desc, id);

alter table public.client_task_feedback enable row level security;
alter table public.client_task_feedback force row level security;

create policy client_task_feedback_select
on public.client_task_feedback
for select
to app_runtime, app_readonly
using (private.is_platform_admin() or private.has_tenant_context(tenant_id));

create policy client_task_feedback_insert
on public.client_task_feedback
for insert
to app_runtime
with check (private.has_tenant_context(tenant_id));

create policy client_task_feedback_update
on public.client_task_feedback
for update
to app_runtime
using (false);

create policy client_task_feedback_delete
on public.client_task_feedback
for delete
to app_runtime
using (false);

grant select, insert on public.client_task_feedback to app_runtime;
grant select on public.client_task_feedback to app_readonly;
