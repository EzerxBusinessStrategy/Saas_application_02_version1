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
set search_path = public, private, authn, audit, pg_temp
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
    activity.last_login_at,
    activity.last_logout_at,
    activity.password_changed_at
  from requested
  left join lateral (
    select
      tm.id as membership_id,
      tm.user_id,
      tm.display_name,
      tm.last_access_at,
      u.email,
      u.last_login_at as user_last_login_at,
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
    select
      greatest(
        administrator.user_last_login_at,
        administrator.last_access_at,
        (
          select max(c.last_login_at)
          from authn.credentials c
          where administrator.user_id is not null
            and c.user_id = administrator.user_id
            and (c.tenant_id = requested.id or c.tenant_id is null)
        ),
        (
          select max(s.last_seen_at)
          from authn.sessions s
          where administrator.user_id is not null
            and s.user_id = administrator.user_id
            and (s.tenant_id = requested.id or s.tenant_id is null)
        ),
        (
          select max(ae.created_at)
          from audit.audit_events ae
          where ae.tenant_id = requested.id
            and ae.action = 'TENANT_ADMIN_LOGGED_IN'
            and ae.actor_membership_id = administrator.membership_id
        )
      ) as last_login_at,
      greatest(
        (
          select max(s.revoked_at)
          from authn.sessions s
          where administrator.user_id is not null
            and s.user_id = administrator.user_id
            and s.revoked_at is not null
            and (s.tenant_id = requested.id or s.tenant_id is null)
        ),
        (
          select max(ae.created_at)
          from audit.audit_events ae
          where ae.tenant_id = requested.id
            and ae.action = 'TENANT_ADMIN_LOGGED_OUT'
            and ae.actor_membership_id = administrator.membership_id
        )
      ) as last_logout_at,
      coalesce(
        (
          select max(c.password_changed_at)
          from authn.credentials c
          where administrator.user_id is not null
            and c.user_id = administrator.user_id
            and (c.tenant_id = requested.id or c.tenant_id is null)
        ),
        (
          select max(ae.created_at)
          from audit.audit_events ae
          where ae.tenant_id = requested.id
            and ae.action = 'TENANT_ADMIN_PASSWORD_RESET_SUCCEEDED'
            and ae.metadata ->> 'targetUserId' = administrator.user_id::text
        )
      ) as password_changed_at
  ) activity on true;
end;
$$;

revoke all on function private.list_super_admin_tenant_administrator_access(uuid[]) from public;
grant execute on function private.list_super_admin_tenant_administrator_access(uuid[]) to app_runtime;
