create table public.task_work_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  task_id uuid not null,
  employee_id uuid not null,
  status text not null default 'active',
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_work_sessions_tenant_id_id_unique unique (tenant_id, id),
  constraint task_work_sessions_assignment_fk foreign key (tenant_id, task_id, employee_id)
    references public.task_assignments (tenant_id, task_id, employee_id),
  constraint task_work_sessions_status_check check (status in ('active', 'paused', 'completed')),
  constraint task_work_sessions_completed_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

create table public.task_work_segments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  task_id uuid not null,
  employee_id uuid not null,
  work_session_id uuid not null,
  started_at timestamptz not null default clock_timestamp(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint task_work_segments_tenant_id_id_unique unique (tenant_id, id),
  constraint task_work_segments_session_fk foreign key (tenant_id, work_session_id)
    references public.task_work_sessions (tenant_id, id),
  constraint task_work_segments_assignment_fk foreign key (tenant_id, task_id, employee_id)
    references public.task_assignments (tenant_id, task_id, employee_id),
  constraint task_work_segments_time_check check (ended_at is null or ended_at >= started_at)
);

create unique index task_work_sessions_open_assignment_uidx
  on public.task_work_sessions (tenant_id, task_id, employee_id)
  where status in ('active', 'paused');

create unique index task_work_segments_one_active_employee_uidx
  on public.task_work_segments (tenant_id, employee_id)
  where ended_at is null;

create index task_work_segments_task_employee_idx
  on public.task_work_segments (tenant_id, task_id, employee_id, started_at);

alter table public.task_work_sessions enable row level security;
alter table public.task_work_sessions force row level security;
alter table public.task_work_segments enable row level security;
alter table public.task_work_segments force row level security;

create policy task_work_sessions_select
on public.task_work_sessions
for select
to app_runtime, app_readonly
using (private.is_platform_admin() or private.has_tenant_context(tenant_id));

create policy task_work_sessions_insert
on public.task_work_sessions
for insert
to app_runtime
with check (private.has_tenant_context(tenant_id));

create policy task_work_sessions_update
on public.task_work_sessions
for update
to app_runtime
using (private.has_tenant_context(tenant_id))
with check (private.has_tenant_context(tenant_id));

create policy task_work_sessions_delete_deny
on public.task_work_sessions
for delete
to app_runtime
using (false);

create policy task_work_segments_select
on public.task_work_segments
for select
to app_runtime, app_readonly
using (private.is_platform_admin() or private.has_tenant_context(tenant_id));

create policy task_work_segments_insert
on public.task_work_segments
for insert
to app_runtime
with check (private.has_tenant_context(tenant_id));

create policy task_work_segments_update
on public.task_work_segments
for update
to app_runtime
using (private.has_tenant_context(tenant_id))
with check (private.has_tenant_context(tenant_id));

create policy task_work_segments_delete_deny
on public.task_work_segments
for delete
to app_runtime
using (false);

grant select, insert, update on public.task_work_sessions to app_runtime;
grant select on public.task_work_sessions to app_readonly;
grant select, insert, update on public.task_work_segments to app_runtime;
grant select on public.task_work_segments to app_readonly;
