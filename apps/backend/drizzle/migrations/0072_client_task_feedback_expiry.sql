alter table public.client_task_feedback
  add column if not exists status text not null default 'submitted';

alter table public.client_task_feedback
  alter column task_rating drop not null;

alter table public.client_task_feedback
  alter column employee_rating drop not null;

alter table public.client_task_feedback
  alter column submitted_by_user_id drop not null;

alter table public.client_task_feedback
  drop constraint if exists client_task_feedback_task_rating_check;

alter table public.client_task_feedback
  drop constraint if exists client_task_feedback_employee_rating_check;

alter table public.client_task_feedback
  add constraint client_task_feedback_status_check
    check (status in ('submitted', 'expired'));

alter table public.client_task_feedback
  add constraint client_task_feedback_rating_status_check
    check (
      (
        status = 'submitted'
        and task_rating between 1 and 5
        and employee_rating between 1 and 5
        and submitted_by_user_id is not null
      )
      or (
        status = 'expired'
        and task_rating is null
        and employee_rating is null
      )
    );

create index if not exists client_task_feedback_tenant_status_created_idx
  on public.client_task_feedback (tenant_id, status, created_at desc, id);

create or replace function private.expire_unanswered_client_task_feedback()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_count integer := 0;
begin
  insert into public.client_task_feedback (
    tenant_id,
    client_id,
    task_id,
    invoice_id,
    employee_id,
    task_rating,
    employee_rating,
    submitted_by_user_id,
    idempotency_key,
    status
  )
  select distinct on (t.tenant_id, t.id)
    t.tenant_id,
    i.client_id,
    t.id,
    i.id,
    e.id,
    null,
    null,
    null,
    'expired:' || t.tenant_id::text || ':' || t.id::text,
    'expired'
  from public.invoices i
  join public.invoice_items ii
    on ii.tenant_id = i.tenant_id
   and ii.invoice_id = i.id
  join public.tasks t
    on t.tenant_id = ii.tenant_id
   and t.id = ii.task_id
  join public.task_assignments ta
    on ta.tenant_id = t.tenant_id
   and ta.task_id = t.id
   and ta.status not in ('removed', 'cancelled')
  join public.employees e
    on e.tenant_id = ta.tenant_id
   and e.id = ta.employee_id
  where i.status not in ('draft', 'cancelled', 'void')
    and i.finalized_at is not null
    and t.status = 'completed'
    and coalesce(t.actual_completed_at, t.updated_at) + interval '60 days' <= now()
    and not exists (
      select 1
      from public.client_task_feedback existing
      where existing.tenant_id = t.tenant_id
        and existing.task_id = t.id
    )
  order by t.tenant_id, t.id, ta.updated_at desc, i.finalized_at desc
  on conflict (tenant_id, task_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function private.expire_unanswered_client_task_feedback() from public;
grant execute on function private.expire_unanswered_client_task_feedback() to app_runtime;
