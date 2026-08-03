create index tenants_status_idx
  on public.tenants (status, id);

create index users_status_idx
  on public.users (status, id);

create index tenant_memberships_tenant_status_idx
  on public.tenant_memberships (tenant_id, status, id);

create index tenant_memberships_user_idx
  on public.tenant_memberships (user_id, tenant_id);

create index roles_scope_idx
  on public.roles (scope, id);

create index permissions_resource_action_idx
  on public.permissions (resource, action, id);

create index role_permissions_permission_idx
  on public.role_permissions (permission_id, role_id);

create index membership_roles_tenant_membership_idx
  on public.membership_roles (tenant_id, membership_id);

create index membership_roles_role_idx
  on public.membership_roles (role_id, tenant_id);

create index audit_events_tenant_created_idx
  on audit.audit_events (tenant_id, created_at desc, id);

create index audit_events_actor_created_idx
  on audit.audit_events (actor_user_id, created_at desc, id);
