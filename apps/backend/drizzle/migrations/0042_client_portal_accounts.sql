create table public.client_portal_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid not null,
  user_id uuid not null references public.users (id),
  membership_id uuid not null,
  email text not null,
  email_normalized text not null,
  phone text,
  status text not null default 'active',
  created_by_membership_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_portal_accounts_status_check check (status in ('active', 'suspended', 'removed')),
  constraint client_portal_accounts_email_normalized_check check (email_normalized = lower(email)),
  constraint client_portal_accounts_client_fk foreign key (tenant_id, client_id)
    references public.clients (tenant_id, id),
  constraint client_portal_accounts_membership_fk foreign key (tenant_id, membership_id)
    references public.tenant_memberships (tenant_id, id),
  constraint client_portal_accounts_created_by_fk foreign key (tenant_id, created_by_membership_id)
    references public.tenant_memberships (tenant_id, id)
);

create unique index client_portal_accounts_tenant_client_active_uidx
  on public.client_portal_accounts (tenant_id, client_id)
  where status = 'active';

create unique index client_portal_accounts_tenant_user_active_uidx
  on public.client_portal_accounts (tenant_id, user_id)
  where status = 'active';

create unique index client_portal_accounts_email_normalized_uidx
  on public.client_portal_accounts (email_normalized);

create index client_portal_accounts_membership_idx
  on public.client_portal_accounts (tenant_id, membership_id);

alter table public.client_portal_accounts enable row level security;
alter table public.client_portal_accounts force row level security;

create policy client_portal_accounts_select
on public.client_portal_accounts
for select
to app_runtime, app_readonly
using (
  private.is_platform_admin()
  or private.has_tenant_context(tenant_id)
  or user_id = private.current_user_id()
);

create policy client_portal_accounts_insert
on public.client_portal_accounts
for insert
to app_runtime
with check (private.has_tenant_context(tenant_id));

create policy client_portal_accounts_update
on public.client_portal_accounts
for update
to app_runtime
using (private.has_tenant_context(tenant_id))
with check (private.has_tenant_context(tenant_id));

create policy client_portal_accounts_delete_deny
on public.client_portal_accounts
for delete
to app_runtime
using (false);

grant select, insert, update on public.client_portal_accounts to app_runtime;
grant select on public.client_portal_accounts to app_readonly;

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert
on public.notifications
for insert
to app_runtime
with check (
  private.is_platform_admin()
  or private.has_tenant_context(tenant_id)
);

drop policy if exists notification_recipients_insert on public.notification_recipients;
create policy notification_recipients_insert
on public.notification_recipients
for insert
to app_runtime
with check (
  private.is_platform_admin()
  or private.notification_belongs_to_current_tenant(notification_id)
);

create or replace function private.resolve_auth_context(p_supabase_auth_user_id uuid)
returns table (
  user_id uuid,
  user_email text,
  user_display_name text,
  user_status text,
  tenant_id uuid,
  tenant_code text,
  tenant_display_name text,
  tenant_status text,
  membership_id uuid,
  membership_status text,
  membership_display_name text,
  membership_timezone text,
  client_account_id uuid,
  role_codes text[],
  permission_codes text[]
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  with app_user as (
    select u.*
    from public.users u
    where u.supabase_auth_user_id = p_supabase_auth_user_id
  ),
  platform_context as (
    select
      u.id as user_id,
      u.email as user_email,
      u.display_name as user_display_name,
      u.status as user_status,
      null::uuid as tenant_id,
      null::text as tenant_code,
      null::text as tenant_display_name,
      null::text as tenant_status,
      null::uuid as membership_id,
      null::text as membership_status,
      null::text as membership_display_name,
      null::text as membership_timezone,
      null::uuid as client_account_id,
      coalesce(array_remove(array_agg(distinct r.code order by r.code), null), '{}'::text[]) as role_codes,
      coalesce(array_remove(array_agg(distinct p.code order by p.code), null), '{}'::text[]) as permission_codes
    from app_user u
    join public.platform_user_roles pur
      on pur.user_id = u.id
     and pur.status = 'active'
    join public.roles r
      on r.id = pur.role_id
     and r.scope = 'platform'
    left join public.role_permissions rp
      on rp.role_id = r.id
    left join public.permissions p
      on p.id = rp.permission_id
    group by u.id, u.email, u.display_name, u.status
  ),
  tenant_context as (
    select
      u.id as user_id,
      u.email as user_email,
      u.display_name as user_display_name,
      u.status as user_status,
      tm.tenant_id,
      t.code as tenant_code,
      t.display_name as tenant_display_name,
      t.status as tenant_status,
      tm.id as membership_id,
      tm.status as membership_status,
      tm.display_name as membership_display_name,
      tm.timezone as membership_timezone,
      cpa.client_id as client_account_id,
      coalesce(array_remove(array_agg(distinct r.code order by r.code), null), '{}'::text[]) as role_codes,
      coalesce(array_remove(array_agg(distinct p.code order by p.code), null), '{}'::text[]) as permission_codes
    from app_user u
    join public.tenant_memberships tm
      on tm.user_id = u.id
     and tm.status <> 'removed'
    join public.tenants t
      on t.id = tm.tenant_id
    left join public.client_portal_accounts cpa
      on cpa.tenant_id = tm.tenant_id
     and cpa.membership_id = tm.id
     and cpa.status = 'active'
    left join public.membership_roles mr
      on mr.tenant_id = tm.tenant_id
     and mr.membership_id = tm.id
     and mr.status = 'active'
    left join public.roles r
      on r.id = mr.role_id
    left join public.role_permissions rp
      on rp.role_id = r.id
    left join public.permissions p
      on p.id = rp.permission_id
    group by
      u.id,
      u.email,
      u.display_name,
      u.status,
      tm.tenant_id,
      t.code,
      t.display_name,
      t.status,
      tm.id,
      tm.status,
      tm.display_name,
      tm.timezone,
      cpa.client_id
  )
  select *
  from platform_context
  union all
  select *
  from tenant_context
  order by tenant_display_name nulls first, membership_id nulls first;
$$;
