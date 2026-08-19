create or replace function audit.enrich_event_metadata(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_resource_type text,
  p_resource_id uuid,
  p_metadata jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = audit, public, private, pg_temp
as $$
declare
  enriched jsonb := coalesce(p_metadata, '{}'::jsonb);
  tenant_name text;
  actor_name text;
  employee_id uuid;
  employee_name text;
  manager_name text;
  client_name text;
  resource_label text;
begin
  select t.display_name into tenant_name
  from public.tenants t
  where t.id = p_tenant_id;

  select u.display_name into actor_name
  from public.users u
  where u.id = p_actor_user_id;

  employee_id := null;
  if (enriched ->> 'employeeId') ~ '^[0-9a-fA-F-]{36}$' then
    employee_id := (enriched ->> 'employeeId')::uuid;
  end if;

  if employee_id is not null then
    select coalesce(tm.display_name, e.employee_code) into employee_name
    from public.employees e
    join public.tenant_memberships tm
      on tm.id = e.membership_id
     and tm.tenant_id = e.tenant_id
    where e.id = employee_id
      and (p_tenant_id is null or e.tenant_id = p_tenant_id);
  end if;

  if p_resource_type = 'task' and p_resource_id is not null then
    select
      t.title,
      c.display_name,
      (
        select coalesce(mtm.display_name, me.employee_code)
        from public.work_group_memberships wgm
        join public.employees me
          on me.id = wgm.employee_id
         and me.tenant_id = wgm.tenant_id
        join public.tenant_memberships mtm
          on mtm.id = me.membership_id
         and mtm.tenant_id = me.tenant_id
        where wgm.tenant_id = t.tenant_id
          and wgm.work_group_id = t.work_group_id
          and wgm.status = 'active'
          and wgm.group_role = 'manager'
        order by wgm.joined_at asc
        limit 1
      ),
      coalesce(
        (
          select string_agg(coalesce(atm.display_name, ae.employee_code), ', ' order by coalesce(atm.display_name, ae.employee_code))
          from public.task_assignments ta
          join public.employees ae
            on ae.id = ta.employee_id
           and ae.tenant_id = ta.tenant_id
          join public.tenant_memberships atm
            on atm.id = ae.membership_id
           and atm.tenant_id = ae.tenant_id
          where ta.tenant_id = t.tenant_id
            and ta.task_id = t.id
            and ta.status = 'active'
        ),
        employee_name
      )
    into resource_label, client_name, manager_name, employee_name
    from public.tasks t
    join public.clients c
      on c.id = t.client_id
     and c.tenant_id = t.tenant_id
    where t.id = p_resource_id
      and (p_tenant_id is null or t.tenant_id = p_tenant_id);
  elsif p_resource_type = 'invoice' and p_resource_id is not null then
    select i.invoice_number, c.display_name
    into resource_label, client_name
    from public.invoices i
    join public.clients c
      on c.id = i.client_id
     and c.tenant_id = i.tenant_id
    where i.id = p_resource_id
      and (p_tenant_id is null or i.tenant_id = p_tenant_id);
  elsif p_resource_type = 'document' and p_resource_id is not null then
    select d.title, c.display_name
    into resource_label, client_name
    from public.tenant_documents d
    left join public.clients c
      on c.id = d.client_id
     and c.tenant_id = d.tenant_id
    where d.id = p_resource_id
      and (p_tenant_id is null or d.tenant_id = p_tenant_id);
  elsif p_resource_type = 'client' and p_resource_id is not null then
    select c.display_name
    into client_name
    from public.clients c
    where c.id = p_resource_id
      and (p_tenant_id is null or c.tenant_id = p_tenant_id);
    resource_label := client_name;
  elsif p_resource_type = 'employee' and p_resource_id is not null then
    select coalesce(tm.display_name, e.employee_code)
    into employee_name
    from public.employees e
    join public.tenant_memberships tm
      on tm.id = e.membership_id
     and tm.tenant_id = e.tenant_id
    where e.id = p_resource_id
      and (p_tenant_id is null or e.tenant_id = p_tenant_id);
    resource_label := employee_name;
  elsif p_resource_type = 'work_group' and p_resource_id is not null then
    select wg.name, c.display_name
    into resource_label, client_name
    from public.work_groups wg
    left join public.clients c
      on c.id = wg.client_id
     and c.tenant_id = wg.tenant_id
    where wg.id = p_resource_id
      and (p_tenant_id is null or wg.tenant_id = p_tenant_id);
    select coalesce(tm.display_name, mgr.employee_code)
    into manager_name
    from public.work_group_memberships wgm
    join public.employees mgr
      on mgr.id = wgm.employee_id
     and mgr.tenant_id = wgm.tenant_id
    join public.tenant_memberships tm
      on tm.id = mgr.membership_id
     and tm.tenant_id = mgr.tenant_id
    where wgm.work_group_id = p_resource_id
      and (p_tenant_id is null or wgm.tenant_id = p_tenant_id)
      and wgm.status = 'active'
      and wgm.group_role = 'manager'
    order by wgm.joined_at asc
    limit 1;
  elsif p_resource_type = 'engagement' and p_resource_id is not null then
    select e.name, c.display_name
    into resource_label, client_name
    from public.engagements e
    join public.clients c
      on c.id = e.client_id
     and c.tenant_id = e.tenant_id
    where e.id = p_resource_id
      and (p_tenant_id is null or e.tenant_id = p_tenant_id);
  elsif p_resource_type = 'service' and p_resource_id is not null then
    select s.name
    into resource_label
    from public.services s
    where s.id = p_resource_id
      and (p_tenant_id is null or s.tenant_id = p_tenant_id);
  end if;

  enriched := (enriched
    - 'password'
    - 'passwordHash'
    - 'token'
    - 'accessToken'
    - 'refreshToken'
    - 'storageKey'
    - 'signedUrl')
    || jsonb_strip_nulls(jsonb_build_object(
      'tenantName', tenant_name,
      'actorName', actor_name,
      'employeeName', employee_name,
      'managerName', manager_name,
      'clientName', client_name,
      'resourceLabel', resource_label
    ));

  return enriched;
end;
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
  tenant_id uuid := private.current_tenant_id();
  actor_user_id uuid := private.current_user_id();
begin
  if private.current_membership_id() is not null and tenant_id is null then
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
    tenant_id,
    actor_user_id,
    private.current_membership_id(),
    private.current_support_access_session_id(),
    action,
    resource_type,
    resource_id,
    result,
    reason,
    private.current_request_id(),
    nullif(current_setting('app.ip_address', true), ''),
    audit.enrich_event_metadata(tenant_id, actor_user_id, resource_type, resource_id, metadata)
  )
  returning id into event_id;

  return event_id;
end;
$$;

revoke all on function audit.enrich_event_metadata(uuid, uuid, text, uuid, jsonb) from public;
grant execute on function audit.enrich_event_metadata(uuid, uuid, text, uuid, jsonb) to app_runtime;
grant execute on function audit.write_audit_event(text, text, uuid, text, text, jsonb) to app_runtime;
