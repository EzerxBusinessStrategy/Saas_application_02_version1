alter table public.tenant_memberships
  add column if not exists display_title text;

alter table public.tenant_memberships
  drop constraint if exists tenant_memberships_display_title_length;

alter table public.tenant_memberships
  add constraint tenant_memberships_display_title_length
  check (display_title is null or char_length(btrim(display_title)) between 1 and 80);

grant update (display_name, phone, updated_at) on public.users to app_runtime;

create or replace function private.normalize_self_membership_roles(p_roles text[])
returns text[]
language plpgsql
immutable
as $$
declare
  normalized text[] := '{}';
  role_code text;
begin
  foreach role_code in array coalesce(p_roles, '{}')
  loop
    if role_code in ('TENANT_ADMIN', 'MANAGER', 'EMPLOYEE')
       and not (role_code = any(normalized))
    then
      normalized := array_append(normalized, role_code);
    end if;
  end loop;

  if 'MANAGER' = any(normalized) and not 'EMPLOYEE' = any(normalized) then
    normalized := array_append(normalized, 'EMPLOYEE');
  end if;

  if coalesce(array_length(normalized, 1), 0) = 0 then
    raise exception 'Select at least one organisation role.' using errcode = '23514';
  end if;

  return normalized;
end;
$$;

create or replace function private.provision_portal_tenant_for_current_user(
  p_display_name text,
  p_legal_name text,
  p_tenant_code text,
  p_slug text,
  p_country_code text,
  p_reporting_currency_code text,
  p_timezone text,
  p_industry text,
  p_registration_number text,
  p_tax_identifier text,
  p_financial_year_source text,
  p_financial_year_label text,
  p_financial_year_starts_on date,
  p_financial_year_ends_on date,
  p_template_id uuid,
  p_override_reason text,
  p_roles text[],
  p_display_title text
)
returns table (tenant_id uuid, financial_year_id uuid, user_id uuid, membership_id uuid)
language plpgsql
security definer
set search_path = public, private, audit, pg_temp
as $$
declare
  actor_user_id uuid := private.current_user_id();
  actor_name text;
  role_codes text[] := private.normalize_self_membership_roles(p_roles);
  role_code text;
  title text := nullif(btrim(coalesce(p_display_title, '')), '');
  employee_code text;
begin
  if not private.is_platform_admin() then
    raise exception 'Only a Super Admin may create tenants.' using errcode = '42501';
  end if;

  if actor_user_id is null then
    raise exception 'Authenticated user context is required.' using errcode = '42501';
  end if;

  if p_tenant_code !~ '^[A-Z0-9][A-Z0-9-]{1,30}[A-Z0-9]$' then
    raise exception 'Tenant code is invalid.' using errcode = '23514';
  end if;

  if p_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' then
    raise exception 'Tenant slug is invalid.' using errcode = '23514';
  end if;

  if p_financial_year_starts_on >= p_financial_year_ends_on then
    raise exception 'Financial year start date must be before end date.' using errcode = '23514';
  end if;

  if p_financial_year_source = 'CUSTOM_CONFIRMED'
     and nullif(trim(coalesce(p_override_reason, '')), '') is null then
    raise exception 'Custom financial year requires an override reason.' using errcode = '23514';
  end if;

  select u.display_name into actor_name
  from public.users u
  where u.id = actor_user_id
    and u.status = 'active';

  if actor_name is null then
    raise exception 'Authenticated user context is required.' using errcode = '42501';
  end if;

  insert into public.tenants (
    code, slug, legal_name, display_name, status, country, currency, timezone,
    industry, registration_number, tax_identifier, financial_year_template_id
  )
  values (
    p_tenant_code, p_slug, p_legal_name, p_display_name, 'active', p_country_code,
    p_reporting_currency_code, p_timezone, nullif(p_industry, ''),
    nullif(p_registration_number, ''), nullif(p_tax_identifier, ''), p_template_id
  )
  returning id into tenant_id;

  insert into public.tenant_financial_years (
    tenant_id, template_id, label, start_date, end_date, status, source, is_current,
    confirmed_at, confirmed_by_user_id, override_reason
  )
  values (
    tenant_id, p_template_id, p_financial_year_label, p_financial_year_starts_on,
    p_financial_year_ends_on, 'active', p_financial_year_source, true, now(),
    actor_user_id, nullif(p_override_reason, '')
  )
  returning id into financial_year_id;

  insert into public.tenant_memberships (
    tenant_id, user_id, display_name, display_title, status
  )
  values (tenant_id, actor_user_id, actor_name, title, 'active')
  returning id into membership_id;

  foreach role_code in array role_codes
  loop
    insert into public.membership_roles (
      tenant_id, membership_id, role_id, assigned_by_membership_id, status
    )
    select tenant_id, membership_id, r.id, null, 'active'
    from public.roles r
    where r.code = role_code
      and r.scope = 'tenant';

    if not found then
      raise exception 'Organisation role % is not configured.', role_code using errcode = '23514';
    end if;
  end loop;

  if 'EMPLOYEE' = any(role_codes) then
    employee_code := 'emp-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    insert into public.employees (
      tenant_id,
      membership_id,
      employee_code,
      employment_status,
      default_capacity_minutes_per_week
    )
    values (
      tenant_id,
      membership_id,
      employee_code,
      'active',
      2400
    );
  end if;

  user_id := actor_user_id;

  perform audit.write_audit_event(
    'TENANT_CREATED',
    'tenant',
    tenant_id,
    'succeeded',
    null,
    jsonb_build_object(
      'tenantCode', p_tenant_code,
      'slug', p_slug,
      'countryCode', p_country_code,
      'financialYearId', financial_year_id,
      'administratorMode', 'myself',
      'membershipId', membership_id,
      'roles', role_codes,
      'displayTitle', title,
      'authenticationProvider', 'existing_platform_credential'
    )
  );

  return next;
end;
$$;

create or replace function private.list_current_user_contexts()
returns table (
  context_type text,
  tenant_id uuid,
  tenant_code text,
  tenant_name text,
  membership_id uuid,
  display_title text,
  roles text[],
  has_employee boolean
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select
    'platform'::text,
    null::uuid,
    null::text,
    null::text,
    null::uuid,
    null::text,
    coalesce(array_remove(array_agg(distinct r.code order by r.code), null), '{}'::text[]),
    false
  from public.platform_user_roles pur
  join public.roles r on r.id = pur.role_id and r.scope = 'platform'
  where pur.user_id = private.current_user_id()
    and pur.status = 'active'
  having count(r.id) > 0

  union all

  select
    'tenant'::text,
    t.id,
    t.code,
    t.display_name,
    tm.id,
    tm.display_title,
    coalesce(array_remove(array_agg(distinct r.code order by r.code), null), '{}'::text[]),
    exists (
      select 1
      from public.employees e
      where e.tenant_id = tm.tenant_id
        and e.membership_id = tm.id
        and e.employment_status = 'active'
    )
  from public.tenant_memberships tm
  join public.tenants t on t.id = tm.tenant_id
  left join public.membership_roles mr
    on mr.tenant_id = tm.tenant_id
   and mr.membership_id = tm.id
   and mr.status = 'active'
  left join public.roles r on r.id = mr.role_id
  where tm.user_id = private.current_user_id()
    and tm.status = 'active'
    and t.status = 'active'
  group by t.id, t.code, t.display_name, tm.id, tm.display_title, tm.tenant_id
  order by 1, 4 nulls first;
$$;

create or replace function private.update_own_user_profile(
  p_display_name text,
  p_phone text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if private.current_user_id() is null then
    raise exception 'Authenticated user context is required.' using errcode = '42501';
  end if;

  update public.users
  set display_name = coalesce(nullif(btrim(p_display_name), ''), display_name),
      phone = case
        when p_phone is null then phone
        else nullif(btrim(p_phone), '')
      end,
      updated_at = now()
  where id = private.current_user_id()
    and status = 'active';

  if not found then
    raise exception 'Authenticated user context is required.' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.update_own_membership_display_title(
  p_membership_id uuid,
  p_display_title text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if private.current_user_id() is null then
    raise exception 'Authenticated user context is required.' using errcode = '42501';
  end if;

  update public.tenant_memberships
  set display_title = nullif(btrim(p_display_title), ''),
      updated_at = now()
  where id = p_membership_id
    and user_id = private.current_user_id()
    and status = 'active';

  if not found then
    raise exception 'Membership is not available.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.normalize_self_membership_roles(text[]) from public, anon, authenticated;
revoke all on function private.provision_portal_tenant_for_current_user(
  text, text, text, text, text, text, text, text, text, text, text, text, date, date, uuid, text, text[], text
) from public, anon, authenticated;
revoke all on function private.list_current_user_contexts() from public, anon, authenticated;
revoke all on function private.update_own_user_profile(text, text) from public, anon, authenticated;
revoke all on function private.update_own_membership_display_title(uuid, text) from public, anon, authenticated;

grant execute on function private.normalize_self_membership_roles(text[]) to app_runtime;
grant execute on function private.provision_portal_tenant_for_current_user(
  text, text, text, text, text, text, text, text, text, text, text, text, date, date, uuid, text, text[], text
) to app_runtime;
grant execute on function private.list_current_user_contexts() to app_runtime;
grant execute on function private.update_own_user_profile(text, text) to app_runtime;
grant execute on function private.update_own_membership_display_title(uuid, text) to app_runtime;
