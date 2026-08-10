-- Allow one active financial calendar per country for the same tenant.
-- Existing task and invoice records remain linked to their original fiscal year.

alter table public.tenant_financial_years
  add column if not exists country_code text;

update public.tenant_financial_years tfy
set country_code = coalesce(
  (
    select fyt.country_code
    from public.financial_year_templates fyt
    where fyt.id = tfy.template_id
  ),
  t.country
)
from public.tenants t
where tfy.tenant_id = t.id
  and tfy.country_code is null;

do $$
begin
  if exists (
    select 1
    from public.tenant_financial_years
    where country_code is null
  ) then
    raise exception 'Cannot scope existing tenant financial years without a country code.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.tasks t
    join public.tenant_financial_years tfy
      on tfy.tenant_id = t.tenant_id
     and tfy.id = t.financial_year_id
    where t.country_code <> tfy.country_code
  ) then
    raise exception 'Existing task country does not match its financial year.' using errcode = '23514';
  end if;
end;
$$;

create or replace function private.set_tenant_financial_year_country_code()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  resolved_country_code text;
begin
  select country_code into resolved_country_code
  from public.financial_year_templates
  where id = new.template_id;

  if resolved_country_code is null then
    select country into resolved_country_code
    from public.tenants
    where id = new.tenant_id;
  end if;

  if resolved_country_code is null then
    raise exception 'A tenant financial year requires a country code.' using errcode = '23514';
  end if;

  if new.country_code is not null and upper(new.country_code) <> resolved_country_code then
    raise exception 'Financial year country does not match its template.' using errcode = '23514';
  end if;

  new.country_code := resolved_country_code;
  return new;
end;
$$;

revoke all on function private.set_tenant_financial_year_country_code() from public;

drop trigger if exists tenant_financial_years_set_country_code on public.tenant_financial_years;
create trigger tenant_financial_years_set_country_code
before insert or update of tenant_id, template_id, country_code
on public.tenant_financial_years
for each row execute function private.set_tenant_financial_year_country_code();

alter table public.tenant_financial_years
  alter column country_code set not null,
  drop constraint if exists tenant_financial_years_country_code_check,
  add constraint tenant_financial_years_country_code_check check (country_code ~ '^[A-Z]{2}$'),
  drop constraint if exists tenant_financial_years_tenant_id_id_country_code_unique,
  add constraint tenant_financial_years_tenant_id_id_country_code_unique unique (tenant_id, id, country_code),
  drop constraint if exists tenant_financial_years_no_overlap,
  add constraint tenant_financial_years_no_overlap exclude using gist (
    tenant_id with =,
    country_code with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status <> 'cancelled');

drop index if exists public.tenant_financial_years_one_current_uidx;
create unique index tenant_financial_years_one_current_uidx
  on public.tenant_financial_years (tenant_id, country_code)
  where is_current and status <> 'cancelled';

create unique index if not exists tenant_financial_years_period_uidx
  on public.tenant_financial_years (tenant_id, country_code, start_date, end_date)
  where status <> 'cancelled';

alter table public.tasks
  drop constraint if exists tasks_financial_year_fk,
  add constraint tasks_financial_year_country_fk
    foreign key (tenant_id, financial_year_id, country_code)
    references public.tenant_financial_years (tenant_id, id, country_code)
    not valid;

alter table public.tasks
  validate constraint tasks_financial_year_country_fk;
