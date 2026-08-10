alter table public.notifications
  drop constraint if exists notifications_tenant_id_id_unique,
  add constraint notifications_tenant_id_id_unique unique (tenant_id, id);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  notification_id uuid not null,
  event_type text not null default 'TASK_NOTIFICATION_READY',
  event_key text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_outbox_notification_fk
    foreign key (tenant_id, notification_id)
    references public.notifications (tenant_id, id),
  constraint notification_outbox_event_key_unique unique (event_key),
  constraint notification_outbox_status_check check (status in ('pending', 'processing', 'delivered')),
  constraint notification_outbox_attempts_check check (attempts >= 0)
);

create index notification_outbox_pending_idx
  on public.notification_outbox (next_attempt_at, created_at, id)
  where status in ('pending', 'processing');

alter table public.notification_outbox enable row level security;
alter table public.notification_outbox force row level security;

create policy notification_outbox_insert
on public.notification_outbox
for insert
to app_runtime
with check (private.has_tenant_context(tenant_id));

create policy notification_outbox_select
on public.notification_outbox
for select
to app_runtime, app_readonly
using (private.is_platform_admin() or private.has_tenant_context(tenant_id));

create policy notification_outbox_update_deny
on public.notification_outbox
for update
to app_runtime
using (false)
with check (false);

create policy notification_outbox_delete_deny
on public.notification_outbox
for delete
to app_runtime
using (false);

grant select, insert on public.notification_outbox to app_runtime;
grant select on public.notification_outbox to app_readonly;

create or replace function private.claim_task_notification_outbox(p_limit integer default 50)
returns table (event_id uuid, tenant_id uuid, notification_id uuid)
language sql
security definer
set search_path = public, private, pg_temp
as $$
  with candidates as (
    select id
    from public.notification_outbox
    where event_type = 'TASK_NOTIFICATION_READY'
      and (
        (status = 'pending' and next_attempt_at <= clock_timestamp())
        or (status = 'processing' and locked_at <= clock_timestamp() - interval '5 minutes')
      )
    order by next_attempt_at, created_at, id
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    for update skip locked
  )
  update public.notification_outbox outbox
  set status = 'processing',
      attempts = outbox.attempts + 1,
      locked_at = clock_timestamp(),
      updated_at = clock_timestamp()
  from candidates
  where outbox.id = candidates.id
  returning outbox.id, outbox.tenant_id, outbox.notification_id;
$$;

create or replace function private.get_task_notification_outbox_recipients(p_event_id uuid)
returns table (
  recipient_user_id uuid,
  notification_id uuid,
  notification_type text,
  title text,
  message text,
  severity text,
  tenant_id uuid,
  action_url text,
  created_at timestamptz,
  read_at timestamptz
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select
    recipient.recipient_user_id,
    notification.id,
    notification.type,
    notification.title,
    notification.message,
    notification.severity,
    notification.tenant_id,
    notification.action_url,
    notification.created_at,
    recipient.read_at
  from public.notification_outbox outbox
  join public.notifications notification
    on notification.tenant_id = outbox.tenant_id
   and notification.id = outbox.notification_id
  join public.notification_recipients recipient
    on recipient.notification_id = notification.id
  where outbox.id = p_event_id
    and outbox.status = 'processing';
$$;

create or replace function private.complete_task_notification_outbox(p_event_id uuid)
returns void
language sql
security definer
set search_path = public, private, pg_temp
as $$
  update public.notification_outbox
  set status = 'delivered',
      delivered_at = clock_timestamp(),
      locked_at = null,
      updated_at = clock_timestamp()
  where id = p_event_id
    and status = 'processing';
$$;

create or replace function private.retry_task_notification_outbox(p_event_id uuid)
returns void
language sql
security definer
set search_path = public, private, pg_temp
as $$
  update public.notification_outbox
  set status = 'pending',
      locked_at = null,
      next_attempt_at = clock_timestamp() + make_interval(secs => least(60, attempts * 2)),
      updated_at = clock_timestamp()
  where id = p_event_id
    and status = 'processing';
$$;

revoke all on function private.claim_task_notification_outbox(integer) from public;
revoke all on function private.get_task_notification_outbox_recipients(uuid) from public;
revoke all on function private.complete_task_notification_outbox(uuid) from public;
revoke all on function private.retry_task_notification_outbox(uuid) from public;
grant execute on function private.claim_task_notification_outbox(integer) to app_runtime;
grant execute on function private.get_task_notification_outbox_recipients(uuid) to app_runtime;
grant execute on function private.complete_task_notification_outbox(uuid) to app_runtime;
grant execute on function private.retry_task_notification_outbox(uuid) to app_runtime;
