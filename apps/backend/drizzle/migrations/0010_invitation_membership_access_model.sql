alter table public.tenants drop constraint if exists tenants_status_check;
alter table public.tenants add constraint tenants_status_check
  check (status in (
    'provisioning',
    'pending_activation',
    'active',
    'suspended',
    'cancelled',
    'archived',
    'pending_deletion'
  ));

alter table public.tenant_memberships drop constraint if exists tenant_memberships_status_check;
alter table public.tenant_memberships add constraint tenant_memberships_status_check
  check (status in ('invited', 'active', 'suspended', 'revoked', 'removed'));

alter table public.tenant_memberships
  add column revoked_at timestamptz,
  add column revoked_by_membership_id uuid,
  add column revocation_reason text,
  add column reactivated_at timestamptz,
  add column reactivated_by_membership_id uuid,
  add column last_access_at timestamptz;

alter table public.tenant_memberships
  add constraint tenant_memberships_revoked_by_fk foreign key (tenant_id, revoked_by_membership_id)
    references public.tenant_memberships (tenant_id, id),
  add constraint tenant_memberships_reactivated_by_fk foreign key (tenant_id, reactivated_by_membership_id)
    references public.tenant_memberships (tenant_id, id);

alter table public.membership_roles
  add column status text not null default 'active',
  add column revoked_at timestamptz,
  add column revoked_by_membership_id uuid;

alter table public.membership_roles
  add constraint membership_roles_status_check check (status in ('active', 'revoked')),
  add constraint membership_roles_revoked_by_fk foreign key (tenant_id, revoked_by_membership_id)
    references public.tenant_memberships (tenant_id, id);

create index membership_roles_tenant_membership_status_idx
  on public.membership_roles (tenant_id, membership_id, status);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  email text not null,
  email_normalized text not null,
  invitee_display_name text,
  intended_role_id uuid not null references public.roles (id),
  invited_by_user_id uuid not null references public.users (id),
  invited_by_membership_id uuid,
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by_user_id uuid references public.users (id),
  revoked_at timestamptz,
  revoked_by_user_id uuid references public.users (id),
  revoked_by_membership_id uuid,
  cancelled_at timestamptz,
  cancelled_by_user_id uuid references public.users (id),
  cancelled_by_membership_id uuid,
  supabase_auth_user_id uuid,
  supabase_invitation_id text,
  delivery_status text not null default 'not_sent',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitations_email_normalized_check check (email_normalized = lower(email)),
  constraint invitations_status_check check (status in ('pending', 'accepted', 'expired', 'revoked', 'cancelled')),
  constraint invitations_delivery_status_check check (delivery_status in ('not_sent', 'sent', 'failed')),
  constraint invitations_tenant_id_id_unique unique (tenant_id, id),
  constraint invitations_invited_by_membership_fk foreign key (tenant_id, invited_by_membership_id)
    references public.tenant_memberships (tenant_id, id),
  constraint invitations_revoked_by_membership_fk foreign key (tenant_id, revoked_by_membership_id)
    references public.tenant_memberships (tenant_id, id),
  constraint invitations_cancelled_by_membership_fk foreign key (tenant_id, cancelled_by_membership_id)
    references public.tenant_memberships (tenant_id, id)
);

create unique index invitations_tenant_pending_email_uidx
  on public.invitations (tenant_id, email_normalized)
  where status = 'pending';

create index invitations_tenant_status_idx
  on public.invitations (tenant_id, status, expires_at, id);

create index invitations_email_idx
  on public.invitations (email_normalized, tenant_id);

alter table public.invitations enable row level security;
alter table public.invitations force row level security;

create policy invitations_select
on public.invitations
for select
to app_runtime, app_readonly
using (
  private.is_platform_admin()
  or (
    private.has_tenant_context(tenant_id)
    and exists (
      select 1
      from public.tenant_memberships tm
      join public.users u on u.id = tm.user_id
      join public.tenants t on t.id = tm.tenant_id
      where tm.tenant_id = invitations.tenant_id
        and tm.id = private.current_membership_id()
        and tm.user_id = private.current_user_id()
        and tm.status = 'active'
        and u.status = 'active'
        and t.status = 'active'
    )
  )
);

create policy invitations_insert_deny
on public.invitations
for insert
to app_runtime
with check (false);

create policy invitations_update_deny
on public.invitations
for update
to app_runtime
using (false)
with check (false);

create policy invitations_delete_deny
on public.invitations
for delete
to app_runtime
using (false);

drop policy if exists membership_roles_select on public.membership_roles;
create policy membership_roles_select
on public.membership_roles
for select
to app_runtime, app_readonly
using (
  private.has_tenant_context(tenant_id)
  and membership_id = private.current_membership_id()
  and status = 'active'
);

grant select on public.invitations to app_runtime, app_readonly;

insert into public.permissions (code, description, resource, action)
values
  ('invitation.read', 'Read tenant invitations.', 'invitation', 'read'),
  ('invitation.create', 'Create tenant invitations.', 'invitation', 'create'),
  ('invitation.cancel', 'Cancel pending tenant invitations.', 'invitation', 'cancel'),
  ('invitation.revoke', 'Revoke pending tenant invitations.', 'invitation', 'revoke'),
  ('membership.revoke', 'Revoke tenant membership access.', 'membership', 'revoke'),
  ('membership.reactivate', 'Reactivate revoked tenant membership access.', 'membership', 'reactivate'),
  ('tenant.suspend', 'Suspend tenant access.', 'tenant', 'suspend'),
  ('tenant.reactivate', 'Reactivate tenant access.', 'tenant', 'reactivate')
on conflict (code) do update
set description = excluded.description,
    resource = excluded.resource,
    action = excluded.action;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from (
  values
    ('SUPER_ADMIN', 'invitation.read'),
    ('SUPER_ADMIN', 'invitation.create'),
    ('SUPER_ADMIN', 'invitation.cancel'),
    ('SUPER_ADMIN', 'invitation.revoke'),
    ('SUPER_ADMIN', 'membership.revoke'),
    ('SUPER_ADMIN', 'membership.reactivate'),
    ('SUPER_ADMIN', 'tenant.suspend'),
    ('SUPER_ADMIN', 'tenant.reactivate'),
    ('TENANT_OWNER', 'invitation.read'),
    ('TENANT_OWNER', 'invitation.create'),
    ('TENANT_OWNER', 'invitation.cancel'),
    ('TENANT_OWNER', 'invitation.revoke'),
    ('TENANT_OWNER', 'membership.revoke'),
    ('TENANT_OWNER', 'membership.reactivate'),
    ('TENANT_ADMIN', 'invitation.read'),
    ('TENANT_ADMIN', 'invitation.create'),
    ('TENANT_ADMIN', 'invitation.cancel'),
    ('TENANT_ADMIN', 'invitation.revoke'),
    ('TENANT_ADMIN', 'membership.revoke'),
    ('TENANT_ADMIN', 'membership.reactivate')
) as seed(role_code, permission_code)
join public.roles r on r.code = seed.role_code
join public.permissions p on p.code = seed.permission_code
on conflict do nothing;

create or replace function private.current_role_codes()
returns text[]
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select coalesce(array_remove(array_agg(distinct r.code order by r.code), null), '{}'::text[])
  from public.membership_roles mr
  join public.roles r on r.id = mr.role_id
  where mr.tenant_id = private.current_tenant_id()
    and mr.membership_id = private.current_membership_id()
    and mr.status = 'active'
$$;

create or replace function private.current_permission_codes()
returns text[]
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select coalesce(array_remove(array_agg(distinct p.code order by p.code), null), '{}'::text[])
  from public.membership_roles mr
  join public.role_permissions rp on rp.role_id = mr.role_id
  join public.permissions p on p.id = rp.permission_id
  where mr.tenant_id = private.current_tenant_id()
    and mr.membership_id = private.current_membership_id()
    and mr.status = 'active'
$$;

create or replace function private.current_membership_is_active()
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    join public.users u on u.id = tm.user_id
    join public.tenants t on t.id = tm.tenant_id
    where tm.tenant_id = private.current_tenant_id()
      and tm.id = private.current_membership_id()
      and tm.user_id = private.current_user_id()
      and tm.status = 'active'
      and u.status = 'active'
      and t.status = 'active'
  )
$$;

create or replace function private.can_invite_role(p_role_code text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_roles text[] := private.current_role_codes();
begin
  if p_role_code = 'SUPER_ADMIN' then
    return false;
  end if;

  if private.is_platform_admin() then
    return p_role_code in (
      'TENANT_OWNER',
      'TENANT_ADMIN',
      'FINANCE_USER',
      'HR_OPERATIONS_USER',
      'MANAGER',
      'EMPLOYEE',
      'CLIENT_USER'
    );
  end if;

  if 'TENANT_OWNER' = any(actor_roles) then
    return p_role_code in (
      'TENANT_ADMIN',
      'FINANCE_USER',
      'HR_OPERATIONS_USER',
      'MANAGER',
      'EMPLOYEE',
      'CLIENT_USER'
    );
  end if;

  if 'TENANT_ADMIN' = any(actor_roles) then
    return p_role_code in (
      'FINANCE_USER',
      'HR_OPERATIONS_USER',
      'MANAGER',
      'EMPLOYEE',
      'CLIENT_USER'
    );
  end if;

  return false;
end;
$$;

create or replace function private.create_tenant_owner_invitation(
  p_tenant_code text,
  p_company_name text,
  p_owner_email text,
  p_owner_name text,
  p_country text default null,
  p_currency text default null,
  p_timezone text default 'UTC',
  p_expires_at timestamptz default null
)
returns table (tenant_id uuid, invitation_id uuid)
language plpgsql
security definer
set search_path = public, private, audit, pg_temp
as $$
declare
  owner_role_id uuid;
begin
  if not private.is_platform_admin() or not private.current_membership_is_active() then
    raise exception 'Only an active Super Admin may create tenants.' using errcode = '42501';
  end if;

  if p_tenant_code !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' then
    raise exception 'Tenant code is invalid.' using errcode = '23514';
  end if;

  select id into owner_role_id
  from public.roles
  where code = 'TENANT_OWNER';

  insert into public.tenants (code, legal_name, display_name, status, country, currency, timezone)
  values (
    p_tenant_code,
    p_company_name,
    p_company_name,
    'pending_activation',
    p_country,
    p_currency,
    coalesce(nullif(p_timezone, ''), 'UTC')
  )
  returning id into tenant_id;

  insert into public.invitations (
    tenant_id,
    email,
    email_normalized,
    invitee_display_name,
    intended_role_id,
    invited_by_user_id,
    invited_by_membership_id,
    expires_at
  )
  values (
    tenant_id,
    p_owner_email,
    lower(p_owner_email),
    p_owner_name,
    owner_role_id,
    private.current_user_id(),
    null,
    coalesce(p_expires_at, now() + interval '1 hour')
  )
  returning id into invitation_id;

  perform audit.write_audit_event(
    'tenant.created',
    'tenant',
    tenant_id,
    'succeeded',
    null,
    jsonb_build_object('owner_email', lower(p_owner_email), 'invitation_id', invitation_id)
  );

  return next;
end;
$$;

create or replace function private.create_invitation(
  p_email text,
  p_display_name text,
  p_role_code text,
  p_expires_at timestamptz default null
)
returns table (invitation_id uuid, role_code text, status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, private, audit, pg_temp
as $$
declare
  role_id uuid;
begin
  if not private.current_membership_is_active() then
    raise exception 'Active tenant membership is required.' using errcode = '42501';
  end if;

  if not private.can_invite_role(p_role_code) then
    raise exception 'Inviter cannot assign requested role.' using errcode = '42501';
  end if;

  select id into role_id
  from public.roles
  where code = p_role_code
    and scope = 'tenant';

  if role_id is null then
    raise exception 'Requested role does not exist.' using errcode = '23514';
  end if;

  insert into public.invitations (
    tenant_id,
    email,
    email_normalized,
    invitee_display_name,
    intended_role_id,
    invited_by_user_id,
    invited_by_membership_id,
    expires_at
  )
  values (
    private.current_tenant_id(),
    p_email,
    lower(p_email),
    p_display_name,
    role_id,
    private.current_user_id(),
    private.current_membership_id(),
    coalesce(p_expires_at, now() + interval '1 hour')
  )
  returning id, p_role_code, invitations.status, invitations.expires_at
  into invitation_id, role_code, status, expires_at;

  perform audit.write_audit_event(
    'invitation.created',
    'invitation',
    invitation_id,
    'succeeded',
    null,
    jsonb_build_object('email', lower(p_email), 'role', p_role_code)
  );

  return next;
end;
$$;

create or replace function private.close_invitation(
  p_invitation_id uuid,
  p_status text,
  p_reason text default null
)
returns table (invitation_id uuid, status text)
language plpgsql
security definer
set search_path = public, private, audit, pg_temp
as $$
declare
  invitation_record public.invitations%rowtype;
begin
  if p_status not in ('cancelled', 'revoked') then
    raise exception 'Unsupported invitation close status.' using errcode = '23514';
  end if;

  if not private.current_membership_is_active() then
    raise exception 'Active tenant membership is required.' using errcode = '42501';
  end if;

  select *
  into invitation_record
  from public.invitations
  where id = p_invitation_id
    and tenant_id = private.current_tenant_id()
  for update;

  if not found then
    raise exception 'Invitation is not available.' using errcode = '42501';
  end if;

  if invitation_record.status <> 'pending' then
    raise exception 'Only pending invitations can be closed.' using errcode = '23505';
  end if;

  update public.invitations
  set status = p_status,
      cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
      cancelled_by_user_id = case when p_status = 'cancelled' then private.current_user_id() else cancelled_by_user_id end,
      cancelled_by_membership_id = case when p_status = 'cancelled' then private.current_membership_id() else cancelled_by_membership_id end,
      revoked_at = case when p_status = 'revoked' then now() else revoked_at end,
      revoked_by_user_id = case when p_status = 'revoked' then private.current_user_id() else revoked_by_user_id end,
      revoked_by_membership_id = case when p_status = 'revoked' then private.current_membership_id() else revoked_by_membership_id end,
      updated_at = now()
  where id = p_invitation_id
  returning id, invitations.status into invitation_id, status;

  perform audit.write_audit_event(
    'invitation.' || p_status,
    'invitation',
    invitation_id,
    'succeeded',
    p_reason,
    jsonb_build_object('email', invitation_record.email_normalized)
  );

  return next;
end;
$$;

create or replace function private.accept_invitation(
  p_invitation_id uuid,
  p_supabase_auth_user_id uuid,
  p_email text,
  p_display_name text default null
)
returns table (tenant_id uuid, user_id uuid, membership_id uuid, role_code text, status text)
language plpgsql
security definer
set search_path = public, private, audit, pg_temp
as $$
declare
  invitation_record public.invitations%rowtype;
  existing_user public.users%rowtype;
  tenant_status text;
  v_membership_id uuid;
  v_user_id uuid;
begin
  select *
  into invitation_record
  from public.invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation is not available.' using errcode = '42501';
  end if;

  if invitation_record.status <> 'pending' then
    raise exception 'Invitation is not pending.' using errcode = '23505';
  end if;

  if invitation_record.expires_at <= now() then
    update public.invitations
    set status = 'expired',
        updated_at = now()
    where id = invitation_record.id;
    raise exception 'Invitation has expired.' using errcode = '23505';
  end if;

  if invitation_record.email_normalized <> lower(p_email) then
    raise exception 'Invitation email does not match authenticated user.' using errcode = '42501';
  end if;

  select status into tenant_status
  from public.tenants
  where id = invitation_record.tenant_id;

  if tenant_status not in ('pending_activation', 'active') then
    raise exception 'Tenant is not available.' using errcode = '42501';
  end if;

  select *
  into existing_user
  from public.users
  where supabase_auth_user_id = p_supabase_auth_user_id
     or email_normalized = lower(p_email)
  for update;

  if not found then
    insert into public.users (
      supabase_auth_user_id,
      email,
      email_normalized,
      display_name,
      status
    )
    values (
      p_supabase_auth_user_id,
      p_email,
      lower(p_email),
      coalesce(nullif(p_display_name, ''), invitation_record.invitee_display_name, split_part(p_email, '@', 1)),
      'active'
    )
    returning id into v_user_id;
  elsif existing_user.supabase_auth_user_id <> p_supabase_auth_user_id
     or existing_user.email_normalized <> lower(p_email) then
    raise exception 'Authenticated user does not match invitation.' using errcode = '42501';
  else
    update public.users
    set display_name = coalesce(nullif(p_display_name, ''), display_name),
        status = case when status = 'deactivated' then 'active' else status end,
        updated_at = now()
    where id = existing_user.id
    returning id into v_user_id;
  end if;

  insert into public.tenant_memberships (
    tenant_id,
    user_id,
    display_name,
    status
  )
  values (
    invitation_record.tenant_id,
    v_user_id,
    coalesce(nullif(p_display_name, ''), invitation_record.invitee_display_name, split_part(p_email, '@', 1)),
    'active'
  )
  on conflict (tenant_id, user_id) do update
  set status = 'active',
      display_name = excluded.display_name,
      revoked_at = null,
      revoked_by_membership_id = null,
      revocation_reason = null,
      reactivated_at = now(),
      reactivated_by_membership_id = null,
      updated_at = now()
  returning id into v_membership_id;

  select r.code into role_code
  from public.roles r
  where r.id = invitation_record.intended_role_id;

  update public.membership_roles
  set status = 'revoked',
      revoked_at = now(),
      revoked_by_membership_id = null
  where tenant_id = invitation_record.tenant_id
    and membership_id = v_membership_id
    and status = 'active';

  insert into public.membership_roles (
    tenant_id,
    membership_id,
    role_id,
    assigned_by_membership_id,
    status
  )
  values (
    invitation_record.tenant_id,
    v_membership_id,
    invitation_record.intended_role_id,
    invitation_record.invited_by_membership_id,
    'active'
  )
  on conflict (tenant_id, membership_id, role_id) do update
  set status = 'active',
      assigned_by_membership_id = excluded.assigned_by_membership_id,
      assigned_at = now(),
      revoked_at = null,
      revoked_by_membership_id = null;

  if tenant_status = 'pending_activation' and role_code = 'TENANT_OWNER' then
    update public.tenants
    set status = 'active',
        updated_at = now()
    where id = invitation_record.tenant_id;
  end if;

  update public.invitations
  set status = 'accepted',
      accepted_at = now(),
      accepted_by_user_id = v_user_id,
      supabase_auth_user_id = p_supabase_auth_user_id,
      updated_at = now()
  where id = invitation_record.id;

  insert into audit.audit_events (
    tenant_id,
    actor_user_id,
    actor_membership_id,
    action,
    resource_type,
    resource_id,
    result,
    metadata
  )
  values (
    invitation_record.tenant_id,
    v_user_id,
    v_membership_id,
    'invitation.accepted',
    'invitation',
    invitation_record.id,
    'succeeded',
    jsonb_build_object('role', role_code)
  );

  tenant_id := invitation_record.tenant_id;
  user_id := v_user_id;
  membership_id := v_membership_id;
  status := 'active';
  return next;
end;
$$;

create or replace function private.revoke_membership(
  p_membership_id uuid,
  p_reason text
)
returns table (membership_id uuid, status text)
language plpgsql
security definer
set search_path = public, private, audit, pg_temp
as $$
declare
  target_record public.tenant_memberships%rowtype;
  target_roles text[];
  actor_roles text[] := private.current_role_codes();
  target_email text;
begin
  if not private.current_membership_is_active() then
    raise exception 'Active tenant membership is required.' using errcode = '42501';
  end if;

  if p_membership_id = private.current_membership_id() then
    raise exception 'Current membership cannot revoke itself.' using errcode = '42501';
  end if;

  select *
  into target_record
  from public.tenant_memberships
  where tenant_id = private.current_tenant_id()
    and id = p_membership_id
  for update;

  if not found then
    raise exception 'Membership is not available.' using errcode = '42501';
  end if;

  select coalesce(array_remove(array_agg(distinct r.code), null), '{}'::text[])
  into target_roles
  from public.membership_roles mr
  join public.roles r on r.id = mr.role_id
  where mr.tenant_id = target_record.tenant_id
    and mr.membership_id = target_record.id
    and mr.status = 'active';

  if not private.is_platform_admin()
     and not ('TENANT_OWNER' = any(actor_roles))
     and not ('TENANT_ADMIN' = any(actor_roles)) then
    raise exception 'Membership revocation is not allowed.' using errcode = '42501';
  end if;

  if 'TENANT_ADMIN' = any(actor_roles)
     and ('TENANT_OWNER' = any(target_roles) or 'TENANT_ADMIN' = any(target_roles)) then
    raise exception 'Tenant Admin cannot revoke owner or admin memberships.' using errcode = '42501';
  end if;

  update public.tenant_memberships
  set status = 'revoked',
      revoked_at = now(),
      revoked_by_membership_id = private.current_membership_id(),
      revocation_reason = p_reason,
      last_access_at = coalesce(last_access_at, last_active_at),
      updated_at = now()
  where tenant_id = target_record.tenant_id
    and id = target_record.id
  returning id, tenant_memberships.status into membership_id, status;

  update public.membership_roles
  set status = 'revoked',
      revoked_at = now(),
      revoked_by_membership_id = private.current_membership_id()
  where tenant_id = target_record.tenant_id
    and membership_id = target_record.id
    and status = 'active';

  select email_normalized into target_email
  from public.users
  where id = target_record.user_id;

  update public.invitations
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by_user_id = private.current_user_id(),
      cancelled_by_membership_id = private.current_membership_id(),
      updated_at = now()
  where tenant_id = target_record.tenant_id
    and email_normalized = target_email
    and status = 'pending';

  perform audit.write_audit_event(
    'membership.revoked',
    'membership',
    target_record.id,
    'succeeded',
    p_reason,
    jsonb_build_object('target_user_id', target_record.user_id, 'previous_roles', target_roles)
  );

  return next;
end;
$$;

create or replace function private.reactivate_membership(
  p_membership_id uuid,
  p_role_code text
)
returns table (membership_id uuid, role_code text, status text)
language plpgsql
security definer
set search_path = public, private, audit, pg_temp
as $$
declare
  target_record public.tenant_memberships%rowtype;
  role_id uuid;
begin
  if not private.current_membership_is_active() then
    raise exception 'Active tenant membership is required.' using errcode = '42501';
  end if;

  if not private.can_invite_role(p_role_code) then
    raise exception 'Actor cannot assign requested role.' using errcode = '42501';
  end if;

  select *
  into target_record
  from public.tenant_memberships
  where tenant_id = private.current_tenant_id()
    and id = p_membership_id
  for update;

  if not found then
    raise exception 'Membership is not available.' using errcode = '42501';
  end if;

  select id into role_id
  from public.roles
  where code = p_role_code
    and scope = 'tenant';

  if role_id is null then
    raise exception 'Requested role does not exist.' using errcode = '23514';
  end if;

  update public.membership_roles
  set status = 'revoked',
      revoked_at = now(),
      revoked_by_membership_id = private.current_membership_id()
  where tenant_id = target_record.tenant_id
    and membership_id = target_record.id
    and status = 'active';

  update public.tenant_memberships
  set status = 'active',
      revoked_at = null,
      revoked_by_membership_id = null,
      revocation_reason = null,
      reactivated_at = now(),
      reactivated_by_membership_id = private.current_membership_id(),
      updated_at = now()
  where tenant_id = target_record.tenant_id
    and id = target_record.id
  returning id, tenant_memberships.status into membership_id, status;

  insert into public.membership_roles (
    tenant_id,
    membership_id,
    role_id,
    assigned_by_membership_id,
    status
  )
  values (
    target_record.tenant_id,
    target_record.id,
    role_id,
    private.current_membership_id(),
    'active'
  )
  on conflict (tenant_id, membership_id, role_id) do update
  set status = 'active',
      assigned_by_membership_id = excluded.assigned_by_membership_id,
      assigned_at = now(),
      revoked_at = null,
      revoked_by_membership_id = null;

  role_code := p_role_code;

  perform audit.write_audit_event(
    'membership.reactivated',
    'membership',
    target_record.id,
    'succeeded',
    null,
    jsonb_build_object('role', p_role_code)
  );

  return next;
end;
$$;

create or replace function private.resolve_auth_context(p_supabase_auth_user_id uuid)
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
  role_codes text[],
  permission_codes text[]
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select
    u.id,
    u.email,
    u.display_name,
    u.status,
    tm.tenant_id,
    t.code,
    t.display_name,
    t.status,
    tm.id,
    tm.status,
    tm.display_name,
    tm.timezone,
    coalesce(array_remove(array_agg(distinct r.code order by r.code), null), '{}'::text[]),
    coalesce(array_remove(array_agg(distinct p.code order by p.code), null), '{}'::text[])
  from public.users u
  left join public.tenant_memberships tm
    on tm.user_id = u.id
   and tm.status <> 'removed'
  left join public.tenants t
    on t.id = tm.tenant_id
  left join public.membership_roles mr
    on mr.tenant_id = tm.tenant_id
   and mr.membership_id = tm.id
   and mr.status = 'active'
  left join public.roles r
    on r.id = mr.role_id
  left join public.role_permissions rp
    on rp.role_id = r.id
  left join public.permissions p
    on p.id = rp.permission_id
  where u.supabase_auth_user_id = p_supabase_auth_user_id
  group by
    u.id,
    u.email,
    u.display_name,
    u.status,
    tm.tenant_id,
    t.code,
    t.display_name,
    t.status,
    tm.id,
    tm.status,
    tm.display_name,
    tm.timezone
  order by t.display_name nulls last, tm.id nulls last;
$$;

revoke all on function private.current_role_codes() from public;
revoke all on function private.current_permission_codes() from public;
revoke all on function private.current_membership_is_active() from public;
revoke all on function private.can_invite_role(text) from public;
revoke all on function private.create_tenant_owner_invitation(text, text, text, text, text, text, text, timestamptz) from public;
revoke all on function private.create_invitation(text, text, text, timestamptz) from public;
revoke all on function private.close_invitation(uuid, text, text) from public;
revoke all on function private.accept_invitation(uuid, uuid, text, text) from public;
revoke all on function private.revoke_membership(uuid, text) from public;
revoke all on function private.reactivate_membership(uuid, text) from public;
revoke all on function private.resolve_auth_context(uuid) from public;

grant execute on function private.current_role_codes() to app_runtime, app_readonly;
grant execute on function private.current_permission_codes() to app_runtime, app_readonly;
grant execute on function private.current_membership_is_active() to app_runtime, app_readonly;
grant execute on function private.can_invite_role(text) to app_runtime;
grant execute on function private.create_tenant_owner_invitation(text, text, text, text, text, text, text, timestamptz) to app_runtime;
grant execute on function private.create_invitation(text, text, text, timestamptz) to app_runtime;
grant execute on function private.close_invitation(uuid, text, text) to app_runtime;
grant execute on function private.accept_invitation(uuid, uuid, text, text) to app_runtime;
grant execute on function private.revoke_membership(uuid, text) to app_runtime;
grant execute on function private.reactivate_membership(uuid, text) to app_runtime;
grant execute on function private.resolve_auth_context(uuid) to app_runtime;
