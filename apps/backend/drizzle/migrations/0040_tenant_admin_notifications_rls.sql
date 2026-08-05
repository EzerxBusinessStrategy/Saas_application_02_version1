create or replace function private.notification_belongs_to_current_tenant(p_notification_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.notifications n
    where n.id = p_notification_id
      and private.has_tenant_context(n.tenant_id)
  )
$$;

revoke all on function private.notification_belongs_to_current_tenant(uuid) from public;
grant execute on function private.notification_belongs_to_current_tenant(uuid) to app_runtime, app_readonly;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select
on public.notifications
for select
to app_runtime, app_readonly
using (
  exists (
    select 1
    from public.notification_recipients nr
    where nr.notification_id = notifications.id
      and nr.recipient_user_id = private.current_user_id()
  )
  and (
    private.is_platform_admin()
    or private.has_tenant_context(tenant_id)
  )
);

drop policy if exists notification_recipients_select on public.notification_recipients;
create policy notification_recipients_select
on public.notification_recipients
for select
to app_runtime, app_readonly
using (
  recipient_user_id = private.current_user_id()
  and (
    private.is_platform_admin()
    or private.notification_belongs_to_current_tenant(notification_recipients.notification_id)
  )
);

drop policy if exists notification_recipients_update on public.notification_recipients;
create policy notification_recipients_update
on public.notification_recipients
for update
to app_runtime
using (
  recipient_user_id = private.current_user_id()
  and (
    private.is_platform_admin()
    or private.notification_belongs_to_current_tenant(notification_recipients.notification_id)
  )
)
with check (
  recipient_user_id = private.current_user_id()
  and (
    private.is_platform_admin()
    or private.notification_belongs_to_current_tenant(notification_recipients.notification_id)
  )
);
