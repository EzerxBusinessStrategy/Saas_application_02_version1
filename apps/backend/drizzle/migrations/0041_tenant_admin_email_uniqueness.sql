create or replace function private.create_super_admin_tenant(
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
  p_admin_full_name text,
  p_admin_email text,
  p_admin_phone text,
  p_expires_at timestamptz
)
returns table (tenant_id uuid, financial_year_id uuid, invitation_id uuid)
language plpgsql
security definer
set search_path = public, private, audit, pg_temp
as $$
declare
  admin_role_id uuid;
  normalized_admin_email text := lower(trim(p_admin_email));
begin
  if not private.is_platform_admin() then
    raise exception 'Only a Super Admin may create tenants.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.users
    where email_normalized = normalized_admin_email
       or lower(trim(email)) = normalized_admin_email
  ) then
    raise exception 'Tenant Administrator email already exists.' using errcode = '23505';
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

  if p_financial_year_source = 'CUSTOM_CONFIRMED' and nullif(trim(coalesce(p_override_reason, '')), '') is null then
    raise exception 'Custom financial year requires an override reason.' using errcode = '23514';
  end if;

  select id into admin_role_id
  from public.roles
  where code = 'TENANT_ADMIN'
    and scope = 'tenant';

  if admin_role_id is null then
    raise exception 'Tenant Administrator role is not configured.' using errcode = '23514';
  end if;

  insert into public.tenants (
    code,
    slug,
    legal_name,
    display_name,
    status,
    country,
    currency,
    timezone,
    industry,
    registration_number,
    tax_identifier,
    financial_year_template_id
  )
  values (
    p_tenant_code,
    p_slug,
    p_legal_name,
    p_display_name,
    'pending_activation',
    p_country_code,
    p_reporting_currency_code,
    p_timezone,
    nullif(p_industry, ''),
    nullif(p_registration_number, ''),
    nullif(p_tax_identifier, ''),
    p_template_id
  )
  returning id into tenant_id;

  insert into public.tenant_financial_years (
    tenant_id,
    template_id,
    label,
    start_date,
    end_date,
    status,
    source,
    is_current,
    confirmed_at,
    confirmed_by_user_id,
    override_reason
  )
  values (
    tenant_id,
    p_template_id,
    p_financial_year_label,
    p_financial_year_starts_on,
    p_financial_year_ends_on,
    'active',
    p_financial_year_source,
    true,
    now(),
    private.current_user_id(),
    nullif(p_override_reason, '')
  )
  returning id into financial_year_id;

  insert into public.invitations (
    tenant_id,
    email,
    email_normalized,
    invitee_display_name,
    intended_role_id,
    invited_by_user_id,
    invited_by_membership_id,
    expires_at,
    delivery_status
  )
  values (
    tenant_id,
    normalized_admin_email,
    normalized_admin_email,
    p_admin_full_name,
    admin_role_id,
    private.current_user_id(),
    null,
    coalesce(p_expires_at, now() + interval '24 hours'),
    'not_sent'
  )
  returning id into invitation_id;

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
      'tenantAdminInvitationId', invitation_id,
      'tenantAdminEmail', normalized_admin_email
    )
  );

  return next;
end;
$$;

revoke all on function private.create_super_admin_tenant(
  text, text, text, text, text, text, text, text, text, text, text, text, date, date, uuid, text, text, text, text, timestamptz
) from public;
grant execute on function private.create_super_admin_tenant(
  text, text, text, text, text, text, text, text, text, text, text, text, date, date, uuid, text, text, text, text, timestamptz
) to app_runtime;
