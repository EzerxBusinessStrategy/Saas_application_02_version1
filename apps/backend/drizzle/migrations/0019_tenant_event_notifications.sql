create or replace function private.notify_super_admins_for_tenant_change()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  notification_id uuid;
  recipient_user_id uuid;
  notification_type text;
  notification_title text;
  notification_message text;
  notification_severity text;
  notification_key text;
begin
  if tg_op = 'INSERT' then
    notification_type := 'TENANT_CREATED';
    notification_title := 'New tenant created';
    notification_message := new.display_name || ' was created.';
    notification_severity := 'INFO';
    notification_key := 'TENANT_CREATED:' || new.id::text;
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'suspended' then
    notification_type := 'TENANT_SUSPENDED';
    notification_title := 'Tenant suspended';
    notification_message := new.display_name || ' was suspended.';
    notification_severity := 'WARNING';
    notification_key := 'TENANT_SUSPENDED:' || new.id::text;
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status and old.status = 'suspended' and new.status = 'active' then
    notification_type := 'TENANT_REACTIVATED';
    notification_title := 'Tenant reactivated';
    notification_message := new.display_name || ' was reactivated.';
    notification_severity := 'SUCCESS';
    notification_key := 'TENANT_REACTIVATED:' || new.id::text;
  else
    return new;
  end if;

  insert into public.notifications (
    type,
    title,
    message,
    severity,
    tenant_id,
    actor_user_id,
    entity_type,
    entity_id,
    action_url,
    idempotency_key
  )
  values (
    notification_type,
    notification_title,
    notification_message,
    notification_severity,
    new.id,
    private.current_user_id(),
    'tenant',
    new.id,
    '/super-admin/tenants?tenantId=' || new.id::text,
    notification_key
  )
  on conflict (idempotency_key) where idempotency_key is not null do update
  set idempotency_key = excluded.idempotency_key
  returning id into notification_id;

  for recipient_user_id in
    select distinct pur.user_id
    from public.platform_user_roles pur
    join public.roles r on r.id = pur.role_id
    join public.users u on u.id = pur.user_id
    where pur.status = 'active'
      and r.code = 'SUPER_ADMIN'
      and u.status = 'active'
  loop
    insert into public.notification_recipients (notification_id, recipient_user_id)
    values (notification_id, recipient_user_id)
    on conflict (notification_id, recipient_user_id) do nothing;

    perform pg_notify(
      'super_admin_notifications',
      json_build_object(
        'notificationId', notification_id,
        'recipientUserId', recipient_user_id
      )::text
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists tenants_super_admin_notifications on public.tenants;

create trigger tenants_super_admin_notifications
after insert or update of status
on public.tenants
for each row
execute function private.notify_super_admins_for_tenant_change();

revoke all on function private.notify_super_admins_for_tenant_change() from public;
