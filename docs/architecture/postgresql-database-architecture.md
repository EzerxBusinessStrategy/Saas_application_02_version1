# PostgreSQL database architecture

Status: Proposed
Date: 2026-07-27

## Goal

Create one normalized PostgreSQL database for the SaaS App backend. The design
supports the current frontend portals without copying data between portals:

- Super Admin: tenants, plans, subscriptions, platform reports, audit, support access
- Tenant Admin: clients, engagements, work groups, employees, billing, documents, settings
- Manager: assigned clients, work groups, employees, tasks, reviews, approvals, reports
- Employee: assigned tasks, work logs, calendar, documents, notifications, profile
- Client User: own client account, services, progress, requests, invoices, documents, support

This is an architecture proposal, not a migration. Approve the related ADR
before creating database migrations or backend repository code.

## Design rules

- Use one PostgreSQL database and a modular-monolith backend.
- Keep source tables normalized. Do not store duplicated display names, counts,
  progress percentages, or dashboard totals as source-of-truth columns.
- Use views or materialized views for dashboard totals and reports.
- Every tenant-owned table has `tenant_id`.
- Tenant-owned relations use composite tenant-safe foreign keys, not only an
  application `tenant_id` filter.
- Enable `ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` on tenant-owned
  tables.
- Derive tenant, actor, role, manager scope, employee scope, and client scope
  from the authenticated server session. Never trust tenant IDs from browsers.
- Keep platform data separate from tenant-owned data.
- Use lower_snake_case table and column names.
- Use `uuid` primary keys, `text` for strings, `timestamptz` for time, and
  `numeric(12,2)` for money.
- Prefer `text` plus check constraints for statuses instead of PostgreSQL enum
  types so status changes are easier to migrate.

## Schemas

Use a small number of schemas:

| Schema | Purpose |
| --- | --- |
| `public` | Application tables and read views |
| `private` | RLS helper functions and internal security functions |
| `audit` | Append-only audit tables |

Do not create one schema per tenant. One database with tenant-safe keys and RLS
is simpler to operate and easier to query.

## Runtime context

The backend sets these transaction-local values after authenticating the user:

```sql
set local app.user_id = '<uuid>';
set local app.tenant_id = '<uuid>';
set local app.is_platform_admin = 'false';
```

Platform requests set `app.is_platform_admin = 'true'` and do not set a tenant
unless the platform user has an audited support session for that tenant.

Use separate database roles:

- `app_migrator`: owns migrations and can change schema.
- `app_runtime`: used by the backend for normal API requests.
- `app_readonly`: optional reporting role with controlled read access.

`app_runtime` must not own tables.

## Tenant-safe key pattern

Tenant-owned parent tables use a normal primary key plus a composite unique key:

```sql
create table clients (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  code text not null,
  legal_name text not null,
  display_name text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code)
);
```

Tenant-owned child tables include `tenant_id` and use composite foreign keys:

```sql
create table service_engagements (
  id uuid primary key,
  tenant_id uuid not null,
  client_id uuid not null,
  service_id uuid not null,
  name text not null,
  status text not null,
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, client_id) references clients(tenant_id, id),
  foreign key (tenant_id, service_id) references services(tenant_id, id)
);
```

This prevents a row from tenant A from pointing to a client, employee, task, or
document from tenant B.

## Core tables

Unless stated otherwise:

- Every table has `id uuid primary key`.
- Tenant-owned tables have `tenant_id uuid not null`, `created_at timestamptz`,
  `updated_at timestamptz`, and `unique (tenant_id, id)`.
- Actor-owned rows use `created_by_membership_id` or `updated_by_membership_id`
  when the action must be audited.
- Source tables store IDs, state, and facts only. List labels and dashboard
  metrics come from joins/views.

### Platform and tenancy

| Table | Purpose | Tenant-owned |
| --- | --- | --- |
| `tenants` | One row per tenant/customer organisation using the SaaS App | No |
| `tenant_domains` | Verified portal domains/subdomains | Yes |
| `tenant_branding` | Current branding and theme settings | Yes |
| `subscription_plans` | Platform-owned plan catalogue | No |
| `tenant_subscriptions` | Tenant plan, limits, billing cycle, status | Yes |
| `platform_configurations` | Controlled platform settings | No |
| `support_access_sessions` | Audited platform support access into a tenant | Yes |

`tenants` stores only tenant identity and lifecycle:

- `id`, `code`, `legal_name`, `display_name`, `status`
- `country`, `currency`, `timezone`
- `created_at`, `updated_at`, `suspended_at`

Plan limits belong in `subscription_plans` and `tenant_subscriptions`, not in
every tenant-owned feature table.

### Identity and authorization

| Table | Purpose | Tenant-owned |
| --- | --- | --- |
| `users` | Global human user profile | No |
| `auth_identities` | Login identity provider and password hash metadata | No |
| `tenant_memberships` | User's membership in a tenant | Yes |
| `roles` | Role catalogue, including platform and tenant roles | No |
| `permissions` | Permission catalogue matching backend actions | No |
| `role_permissions` | Normalized role-to-permission mapping | No |
| `membership_roles` | Roles assigned to a tenant membership | Yes |
| `invitations` | Tenant invitations and acceptance state | Yes |
| `sessions` | Optional durable session records or refresh tokens | No |

Keep `users` global so one email can belong to more than one tenant without
duplicating the person. Tenant-specific status, job profile, client link, and
role assignment belong to `tenant_memberships`.

Core constraints:

- `users.email` unique with a case-insensitive index.
- `tenant_memberships` unique on `(tenant_id, user_id)`.
- `membership_roles` unique on `(tenant_id, membership_id, role_id)`.
- `role_permissions` unique on `(role_id, permission_id)`.

### Organisation and workforce

| Table | Purpose | Tenant-owned |
| --- | --- | --- |
| `departments` | Tenant departments such as Taxation, Accounts, Compliance | Yes |
| `service_categories` | Tenant service/category catalogue | Yes |
| `skills` | Tenant skill catalogue | Yes |
| `employees` | Tenant employee profile linked to a membership | Yes |
| `employee_skills` | Employee-to-skill join table | Yes |
| `employee_categories` | Employee-to-category join table | Yes |
| `employee_capacity_periods` | Weekly/monthly capacity snapshots | Yes |
| `employee_availability_events` | Leave, holiday, unavailable periods | Yes |
| `manager_assignments` | Employee manager history | Yes |

`employees` stores the employee profile only:

- `tenant_id`, `membership_id`, `employee_code`
- `department_id`, `experience_level`, `employment_status`
- `default_capacity_minutes_per_week`

Do not store current manager name, skill names, category names, utilization, or
active-task counts in `employees`. Those come from joins or report views.

### Clients and contacts

| Table | Purpose | Tenant-owned |
| --- | --- | --- |
| `clients` | Tenant's client accounts | Yes |
| `client_contacts` | Client-side contacts | Yes |
| `client_user_accounts` | Links tenant memberships to a client account | Yes |
| `client_contact_preferences` | Optional normalized contact preferences | Yes |

`clients` stores:

- `tenant_id`, `code`, `legal_name`, `display_name`, `status`
- `delivery_health`, `onboarding_status`
- `created_at`, `archived_at`

Primary contact is a flag on `client_contacts`, constrained so each client has
at most one active primary contact.

### Services, engagements, and work groups

| Table | Purpose | Tenant-owned |
| --- | --- | --- |
| `services` | Tenant service catalogue such as Tax compliance or Payroll | Yes |
| `service_engagements` | Client-specific service contract/work stream | Yes |
| `engagement_milestones` | Normalized milestones for an engagement | Yes |
| `work_groups` | Delivery team for an engagement/client | Yes |
| `work_group_memberships` | Employees/managers assigned to a work group | Yes |
| `work_group_capacity_periods` | Optional capacity snapshots for planning | Yes |

`work_group_memberships` is the manager/employee scope source. Manager views and
task updates should resolve through this table.

### Tasks and delivery work

| Table | Purpose | Tenant-owned |
| --- | --- | --- |
| `tasks` | Work item tied to client, engagement, work group, manager, assignee | Yes |
| `task_checklist_items` | One checklist row per task item | Yes |
| `task_dependencies` | Task-to-task dependency join table | Yes |
| `task_comments` | Internal/client-visible comments | Yes |
| `task_attachments` | Links documents to tasks | Yes |
| `task_status_history` | Append-only task lifecycle history | Yes |
| `task_review_decisions` | Manager review decisions | Yes |
| `task_approval_decisions` | Tenant Admin approval decisions | Yes |
| `work_logs` | Employee time and work notes | Yes |
| `work_log_review_decisions` | Manager review of work logs | Yes |

`tasks` should contain IDs and current state:

- `tenant_id`, `client_id`, `engagement_id`, `work_group_id`
- `manager_employee_id`, `assignee_employee_id`
- `title`, `description`, `priority`, `complexity`, `status`, `sla_status`
- `due_at`, `blocked`, `created_by_membership_id`

Checklist, dependency, comments, attachments, review history, and approval
history are separate tables. That removes array columns and keeps task data in
third normal form.

### Billing and payments

| Table | Purpose | Tenant-owned |
| --- | --- | --- |
| `invoices` | Invoice header | Yes |
| `invoice_lines` | Normalized invoice line items | Yes |
| `invoice_documents` | File metadata link for invoice PDF | Yes |
| `payments` | Payment events against an invoice | Yes |
| `payment_allocations` | Allocation of payments to invoice balances | Yes |
| `agreements` | Client or engagement agreements | Yes |

Invoice outstanding amount is calculated:

```text
invoice total = sum(invoice_lines.quantity * invoice_lines.unit_amount)
paid total = sum(payment_allocations.amount)
outstanding = invoice total - paid total
```

Do not store `paid_amount` or `outstanding_amount` as source columns. Use a view
for invoice list screens.

### Documents and private files

| Table | Purpose | Tenant-owned |
| --- | --- | --- |
| `documents` | One metadata row per logical document | Yes |
| `document_versions` | One row per uploaded file version | Yes |
| `document_access_grants` | Explicit user/client/role visibility grants | Yes |
| `document_activity` | Append-only document activity | Yes |
| `storage_objects` | Private object-key metadata, not public URLs | Yes |

Store file bytes in private object storage, not PostgreSQL. PostgreSQL stores
metadata, object key, size, hash, MIME type, scan status, and access records.

Use one `documents` row and many `document_access_grants` rows instead of
copying the document into each portal.

### Support, requests, and notifications

| Table | Purpose | Tenant-owned |
| --- | --- | --- |
| `support_tickets` | Client/internal support ticket header | Yes |
| `support_ticket_activity` | Ticket comments, assignments, status changes | Yes |
| `support_ticket_attachments` | Links support tickets to documents | Yes |
| `client_requests` | Lightweight client service requests | Yes |
| `notifications` | Notification event sent to users/client users | Yes |
| `notification_receipts` | Per-recipient read/archive state | Yes |

Notifications are normalized as one event plus receipt rows. Do not copy the
same notification body into every user's row.

### Professional progress

| Table | Purpose | Tenant-owned |
| --- | --- | --- |
| `achievement_definitions` | Tenant/global achievement catalogue | Yes |
| `employee_achievements` | Earned/provisional achievement state | Yes |
| `employee_goals` | Goal assignments | Yes |
| `employee_goal_progress_events` | Progress events used to calculate state | Yes |
| `recognitions` | Manager/peer recognition records | Yes |
| `recognition_recipients` | Employee/work-group/team recipients | Yes |
| `gamification_policies` | Tenant policy settings | Yes |
| `user_preferences` | Per-membership notification/progress settings | Yes |

Keep progress event-based. Current summaries, streaks, and weekly comparisons
should be computed from work logs, task history, leave/holiday data, and progress
events.

### Audit and idempotency

| Table | Purpose | Tenant-owned |
| --- | --- | --- |
| `audit.audit_events` | Append-only audit log for sensitive actions | Mixed |
| `idempotency_keys` | Prevent duplicate mutation execution | Yes |
| `outbox_events` | Durable events for email, notifications, and async jobs | Yes |

`audit.audit_events` includes:

- `tenant_id` nullable for platform-only events
- `actor_user_id`, `actor_membership_id`, `support_access_session_id`
- `action`, `resource_type`, `resource_id`, `result`
- `reason`, `ip_address`, `user_agent`, `metadata`
- `created_at`

Audit rows are append-only. Do not update or delete them through the runtime
role.

## Normalized relationship map

```text
tenants
  -> tenant_memberships -> users
  -> departments -> employees -> employee_skills -> skills
  -> clients -> client_contacts
  -> clients -> service_engagements -> engagement_milestones
  -> service_engagements -> work_groups -> work_group_memberships -> employees
  -> work_groups -> tasks -> task_checklist_items
  -> tasks -> work_logs -> work_log_review_decisions
  -> tasks -> task_review_decisions -> task_approval_decisions
  -> clients -> invoices -> invoice_lines
  -> invoices -> payment_allocations <- payments
  -> clients -> documents -> document_versions -> storage_objects
  -> documents -> document_access_grants
  -> clients -> support_tickets -> support_ticket_activity
  -> notifications -> notification_receipts
  -> audit.audit_events
```

## Compact table catalogue

This catalogue names the business columns. Standard `id`, `tenant_id`,
`created_at`, and `updated_at` columns are implied by the rules above.

### Platform

| Table | Main columns |
| --- | --- |
| `tenants` | `code`, `legal_name`, `display_name`, `status`, `country`, `currency`, `timezone`, `suspended_at` |
| `tenant_domains` | `domain`, `status`, `verified_at`, `is_primary` |
| `tenant_branding` | `company_name`, `primary_colour`, `sidebar_colour`, `surface_colour`, `default_theme`, `density`, `heading_font`, `portal_subtitle`, `allow_user_theme_override`, `published_at` |
| `subscription_plans` | `code`, `name`, `status`, `base_price`, `currency`, `billing_interval`, `user_limit`, `module_limit`, `features` |
| `tenant_subscriptions` | `plan_id`, `status`, `billing_cycle`, `starts_on`, `renews_on`, `cancelled_at`, `user_limit`, `module_codes` |
| `platform_configurations` | `key`, `value`, `updated_by_user_id` |
| `support_access_sessions` | `tenant_id`, `platform_user_id`, `reason`, `status`, `starts_at`, `expires_at`, `ended_at` |

### Identity and RBAC

| Table | Main columns |
| --- | --- |
| `users` | `email`, `display_name`, `phone`, `status`, `last_login_at` |
| `auth_identities` | `user_id`, `provider`, `provider_subject`, `password_hash`, `password_changed_at`, `mfa_enabled`, `locked_until` |
| `tenant_memberships` | `tenant_id`, `user_id`, `status`, `display_name`, `timezone`, `joined_at`, `last_active_at` |
| `roles` | `code`, `name`, `scope`, `system_role` |
| `permissions` | `code`, `description`, `resource`, `action` |
| `role_permissions` | `role_id`, `permission_id` |
| `membership_roles` | `tenant_id`, `membership_id`, `role_id`, `assigned_by_membership_id`, `assigned_at` |
| `invitations` | `tenant_id`, `email`, `role_id`, `token_hash`, `status`, `expires_at`, `accepted_at` |
| `sessions` | `user_id`, `refresh_token_hash`, `ip_address`, `user_agent`, `expires_at`, `revoked_at` |

### Organisation and workforce

| Table | Main columns |
| --- | --- |
| `departments` | `code`, `name`, `status` |
| `service_categories` | `code`, `name`, `status` |
| `skills` | `code`, `name`, `status` |
| `employees` | `membership_id`, `employee_code`, `department_id`, `experience_level`, `employment_status`, `availability`, `default_capacity_minutes_per_week` |
| `employee_skills` | `employee_id`, `skill_id`, `level` |
| `employee_categories` | `employee_id`, `category_id` |
| `employee_capacity_periods` | `employee_id`, `period_start`, `period_end`, `capacity_minutes`, `allocated_minutes` |
| `employee_availability_events` | `employee_id`, `event_type`, `starts_at`, `ends_at`, `status`, `reason` |
| `manager_assignments` | `employee_id`, `manager_employee_id`, `starts_on`, `ends_on` |

### Clients and delivery structure

| Table | Main columns |
| --- | --- |
| `clients` | `code`, `legal_name`, `display_name`, `status`, `delivery_health`, `onboarding_status`, `archived_at` |
| `client_contacts` | `client_id`, `name`, `role_title`, `email`, `phone`, `preference`, `status`, `primary_contact`, `notes` |
| `client_user_accounts` | `client_id`, `membership_id`, `status` |
| `services` | `category_id`, `code`, `name`, `status`, `default_billing_model` |
| `service_engagements` | `client_id`, `service_id`, `code`, `name`, `billing_model`, `priority`, `complexity`, `sla_status`, `status`, `start_date`, `end_date` |
| `engagement_milestones` | `engagement_id`, `label`, `due_date`, `status`, `client_visible` |
| `work_groups` | `client_id`, `engagement_id`, `code`, `name`, `manager_employee_id`, `status`, `sla_status` |
| `work_group_memberships` | `work_group_id`, `employee_id`, `role`, `starts_on`, `ends_on` |
| `work_group_capacity_periods` | `work_group_id`, `period_start`, `period_end`, `capacity_minutes`, `allocated_minutes` |

### Tasks and work logs

| Table | Main columns |
| --- | --- |
| `tasks` | `client_id`, `engagement_id`, `work_group_id`, `manager_employee_id`, `assignee_employee_id`, `title`, `description`, `priority`, `complexity`, `status`, `sla_status`, `due_at`, `blocked` |
| `task_checklist_items` | `task_id`, `position`, `label`, `complete`, `completed_by_membership_id`, `completed_at` |
| `task_dependencies` | `task_id`, `depends_on_task_id` |
| `task_comments` | `task_id`, `author_membership_id`, `body`, `client_visible` |
| `task_attachments` | `task_id`, `document_id` |
| `task_status_history` | `task_id`, `from_status`, `to_status`, `changed_by_membership_id`, `changed_at`, `reason` |
| `task_review_decisions` | `task_id`, `reviewer_membership_id`, `decision`, `comment`, `decided_at` |
| `task_approval_decisions` | `task_id`, `approver_membership_id`, `decision`, `comment`, `decided_at` |
| `work_logs` | `task_id`, `employee_id`, `work_date`, `duration_minutes`, `description`, `status`, `submitted_at` |
| `work_log_review_decisions` | `work_log_id`, `reviewer_membership_id`, `decision`, `comment`, `decided_at` |

### Billing and documents

| Table | Main columns |
| --- | --- |
| `invoices` | `client_id`, `engagement_id`, `invoice_number`, `issued_on`, `due_on`, `currency`, `status`, `visibility` |
| `invoice_lines` | `invoice_id`, `description`, `quantity`, `unit_amount`, `tax_amount`, `position` |
| `payments` | `client_id`, `received_on`, `method`, `amount`, `currency`, `status`, `reference` |
| `payment_allocations` | `payment_id`, `invoice_id`, `amount` |
| `agreements` | `client_id`, `engagement_id`, `document_id`, `status`, `signed_on`, `expires_on` |
| `documents` | `client_id`, `engagement_id`, `task_id`, `title`, `category`, `status`, `visibility`, `current_version_id` |
| `document_versions` | `document_id`, `storage_object_id`, `version_number`, `file_name`, `file_type`, `size_bytes`, `sha256_hash`, `uploaded_by_membership_id`, `scan_status` |
| `document_access_grants` | `document_id`, `grantee_type`, `grantee_id`, `access_level`, `granted_by_membership_id`, `expires_at` |
| `document_activity` | `document_id`, `actor_membership_id`, `action`, `metadata`, `created_at` |
| `storage_objects` | `bucket`, `object_key`, `mime_type`, `size_bytes`, `sha256_hash`, `status` |

### Support, notifications, and progress

| Table | Main columns |
| --- | --- |
| `support_tickets` | `client_id`, `manager_employee_id`, `assignee_employee_id`, `service_id`, `category`, `subject`, `description`, `business_impact`, `affected_users`, `affected_url`, `preferred_contact_method`, `notify_by_email`, `notify_in_app`, `expected_first_response_at`, `status`, `requester_membership_id`, `resolution` |
| `support_ticket_activity` | `support_ticket_id`, `actor_membership_id`, `message`, `activity_type`, `client_visible` |
| `support_ticket_attachments` | `support_ticket_id`, `document_id` |
| `client_requests` | `client_id`, `service_id`, `title`, `description`, `status`, `owner_membership_id` |
| `notifications` | `tenant_id`, `event_type`, `title`, `body`, `resource_type`, `resource_id`, `created_by_membership_id` |
| `notification_receipts` | `notification_id`, `recipient_membership_id`, `read_at`, `archived_at` |
| `achievement_definitions` | `code`, `title`, `description`, `category`, `requirement`, `default_visibility`, `status` |
| `employee_achievements` | `employee_id`, `achievement_definition_id`, `status`, `earned_at`, `visibility` |
| `employee_goals` | `employee_id`, `label`, `target_value`, `unit`, `starts_on`, `ends_on`, `status` |
| `employee_goal_progress_events` | `employee_goal_id`, `source_type`, `source_id`, `value`, `occurred_at` |
| `recognitions` | `from_membership_id`, `category`, `message`, `related_resource_type`, `related_resource_id`, `visibility`, `private_note` |
| `recognition_recipients` | `recognition_id`, `recipient_type`, `employee_id`, `work_group_id` |
| `gamification_policies` | `enabled`, `achievements`, `consistency`, `manager_recognition`, `team_feed`, `tenant_feed`, `client_onboarding`, `service_milestones`, `celebration_animation`, `default_visibility`, `timezone`, `working_days`, `leave_integration` |
| `user_preferences` | `membership_id`, `preference_key`, `preference_value` |

### Audit and reliability

| Table | Main columns |
| --- | --- |
| `audit.audit_events` | `tenant_id`, `actor_user_id`, `actor_membership_id`, `support_access_session_id`, `action`, `resource_type`, `resource_id`, `result`, `reason`, `ip_address`, `user_agent`, `metadata`, `created_at` |
| `idempotency_keys` | `tenant_id`, `actor_membership_id`, `idempotency_key`, `request_hash`, `resource_type`, `resource_id`, `status`, `expires_at` |
| `outbox_events` | `tenant_id`, `event_type`, `payload`, `status`, `available_at`, `processed_at`, `attempt_count` |

## Important constraints

Use check constraints for status values:

```sql
alter table tasks add constraint tasks_status_check
check (status in ('to-do', 'in-progress', 'review', 'rejected', 'done'));
```

Use tenant-scoped unique constraints:

```sql
unique (tenant_id, employee_code)
unique (tenant_id, client_id, invoice_number)
unique (tenant_id, work_group_id, employee_id)
unique (tenant_id, document_id, grantee_type, grantee_id)
```

Use foreign keys for every normalized relationship, with tenant-safe composite
keys for tenant-owned relationships:

```sql
foreign key (tenant_id, work_group_id) references work_groups(tenant_id, id)
foreign key (tenant_id, assignee_employee_id) references employees(tenant_id, id)
foreign key (tenant_id, task_id) references tasks(tenant_id, id)
```

Use partial unique indexes where needed:

```sql
create unique index client_contacts_one_primary_idx
on client_contacts (tenant_id, client_id)
where primary_contact and status = 'active';
```

## Index strategy

Keep indexes boring and query-led.

Required index pattern:

- Every foreign key column or composite foreign key gets a matching index.
- Tenant-owned list pages start indexes with `tenant_id`.
- Equality columns come before range/sort columns.
- Cursor pagination uses `(created_at, id)` or a feature-specific stable sort.

Core indexes:

```sql
create index clients_tenant_status_name_idx
on clients (tenant_id, status, display_name, id);

create index employees_tenant_department_status_idx
on employees (tenant_id, department_id, employment_status, id);

create index service_engagements_tenant_client_status_idx
on service_engagements (tenant_id, client_id, status, id);

create index work_group_memberships_tenant_employee_idx
on work_group_memberships (tenant_id, employee_id, work_group_id);

create index tasks_tenant_assignee_status_due_idx
on tasks (tenant_id, assignee_employee_id, status, due_at, id);

create index tasks_tenant_manager_status_due_idx
on tasks (tenant_id, manager_employee_id, status, due_at, id);

create index tasks_tenant_work_group_status_idx
on tasks (tenant_id, work_group_id, status, id);

create index work_logs_tenant_employee_date_idx
on work_logs (tenant_id, employee_id, work_date, id);

create index invoices_tenant_client_status_due_idx
on invoices (tenant_id, client_id, status, due_on, id);

create index documents_tenant_client_category_idx
on documents (tenant_id, client_id, category, status, updated_at desc, id);

create index support_tickets_tenant_client_status_idx
on support_tickets (tenant_id, client_id, status, updated_at desc, id);

create index audit_events_tenant_created_idx
on audit.audit_events (tenant_id, created_at desc, id);
```

Use trigram indexes later only if normal search is too slow. Do not add search
infrastructure before measuring.

## RLS pattern

Enable and force RLS for tenant-owned tables:

```sql
alter table tasks enable row level security;
alter table tasks force row level security;
```

Base tenant policy:

```sql
create policy tenant_isolation_tasks on tasks
for all to app_runtime
using (
  tenant_id = current_setting('app.tenant_id', true)::uuid
)
with check (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);
```

Manager task scope adds assigned work-group access:

```sql
exists (
  select 1
  from work_group_memberships wgm
  join employees e
    on e.tenant_id = wgm.tenant_id
   and e.id = wgm.employee_id
  where wgm.tenant_id = tasks.tenant_id
    and wgm.work_group_id = tasks.work_group_id
    and e.membership_id = current_setting('app.membership_id', true)::uuid
    and wgm.role = 'manager'
)
```

Employee task scope:

```sql
exists (
  select 1
  from employees e
  where e.tenant_id = tasks.tenant_id
    and e.id = tasks.assignee_employee_id
    and e.membership_id = current_setting('app.membership_id', true)::uuid
)
```

Client scope:

```sql
exists (
  select 1
  from client_user_accounts cua
  where cua.tenant_id = tasks.tenant_id
    and cua.client_id = tasks.client_id
    and cua.membership_id = current_setting('app.membership_id', true)::uuid
)
```

Keep complex checks in `private` helper functions if the policy becomes hard to
read. Index every column referenced by RLS policies.

## Reporting architecture

Do not store dashboard metrics in source tables. Use views first:

- `tenant_client_summary_v`
- `tenant_task_summary_v`
- `manager_workload_summary_v`
- `employee_day_summary_v`
- `client_portal_summary_v`
- `invoice_balance_v`

Use materialized views only for slow reports after measuring with
`EXPLAIN ANALYZE`.

## Migration order

1. Extensions and schemas: `pgcrypto`, `public`, `private`, `audit`.
2. Platform tables: tenants, plans, subscriptions.
3. Identity/RBAC tables: users, memberships, roles, permissions.
4. Organisation and workforce.
5. Clients, contacts, services, engagements, work groups.
6. Tasks, work logs, reviews, approvals.
7. Billing, documents, support, notifications.
8. Audit, idempotency, outbox.
9. RLS policies and runtime grants.
10. Views for list pages and dashboards.
11. Tenant A/B isolation tests.

Use backward-compatible migrations:

- Add nullable columns first, backfill, then add `not null`.
- Add constraints after data is valid.
- Keep transactions short.
- Never run external calls inside a database transaction.

## Tenant isolation tests

Minimum test set before production:

- Tenant A cannot read Tenant B clients, employees, tasks, invoices, documents,
  support tickets, notifications, or audit rows.
- A child row cannot reference a parent row from a different tenant.
- Manager can access only tasks in assigned work groups.
- Employee can access only self-owned or assigned task/work-log records.
- Client user can access only their own client account, visible documents,
  invoices, requests, and tickets.
- Platform support access requires an active support session and writes audit.
- Runtime role cannot bypass RLS or write audit rows directly.

## What this deliberately does not include

- One schema per tenant.
- Microservices.
- Redis queues.
- Dedicated analytics warehouse.
- pgvector, embeddings, or AI search.
- JSONB source-of-truth blobs for core business data.
- Duplicated portal-specific copies of clients, tasks, invoices, or documents.

Those can be added later only after a measured product or scale need.
