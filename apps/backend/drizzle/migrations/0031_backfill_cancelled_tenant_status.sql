update public.tenants t
set status = 'cancelled',
    updated_at = now()
where t.status = 'pending_activation'
  and exists (
    select 1
    from public.invitations i
    join public.roles r on r.id = i.intended_role_id
    where i.tenant_id = t.id
      and r.code = 'TENANT_ADMIN'
      and i.status = 'cancelled'
  );
