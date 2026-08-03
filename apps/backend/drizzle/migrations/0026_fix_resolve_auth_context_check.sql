-- Migration 0026: Fix resolve_auth_context security check
-- The double-check in migration 0012 is too restrictive and prevents login
-- Remove the redundant current_auth_user_id() check

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
