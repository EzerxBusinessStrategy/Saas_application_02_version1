alter table audit.audit_events
  add column if not exists reason_source text;

create or replace function audit.generated_reason(
  p_action text,
  p_resource_type text,
  p_result text
)
returns text
language sql
immutable
as $$
  select format(
    'The %s action for the %s %s because no explicit reason was provided.',
    lower(replace(coalesce(nullif(trim(p_action), ''), 'system'), '_', ' ')),
    lower(replace(coalesce(nullif(trim(p_resource_type), ''), 'record'), '_', ' ')),
    case coalesce(nullif(trim(p_result), ''), 'succeeded')
      when 'succeeded' then 'was completed'
      when 'denied' then 'was denied'
      when 'failed' then 'failed'
      else 'was recorded'
    end
  );
$$;

update audit.audit_events
set reason = audit.generated_reason(action, resource_type, result),
    reason_source = 'auto_generated'
where nullif(trim(reason), '') is null;

update audit.audit_events
set reason_source = 'explicit'
where reason_source is null;

alter table audit.audit_events
  alter column reason_source set default 'explicit',
  alter column reason_source set not null,
  drop constraint if exists audit_events_reason_source_check,
  add constraint audit_events_reason_source_check
    check (reason_source in ('explicit', 'auto_generated'));

create or replace function audit.capture_event_detail_context()
returns trigger
language plpgsql
security definer
set search_path = audit, private, pg_temp
as $$
begin
  if nullif(trim(coalesce(new.ip_address, '')), '') is null then
    new.ip_address := nullif(current_setting('app.ip_address', true), '');
  end if;

  if nullif(trim(coalesce(new.reason, '')), '') is null then
    new.reason := audit.generated_reason(new.action, new.resource_type, new.result);
    new.reason_source := 'auto_generated';
  else
    new.reason_source := 'explicit';
  end if;

  return new;
end;
$$;

drop trigger if exists audit_events_capture_detail_context on audit.audit_events;
create trigger audit_events_capture_detail_context
before insert on audit.audit_events
for each row
execute function audit.capture_event_detail_context();

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
    ip_address,
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
    nullif(current_setting('app.ip_address', true), ''),
    coalesce(metadata, '{}'::jsonb)
  )
  returning id into event_id;

  return event_id;
end;
$$;
