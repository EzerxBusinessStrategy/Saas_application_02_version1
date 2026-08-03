drop function if exists private.list_super_admin_tenants(text, text, date, text, integer, integer);

create function private.list_super_admin_tenants(
  p_query text,
  p_status text,
  p_created_after date,
  p_sort text,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid,
  name text,
  code text,
  owner_name text,
  owner_email text,
  pending_invitation_id uuid,
  status text,
  employee_count integer,
  client_count integer,
  created_at timestamptz,
  usage_percent integer,
  total_items bigint
)
language sql
stable
security definer
set search_path = public, private
as $$
  with base as (
    select
      t.id,
      t.display_name as name,
      t.code,
      coalesce(active_admin.display_name, pending_invite.invitee_display_name, 'Invitation pending') as owner_name,
      coalesce(active_admin.email, pending_invite.email) as owner_email,
      pending_invite.id as pending_invitation_id,
      t.status,
      (
        select count(distinct tm2.user_id)::integer
        from public.tenant_memberships tm2
        join public.users u2 on u2.id = tm2.user_id
        where tm2.tenant_id = t.id
          and tm2.status = 'active'
          and u2.status = 'active'
      ) as employee_count,
      (
        select count(*)::integer
        from public.clients c
        where c.tenant_id = t.id
          and c.status = 'active'
      ) as client_count,
      t.created_at,
      0::integer as usage_percent
    from public.tenants t
    left join lateral (
      select tm.display_name, u.email
      from public.tenant_memberships tm
      join public.users u on u.id = tm.user_id
      join public.membership_roles mr on mr.tenant_id = tm.tenant_id
        and mr.membership_id = tm.id
        and mr.status = 'active'
      join public.roles r on r.id = mr.role_id
      where tm.tenant_id = t.id
        and tm.status = 'active'
        and r.code in ('TENANT_OWNER', 'TENANT_ADMIN')
      order by case r.code when 'TENANT_OWNER' then 0 else 1 end, tm.joined_at
      limit 1
    ) active_admin on true
    left join lateral (
      select i.id, i.invitee_display_name, i.email
      from public.invitations i
      join public.roles r on r.id = i.intended_role_id
      where i.tenant_id = t.id
        and i.status = 'pending'
        and r.code = 'TENANT_ADMIN'
      order by i.created_at
      limit 1
    ) pending_invite on true
    where (
      p_query is null
      or t.display_name ilike '%' || p_query || '%'
      or t.code ilike '%' || p_query || '%'
      or t.slug ilike '%' || p_query || '%'
      or active_admin.email ilike '%' || p_query || '%'
      or pending_invite.email ilike '%' || p_query || '%'
    )
      and (p_status is null or t.status = p_status)
      and (p_created_after is null or t.created_at::date >= p_created_after)
  )
  select
    b.id,
    b.name,
    b.code,
    b.owner_name,
    b.owner_email,
    b.pending_invitation_id,
    b.status,
    b.employee_count,
    b.client_count,
    b.created_at,
    b.usage_percent,
    count(*) over () as total_items
  from base b
  order by
    case when p_sort = 'employees' then b.employee_count end desc nulls last,
    case when p_sort = 'createdAt' then b.created_at end desc nulls last,
    case when coalesce(p_sort, 'name') = 'name' then b.name end asc nulls last,
    b.id asc
  limit p_limit
  offset p_offset;
$$;

grant execute on function private.list_super_admin_tenants(text, text, date, text, integer, integer)
  to app_runtime;

drop function if exists private.get_super_admin_tenant(uuid);

create function private.get_super_admin_tenant(p_tenant_id uuid)
returns table (
  id uuid,
  name text,
  code text,
  owner_name text,
  owner_email text,
  pending_invitation_id uuid,
  status text,
  employee_count integer,
  client_count integer,
  created_at timestamptz,
  usage_percent integer
)
language sql
stable
security definer
set search_path = public, private
as $$
  select
    t.id,
    t.display_name as name,
    t.code,
    coalesce(active_admin.display_name, pending_invite.invitee_display_name, 'Invitation pending') as owner_name,
    coalesce(active_admin.email, pending_invite.email) as owner_email,
    pending_invite.id as pending_invitation_id,
    t.status,
    (
      select count(distinct tm2.user_id)::integer
      from public.tenant_memberships tm2
      join public.users u2 on u2.id = tm2.user_id
      where tm2.tenant_id = t.id
        and tm2.status = 'active'
        and u2.status = 'active'
    ) as employee_count,
    (
      select count(*)::integer
      from public.clients c
      where c.tenant_id = t.id
        and c.status = 'active'
    ) as client_count,
    t.created_at,
    0::integer as usage_percent
  from public.tenants t
  left join lateral (
    select tm.display_name, u.email
    from public.tenant_memberships tm
    join public.users u on u.id = tm.user_id
    join public.membership_roles mr on mr.tenant_id = tm.tenant_id
      and mr.membership_id = tm.id
      and mr.status = 'active'
    join public.roles r on r.id = mr.role_id
    where tm.tenant_id = t.id
      and tm.status = 'active'
      and r.code in ('TENANT_OWNER', 'TENANT_ADMIN')
    order by case r.code when 'TENANT_OWNER' then 0 else 1 end, tm.joined_at
    limit 1
  ) active_admin on true
  left join lateral (
    select i.id, i.invitee_display_name, i.email
    from public.invitations i
    join public.roles r on r.id = i.intended_role_id
    where i.tenant_id = t.id
      and i.status = 'pending'
      and r.code = 'TENANT_ADMIN'
    order by i.created_at
    limit 1
  ) pending_invite on true
  where t.id = p_tenant_id;
$$;

grant execute on function private.get_super_admin_tenant(uuid)
  to app_runtime;
