create schema if not exists authn;

revoke all on schema authn from public;
grant usage on schema authn to app_runtime;

alter table public.users
  alter column supabase_auth_user_id drop not null;

create table authn.credentials (
  id uuid primary key default gen_random_uuid(),
  portal_type text not null check (portal_type in ('SUPER_ADMIN', 'TENANT', 'EMPLOYEE', 'CLIENT')),
  user_id uuid not null references public.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  client_account_id uuid references public.client_portal_accounts(id) on delete cascade,
  email text not null,
  email_normalized text not null,
  password_hash text,
  status text not null default 'INVITED' check (status in ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  failed_login_attempts integer not null default 0 check (failed_login_attempts >= 0),
  locked_until timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint authn_credentials_email_normalized_check check (email_normalized = lower(btrim(email))),
  constraint authn_credentials_portal_scope_check check (
    (portal_type = 'SUPER_ADMIN' and tenant_id is null and employee_id is null and client_account_id is null)
    or (portal_type = 'TENANT' and tenant_id is not null and employee_id is null and client_account_id is null)
    or (portal_type = 'EMPLOYEE' and tenant_id is not null and employee_id is not null and client_account_id is null)
    or (portal_type = 'CLIENT' and tenant_id is not null and employee_id is null and client_account_id is not null)
  )
);

create unique index authn_credentials_email_normalized_uidx on authn.credentials (email_normalized);
create unique index authn_credentials_user_uidx on authn.credentials (user_id);
create index authn_credentials_portal_email_idx on authn.credentials (portal_type, email_normalized);
create index authn_credentials_tenant_idx on authn.credentials (tenant_id, portal_type);

create table authn.sessions (
  id uuid primary key default gen_random_uuid(),
  portal_type text not null check (portal_type in ('SUPER_ADMIN', 'TENANT', 'EMPLOYEE', 'CLIENT')),
  credential_id uuid not null references authn.credentials(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  ip_address inet,
  user_agent text,
  constraint authn_sessions_token_hash_check check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint authn_sessions_expiry_check check (expires_at > created_at)
);

create unique index authn_sessions_token_hash_uidx on authn.sessions (token_hash);
create index authn_sessions_active_lookup_idx on authn.sessions (portal_type, token_hash, expires_at) where revoked_at is null;
create index authn_sessions_credential_idx on authn.sessions (credential_id, created_at desc);

create table authn.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references authn.credentials(id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by_user_id uuid references public.users(id) on delete set null,
  constraint authn_password_reset_tokens_expiry_check check (expires_at > created_at)
);

create unique index authn_password_reset_tokens_hash_uidx on authn.password_reset_tokens (token_hash);
create index authn_password_reset_tokens_active_idx on authn.password_reset_tokens (credential_id, expires_at) where consumed_at is null;

create table authn.login_audit_events (
  id uuid primary key default gen_random_uuid(),
  portal_type text not null check (portal_type in ('SUPER_ADMIN', 'TENANT', 'EMPLOYEE', 'CLIENT')),
  credential_id uuid references authn.credentials(id) on delete set null,
  email_normalized text not null,
  outcome text not null check (outcome in ('SUCCESS', 'INVALID_CREDENTIALS', 'ACCOUNT_LOCKED', 'ACCOUNT_SUSPENDED', 'TENANT_SUSPENDED', 'SESSION_REVOKED')),
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index authn_login_audit_events_credential_created_idx on authn.login_audit_events (credential_id, created_at desc);

create or replace function authn.touch_updated_at()
returns trigger
language plpgsql
set search_path = authn, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger authn_credentials_touch_updated_at
before update on authn.credentials
for each row execute function authn.touch_updated_at();

create or replace function authn.assert_global_email_uniqueness()
returns trigger
language plpgsql
set search_path = authn, public, pg_temp
as $$
begin
  if exists (
    select 1 from public.users u
    where u.email_normalized = new.email_normalized and u.id <> new.user_id
  ) then
    raise exception using errcode = 'unique_violation', message = 'email is already assigned to another application user';
  end if;
  return new;
end;
$$;

create trigger authn_credentials_global_email_uniqueness
before insert or update of email_normalized, user_id on authn.credentials
for each row execute function authn.assert_global_email_uniqueness();

create or replace function public.assert_application_user_email_uniqueness()
returns trigger
language plpgsql
set search_path = authn, public, pg_temp
as $$
begin
  if exists (
    select 1 from authn.credentials c
    where c.email_normalized = new.email_normalized and c.user_id <> new.id
  ) then
    raise exception using errcode = 'unique_violation', message = 'email is already assigned to another credential';
  end if;
  return new;
end;
$$;

create trigger public_users_global_email_uniqueness
before insert or update of email_normalized on public.users
for each row execute function public.assert_application_user_email_uniqueness();

create or replace function private.resolve_auth_context_by_user_id(p_user_id uuid)
returns table (
  user_id uuid,
  user_email text,
  user_display_name text,
  user_status text,
  tenant_id uuid,
  tenant_code text,
  tenant_display_name text,
  tenant_status text,
  membership_id uuid,
  membership_status text,
  membership_display_name text,
  membership_timezone text,
  client_account_id uuid,
  role_codes text[],
  permission_codes text[]
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  with app_user as (
    select u.* from public.users u
    where u.id = p_user_id and private.current_user_id() = p_user_id
  ), platform_context as (
    select u.id as user_id, u.email as user_email, u.display_name as user_display_name, u.status as user_status,
      null::uuid as tenant_id, null::text as tenant_code, null::text as tenant_display_name, null::text as tenant_status,
      null::uuid as membership_id, null::text as membership_status, null::text as membership_display_name, null::text as membership_timezone,
      null::uuid as client_account_id,
      coalesce(array_remove(array_agg(distinct r.code order by r.code), null), '{}'::text[]) as role_codes,
      coalesce(array_remove(array_agg(distinct p.code order by p.code), null), '{}'::text[]) as permission_codes
    from app_user u join public.platform_user_roles pur on pur.user_id = u.id and pur.status = 'active'
      join public.roles r on r.id = pur.role_id and r.scope = 'platform'
      left join public.role_permissions rp on rp.role_id = r.id left join public.permissions p on p.id = rp.permission_id
    group by u.id, u.email, u.display_name, u.status
  ), tenant_context as (
    select u.id as user_id, u.email as user_email, u.display_name as user_display_name, u.status as user_status,
      tm.tenant_id, t.code as tenant_code, t.display_name as tenant_display_name, t.status as tenant_status,
      tm.id as membership_id, tm.status as membership_status, tm.display_name as membership_display_name, tm.timezone as membership_timezone,
      cpa.id as client_account_id,
      coalesce(array_remove(array_agg(distinct r.code order by r.code), null), '{}'::text[]) as role_codes,
      coalesce(array_remove(array_agg(distinct p.code order by p.code), null), '{}'::text[]) as permission_codes
    from app_user u join public.tenant_memberships tm on tm.user_id = u.id and tm.status <> 'removed'
      join public.tenants t on t.id = tm.tenant_id
      left join public.client_portal_accounts cpa on cpa.user_id = u.id and cpa.tenant_id = tm.tenant_id and cpa.status = 'active'
      left join public.membership_roles mr on mr.tenant_id = tm.tenant_id and mr.membership_id = tm.id and mr.status = 'active'
      left join public.roles r on r.id = mr.role_id left join public.role_permissions rp on rp.role_id = r.id
      left join public.permissions p on p.id = rp.permission_id
    group by u.id, u.email, u.display_name, u.status, tm.tenant_id, t.code, t.display_name, t.status, tm.id, tm.status, tm.display_name, tm.timezone, cpa.id
  ) select * from platform_context union all select * from tenant_context order by tenant_display_name nulls first, membership_id nulls first;
$$;

revoke all on all tables in schema authn from public, anon, authenticated;
revoke all on all sequences in schema authn from public, anon, authenticated;
revoke all on all functions in schema authn from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema authn to app_runtime;
grant usage, select on all sequences in schema authn to app_runtime;
grant execute on function private.resolve_auth_context_by_user_id(uuid) to app_runtime;
