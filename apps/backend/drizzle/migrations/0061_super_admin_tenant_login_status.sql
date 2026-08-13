create or replace function private.list_super_admin_tenant_administrator_access(p_tenant_ids uuid[])
returns table (
  tenant_id uuid,
  membership_id uuid,
  administrator_name text,
  administrator_email text,
  membership_status text,
  last_login_at timestamptz,
  last_logout_at timestamptz,
  password_changed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, private, authn, pg_temp
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform administrator context is required.' using errcode = '42501';
  end if;

  return query
  with requested as (
    select distinct unnest(coalesce(p_tenant_ids, '{}'::uuid[])) as id
  )
  select
    requested.id,
    administrator.membership_id,
    administrator.display_name,
    administrator.email,
    administrator.membership_status,
    credential.last_login_at,
    session.last_logout_at,
    credential.password_changed_at
  from requested
  left join lateral (
    select
      tm.id as membership_id,
      tm.user_id,
      tm.display_name,
      u.email,
      tm.status as membership_status
    from public.tenant_memberships tm
    join public.users u on u.id = tm.user_id
    join public.membership_roles mr
      on mr.tenant_id = tm.tenant_id
     and mr.membership_id = tm.id
    join public.roles r on r.id = mr.role_id and r.code = 'TENANT_ADMIN'
    where tm.tenant_id = requested.id
    order by (tm.status = 'active') desc, tm.joined_at desc
    limit 1
  ) administrator on true
  left join lateral (
    select c.id, c.last_login_at, c.password_changed_at
    from authn.credentials c
    where c.portal_type = 'TENANT'
      and c.tenant_id = requested.id
      and c.user_id = administrator.user_id
    limit 1
  ) credential on true
  left join lateral (
    select max(s.revoked_at) as last_logout_at
    from authn.sessions s
    where s.portal_type = 'TENANT'
      and s.credential_id = credential.id
  ) session on true;
end;
$$;

revoke all on function private.list_super_admin_tenant_administrator_access(uuid[]) from public;
grant execute on function private.list_super_admin_tenant_administrator_access(uuid[]) to app_runtime;
