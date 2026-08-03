alter table public.tenants enable row level security;
alter table public.tenants force row level security;
alter table public.users enable row level security;
alter table public.users force row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_memberships force row level security;
alter table public.membership_roles enable row level security;
alter table public.membership_roles force row level security;
alter table audit.audit_events enable row level security;
alter table audit.audit_events force row level security;

create policy tenants_select
on public.tenants
for select
to app_runtime, app_readonly
using (id = private.current_tenant_id() or private.is_platform_admin());

create policy tenants_insert
on public.tenants
for insert
to app_runtime
with check (private.is_platform_admin());

create policy tenants_update
on public.tenants
for update
to app_runtime
using (false)
with check (false);

create policy tenants_delete_deny
on public.tenants
for delete
to app_runtime
using (false);

create policy users_select
on public.users
for select
to app_runtime
using (
  id = private.current_user_id()
  or exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = users.id
      and private.has_tenant_context(tm.tenant_id)
  )
  or private.is_platform_admin()
);

create policy users_insert
on public.users
for insert
to app_runtime
with check (id = private.current_user_id() or private.is_platform_admin());

create policy users_update
on public.users
for update
to app_runtime
using (false)
with check (false);

create policy users_delete_deny
on public.users
for delete
to app_runtime
using (false);

create policy tenant_memberships_select
on public.tenant_memberships
for select
to app_runtime, app_readonly
using (
  private.has_tenant_context(tenant_id)
  and id = private.current_membership_id()
  and user_id = private.current_user_id()
  and status = 'active'
  and exists (
    select 1
    from public.users u
    where u.id = tenant_memberships.user_id
      and u.status = 'active'
  )
  and exists (
    select 1
    from public.tenants t
    where t.id = tenant_memberships.tenant_id
      and t.status = 'active'
  )
);

create policy tenant_memberships_insert
on public.tenant_memberships
for insert
to app_runtime
with check (false);

create policy tenant_memberships_update
on public.tenant_memberships
for update
to app_runtime
using (false)
with check (false);

create policy tenant_memberships_delete
on public.tenant_memberships
for delete
to app_runtime
using (false);

create policy membership_roles_select
on public.membership_roles
for select
to app_runtime, app_readonly
using (
  private.has_tenant_context(tenant_id)
  and membership_id = private.current_membership_id()
);

create policy membership_roles_insert
on public.membership_roles
for insert
to app_runtime
with check (false);

create policy membership_roles_update
on public.membership_roles
for update
to app_runtime
using (false)
with check (false);

create policy membership_roles_delete
on public.membership_roles
for delete
to app_runtime
using (false);

create policy audit_events_select
on audit.audit_events
for select
to app_runtime, app_readonly
using (
  tenant_id = private.current_tenant_id()
  or private.is_platform_admin()
);

create policy audit_events_insert_migrator
on audit.audit_events
for insert
to app_migrator
with check (true);

create policy audit_events_update_deny
on audit.audit_events
for update
to app_runtime
using (false)
with check (false);

create policy audit_events_delete_deny
on audit.audit_events
for delete
to app_runtime
using (false);
