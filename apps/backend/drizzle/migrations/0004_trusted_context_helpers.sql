create or replace function private.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

create or replace function private.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create or replace function private.current_membership_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.membership_id', true), '')::uuid
$$;

create or replace function private.current_support_access_session_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.support_access_session_id', true), '')::uuid
$$;

create or replace function private.current_request_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('app.request_id', true), '')
$$;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
as $$
  select coalesce(nullif(current_setting('app.is_platform_admin', true), '')::boolean, false)
$$;

create or replace function private.has_tenant_context(target_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select target_tenant_id = private.current_tenant_id()
    and private.current_user_id() is not null
    and private.current_membership_id() is not null
$$;

create or replace function private.has_support_tenant_context(target_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select false
$$;

create or replace function audit.write_audit_event(
  action text,
  resource_type text,
  resource_id uuid,
  result text,
  reason text default null,
  metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = audit, public, private, pg_temp
as $$
declare
  event_id uuid;
begin
  if private.current_membership_id() is not null and private.current_tenant_id() is null then
    raise exception 'tenant context is required when membership context is set';
  end if;

  insert into audit.audit_events (
    tenant_id,
    actor_user_id,
    actor_membership_id,
    support_access_session_id,
    action,
    resource_type,
    resource_id,
    result,
    reason,
    request_id,
    metadata
  )
  values (
    private.current_tenant_id(),
    private.current_user_id(),
    private.current_membership_id(),
    private.current_support_access_session_id(),
    action,
    resource_type,
    resource_id,
    result,
    reason,
    private.current_request_id(),
    coalesce(metadata, '{}'::jsonb)
  )
  returning id into event_id;

  return event_id;
end;
$$;
