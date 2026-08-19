alter table public.billable_task_entries
  add column if not exists billing_frequency text;

alter table public.billable_task_entries
  add column if not exists billing_period_key text;

alter table public.billable_task_entries
  drop constraint if exists billable_task_entries_billing_frequency_check;

alter table public.billable_task_entries
  add constraint billable_task_entries_billing_frequency_check
  check (
    billing_frequency is null
    or billing_frequency in ('monthly', 'quarterly', 'annually', 'one_time')
  );

update public.billable_task_entries as bte
set
  billing_frequency = case
    when ccr.frequency in ('monthly', 'quarterly', 'annually', 'one_time') then ccr.frequency
    else 'one_time'
  end,
  billing_period_key = case
    when ccr.frequency = 'monthly' then
      to_char(coalesce(t.planned_due_at, bte.created_at) at time zone 'utc', 'YYYY-MM')
    when ccr.frequency = 'quarterly' then
      to_char(coalesce(t.planned_due_at, bte.created_at) at time zone 'utc', 'YYYY')
      || '-Q'
      || to_char(coalesce(t.planned_due_at, bte.created_at) at time zone 'utc', 'Q')
    when ccr.frequency = 'annually' then
      coalesce(
        'FY-' || substring(regexp_replace(coalesce(fy.label, ''), '[–—]', '-', 'g') from '([0-9]{4}-[0-9]{2})'),
        'FY-' || to_char(fy.start_date, 'YYYY') || '-' || to_char(fy.end_date, 'YY'),
        t.id::text
      )
    else t.id::text
  end
from public.tasks as t
left join public.compliance_calendar_rules as ccr
  on ccr.tenant_id = t.tenant_id
 and ccr.id = t.compliance_calendar_rule_id
left join public.tenant_financial_years as fy
  on fy.tenant_id = t.tenant_id
 and fy.id = t.financial_year_id
where t.tenant_id = bte.tenant_id
  and t.id = bte.task_id
  and (bte.billing_frequency is null or bte.billing_period_key is null);

create index if not exists billable_task_entries_billing_group_idx
  on public.billable_task_entries (
    tenant_id,
    client_id,
    billing_frequency,
    billing_period_key,
    status
  );
