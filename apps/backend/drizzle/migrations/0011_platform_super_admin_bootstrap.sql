create table public.platform_user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id),
  role_id uuid not null references public.roles (id),
  role_scope text not null default 'platform',
  status text not null default 'active',
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint platform_user_roles_status_check check (status in ('active', 'revoked')),
  constraint platform_user_roles_role_scope_check check (role_scope = 'platform'),
  constraint platform_user_roles_user_role_unique unique (user_id, role_id)
);

alter table public.roles
  add constraint roles_id_scope_unique unique (id, scope);

alter table public.platform_user_roles
  add constraint platform_user_roles_platform_role_fk foreign key (role_id, role_scope)
    references public.roles (id, scope);

create index platform_user_roles_user_status_idx
  on public.platform_user_roles (user_id, status, role_id);

alter table public.platform_user_roles enable row level security;
alter table public.platform_user_roles force row level security;

create policy platform_user_roles_select
on public.platform_user_roles
for select
to app_runtime, app_readonly
using (user_id = private.current_user_id() or private.is_platform_admin());

create policy platform_user_roles_insert_deny
on public.platform_user_roles
for insert
to app_runtime
with check (false);

create policy platform_user_roles_update_deny
on public.platform_user_roles
for update
to app_runtime
using (false)
with check (false);

create policy platform_user_roles_delete_deny
on public.platform_user_roles
for delete
to app_runtime
using (false);

grant select on public.platform_user_roles to app_runtime, app_readonly;

create or replace function private.current_platform_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.users u
    join public.platform_user_roles pur on pur.user_id = u.id
    join public.roles r on r.id = pur.role_id
    where u.id = private.current_user_id()
      and u.status = 'active'
      and pur.status = 'active'
      and r.code = 'SUPER_ADMIN'
      and r.scope = 'platform'
  )
$$;

create or replace function private.create_tenant_owner_invitation(
  p_tenant_code text,
  p_company_name text,
  p_owner_email text,
  p_owner_name text,
  p_country text default null,
  p_currency text default null,
  p_timezone text default 'UTC',
  p_expires_at timestamptz default null
)
returns table (tenant_id uuid, invitation_id uuid)
language plpgsql
security definer
set search_path = public, private, audit, pg_temp
as $$
declare
  owner_role_id uuid;
begin
  if not private.is_platform_admin() or not private.current_platform_user_is_active() then
    raise exception 'Only an active Super Admin may create tenants.' using errcode = '42501';
  end if;

  if p_tenant_code !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' then
    raise exception 'Tenant code is invalid.' using errcode = '23514';
  end if;

  select id into owner_role_id
  from public.roles
  where code = 'TENANT_OWNER'
    and scope = 'tenant';

  insert into public.tenants (code, legal_name, display_name, status, country, currency, timezone)
  values (
    p_tenant_code,
    p_company_name,
    p_company_name,
    'pending_activation',
    p_country,
    p_currency,
    coalesce(nullif(p_timezone, ''), 'UTC')
  )
  returning id into tenant_id;

  insert into public.invitations (
    tenant_id,
    email,
    email_normalized,
    invitee_display_name,
    intended_role_id,
    invited_by_user_id,
    invited_by_membership_id,
    expires_at
  )
  values (
    tenant_id,
    p_owner_email,
    lower(p_owner_email),
    p_owner_name,
    owner_role_id,
    private.current_user_id(),
    null,
    coalesce(p_expires_at, now() + interval '1 hour')
  )
  returning id into invitation_id;

  perform audit.write_audit_event(
    'tenant.created',
    'tenant',
    tenant_id,
    'succeeded',
    null,
    jsonb_build_object('owner_email', lower(p_owner_email), 'invitation_id', invitation_id)
  );

  return next;
end;
$$;

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
      coalesce(array_remove(array_agg(distinct r.code order by r.code), null), '{}'::text[]) as role_codes,
      coalesce(array_remove(array_agg(distinct p.code order by p.code), null), '{}'::text[]) as permission_codes
    from app_user u
    join public.tenant_memberships tm
      on tm.user_id = u.id
     and tm.status <> 'removed'
    join public.tenants t
      on t.id = tm.tenant_id
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
      tm.timezone
  )
  select *
  from platform_context
  union all
  select *
  from tenant_context
  order by tenant_display_name nulls first, membership_id nulls first;
$$;

revoke all on function private.current_platform_user_is_active() from public;
revoke all on function private.create_tenant_owner_invitation(text, text, text, text, text, text, text, timestamptz) from public;
revoke all on function private.resolve_auth_context(uuid) from public;

grant execute on function private.current_platform_user_is_active() to app_runtime, app_readonly;
grant execute on function private.create_tenant_owner_invitation(text, text, text, text, text, text, text, timestamptz) to app_runtime;
grant execute on function private.resolve_auth_context(uuid) to app_runtime;
