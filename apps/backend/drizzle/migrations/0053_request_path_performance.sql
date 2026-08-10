-- Keep authenticated request validation read-heavy. Session activity is touched
-- at most once per minute and cached authorization is invalidated by this version.
alter table public.auth_session_policies
  add column if not exists auth_context_version integer not null default 1;

alter table public.auth_session_policies
  drop constraint if exists auth_session_policies_auth_context_version_check,
  add constraint auth_session_policies_auth_context_version_check
    check (auth_context_version > 0);

create or replace function private.bump_auth_context_version(p_user_id uuid)
returns void
language sql
security definer
set search_path = public, private, pg_temp
as $$
  update public.auth_session_policies
  set auth_context_version = auth_context_version + 1
  where user_id = p_user_id
    and revoked_at is null;
$$;

create or replace function private.bump_auth_context_version_for_membership()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if tg_op <> 'INSERT' then
    perform private.bump_auth_context_version(old.user_id);
  end if;
  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.user_id <> old.user_id) then
    perform private.bump_auth_context_version(new.user_id);
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function private.bump_auth_context_version_for_membership_role()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  affected_user_id uuid;
begin
  if tg_op <> 'DELETE' then
    select user_id into affected_user_id
    from public.tenant_memberships
    where id = new.membership_id;

    if affected_user_id is not null then
      perform private.bump_auth_context_version(affected_user_id);
    end if;
  end if;

  if tg_op <> 'INSERT' and (tg_op = 'DELETE' or old.membership_id <> new.membership_id) then
    select user_id into affected_user_id
    from public.tenant_memberships
    where id = old.membership_id;

    if affected_user_id is not null then
      perform private.bump_auth_context_version(affected_user_id);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function private.bump_auth_context_version_for_tenant()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  update public.auth_session_policies policy
  set auth_context_version = auth_context_version + 1
  where policy.revoked_at is null
    and exists (
      select 1
      from public.tenant_memberships membership
      where membership.tenant_id = new.id
        and membership.user_id = policy.user_id
    );
  return new;
end;
$$;

create or replace function private.bump_auth_context_version_for_role(p_role_id uuid)
returns void
language sql
security definer
set search_path = public, private, pg_temp
as $$
  update public.auth_session_policies policy
  set auth_context_version = auth_context_version + 1
  where policy.revoked_at is null
    and exists (
      select 1
      from public.membership_roles membership_role
      join public.tenant_memberships membership
        on membership.id = membership_role.membership_id
      where membership_role.role_id = p_role_id
        and membership.user_id = policy.user_id
    );
$$;

create or replace function private.bump_auth_context_version_for_role_permission()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if tg_op <> 'DELETE' then
    perform private.bump_auth_context_version_for_role(new.role_id);
  end if;
  if tg_op <> 'INSERT' and (tg_op = 'DELETE' or old.role_id <> new.role_id) then
    perform private.bump_auth_context_version_for_role(old.role_id);
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function private.bump_auth_context_version_for_role_code()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  perform private.bump_auth_context_version_for_role(new.id);
  return coalesce(new, old);
end;
$$;

create or replace function private.bump_auth_context_version_for_user()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  perform private.bump_auth_context_version(new.id);
  return new;
end;
$$;

drop trigger if exists auth_context_version_for_user on public.users;
create trigger auth_context_version_for_user
after update of status, supabase_auth_user_id on public.users
for each row execute function private.bump_auth_context_version_for_user();

drop trigger if exists auth_context_version_for_membership on public.tenant_memberships;
create trigger auth_context_version_for_membership
after insert or update of status, tenant_id, user_id or delete on public.tenant_memberships
for each row execute function private.bump_auth_context_version_for_membership();

drop trigger if exists auth_context_version_for_membership_role on public.membership_roles;
create trigger auth_context_version_for_membership_role
after insert or update of role_id, membership_id, status or delete on public.membership_roles
for each row execute function private.bump_auth_context_version_for_membership_role();

drop trigger if exists auth_context_version_for_tenant on public.tenants;
create trigger auth_context_version_for_tenant
after update of status on public.tenants
for each row execute function private.bump_auth_context_version_for_tenant();

drop trigger if exists auth_context_version_for_role_permissions on public.role_permissions;
create trigger auth_context_version_for_role_permissions
after insert or update of role_id, permission_id or delete on public.role_permissions
for each row execute function private.bump_auth_context_version_for_role_permission();

drop trigger if exists auth_context_version_for_role on public.roles;
create trigger auth_context_version_for_role
after update of code on public.roles
for each row execute function private.bump_auth_context_version_for_role_code();

create or replace function private.restore_all_expired_tenant_suspensions()
returns integer
language plpgsql
security definer
set search_path = public, private, audit, pg_temp
as $$
declare
  restored_count integer;
begin
  with restored as (
    update public.tenants
    set status = 'active',
        suspended_at = null,
        suspension_ends_at = null,
        updated_at = clock_timestamp()
    where status = 'suspended'
      and suspension_ends_at <= clock_timestamp()
    returning id
  ), recorded as (
    insert into audit.audit_events (
      tenant_id, action, resource_type, resource_id, result, metadata
    )
    select
      id,
      'TENANT_SUSPENSION_EXPIRED',
      'tenant',
      id,
      'succeeded',
      jsonb_build_object('automatic', true)
    from restored
    returning 1
  )
  select count(*)::integer into restored_count from recorded;

  return restored_count;
end;
$$;

revoke all on function private.bump_auth_context_version(uuid) from public;
revoke all on function private.bump_auth_context_version_for_role(uuid) from public;
revoke all on function private.restore_all_expired_tenant_suspensions() from public;
grant execute on function private.restore_all_expired_tenant_suspensions() to app_runtime;
