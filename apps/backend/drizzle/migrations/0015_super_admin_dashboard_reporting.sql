insert into public.tenant_health_bands (
  code,
  label,
  minimum_turnover,
  maximum_turnover,
  sort_order
)
select *
from (
  values
  ('LOW', 'Low', 0, 500000, 10),
  ('DEVELOPING', 'Developing', 500000, 2000000, 20),
  ('HEALTHY', 'Healthy', 2000000, 5000000, 30),
  ('HIGH_PERFORMING', 'High Performing', 5000000, null, 40)
) as defaults(code, label, minimum_turnover, maximum_turnover, sort_order)
where not exists (select 1 from public.tenant_health_bands)
on conflict do nothing;

create or replace view public.tenant_sales_summary_v
with (security_invoker = true)
as
with item_totals as (
  select
    tenant_id,
    invoice_id,
    sum(gross_amount - discount_amount)::numeric(18,2) as turnover_amount
  from public.invoice_items
  group by tenant_id, invoice_id
),
payment_totals as (
  select
    tenant_id,
    invoice_id,
    coalesce(sum(amount) filter (where status = 'successful'), 0)::numeric(18,2) as collected_amount
  from public.payments
  group by tenant_id, invoice_id
),
invoice_base as (
  select
    i.tenant_id,
    i.financial_year_id,
    i.id as invoice_id,
    coalesce(
      it.turnover_amount,
      greatest(i.subtotal_amount - i.discount_amount, 0),
      0
    )::numeric(18,2) as turnover_amount,
    coalesce(pt.collected_amount, 0)::numeric(18,2) as collected_amount
  from public.invoices i
  left join item_totals it
    on it.tenant_id = i.tenant_id
   and it.invoice_id = i.id
  left join payment_totals pt
    on pt.tenant_id = i.tenant_id
   and pt.invoice_id = i.id
  where i.status in ('issued', 'finalized', 'partially_paid', 'paid', 'overdue')
    and i.finalized_at is not null
)
select
  tfy.tenant_id,
  tfy.id as financial_year_id,
  tfy.start_date as period_start,
  tfy.end_date as period_end,
  coalesce(sum(ib.turnover_amount), 0)::numeric(18,2) as total_sales,
  coalesce(sum(ib.collected_amount), 0)::numeric(18,2) as total_collected,
  coalesce(sum(greatest(ib.turnover_amount - ib.collected_amount, 0)), 0)::numeric(18,2) as total_outstanding,
  count(ib.invoice_id)::integer as invoice_count
from public.tenant_financial_years tfy
left join invoice_base ib
  on ib.tenant_id = tfy.tenant_id
 and ib.financial_year_id = tfy.id
group by tfy.tenant_id, tfy.id, tfy.start_date, tfy.end_date;

create or replace view public.tenant_health_summary_v
with (security_invoker = true)
as
select
  t.id as tenant_id,
  t.display_name as tenant_name,
  t.country as country_code,
  t.status as tenant_status,
  s.financial_year_id,
  s.period_start,
  s.period_end,
  s.total_sales,
  s.total_collected,
  s.total_outstanding,
  hb.code as health_code,
  hb.label as health_label,
  s.invoice_count
from public.tenants t
join public.tenant_sales_summary_v s on s.tenant_id = t.id
left join public.tenant_health_bands hb
  on hb.is_active
 and s.total_sales >= hb.minimum_turnover
 and (hb.maximum_turnover is null or s.total_sales < hb.maximum_turnover);
