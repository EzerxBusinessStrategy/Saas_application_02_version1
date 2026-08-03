revoke all on schema public from public;
revoke all on schema private from public;
revoke all on schema audit from public;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

create policy roles_select
on public.roles
for select
to app_runtime, app_readonly
using (true);

create policy permissions_select
on public.permissions
for select
to app_runtime, app_readonly
using (true);

create policy role_permissions_select
on public.role_permissions
for select
to app_runtime, app_readonly
using (true);

grant usage on schema public to app_runtime, app_readonly;
grant usage on schema private to app_runtime, app_readonly;
grant usage on schema audit to app_runtime, app_readonly;

grant select on public.tenants to app_runtime;
grant select on public.users to app_runtime;
grant select on public.tenant_memberships to app_runtime;
grant select on public.roles to app_runtime, app_readonly;
grant select on public.permissions to app_runtime, app_readonly;
grant select on public.role_permissions to app_runtime, app_readonly;
grant select on public.membership_roles to app_runtime;

grant select on public.tenants to app_readonly;
grant select on public.users to app_readonly;
grant select on public.tenant_memberships to app_readonly;
grant select on public.membership_roles to app_readonly;
grant select on audit.audit_events to app_runtime, app_readonly;

revoke insert, update, delete on audit.audit_events from app_runtime;
grant execute on function private.current_tenant_id() to app_runtime, app_readonly;
grant execute on function private.current_user_id() to app_runtime, app_readonly;
grant execute on function private.current_membership_id() to app_runtime, app_readonly;
grant execute on function private.current_support_access_session_id() to app_runtime, app_readonly;
grant execute on function private.current_request_id() to app_runtime, app_readonly;
grant execute on function private.is_platform_admin() to app_runtime, app_readonly;
grant execute on function private.has_tenant_context(uuid) to app_runtime, app_readonly;
grant execute on function private.has_support_tenant_context(uuid) to app_runtime, app_readonly;
grant execute on function audit.write_audit_event(text, text, uuid, text, text, jsonb) to app_runtime;
