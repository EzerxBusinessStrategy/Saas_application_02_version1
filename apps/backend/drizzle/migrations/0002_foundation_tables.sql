create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  legal_name text not null,
  display_name text not null,
  status text not null default 'provisioning',
  country text,
  currency text,
  timezone text not null default 'UTC',
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_status_check check (status in ('provisioning', 'active', 'suspended', 'archived')),
  constraint tenants_code_unique unique (code)
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  supabase_auth_user_id uuid not null,
  email text not null,
  email_normalized text not null,
  display_name text not null,
  phone text,
  status text not null default 'active',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_status_check check (status in ('active', 'suspended', 'deactivated', 'anonymized')),
  constraint users_email_normalized_check check (email_normalized = lower(email)),
  constraint users_supabase_auth_user_id_unique unique (supabase_auth_user_id),
  constraint users_email_normalized_unique unique (email_normalized)
);

create table public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  user_id uuid not null references public.users (id),
  status text not null default 'active',
  display_name text not null,
  timezone text not null default 'UTC',
  joined_at timestamptz not null default now(),
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_memberships_status_check check (status in ('invited', 'active', 'suspended', 'removed')),
  constraint tenant_memberships_tenant_id_id_unique unique (tenant_id, id),
  constraint tenant_memberships_tenant_user_unique unique (tenant_id, user_id)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  scope text not null,
  system_role boolean not null default true,
  created_at timestamptz not null default now(),
  constraint roles_scope_check check (scope in ('platform', 'tenant')),
  constraint roles_code_unique unique (code)
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text not null,
  resource text not null,
  action text not null,
  created_at timestamptz not null default now(),
  constraint permissions_code_unique unique (code)
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint role_permissions_pkey primary key (role_id, permission_id)
);

create table public.membership_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  membership_id uuid not null,
  role_id uuid not null references public.roles (id),
  assigned_by_membership_id uuid,
  assigned_at timestamptz not null default now(),
  constraint membership_roles_tenant_id_id_unique unique (tenant_id, id),
  constraint membership_roles_tenant_membership_role_unique unique (tenant_id, membership_id, role_id),
  constraint membership_roles_membership_fk foreign key (tenant_id, membership_id)
    references public.tenant_memberships (tenant_id, id),
  constraint membership_roles_assigned_by_fk foreign key (tenant_id, assigned_by_membership_id)
    references public.tenant_memberships (tenant_id, id)
);

create table audit.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id),
  actor_user_id uuid references public.users (id),
  actor_membership_id uuid,
  support_access_session_id uuid,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  result text not null,
  reason text,
  request_id text,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_result_check check (result in ('succeeded', 'denied', 'failed')),
  constraint audit_events_membership_requires_tenant_check
    check (actor_membership_id is null or tenant_id is not null),
  constraint audit_events_membership_fk foreign key (tenant_id, actor_membership_id)
    references public.tenant_memberships (tenant_id, id)
);
