alter table public.tenants
  add column if not exists suspension_ends_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revocation_reason text;

alter table public.tenants drop constraint if exists tenants_status_check;
alter table public.tenants add constraint tenants_status_check
  check (status in (
    'provisioning', 'pending_activation', 'active', 'suspended', 'revoked',
    'cancelled', 'archived', 'pending_deletion'
  )) not valid;
alter table public.tenants validate constraint tenants_status_check;

create index if not exists tenants_suspension_expiry_idx
  on public.tenants (suspension_ends_at, id)
  where status = 'suspended' and suspension_ends_at is not null;

insert into public.permissions (code, description, resource, action)
values ('tenant.revoke', 'Revoke tenant access while preserving tenant data.', 'tenant', 'revoke')
on conflict (code) do update
set description = excluded.description,
    resource = excluded.resource,
    action = excluded.action;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'tenant.revoke'
where r.code = 'SUPER_ADMIN'
on conflict do nothing;

create or replace function private.set_super_admin_tenant_lifecycle(
  p_tenant_id uuid,
  p_action text,
  p_suspension_duration text default null,
  p_reason text default null
)
returns table (
  tenant_id uuid,
  status text,
  suspension_ends_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public, private, audit, pg_temp
as $$
declare
  previous_status text;
  next_suspension_ends_at timestamptz;
  next_revoked_at timestamptz;
  suspension_interval interval;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform administrator context is required.' using errcode = '42501';
  end if;

  if p_action not in ('suspend', 'reactivate', 'revoke') then
    raise exception 'Tenant lifecycle action is not supported.' using errcode = '22023';
  end if;

  select t.status into previous_status
  from public.tenants t
  where t.id = p_tenant_id
  for update;

  if previous_status is null then
    raise exception 'Tenant was not found.' using errcode = 'P0002';
  end if;

  if p_action = 'suspend' then
    suspension_interval := case p_suspension_duration
      when '24h' then interval '24 hours'
      when '48h' then interval '48 hours'
      when '72h' then interval '72 hours'
      when '96h' then interval '96 hours'
      when '1w' then interval '1 week'
      when '1m' then interval '1 month'
      when '6m' then interval '6 months'
      else null
    end;
    if previous_status <> 'active' or suspension_interval is null then
      raise exception 'Only active tenants can be suspended with a supported duration.' using errcode = 'P0001';
    end if;

    next_suspension_ends_at := now() + suspension_interval;
    update public.tenants
    set status = 'suspended',
        suspended_at = now(),
        suspension_ends_at = next_suspension_ends_at,
        updated_at = now()
    where id = p_tenant_id;
  elsif p_action = 'reactivate' then
    if previous_status <> 'suspended' then
      raise exception 'Only suspended tenants can be reactivated.' using errcode = 'P0001';
    end if;

    update public.tenants
    set status = 'active',
        suspended_at = null,
        suspension_ends_at = null,
        updated_at = now()
    where id = p_tenant_id;
  else
    if previous_status not in ('active', 'suspended') then
      raise exception 'Only active or suspended tenants can be revoked.' using errcode = 'P0001';
    end if;

    next_revoked_at := now();
    update public.tenants
    set status = 'revoked',
        suspended_at = null,
        suspension_ends_at = null,
        revoked_at = next_revoked_at,
        revocation_reason = nullif(trim(p_reason), ''),
        updated_at = now()
    where id = p_tenant_id;

    update public.auth_session_policies policy
    set revoked_at = coalesce(policy.revoked_at, now())
    where policy.revoked_at is null
      and exists (
        select 1
        from public.tenant_memberships membership
        where membership.tenant_id = p_tenant_id
          and membership.user_id = policy.user_id
      );
  end if;

  insert into audit.audit_events (
    tenant_id, actor_user_id, action, resource_type, resource_id, result, reason, request_id, metadata
  ) values (
    p_tenant_id,
    private.current_user_id(),
    case p_action when 'suspend' then 'TENANT_SUSPENDED' when 'reactivate' then 'TENANT_REACTIVATED' else 'TENANT_REVOKED' end,
    'tenant',
    p_tenant_id,
    'succeeded',
    nullif(trim(p_reason), ''),
    private.current_request_id(),
    jsonb_build_object(
      'previousStatus', previous_status,
      'status', case p_action when 'suspend' then 'suspended' when 'reactivate' then 'active' else 'revoked' end,
      'suspensionDuration', case when p_action = 'suspend' then p_suspension_duration else null end,
      'suspensionEndsAt', next_suspension_ends_at,
      'revokedAt', next_revoked_at
    )
  );

  return query
  select
    p_tenant_id,
    case p_action when 'suspend' then 'suspended' when 'reactivate' then 'active' else 'revoked' end,
    next_suspension_ends_at,
    next_revoked_at;
end;
$$;

revoke all on function private.set_super_admin_tenant_lifecycle(uuid, text, text, text) from public;
grant execute on function private.set_super_admin_tenant_lifecycle(uuid, text, text, text) to app_runtime;

create or replace function private.restore_expired_tenant_suspensions()
returns void
language plpgsql
security definer
set search_path = public, private, audit, pg_temp
as $$
declare
  restored_tenant_id uuid;
begin
  if nullif(current_setting('app.auth_user_id', true), '') is null then
    raise exception 'Authenticated request context is required.' using errcode = '42501';
  end if;

  for restored_tenant_id in
    update public.tenants
    set status = 'active',
        suspended_at = null,
        suspension_ends_at = null,
        updated_at = now()
    where status = 'suspended'
      and suspension_ends_at <= now()
      and exists (
        select 1
        from public.tenant_memberships membership
        join public.users tenant_user on tenant_user.id = membership.user_id
        where membership.tenant_id = tenants.id
          and tenant_user.supabase_auth_user_id = nullif(current_setting('app.auth_user_id', true), '')::uuid
      )
    returning id
  loop
    insert into audit.audit_events (
      tenant_id, action, resource_type, resource_id, result, request_id, metadata
    ) values (
      restored_tenant_id,
      'TENANT_SUSPENSION_EXPIRED',
      'tenant',
      restored_tenant_id,
      'succeeded',
      private.current_request_id(),
      jsonb_build_object('automatic', true)
    );
  end loop;
end;
$$;

revoke all on function private.restore_expired_tenant_suspensions() from public;
grant execute on function private.restore_expired_tenant_suspensions() to app_runtime;
