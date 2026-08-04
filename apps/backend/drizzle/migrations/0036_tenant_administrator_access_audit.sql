create or replace function private.record_tenant_administrator_session_event(p_event text)
returns void
language plpgsql
security definer
set search_path = public, private, audit, pg_temp
as $$
begin
  if p_event not in ('login', 'logout') then
    raise exception 'Unsupported tenant administrator session event.' using errcode = '22023';
  end if;

  if private.current_tenant_id() is null or private.current_membership_id() is null then
    raise exception 'An active tenant membership context is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.tenant_memberships tm
    join public.membership_roles mr
      on mr.tenant_id = tm.tenant_id
     and mr.membership_id = tm.id
     and mr.status = 'active'
    join public.roles r on r.id = mr.role_id and r.code = 'TENANT_ADMIN'
    where tm.id = private.current_membership_id()
      and tm.tenant_id = private.current_tenant_id()
      and tm.user_id = private.current_user_id()
      and tm.status = 'active'
  ) then
    raise exception 'An active Tenant Administrator membership is required.' using errcode = '42501';
  end if;

  if p_event = 'login' then
    update public.tenant_memberships
    set last_active_at = now(),
        last_access_at = now(),
        updated_at = now()
    where id = private.current_membership_id();
  end if;

  perform audit.write_audit_event(
    case when p_event = 'login' then 'TENANT_ADMIN_LOGGED_IN' else 'TENANT_ADMIN_LOGGED_OUT' end,
    'tenant_membership',
    private.current_membership_id(),
    'succeeded'
  );
end;
$$;

revoke all on function private.record_tenant_administrator_session_event(text) from public;
grant execute on function private.record_tenant_administrator_session_event(text) to app_runtime;

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
set search_path = public, private, audit, pg_temp
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
    select
      max(ae.created_at) filter (
        where ae.action = 'TENANT_ADMIN_LOGGED_IN'
          and ae.actor_membership_id = administrator.membership_id
      ) as last_login_at,
      max(ae.created_at) filter (
        where ae.action = 'TENANT_ADMIN_LOGGED_OUT'
          and ae.actor_membership_id = administrator.membership_id
      ) as last_logout_at,
      max(ae.created_at) filter (
        where ae.action = 'TENANT_ADMIN_PASSWORD_RESET_SUCCEEDED'
          and ae.metadata ->> 'targetUserId' = administrator.user_id::text
      ) as password_changed_at
    from audit.audit_events ae
    where ae.tenant_id = requested.id
  ) activity on true;
end;
$$;

revoke all on function private.list_super_admin_tenant_administrator_access(uuid[]) from public;
grant execute on function private.list_super_admin_tenant_administrator_access(uuid[]) to app_runtime;
