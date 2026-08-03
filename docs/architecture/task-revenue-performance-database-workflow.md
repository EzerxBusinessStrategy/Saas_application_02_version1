# Task, Revenue, Performance and Tenant-Health Database Workflow

Status: Implemented database slice
Date: 2026-07-29

This document records the database relationship implemented by migration
`0013_task_revenue_performance_health_workflow.sql`.

## Existing tables reused

- `tenants`
- `users`
- `tenant_memberships`
- `roles`
- `permissions`
- `membership_roles`
- `audit.audit_events`

## Source-of-truth tables

The workflow stores source facts in normalized tables only. It does not create
snapshot tables for tenant sales, tenant health, client revenue, employee
performance or employee recommendations.

New source tables include:

- `financial_year_templates`
- `tenant_financial_years`
- `tenant_health_bands`
- `departments`
- `clients`
- `client_contacts`
- `services`
- `engagements`
- `employees`
- `skills`
- `employee_skills`
- `work_groups`
- `work_group_memberships`
- `client_task_requests`
- `sla_policies`
- `compliance_calendar_rules`
- `rate_cards`
- `rate_card_items`
- `tasks`
- `task_skill_requirements`
- `task_assignments`
- `task_submissions`
- `approvals`
- `billable_task_entries`
- `task_employee_contributions`
- `invoices`
- `invoice_items`
- `payments`

## End-to-end relationship

```text
client_task_requests
-> tasks
-> work_groups
-> work_group_memberships
-> task_assignments
-> task_skill_requirements
-> employee_skills
-> task_submissions
-> approvals
-> billable_task_entries
-> invoice_items
-> invoices
-> payments
-> tenant_sales_summary_v
-> tenant_health_summary_v
-> employee_performance_summary_v
-> client_task_revenue_summary_v
```

The implemented connection supports this data path:

1. A client request is stored in `client_task_requests`.
2. The tenant converts it into a `tasks` row and keeps the request for history.
3. The task is mapped to a client, service, country, financial year, work group,
   SLA policy, compliance rule and rate-card item.
4. Required task skills are stored in `task_skill_requirements`.
5. Eligible employees are derived through `task_employee_eligibility_v`.
6. Assignment rows in `task_assignments` support one or many employees.
7. Employee completion is stored in `task_submissions`.
8. Manager and Tenant Admin decisions are stored in `approvals`.
9. Approved completed work becomes `billable_task_entries`.
10. Billable entries connect to `invoice_items`, `invoices` and `payments`.
11. Sales and collection figures are derived through `tenant_sales_summary_v`.
12. Tenant health is derived by joining sales to configurable
    `tenant_health_bands`.
13. Employee generated revenue is stored explicitly in
    `task_employee_contributions` and reported through
    `employee_performance_summary_v`.
14. Client task and revenue totals are derived through
    `client_task_revenue_summary_v`.

## Reporting views

- `task_employee_eligibility_v`
- `tenant_sales_summary_v`
- `tenant_health_summary_v`
- `employee_performance_summary_v`
- `client_task_revenue_summary_v`
- `task_group_workload_summary_v`

All reporting views use `security_invoker = true` so PostgreSQL RLS on the
underlying tables remains effective.

## Tenant health

Tenant health is data-driven. The database stores health ranges in
`tenant_health_bands`; the view does not hard-code turnover thresholds.

Turnover is:

```text
sum(invoices.total_amount)
where invoice status is not draft, cancelled or void
```

Collected amount is:

```text
sum(payments.amount)
where payment status is successful
```

Outstanding amount is:

```text
finalised invoice total - successful payments
```

## Employee performance formula

`employee_performance_summary_v.performance_score` uses an initial transparent
weighted score:

```text
completion_rate              * 30
+ on_time_completion_rate     * 20
+ sla_compliance_rate         * 20
+ non_return_rate             * 15
+ relative_revenue_score      * 15
```

The revenue component compares an employee's generated revenue with the highest
employee revenue in the same tenant and financial year. This keeps the formula
dynamic and avoids a hard-coded revenue target.

## Tenant isolation

Every new tenant-owned table contains `tenant_id`, has tenant-leading indexes,
uses composite tenant-safe foreign keys where the parent is tenant-owned, and
has `ENABLE ROW LEVEL SECURITY` plus `FORCE ROW LEVEL SECURITY`.

Runtime access uses transaction-local trusted context through the existing
`private.current_*` helpers. Browser-provided tenant, role, employee, client or
authority-bearing values remain lookup inputs only and are not trusted.
