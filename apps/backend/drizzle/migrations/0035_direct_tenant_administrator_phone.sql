create or replace function private.set_direct_tenant_administrator_phone(
  p_tenant_id uuid,
  p_user_id uuid,
  p_phone text
)
returns void
language plpgsql
security definer
set search_path = public, private, audit, pg_temp
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Only a Super Admin may set a Tenant Administrator phone number.' using errcode = '42501';
  end if;

  if nullif(trim(p_phone), '') is null then
    raise exception 'Tenant Administrator phone number is required.' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.tenant_memberships tm
    join public.membership_roles mr
      on mr.tenant_id = tm.tenant_id
     and mr.membership_id = tm.id
     and mr.status = 'active'
    join public.roles r on r.id = mr.role_id and r.code = 'TENANT_ADMIN'
    where tm.tenant_id = p_tenant_id
      and tm.user_id = p_user_id
      and tm.status = 'active'
  ) then
    raise exception 'Active Tenant Administrator was not found.' using errcode = '23503';
  end if;

  update public.users
  set phone = trim(p_phone), updated_at = now()
  where id = p_user_id;

  perform audit.write_audit_event(
    'TENANT_ADMIN_PHONE_SET',
    'tenant',
    p_tenant_id,
    'succeeded',
    null,
    jsonb_build_object('targetUserId', p_user_id)
  );
end;
$$;

revoke all on function private.set_direct_tenant_administrator_phone(uuid, uuid, text) from public;
grant execute on function private.set_direct_tenant_administrator_phone(uuid, uuid, text) to app_runtime;
