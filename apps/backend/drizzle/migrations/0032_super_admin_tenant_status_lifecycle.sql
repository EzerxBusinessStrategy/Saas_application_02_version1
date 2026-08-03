create or replace function private.set_super_admin_tenant_status(
  p_tenant_id uuid,
  p_status text,
  p_reason text default null
)
returns table (tenant_id uuid, status text)
language plpgsql
security definer
set search_path = public, private, audit, pg_temp
as $$
declare
  previous_status text;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform administrator context is required.' using errcode = '42501';
  end if;

  if p_status not in ('active', 'suspended') then
    raise exception 'Tenant status transition is not supported.' using errcode = '22023';
  end if;

  select t.status into previous_status
  from public.tenants t
  where t.id = p_tenant_id
  for update;

  if previous_status is null then
    raise exception 'Tenant was not found.' using errcode = 'P0002';
  end if;

  if previous_status = p_status then
    return query select p_tenant_id, previous_status;
    return;
  end if;

  if (previous_status, p_status) not in (('active', 'suspended'), ('suspended', 'active')) then
    raise exception 'Tenant must be active to suspend or suspended to reactivate.' using errcode = 'P0001';
  end if;

  update public.tenants
  set status = p_status,
      suspended_at = case when p_status = 'suspended' then now() else null end,
      updated_at = now()
  where id = p_tenant_id;

  perform audit.write_audit_event(
    case when p_status = 'suspended' then 'TENANT_SUSPENDED' else 'TENANT_REACTIVATED' end,
    'tenant',
    p_tenant_id,
    'succeeded',
    p_reason,
    jsonb_build_object('previousStatus', previous_status, 'status', p_status)
  );

  return query select p_tenant_id, p_status;
end;
$$;

revoke all on function private.set_super_admin_tenant_status(uuid, text, text) from public;
grant execute on function private.set_super_admin_tenant_status(uuid, text, text) to app_runtime;
