alter table authn.sessions
  add column idle_expires_at timestamptz;

alter table authn.credentials enable row level security;
alter table authn.credentials force row level security;
alter table authn.sessions enable row level security;
alter table authn.sessions force row level security;
alter table authn.password_reset_tokens enable row level security;
alter table authn.password_reset_tokens force row level security;
alter table authn.login_audit_events enable row level security;
alter table authn.login_audit_events force row level security;

create policy authn_credentials_runtime_access on authn.credentials for all to app_runtime using (true) with check (true);
create policy authn_sessions_runtime_access on authn.sessions for all to app_runtime using (true) with check (true);
create policy authn_password_reset_tokens_runtime_access on authn.password_reset_tokens for all to app_runtime using (true) with check (true);
create policy authn_login_audit_events_runtime_access on authn.login_audit_events for all to app_runtime using (true) with check (true);

create index authn_sessions_idle_expiry_idx
  on authn.sessions (idle_expires_at)
  where revoked_at is null and idle_expires_at is not null;

create or replace function private.accept_portal_invitation(
  p_invitation_id uuid,
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
  select * into invitation_record
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
    update public.invitations set status = 'expired', updated_at = now() where id = invitation_record.id;
    raise exception 'Invitation has expired.' using errcode = '23505';
  end if;
  if invitation_record.email_normalized <> lower(p_email) then
    raise exception 'Invitation email does not match the requested account.' using errcode = '42501';
  end if;

  select status into tenant_status from public.tenants where id = invitation_record.tenant_id;
  if tenant_status not in ('pending_activation', 'active') then
    raise exception 'Tenant is not available.' using errcode = '42501';
  end if;

  select * into existing_user from public.users where email_normalized = lower(p_email) for update;
  if not found then
    insert into public.users (supabase_auth_user_id, email, email_normalized, display_name, status)
    values (null, p_email, lower(p_email), coalesce(nullif(p_display_name, ''), invitation_record.invitee_display_name, split_part(p_email, '@', 1)), 'active')
    returning id into v_user_id;
  else
    update public.users
    set display_name = coalesce(nullif(p_display_name, ''), display_name),
        status = case when status = 'deactivated' then 'active' else status end,
        updated_at = now()
    where id = existing_user.id
    returning id into v_user_id;
  end if;

  insert into public.tenant_memberships (tenant_id, user_id, display_name, status)
  values (invitation_record.tenant_id, v_user_id, coalesce(nullif(p_display_name, ''), invitation_record.invitee_display_name, split_part(p_email, '@', 1)), 'active')
  on conflict (tenant_id, user_id) do update
  set status = 'active', display_name = excluded.display_name, revoked_at = null,
      revoked_by_membership_id = null, revocation_reason = null, reactivated_at = now(),
      reactivated_by_membership_id = null, updated_at = now()
  returning id into v_membership_id;

  select r.code into role_code from public.roles r where r.id = invitation_record.intended_role_id;
  update public.membership_roles
  set status = 'revoked', revoked_at = now(), revoked_by_membership_id = null
  where tenant_id = invitation_record.tenant_id and membership_id = v_membership_id and status = 'active';
  insert into public.membership_roles (tenant_id, membership_id, role_id, assigned_by_membership_id, status)
  values (invitation_record.tenant_id, v_membership_id, invitation_record.intended_role_id, invitation_record.invited_by_membership_id, 'active')
  on conflict (tenant_id, membership_id, role_id) do update
  set status = 'active', assigned_by_membership_id = excluded.assigned_by_membership_id,
      assigned_at = now(), revoked_at = null, revoked_by_membership_id = null;

  if tenant_status = 'pending_activation' and role_code = 'TENANT_OWNER' then
    update public.tenants set status = 'active', updated_at = now() where id = invitation_record.tenant_id;
  end if;
  update public.invitations
  set status = 'accepted', accepted_at = now(), accepted_by_user_id = v_user_id,
      supabase_auth_user_id = null, updated_at = now()
  where id = invitation_record.id;
  insert into audit.audit_events (tenant_id, actor_user_id, actor_membership_id, action, resource_type, resource_id, result, metadata)
  values (invitation_record.tenant_id, v_user_id, v_membership_id, 'invitation.accepted', 'invitation', invitation_record.id, 'succeeded', jsonb_build_object('role', role_code));

  tenant_id := invitation_record.tenant_id;
  user_id := v_user_id;
  membership_id := v_membership_id;
  status := 'active';
  return next;
end;
$$;

revoke all on function private.accept_portal_invitation(uuid, text, text) from public, anon, authenticated;
grant execute on function private.accept_portal_invitation(uuid, text, text) to app_runtime;
