alter table authn.login_audit_events
  drop constraint if exists login_audit_events_outcome_check,
  add constraint login_audit_events_outcome_check
    check (outcome in (
      'SUCCESS',
      'INVALID_CREDENTIALS',
      'ACCOUNT_LOCKED',
      'ACCOUNT_SUSPENDED',
      'TENANT_SUSPENDED',
      'SESSION_REVOKED',
      'LOGGED_OUT'
    ));

create index if not exists audit_events_auth_session_created_idx
  on audit.audit_events (action, created_at desc)
  where resource_type = 'auth_session';

create or replace function audit.write_portal_session_audit_event(
  p_tenant_id uuid,
  p_user_id uuid,
  p_action text,
  p_session_id uuid,
  p_reason text,
  p_request_id text,
  p_ip_address inet,
  p_user_agent text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = audit, public, pg_temp
as $$
declare
  event_id uuid;
  membership_id uuid;
begin
  if p_action not in (
    'SUPER_ADMIN_LOGGED_IN',
    'SUPER_ADMIN_LOGGED_OUT',
    'TENANT_LOGGED_IN',
    'TENANT_LOGGED_OUT',
    'MANAGER_LOGGED_IN',
    'MANAGER_LOGGED_OUT',
    'EMPLOYEE_LOGGED_IN',
    'EMPLOYEE_LOGGED_OUT',
    'CLIENT_LOGGED_IN',
    'CLIENT_LOGGED_OUT'
  ) then
    raise exception 'Unsupported portal session audit action.' using errcode = '22023';
  end if;

  select tm.id into membership_id
  from public.tenant_memberships tm
  where tm.tenant_id = p_tenant_id
    and tm.user_id = p_user_id
    and tm.status = 'active'
  order by tm.joined_at desc
  limit 1;

  insert into audit.audit_events (
    tenant_id,
    actor_user_id,
    actor_membership_id,
    action,
    resource_type,
    resource_id,
    result,
    reason,
    request_id,
    ip_address,
    user_agent,
    metadata
  )
  values (
    p_tenant_id,
    p_user_id,
    membership_id,
    p_action,
    'auth_session',
    p_session_id,
    'succeeded',
    p_reason,
    nullif(p_request_id, ''),
    p_ip_address,
    nullif(p_user_agent, ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into event_id;

  return event_id;
end;
$$;

revoke all on function audit.write_portal_session_audit_event(uuid, uuid, text, uuid, text, text, inet, text, jsonb) from public;
grant execute on function audit.write_portal_session_audit_event(uuid, uuid, text, uuid, text, text, inet, text, jsonb) to app_runtime;
