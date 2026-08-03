create or replace function private.cancel_super_admin_tenant_invitation(
  p_tenant_id uuid,
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
  if not private.is_platform_admin() then
    raise exception 'Only platform administrators can cancel tenant administrator invitations.' using errcode = '42501';
  end if;

  select i.*
  into invitation_record
  from public.invitations i
  join public.roles r on r.id = i.intended_role_id
  where i.tenant_id = p_tenant_id
    and r.code = 'TENANT_ADMIN'
    and i.status = 'pending'
  order by i.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Pending Tenant Administrator invitation is not available.' using errcode = '42501';
  end if;

  update public.invitations
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by_user_id = private.current_user_id(),
      updated_at = now()
  where id = invitation_record.id
  returning id, invitations.status into invitation_id, status;

  perform audit.write_audit_event(
    'invitation.cancelled',
    'invitation',
    invitation_id,
    'succeeded',
    p_reason,
    jsonb_build_object('email', invitation_record.email_normalized, 'tenantId', p_tenant_id)
  );

  return next;
end;
$$;

revoke all on function private.cancel_super_admin_tenant_invitation(uuid, text) from public;
grant execute on function private.cancel_super_admin_tenant_invitation(uuid, text) to app_runtime;
