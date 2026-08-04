create or replace function private.activate_direct_tenant_admin_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, audit, pg_temp
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Only a Super Admin may activate a newly provisioned tenant.' using errcode = '42501';
  end if;

  update public.tenants
  set status = 'active', updated_at = now()
  where id = p_tenant_id and status = 'pending_activation';

  if not found then
    raise exception 'Tenant is not awaiting activation.' using errcode = 'P0001';
  end if;

  perform audit.write_audit_event(
    'TENANT_DIRECT_ADMIN_PROVISIONED', 'tenant', p_tenant_id, 'succeeded', null,
    jsonb_build_object('activationMethod', 'super_admin_password_provisioning')
  );
end;
$$;

revoke all on function private.activate_direct_tenant_admin_tenant(uuid) from public;
grant execute on function private.activate_direct_tenant_admin_tenant(uuid) to app_runtime;
