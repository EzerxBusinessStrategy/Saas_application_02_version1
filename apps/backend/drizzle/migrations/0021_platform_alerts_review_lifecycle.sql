create table public.platform_alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text not null,
  severity text not null,
  tenant_id uuid references public.tenants (id),
  entity_type text,
  entity_id uuid,
  action_url text,
  status text not null default 'open',
  viewed_at timestamptz,
  viewed_by_user_id uuid references public.users (id),
  resolved_at timestamptz,
  resolved_by_user_id uuid references public.users (id),
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_alerts_type_check check (type ~ '^[A-Z][A-Z0-9_]*$'),
  constraint platform_alerts_severity_check check (severity in ('INFO', 'WARNING', 'CRITICAL')),
  constraint platform_alerts_status_check check (status in ('open', 'viewed', 'resolved', 'dismissed')),
  constraint platform_alerts_action_url_check check (action_url is null or action_url like '/%'),
  constraint platform_alerts_idempotency_unique unique (idempotency_key)
);

create index platform_alerts_status_created_idx
  on public.platform_alerts (status, created_at desc, id);

create index platform_alerts_tenant_status_idx
  on public.platform_alerts (tenant_id, status, created_at desc, id)
  where tenant_id is not null;

alter table public.platform_alerts enable row level security;
alter table public.platform_alerts force row level security;

create policy platform_alerts_select
on public.platform_alerts
for select
to app_runtime, app_readonly
using (private.is_platform_admin());

create policy platform_alerts_insert
on public.platform_alerts
for insert
to app_runtime
with check (private.is_platform_admin());

create policy platform_alerts_update
on public.platform_alerts
for update
to app_runtime
using (private.is_platform_admin())
with check (private.is_platform_admin());

create policy platform_alerts_delete_deny
on public.platform_alerts
for delete
to app_runtime
using (false);

grant select, insert, update on public.platform_alerts to app_runtime;
grant select on public.platform_alerts to app_readonly;

alter table public.tenant_reviews
  add column if not exists priority text not null default 'normal',
  add column if not exists assigned_user_id uuid references public.users (id),
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists internal_notes text,
  add column if not exists resolution text,
  add column if not exists last_action_by_user_id uuid references public.users (id);

alter table public.tenant_reviews
  drop constraint if exists tenant_reviews_priority_check,
  add constraint tenant_reviews_priority_check check (priority in ('low', 'normal', 'high', 'critical'));

drop policy if exists tenant_reviews_insert on public.tenant_reviews;
drop policy if exists tenant_reviews_update on public.tenant_reviews;
drop policy if exists tenant_reviews_delete on public.tenant_reviews;

create policy tenant_reviews_insert
on public.tenant_reviews
for insert
to app_runtime
with check (private.is_platform_admin() or private.has_tenant_context(tenant_id));

create policy tenant_reviews_update
on public.tenant_reviews
for update
to app_runtime
using (private.is_platform_admin() or private.has_tenant_context(tenant_id))
with check (private.is_platform_admin() or private.has_tenant_context(tenant_id));

create policy tenant_reviews_delete
on public.tenant_reviews
for delete
to app_runtime
using (private.has_tenant_context(tenant_id));
