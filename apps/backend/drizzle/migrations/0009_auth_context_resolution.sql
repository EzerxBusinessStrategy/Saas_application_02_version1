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
  select
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
    coalesce(array_remove(array_agg(distinct r.code order by r.code), null), '{}'::text[]),
    coalesce(array_remove(array_agg(distinct p.code order by p.code), null), '{}'::text[])
  from public.users u
  left join public.tenant_memberships tm
    on tm.user_id = u.id
   and tm.status <> 'removed'
  left join public.tenants t
    on t.id = tm.tenant_id
  left join public.membership_roles mr
    on mr.tenant_id = tm.tenant_id
   and mr.membership_id = tm.id
  left join public.roles r
    on r.id = mr.role_id
  left join public.role_permissions rp
    on rp.role_id = r.id
  left join public.permissions p
    on p.id = rp.permission_id
  where u.supabase_auth_user_id = p_supabase_auth_user_id
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
  order by t.display_name nulls last, tm.id nulls last;
$$;

revoke all on function private.resolve_auth_context(uuid) from public;
grant execute on function private.resolve_auth_context(uuid) to app_runtime;
