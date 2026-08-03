alter table public.tenants
  add column if not exists slug text,
  add column if not exists industry text,
  add column if not exists registration_number text,
  add column if not exists tax_identifier text;

update public.tenants
set slug = lower(regexp_replace(code, '[^a-zA-Z0-9]+', '-', 'g'))
where slug is null;

create unique index if not exists tenants_slug_uidx
  on public.tenants (slug)
  where slug is not null;

alter table public.financial_year_templates
  add column if not exists policy_mode text not null default 'COUNTRY_FIXED',
  add column if not exists confirmation_required boolean not null default true,
  add column if not exists custom_allowed boolean not null default true,
  add column if not exists maximum_period_days integer,
  add column if not exists supports_52_53_week boolean not null default false,
  add column if not exists effective_from date not null default '2026-01-01',
  add column if not exists effective_to date,
  add column if not exists policy_version text not null default '2026.1',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.financial_year_templates
  drop constraint if exists financial_year_templates_policy_mode_check,
  add constraint financial_year_templates_policy_mode_check
    check (policy_mode in ('COUNTRY_FIXED', 'COMPANY_DEFINED', 'INCORPORATION_DERIVED')),
  drop constraint if exists financial_year_templates_maximum_period_days_check,
  add constraint financial_year_templates_maximum_period_days_check
    check (maximum_period_days is null or maximum_period_days between 1 and 548),
  drop constraint if exists financial_year_templates_effective_dates_check,
  add constraint financial_year_templates_effective_dates_check
    check (effective_to is null or effective_from <= effective_to);

create unique index if not exists financial_year_templates_country_policy_uidx
  on public.financial_year_templates (country_code, policy_version);

alter table public.tenant_financial_years
  add column if not exists source text not null default 'COUNTRY_SUGGESTION_CONFIRMED',
  add column if not exists is_current boolean not null default false,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by_user_id uuid references public.users (id),
  add column if not exists override_reason text;

alter table public.tenant_financial_years
  drop constraint if exists tenant_financial_years_source_check,
  add constraint tenant_financial_years_source_check
    check (source in ('COUNTRY_SUGGESTION_CONFIRMED', 'CUSTOM_CONFIRMED'));

with ranked as (
  select
    id,
    row_number() over (
      partition by tenant_id
      order by
        case status when 'active' then 0 when 'planned' then 1 else 2 end,
        start_date desc,
        id
    ) as rn
  from public.tenant_financial_years
  where status <> 'cancelled'
)
update public.tenant_financial_years tfy
set is_current = true
from ranked
where ranked.id = tfy.id
  and ranked.rn = 1
  and tfy.is_current = false;

create unique index if not exists tenant_financial_years_one_current_uidx
  on public.tenant_financial_years (tenant_id)
  where is_current and status <> 'cancelled';

insert into public.financial_year_templates (
  country_code,
  name,
  policy_mode,
  start_month,
  start_day,
  end_month,
  end_day,
  confirmation_required,
  custom_allowed,
  maximum_period_days,
  supports_52_53_week,
  policy_version,
  metadata
)
values
  (
    'IN',
    'India April to March financial year',
    'COUNTRY_FIXED',
    4,
    1,
    3,
    31,
    true,
    true,
    366,
    false,
    '2026.1',
    jsonb_build_object(
      'defaultCurrency', 'INR',
      'defaultTimezone', 'Asia/Kolkata',
      'guidance', 'Companies generally use a financial year ending 31 March; custom periods require confirmation.',
      'sourceUrl', 'https://www.indiacode.nic.in/show-data?actid=AC_CEN_22_29_00008_201318_1517807327856'
    )
  ),
  (
    'US',
    'United States company-defined tax year',
    'COMPANY_DEFINED',
    1,
    1,
    12,
    31,
    true,
    true,
    371,
    true,
    '2026.1',
    jsonb_build_object(
      'defaultCurrency', 'USD',
      'defaultTimezone', 'America/New_York',
      'guidance', 'Calendar year is a common suggestion; companies may use a fiscal or 52-53-week tax year where allowed.',
      'sourceUrl', 'https://www.irs.gov/businesses/small-businesses-self-employed/tax-years'
    )
  ),
  (
    'SG',
    'Singapore company-selected financial year end',
    'COMPANY_DEFINED',
    1,
    1,
    12,
    31,
    true,
    true,
    548,
    true,
    '2026.1',
    jsonb_build_object(
      'defaultCurrency', 'SGD',
      'defaultTimezone', 'Asia/Singapore',
      'suggestedYearEnds', jsonb_build_array('03-31', '06-30', '09-30', '12-31'),
      'guidance', 'Companies may choose any financial year end; common dates include 31 March, 30 June, 30 September, and 31 December.',
      'sourceUrl', 'https://www.acra.gov.sg/register/business/registering-different-business-structures/local-company/choosing-a-companys-financial-year-end/'
    )
  ),
  (
    'CA',
    'Canada corporation-selected fiscal period',
    'COMPANY_DEFINED',
    1,
    1,
    12,
    31,
    true,
    true,
    371,
    false,
    '2026.1',
    jsonb_build_object(
      'defaultCurrency', 'CAD',
      'defaultTimezone', 'America/Toronto',
      'guidance', 'A corporation tax year is its fiscal period and cannot be longer than 53 weeks.',
      'sourceUrl', 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/corporation-income-tax-return/when-file-your-corporation-income-tax-return/determining-your-corporation-s-tax-year.html'
    )
  ),
  (
    'GB',
    'United Kingdom incorporation-derived accounting reference date',
    'INCORPORATION_DERIVED',
    1,
    1,
    12,
    31,
    true,
    true,
    548,
    false,
    '2026.1',
    jsonb_build_object(
      'defaultCurrency', 'GBP',
      'defaultTimezone', 'Europe/London',
      'guidance', 'For new companies, the first accounting reference date is the last day of the month of the first incorporation anniversary.',
      'sourceUrl', 'https://www.gov.uk/government/publications/life-of-a-company-annual-requirements/life-of-a-company-part-1-accounts'
    )
  )
on conflict (country_code, policy_version) do update
set name = excluded.name,
    policy_mode = excluded.policy_mode,
    start_month = excluded.start_month,
    start_day = excluded.start_day,
    end_month = excluded.end_month,
    end_day = excluded.end_day,
    confirmation_required = excluded.confirmation_required,
    custom_allowed = excluded.custom_allowed,
    maximum_period_days = excluded.maximum_period_days,
    supports_52_53_week = excluded.supports_52_53_week,
    metadata = excluded.metadata,
    is_active = true,
    updated_at = now();

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
begin
  if not private.is_platform_admin() then
    raise exception 'Only a Super Admin may create tenants.' using errcode = '42501';
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
    p_admin_email,
    lower(p_admin_email),
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
      'tenantAdminEmail', lower(p_admin_email)
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
