create or replace view public.employee_performance_summary_v
with (security_invoker = true)
as
with employee_periods as (
  select
    e.tenant_id,
    e.id as employee_id,
    tfy.id as financial_year_id,
    tfy.start_date as period_start,
    tfy.end_date as period_end
  from public.employees e
  join public.tenant_financial_years tfy on tfy.tenant_id = e.tenant_id
),
assignment_tasks as (
  select distinct
    ta.tenant_id,
    ta.employee_id,
    t.id as task_id,
    t.financial_year_id,
    t.status,
    t.planned_due_at,
    t.actual_completed_at,
    t.sla_status,
    t.sla_elapsed_minutes
  from public.task_assignments ta
  join public.tasks t
    on t.tenant_id = ta.tenant_id
   and t.id = ta.task_id
),
approval_flags as (
  select
    tenant_id,
    task_id,
    bool_or(decision = 'returned') as was_returned
  from public.approvals
  group by tenant_id, task_id
),
contribution_totals as (
  select
    tenant_id,
    task_id,
    employee_id,
    sum(revenue_share_amount)::numeric(18,2) as total_revenue_generated
  from public.task_employee_contributions
  group by tenant_id, task_id, employee_id
),
employee_task_totals as (
  select
    at.tenant_id,
    at.employee_id,
    at.financial_year_id,
    count(at.task_id)::numeric as assigned_count,
    count(at.task_id) filter (where at.status = 'completed')::numeric as completed_task_count,
    count(at.task_id) filter (
      where at.status = 'completed'
        and at.planned_due_at is not null
        and at.actual_completed_at <= at.planned_due_at
    )::numeric as on_time_task_count,
    count(at.task_id) filter (where coalesce(af.was_returned, false))::numeric as returned_task_count,
    count(at.task_id) filter (where at.sla_status = 'met')::numeric as sla_met_count,
    count(at.task_id) filter (where at.sla_status = 'breached')::numeric as sla_breached_count,
    avg(at.sla_elapsed_minutes) filter (where at.sla_elapsed_minutes is not null)::numeric(18,2) as average_sla_minutes,
    coalesce(sum(ct.total_revenue_generated), 0)::numeric(18,2) as total_revenue_generated
  from assignment_tasks at
  left join approval_flags af
    on af.tenant_id = at.tenant_id
   and af.task_id = at.task_id
  left join contribution_totals ct
    on ct.tenant_id = at.tenant_id
   and ct.task_id = at.task_id
   and ct.employee_id = at.employee_id
  group by at.tenant_id, at.employee_id, at.financial_year_id
),
scored as (
  select
    ep.tenant_id,
    ep.employee_id,
    ep.financial_year_id,
    ep.period_start,
    ep.period_end,
    coalesce(ett.assigned_count, 0) as assigned_count,
    coalesce(ett.completed_task_count, 0) as completed_task_count,
    coalesce(ett.on_time_task_count, 0) as on_time_task_count,
    coalesce(ett.returned_task_count, 0) as returned_task_count,
    coalesce(ett.sla_met_count, 0) as sla_met_count,
    coalesce(ett.sla_breached_count, 0) as sla_breached_count,
    ett.average_sla_minutes,
    coalesce(ett.total_revenue_generated, 0)::numeric(18,2) as total_revenue_generated,
    case when coalesce(ett.assigned_count, 0) = 0 then 0 else ett.completed_task_count / ett.assigned_count end as completion_rate,
    case when coalesce(ett.completed_task_count, 0) = 0 then 0 else ett.on_time_task_count / ett.completed_task_count end as on_time_rate,
    case when coalesce(ett.completed_task_count, 0) = 0 then 0 else ett.sla_met_count / ett.completed_task_count end as sla_compliance_rate,
    case when coalesce(ett.completed_task_count, 0) = 0 then 1 else greatest(0, 1 - (ett.returned_task_count / ett.completed_task_count)) end as non_return_rate,
    max(coalesce(ett.total_revenue_generated, 0)) over (partition by ep.tenant_id, ep.financial_year_id) as max_revenue_generated
  from employee_periods ep
  left join employee_task_totals ett
    on ett.tenant_id = ep.tenant_id
   and ett.employee_id = ep.employee_id
   and ett.financial_year_id = ep.financial_year_id
)
select
  tenant_id,
  employee_id,
  financial_year_id,
  period_start,
  period_end,
  completed_task_count::integer,
  on_time_task_count::integer,
  returned_task_count::integer,
  sla_met_count::integer,
  sla_breached_count::integer,
  average_sla_minutes,
  total_revenue_generated,
  completion_rate::numeric(8,4),
  sla_compliance_rate::numeric(8,4),
  round((
    completion_rate * 30
    + on_time_rate * 20
    + sla_compliance_rate * 20
    + non_return_rate * 15
    + case
        when coalesce(max_revenue_generated, 0) = 0 then 0
        else (total_revenue_generated / max_revenue_generated) * 15
      end
  ), 2)::numeric(8,2) as performance_score
from scored;

create or replace view public.client_task_revenue_summary_v
with (security_invoker = true)
as
with task_totals as (
  select
    tenant_id,
    client_id,
    financial_year_id,
    count(*)::integer as total_tasks,
    count(*) filter (where status = 'completed')::integer as completed_tasks,
    count(*) filter (where status not in ('completed', 'cancelled'))::integer as pending_tasks
  from public.tasks
  group by tenant_id, client_id, financial_year_id
),
billable_totals as (
  select
    t.tenant_id,
    t.client_id,
    t.financial_year_id,
    coalesce(sum(bte.net_amount) filter (where bte.status in ('approved_for_invoice', 'invoiced')), 0)::numeric(18,2) as total_billable_amount
  from public.tasks t
  left join public.billable_task_entries bte
    on bte.tenant_id = t.tenant_id
   and bte.task_id = t.id
  group by t.tenant_id, t.client_id, t.financial_year_id
),
invoice_totals as (
  select
    i.tenant_id,
    i.client_id,
    i.financial_year_id,
    coalesce(sum(i.total_amount) filter (where i.status not in ('draft', 'cancelled', 'void')), 0)::numeric(18,2) as invoiced_amount,
    coalesce(sum(p.amount) filter (where p.status = 'successful'), 0)::numeric(18,2) as collected_amount
  from public.invoices i
  left join public.payments p
    on p.tenant_id = i.tenant_id
   and p.invoice_id = i.id
  group by i.tenant_id, i.client_id, i.financial_year_id
)
select
  c.tenant_id,
  c.id as client_id,
  tfy.id as financial_year_id,
  coalesce(tt.total_tasks, 0) as total_tasks,
  coalesce(tt.completed_tasks, 0) as completed_tasks,
  coalesce(tt.pending_tasks, 0) as pending_tasks,
  coalesce(bt.total_billable_amount, 0)::numeric(18,2) as total_billable_amount,
  coalesce(it.invoiced_amount, 0)::numeric(18,2) as invoiced_amount,
  coalesce(it.collected_amount, 0)::numeric(18,2) as collected_amount,
  greatest(coalesce(it.invoiced_amount, 0) - coalesce(it.collected_amount, 0), 0)::numeric(18,2) as outstanding_amount
from public.clients c
join public.tenant_financial_years tfy on tfy.tenant_id = c.tenant_id
left join task_totals tt
  on tt.tenant_id = c.tenant_id
 and tt.client_id = c.id
 and tt.financial_year_id = tfy.id
left join billable_totals bt
  on bt.tenant_id = c.tenant_id
 and bt.client_id = c.id
 and bt.financial_year_id = tfy.id
left join invoice_totals it
  on it.tenant_id = c.tenant_id
 and it.client_id = c.id
 and it.financial_year_id = tfy.id;

create or replace view public.task_group_workload_summary_v
with (security_invoker = true)
as
with member_totals as (
  select
    tenant_id,
    work_group_id,
    count(*) filter (where status = 'active' and group_role = 'manager')::integer as active_manager_count,
    count(*) filter (where status = 'active' and group_role = 'member')::integer as active_employee_count
  from public.work_group_memberships
  group by tenant_id, work_group_id
),
task_totals as (
  select
    tenant_id,
    work_group_id,
    count(*) filter (where status not in ('completed', 'cancelled'))::integer as active_task_count,
    count(*) filter (
      where status not in ('completed', 'cancelled')
        and planned_due_at is not null
        and planned_due_at < now()
    )::integer as overdue_task_count,
    count(*) filter (where status = 'completed')::integer as completed_task_count
  from public.tasks
  where work_group_id is not null
  group by tenant_id, work_group_id
)
select
  wg.tenant_id,
  wg.id as work_group_id,
  coalesce(mt.active_manager_count, 0) as active_manager_count,
  coalesce(mt.active_employee_count, 0) as active_employee_count,
  coalesce(tt.active_task_count, 0) as active_task_count,
  coalesce(tt.overdue_task_count, 0) as overdue_task_count,
  coalesce(tt.completed_task_count, 0) as completed_task_count
from public.work_groups wg
left join member_totals mt
  on mt.tenant_id = wg.tenant_id
 and mt.work_group_id = wg.id
left join task_totals tt
  on tt.tenant_id = wg.tenant_id
 and tt.work_group_id = wg.id;
