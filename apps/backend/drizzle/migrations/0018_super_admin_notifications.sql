create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text not null,
  severity text not null default 'INFO',
  tenant_id uuid references public.tenants (id),
  actor_user_id uuid references public.users (id),
  entity_type text,
  entity_id uuid,
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (type ~ '^[A-Z][A-Z0-9_]*$'),
  constraint notifications_severity_check check (severity in ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL')),
  constraint notifications_action_url_check check (action_url is null or action_url like '/%')
);

create table public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  recipient_user_id uuid not null references public.users (id),
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_recipients_notification_user_unique unique (notification_id, recipient_user_id)
);

create unique index notifications_idempotency_key_uidx
  on public.notifications (idempotency_key)
  where idempotency_key is not null;

create index notifications_created_idx
  on public.notifications (created_at desc, id);

create index notifications_tenant_created_idx
  on public.notifications (tenant_id, created_at desc, id)
  where tenant_id is not null;

create index notification_recipients_user_unread_idx
  on public.notification_recipients (recipient_user_id, created_at desc, notification_id)
  where read_at is null;

create index notification_recipients_user_created_idx
  on public.notification_recipients (recipient_user_id, created_at desc, notification_id);

alter table public.notifications enable row level security;
alter table public.notifications force row level security;
alter table public.notification_recipients enable row level security;
alter table public.notification_recipients force row level security;

create policy notifications_select
on public.notifications
for select
to app_runtime, app_readonly
using (
  private.is_platform_admin()
  and exists (
    select 1
    from public.notification_recipients nr
    where nr.notification_id = notifications.id
      and nr.recipient_user_id = private.current_user_id()
  )
);

create policy notifications_insert
on public.notifications
for insert
to app_runtime
with check (private.is_platform_admin());

create policy notifications_update_deny
on public.notifications
for update
to app_runtime
using (false)
with check (false);

create policy notifications_delete_deny
on public.notifications
for delete
to app_runtime
using (false);

create policy notification_recipients_select
on public.notification_recipients
for select
to app_runtime, app_readonly
using (
  private.is_platform_admin()
  and recipient_user_id = private.current_user_id()
);

create policy notification_recipients_insert
on public.notification_recipients
for insert
to app_runtime
with check (private.is_platform_admin());

create policy notification_recipients_update
on public.notification_recipients
for update
to app_runtime
using (
  private.is_platform_admin()
  and recipient_user_id = private.current_user_id()
)
with check (
  private.is_platform_admin()
  and recipient_user_id = private.current_user_id()
);

create policy notification_recipients_delete_deny
on public.notification_recipients
for delete
to app_runtime
using (false);

grant select, insert on public.notifications to app_runtime;
grant select on public.notifications to app_readonly;
grant select, insert, update on public.notification_recipients to app_runtime;
grant select on public.notification_recipients to app_readonly;
