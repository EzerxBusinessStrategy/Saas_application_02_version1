create extension if not exists btree_gist;

create or replace function private.current_employee_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.employee_id', true), '')::uuid
$$;

create or replace function private.current_client_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.client_id', true), '')::uuid
$$;

create or replace function private.proficiency_rank(proficiency text)
returns integer
language sql
immutable
as $$
  select case lower(proficiency)
    when 'beginner' then 1
    when 'intermediate' then 2
    when 'advanced' then 3
    when 'expert' then 4
    else 0
  end
$$;

create table public.financial_year_templates (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  name text not null,
  start_month integer not null,
  start_day integer not null,
  end_month integer not null,
  end_day integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint financial_year_templates_country_check check (country_code ~ '^[A-Z]{2}$'),
  constraint financial_year_templates_start_month_check check (start_month between 1 and 12),
  constraint financial_year_templates_end_month_check check (end_month between 1 and 12),
  constraint financial_year_templates_start_day_check check (start_day between 1 and 31),
  constraint financial_year_templates_end_day_check check (end_day between 1 and 31)
);

alter table public.tenants
  add column financial_year_template_id uuid,
  add constraint tenants_financial_year_template_fk foreign key (financial_year_template_id)
    references public.financial_year_templates (id),
  add constraint tenants_country_iso_check check (country is null or country ~ '^[A-Z]{2}$'),
  add constraint tenants_currency_iso_check check (currency is null or currency ~ '^[A-Z]{3}$');

create table public.tenant_financial_years (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  template_id uuid references public.financial_year_templates (id) on delete set null,
  label text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_financial_years_tenant_id_id_unique unique (tenant_id, id),
  constraint tenant_financial_years_status_check check (status in ('planned', 'active', 'closed', 'locked', 'cancelled')),
  constraint tenant_financial_years_date_check check (start_date < end_date),
  constraint tenant_financial_years_no_overlap exclude using gist (
    tenant_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status <> 'cancelled')
);

create table public.tenant_health_bands (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  minimum_turnover numeric(18,2) not null,
  maximum_turnover numeric(18,2),
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_health_bands_code_unique unique (code),
  constraint tenant_health_bands_code_check check (code ~ '^[A-Z][A-Z0-9_]*$'),
  constraint tenant_health_bands_amount_check check (
    minimum_turnover >= 0
    and (maximum_turnover is null or maximum_turnover > minimum_turnover)
  ),
  constraint tenant_health_bands_sort_order_unique unique (sort_order)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  code text not null,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departments_tenant_id_id_unique unique (tenant_id, id),
  constraint departments_tenant_code_unique unique (tenant_id, code),
  constraint departments_code_normalized_check check (code = lower(code)),
  constraint departments_status_check check (status in ('active', 'inactive', 'archived'))
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  code text not null,
  legal_name text not null,
  display_name text not null,
  status text not null default 'active',
  delivery_health text,
  onboarding_status text not null default 'pending',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_tenant_id_id_unique unique (tenant_id, id),
  constraint clients_tenant_code_unique unique (tenant_id, code),
  constraint clients_code_normalized_check check (code = lower(code)),
  constraint clients_status_check check (status in ('prospect', 'active', 'paused', 'archived')),
  constraint clients_onboarding_status_check check (onboarding_status in ('pending', 'active', 'completed', 'blocked'))
);

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid not null,
  name text not null,
  role_title text,
  email text,
  phone text,
  preference text,
  status text not null default 'active',
  primary_contact boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_contacts_tenant_id_id_unique unique (tenant_id, id),
  constraint client_contacts_tenant_client_id_unique unique (tenant_id, client_id, id),
  constraint client_contacts_client_fk foreign key (tenant_id, client_id)
    references public.clients (tenant_id, id),
  constraint client_contacts_status_check check (status in ('active', 'inactive', 'archived'))
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  code text not null,
  name text not null,
  task_type text,
  default_billing_model text not null default 'per_task',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_tenant_id_id_unique unique (tenant_id, id),
  constraint services_tenant_code_unique unique (tenant_id, code),
  constraint services_code_normalized_check check (code = lower(code)),
  constraint services_status_check check (status in ('active', 'inactive', 'archived')),
  constraint services_default_billing_model_check check (default_billing_model in ('per_task', 'hourly', 'fixed', 'per_unit'))
);

create table public.engagements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid not null,
  service_id uuid not null,
  code text not null,
  name text not null,
  status text not null default 'active',
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint engagements_tenant_id_id_unique unique (tenant_id, id),
  constraint engagements_tenant_code_unique unique (tenant_id, code),
  constraint engagements_code_normalized_check check (code = lower(code)),
  constraint engagements_status_check check (status in ('draft', 'active', 'paused', 'completed', 'cancelled', 'archived')),
  constraint engagements_date_check check (end_date is null or start_date <= end_date),
  constraint engagements_client_fk foreign key (tenant_id, client_id)
    references public.clients (tenant_id, id),
  constraint engagements_service_fk foreign key (tenant_id, service_id)
    references public.services (tenant_id, id)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  membership_id uuid not null,
  employee_code text not null,
  department_id uuid,
  experience_level text,
  employment_status text not null default 'active',
  default_capacity_minutes_per_week integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_tenant_id_id_unique unique (tenant_id, id),
  constraint employees_tenant_code_unique unique (tenant_id, employee_code),
  constraint employees_tenant_membership_unique unique (tenant_id, membership_id),
  constraint employees_code_normalized_check check (employee_code = lower(employee_code)),
  constraint employees_capacity_check check (default_capacity_minutes_per_week is null or default_capacity_minutes_per_week >= 0),
  constraint employees_status_check check (employment_status in ('active', 'inactive', 'on_leave', 'revoked', 'archived')),
  constraint employees_membership_fk foreign key (tenant_id, membership_id)
    references public.tenant_memberships (tenant_id, id),
  constraint employees_department_fk foreign key (tenant_id, department_id)
    references public.departments (tenant_id, id)
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  code text not null,
  name text not null,
  category text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skills_tenant_id_id_unique unique (tenant_id, id),
  constraint skills_tenant_code_unique unique (tenant_id, code),
  constraint skills_code_normalized_check check (code = lower(code)),
  constraint skills_status_check check (status in ('active', 'inactive', 'archived'))
);

create table public.employee_skills (
  tenant_id uuid not null,
  employee_id uuid not null,
  skill_id uuid not null,
  proficiency_level text not null,
  years_of_experience numeric(5,2),
  is_verified boolean not null default false,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_skills_pkey primary key (employee_id, skill_id),
  constraint employee_skills_tenant_employee_skill_unique unique (tenant_id, employee_id, skill_id),
  constraint employee_skills_employee_fk foreign key (tenant_id, employee_id)
    references public.employees (tenant_id, id),
  constraint employee_skills_skill_fk foreign key (tenant_id, skill_id)
    references public.skills (tenant_id, id),
  constraint employee_skills_verified_by_fk foreign key (tenant_id, verified_by)
    references public.tenant_memberships (tenant_id, id),
  constraint employee_skills_proficiency_check check (proficiency_level in ('beginner', 'intermediate', 'advanced', 'expert')),
  constraint employee_skills_experience_check check (years_of_experience is null or years_of_experience >= 0),
  constraint employee_skills_verified_check check (
    (is_verified = false and verified_by is null and verified_at is null)
    or (is_verified = true and verified_by is not null and verified_at is not null)
  )
);

create table public.work_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  client_id uuid,
  engagement_id uuid,
  code text,
  name text not null,
  group_type text not null default 'delivery',
  status text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_groups_tenant_id_id_unique unique (tenant_id, id),
  constraint work_groups_tenant_code_unique unique (tenant_id, code),
  constraint work_groups_code_normalized_check check (code is null or code = lower(code)),
  constraint work_groups_status_check check (status in ('active', 'inactive', 'archived')),
  constraint work_groups_client_fk foreign key (tenant_id, client_id)
    references public.clients (tenant_id, id),
  constraint work_groups_engagement_fk foreign key (tenant_id, engagement_id)
    references public.engagements (tenant_id, id),
  constraint work_groups_created_by_fk foreign key (tenant_id, created_by)
    references public.tenant_memberships (tenant_id, id)
);

create table public.work_group_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  work_group_id uuid not null,
  employee_id uuid not null,
  group_role text not null,
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  added_by uuid,
  removed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_group_memberships_tenant_id_id_unique unique (tenant_id, id),
  constraint work_group_memberships_work_group_fk foreign key (tenant_id, work_group_id)
    references public.work_groups (tenant_id, id),
  constraint work_group_memberships_employee_fk foreign key (tenant_id, employee_id)
    references public.employees (tenant_id, id),
  constraint work_group_memberships_added_by_fk foreign key (tenant_id, added_by)
    references public.tenant_memberships (tenant_id, id),
  constraint work_group_memberships_removed_by_fk foreign key (tenant_id, removed_by)
    references public.tenant_memberships (tenant_id, id),
  constraint work_group_memberships_role_check check (group_role in ('manager', 'member')),
  constraint work_group_memberships_status_check check (status in ('active', 'removed')),
  constraint work_group_memberships_removed_check check (
    (status = 'removed' and removed_at is not null)
    or (status = 'active' and removed_at is null)
  )
);

create table public.client_task_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid not null,
  client_contact_id uuid,
  service_id uuid not null,
  title text not null,
  description text not null,
  country_code text not null,
  requested_due_date date,
  priority text not null default 'normal',
  status text not null default 'submitted',
  submitted_by_user_id uuid references public.users (id),
  reviewed_by_user_id uuid references public.users (id),
  reviewed_at timestamptz,
  converted_task_id uuid,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_task_requests_tenant_id_id_unique unique (tenant_id, id),
  constraint client_task_requests_country_check check (country_code ~ '^[A-Z]{2}$'),
  constraint client_task_requests_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint client_task_requests_status_check check (status in ('submitted', 'under_review', 'accepted', 'rejected', 'converted_to_task', 'cancelled')),
  constraint client_task_requests_review_check check (
    (reviewed_at is null and reviewed_by_user_id is null)
    or (reviewed_at is not null and reviewed_by_user_id is not null)
  ),
  constraint client_task_requests_client_fk foreign key (tenant_id, client_id)
    references public.clients (tenant_id, id),
  constraint client_task_requests_contact_fk foreign key (tenant_id, client_id, client_contact_id)
    references public.client_contacts (tenant_id, client_id, id),
  constraint client_task_requests_service_fk foreign key (tenant_id, service_id)
    references public.services (tenant_id, id)
);

create table public.sla_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid,
  service_id uuid,
  country_code text,
  priority text,
  name text not null,
  target_minutes integer not null,
  warning_minutes integer,
  effective_from date not null,
  effective_to date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sla_policies_tenant_id_id_unique unique (tenant_id, id),
  constraint sla_policies_country_check check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint sla_policies_priority_check check (priority is null or priority in ('low', 'normal', 'high', 'urgent')),
  constraint sla_policies_minutes_check check (
    target_minutes > 0
    and (warning_minutes is null or warning_minutes between 0 and target_minutes)
  ),
  constraint sla_policies_effective_check check (effective_to is null or effective_from <= effective_to),
  constraint sla_policies_status_check check (status in ('active', 'inactive', 'archived')),
  constraint sla_policies_client_fk foreign key (tenant_id, client_id)
    references public.clients (tenant_id, id),
  constraint sla_policies_service_fk foreign key (tenant_id, service_id)
    references public.services (tenant_id, id)
);

create table public.compliance_calendar_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  country_code text not null,
  service_id uuid,
  task_type text not null,
  name text not null,
  frequency text not null,
  due_rule jsonb not null,
  effective_from date not null,
  effective_to date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_calendar_rules_tenant_id_id_unique unique (tenant_id, id),
  constraint compliance_calendar_rules_country_check check (country_code ~ '^[A-Z]{2}$'),
  constraint compliance_calendar_rules_frequency_check check (frequency in ('monthly', 'quarterly', 'annually', 'one_time')),
  constraint compliance_calendar_rules_due_rule_check check (
    jsonb_typeof(due_rule) = 'object'
    and due_rule ? 'type'
    and due_rule->>'type' in ('fixed_day_of_month', 'fixed_month_day', 'days_after_period_end', 'quarterly_due_date')
  ),
  constraint compliance_calendar_rules_effective_check check (effective_to is null or effective_from <= effective_to),
  constraint compliance_calendar_rules_status_check check (status in ('active', 'inactive', 'archived')),
  constraint compliance_calendar_rules_service_fk foreign key (tenant_id, service_id)
    references public.services (tenant_id, id)
);

create table public.rate_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid,
  name text not null,
  country_code text,
  currency_code text not null,
  effective_from date not null,
  effective_to date,
  status text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rate_cards_tenant_id_id_unique unique (tenant_id, id),
  constraint rate_cards_country_check check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint rate_cards_currency_check check (currency_code ~ '^[A-Z]{3}$'),
  constraint rate_cards_effective_check check (effective_to is null or effective_from <= effective_to),
  constraint rate_cards_status_check check (status in ('active', 'inactive', 'archived')),
  constraint rate_cards_client_fk foreign key (tenant_id, client_id)
    references public.clients (tenant_id, id),
  constraint rate_cards_created_by_fk foreign key (tenant_id, created_by)
    references public.tenant_memberships (tenant_id, id)
);

create table public.rate_card_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  rate_card_id uuid not null,
  service_id uuid not null,
  task_type text not null,
  unit_type text not null,
  rate_amount numeric(18,2) not null,
  tax_code text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rate_card_items_tenant_id_id_unique unique (tenant_id, id),
  constraint rate_card_items_rate_amount_check check (rate_amount >= 0),
  constraint rate_card_items_unit_type_check check (unit_type in ('per_task', 'per_hour', 'per_filing', 'per_unit')),
  constraint rate_card_items_status_check check (status in ('active', 'inactive', 'archived')),
  constraint rate_card_items_rate_card_fk foreign key (tenant_id, rate_card_id)
    references public.rate_cards (tenant_id, id),
  constraint rate_card_items_service_fk foreign key (tenant_id, service_id)
    references public.services (tenant_id, id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_task_request_id uuid,
  client_id uuid not null,
  service_id uuid not null,
  engagement_id uuid,
  work_group_id uuid,
  country_code text not null,
  financial_year_id uuid not null,
  compliance_calendar_rule_id uuid,
  sla_policy_id uuid,
  rate_card_item_id uuid,
  title text not null,
  description text,
  priority text not null default 'normal',
  status text not null default 'draft',
  planned_start_at timestamptz,
  planned_due_at timestamptz,
  actual_started_at timestamptz,
  actual_completed_at timestamptz,
  sla_target_minutes integer,
  sla_elapsed_minutes integer,
  sla_status text not null default 'not_started',
  billable_status text not null default 'not_billable',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_tenant_id_id_unique unique (tenant_id, id),
  constraint tasks_country_check check (country_code ~ '^[A-Z]{2}$'),
  constraint tasks_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint tasks_status_check check (status in ('draft', 'requested', 'open', 'assigned', 'in_progress', 'submitted', 'manager_review', 'returned', 'tenant_approval', 'approved', 'completed', 'cancelled')),
  constraint tasks_sla_status_check check (sla_status in ('not_started', 'running', 'met', 'near_breach', 'breached', 'not_applicable')),
  constraint tasks_billable_status_check check (billable_status in ('not_billable', 'pending_completion', 'ready_for_billing', 'invoiced', 'cancelled')),
  constraint tasks_sla_minutes_check check (
    (sla_target_minutes is null or sla_target_minutes > 0)
    and (sla_elapsed_minutes is null or sla_elapsed_minutes >= 0)
  ),
  constraint tasks_actual_times_check check (
    actual_completed_at is null
    or actual_started_at is null
    or actual_started_at <= actual_completed_at
  ),
  constraint tasks_client_fk foreign key (tenant_id, client_id)
    references public.clients (tenant_id, id),
  constraint tasks_service_fk foreign key (tenant_id, service_id)
    references public.services (tenant_id, id),
  constraint tasks_engagement_fk foreign key (tenant_id, engagement_id)
    references public.engagements (tenant_id, id),
  constraint tasks_work_group_fk foreign key (tenant_id, work_group_id)
    references public.work_groups (tenant_id, id),
  constraint tasks_financial_year_fk foreign key (tenant_id, financial_year_id)
    references public.tenant_financial_years (tenant_id, id),
  constraint tasks_client_task_request_fk foreign key (tenant_id, client_task_request_id)
    references public.client_task_requests (tenant_id, id),
  constraint tasks_compliance_rule_fk foreign key (tenant_id, compliance_calendar_rule_id)
    references public.compliance_calendar_rules (tenant_id, id),
  constraint tasks_sla_policy_fk foreign key (tenant_id, sla_policy_id)
    references public.sla_policies (tenant_id, id),
  constraint tasks_rate_card_item_fk foreign key (tenant_id, rate_card_item_id)
    references public.rate_card_items (tenant_id, id),
  constraint tasks_created_by_fk foreign key (tenant_id, created_by)
    references public.tenant_memberships (tenant_id, id),
  constraint tasks_updated_by_fk foreign key (tenant_id, updated_by)
    references public.tenant_memberships (tenant_id, id)
);

alter table public.client_task_requests
  add constraint client_task_requests_converted_task_unique unique (tenant_id, converted_task_id),
  add constraint client_task_requests_converted_task_fk foreign key (tenant_id, converted_task_id)
    references public.tasks (tenant_id, id);

create table public.task_skill_requirements (
  tenant_id uuid not null,
  task_id uuid not null,
  skill_id uuid not null,
  minimum_proficiency text not null,
  is_mandatory boolean not null default true,
  created_at timestamptz not null default now(),
  constraint task_skill_requirements_pkey primary key (task_id, skill_id),
  constraint task_skill_requirements_tenant_task_skill_unique unique (tenant_id, task_id, skill_id),
  constraint task_skill_requirements_task_fk foreign key (tenant_id, task_id)
    references public.tasks (tenant_id, id),
  constraint task_skill_requirements_skill_fk foreign key (tenant_id, skill_id)
    references public.skills (tenant_id, id),
  constraint task_skill_requirements_proficiency_check check (minimum_proficiency in ('beginner', 'intermediate', 'advanced', 'expert'))
);

create table public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  task_id uuid not null,
  employee_id uuid not null,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  status text not null default 'active',
  removed_at timestamptz,
  removed_by uuid,
  assignment_source text not null default 'direct',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_assignments_tenant_id_id_unique unique (tenant_id, id),
  constraint task_assignments_tenant_task_employee_unique unique (tenant_id, task_id, employee_id),
  constraint task_assignments_task_fk foreign key (tenant_id, task_id)
    references public.tasks (tenant_id, id),
  constraint task_assignments_employee_fk foreign key (tenant_id, employee_id)
    references public.employees (tenant_id, id),
  constraint task_assignments_assigned_by_fk foreign key (tenant_id, assigned_by)
    references public.tenant_memberships (tenant_id, id),
  constraint task_assignments_removed_by_fk foreign key (tenant_id, removed_by)
    references public.tenant_memberships (tenant_id, id),
  constraint task_assignments_status_check check (status in ('active', 'submitted', 'completed', 'removed', 'cancelled')),
  constraint task_assignments_source_check check (assignment_source in ('direct', 'work_group', 'skill_suggestion')),
  constraint task_assignments_removed_check check (
    (status in ('removed', 'cancelled') and removed_at is not null)
    or (status not in ('removed', 'cancelled') and removed_at is null)
  )
);

create table public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  task_id uuid not null,
  employee_id uuid not null,
  submitted_by uuid,
  status text not null default 'submitted',
  remarks text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_submissions_tenant_id_id_unique unique (tenant_id, id),
  constraint task_submissions_task_fk foreign key (tenant_id, task_id)
    references public.tasks (tenant_id, id),
  constraint task_submissions_employee_fk foreign key (tenant_id, employee_id)
    references public.employees (tenant_id, id),
  constraint task_submissions_submitted_by_fk foreign key (tenant_id, submitted_by)
    references public.tenant_memberships (tenant_id, id),
  constraint task_submissions_assignment_fk foreign key (tenant_id, task_id, employee_id)
    references public.task_assignments (tenant_id, task_id, employee_id),
  constraint task_submissions_status_check check (status in ('submitted', 'returned', 'manager_approved', 'tenant_approved', 'cancelled'))
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  task_id uuid not null,
  submission_id uuid,
  approval_stage text not null,
  decision text not null,
  remarks text,
  decided_by uuid not null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint approvals_tenant_id_id_unique unique (tenant_id, id),
  constraint approvals_task_fk foreign key (tenant_id, task_id)
    references public.tasks (tenant_id, id),
  constraint approvals_submission_fk foreign key (tenant_id, submission_id)
    references public.task_submissions (tenant_id, id),
  constraint approvals_decided_by_fk foreign key (tenant_id, decided_by)
    references public.tenant_memberships (tenant_id, id),
  constraint approvals_stage_check check (approval_stage in ('manager_review', 'tenant_admin_approval')),
  constraint approvals_decision_check check (decision in ('approved', 'returned', 'rejected', 'cancelled'))
);

create table public.billable_task_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  task_id uuid not null,
  client_id uuid not null,
  rate_card_item_id uuid,
  currency_code text not null,
  quantity numeric(18,4) not null,
  unit_rate numeric(18,2) not null,
  gross_amount numeric(18,2) not null,
  discount_type text,
  discount_value numeric(18,2),
  discount_amount numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  net_amount numeric(18,2) not null,
  status text not null default 'pending_review',
  approved_by uuid,
  approved_at timestamptz,
  invoice_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billable_task_entries_tenant_id_id_unique unique (tenant_id, id),
  constraint billable_task_entries_currency_check check (currency_code ~ '^[A-Z]{3}$'),
  constraint billable_task_entries_status_check check (status in ('pending_review', 'approved_for_invoice', 'invoiced', 'cancelled')),
  constraint billable_task_entries_discount_type_check check (discount_type is null or discount_type in ('percentage', 'fixed_amount')),
  constraint billable_task_entries_amount_check check (
    quantity > 0
    and unit_rate >= 0
    and gross_amount = round(quantity * unit_rate, 2)
    and discount_amount >= 0
    and tax_amount >= 0
    and discount_amount <= gross_amount
    and net_amount = gross_amount - discount_amount + tax_amount
    and net_amount >= 0
    and (discount_value is null or discount_value >= 0)
  ),
  constraint billable_task_entries_approved_check check (
    (status in ('approved_for_invoice', 'invoiced') and approved_by is not null and approved_at is not null)
    or status in ('pending_review', 'cancelled')
  ),
  constraint billable_task_entries_task_fk foreign key (tenant_id, task_id)
    references public.tasks (tenant_id, id),
  constraint billable_task_entries_client_fk foreign key (tenant_id, client_id)
    references public.clients (tenant_id, id),
  constraint billable_task_entries_rate_card_item_fk foreign key (tenant_id, rate_card_item_id)
    references public.rate_card_items (tenant_id, id),
  constraint billable_task_entries_approved_by_fk foreign key (tenant_id, approved_by)
    references public.tenant_memberships (tenant_id, id)
);

create unique index billable_task_entries_active_task_uidx
  on public.billable_task_entries (tenant_id, task_id)
  where status <> 'cancelled';

create table public.task_employee_contributions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  task_id uuid not null,
  employee_id uuid not null,
  contribution_percentage numeric(5,2) not null,
  revenue_share_amount numeric(18,2) not null default 0,
  recorded_by uuid not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_employee_contributions_tenant_id_id_unique unique (tenant_id, id),
  constraint task_employee_contributions_task_employee_unique unique (tenant_id, task_id, employee_id),
  constraint task_employee_contributions_assignment_fk foreign key (tenant_id, task_id, employee_id)
    references public.task_assignments (tenant_id, task_id, employee_id),
  constraint task_employee_contributions_recorded_by_fk foreign key (tenant_id, recorded_by)
    references public.tenant_memberships (tenant_id, id),
  constraint task_employee_contributions_percent_check check (contribution_percentage between 0 and 100),
  constraint task_employee_contributions_revenue_check check (revenue_share_amount >= 0)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid not null,
  financial_year_id uuid,
  invoice_number text not null,
  issued_on date not null,
  due_on date,
  subtotal_amount numeric(18,2) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  total_amount numeric(18,2) not null default 0,
  currency_code text not null,
  finalized_at timestamptz,
  created_by uuid,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_tenant_id_id_unique unique (tenant_id, id),
  constraint invoices_tenant_invoice_number_unique unique (tenant_id, invoice_number),
  constraint invoices_amount_check check (
    subtotal_amount >= 0
    and discount_amount >= 0
    and tax_amount >= 0
    and discount_amount <= subtotal_amount
    and total_amount = subtotal_amount - discount_amount + tax_amount
    and total_amount >= 0
  ),
  constraint invoices_currency_check check (currency_code ~ '^[A-Z]{3}$'),
  constraint invoices_status_check check (status in ('draft', 'issued', 'finalized', 'partially_paid', 'paid', 'overdue', 'cancelled', 'void')),
  constraint invoices_finalized_check check (
    (status in ('draft', 'cancelled', 'void') and finalized_at is null)
    or (status not in ('draft', 'cancelled', 'void') and finalized_at is not null)
  ),
  constraint invoices_client_fk foreign key (tenant_id, client_id)
    references public.clients (tenant_id, id),
  constraint invoices_financial_year_fk foreign key (tenant_id, financial_year_id)
    references public.tenant_financial_years (tenant_id, id),
  constraint invoices_created_by_fk foreign key (tenant_id, created_by)
    references public.tenant_memberships (tenant_id, id)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  invoice_id uuid not null,
  task_id uuid,
  billable_task_entry_id uuid,
  service_id uuid,
  description text not null,
  quantity numeric(18,4) not null,
  unit_rate numeric(18,2) not null,
  gross_amount numeric(18,2) not null,
  discount_amount numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  net_amount numeric(18,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_items_tenant_id_id_unique unique (tenant_id, id),
  constraint invoice_items_invoice_fk foreign key (tenant_id, invoice_id)
    references public.invoices (tenant_id, id),
  constraint invoice_items_task_fk foreign key (tenant_id, task_id)
    references public.tasks (tenant_id, id),
  constraint invoice_items_billable_task_entry_fk foreign key (tenant_id, billable_task_entry_id)
    references public.billable_task_entries (tenant_id, id),
  constraint invoice_items_service_fk foreign key (tenant_id, service_id)
    references public.services (tenant_id, id),
  constraint invoice_items_amount_check check (
    quantity > 0
    and unit_rate >= 0
    and gross_amount = round(quantity * unit_rate, 2)
    and discount_amount >= 0
    and tax_amount >= 0
    and discount_amount <= gross_amount
    and net_amount = gross_amount - discount_amount + tax_amount
    and net_amount >= 0
  )
);

create unique index invoice_items_billable_task_entry_uidx
  on public.invoice_items (tenant_id, billable_task_entry_id)
  where billable_task_entry_id is not null;

alter table public.billable_task_entries
  add constraint billable_task_entries_invoice_item_fk foreign key (tenant_id, invoice_item_id)
    references public.invoice_items (tenant_id, id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  invoice_id uuid not null,
  client_id uuid not null,
  amount numeric(18,2) not null,
  currency_code text not null,
  method text,
  reference text,
  status text not null default 'pending',
  received_at timestamptz not null default now(),
  recorded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_tenant_id_id_unique unique (tenant_id, id),
  constraint payments_amount_check check (amount > 0),
  constraint payments_currency_check check (currency_code ~ '^[A-Z]{3}$'),
  constraint payments_status_check check (status in ('pending', 'successful', 'failed', 'refunded', 'cancelled')),
  constraint payments_invoice_fk foreign key (tenant_id, invoice_id)
    references public.invoices (tenant_id, id),
  constraint payments_client_fk foreign key (tenant_id, client_id)
    references public.clients (tenant_id, id),
  constraint payments_recorded_by_fk foreign key (tenant_id, recorded_by)
    references public.tenant_memberships (tenant_id, id)
);

create or replace function private.enforce_task_employee_contribution_total()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  total_percentage numeric(7,2);
begin
  select coalesce(sum(contribution_percentage), 0)
  into total_percentage
  from public.task_employee_contributions
  where tenant_id = new.tenant_id
    and task_id = new.task_id
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if total_percentage + new.contribution_percentage > 100 then
    raise exception 'Task contribution percentage cannot exceed 100.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger task_employee_contributions_total_check
before insert or update of contribution_percentage, task_id, employee_id, tenant_id
on public.task_employee_contributions
for each row
execute function private.enforce_task_employee_contribution_total();

create index financial_year_templates_country_active_idx
  on public.financial_year_templates (country_code, is_active, id);
create index tenant_financial_years_tenant_dates_idx
  on public.tenant_financial_years (tenant_id, start_date, end_date, id);
create index tenant_health_bands_active_sort_idx
  on public.tenant_health_bands (is_active, sort_order, id);
create index departments_tenant_status_idx
  on public.departments (tenant_id, status, id);
create index clients_tenant_status_name_idx
  on public.clients (tenant_id, status, display_name, id);
create index client_contacts_tenant_client_idx
  on public.client_contacts (tenant_id, client_id, status, id);
create unique index client_contacts_one_primary_idx
  on public.client_contacts (tenant_id, client_id)
  where primary_contact and status = 'active';
create index services_tenant_status_idx
  on public.services (tenant_id, status, id);
create index engagements_tenant_client_status_idx
  on public.engagements (tenant_id, client_id, status, id);
create index employees_tenant_department_status_idx
  on public.employees (tenant_id, department_id, employment_status, id);
create index employee_skills_tenant_skill_idx
  on public.employee_skills (tenant_id, skill_id, proficiency_level, employee_id);
create index skills_tenant_status_idx
  on public.skills (tenant_id, status, id);
create index work_groups_tenant_status_idx
  on public.work_groups (tenant_id, status, id);
create index work_groups_tenant_client_idx
  on public.work_groups (tenant_id, client_id, engagement_id, status, id);
create unique index work_group_memberships_active_employee_uidx
  on public.work_group_memberships (tenant_id, work_group_id, employee_id)
  where status = 'active';
create index work_group_memberships_tenant_employee_idx
  on public.work_group_memberships (tenant_id, employee_id, work_group_id, status);
create index client_task_requests_tenant_client_status_idx
  on public.client_task_requests (tenant_id, client_id, status, submitted_at, id);
create unique index client_task_requests_converted_task_uidx
  on public.client_task_requests (tenant_id, converted_task_id)
  where converted_task_id is not null;
create index sla_policies_tenant_lookup_idx
  on public.sla_policies (tenant_id, client_id, service_id, country_code, priority, status, effective_from);
create index compliance_calendar_rules_tenant_lookup_idx
  on public.compliance_calendar_rules (tenant_id, country_code, service_id, task_type, status, effective_from);
create index rate_cards_tenant_lookup_idx
  on public.rate_cards (tenant_id, client_id, country_code, status, effective_from);
create index rate_card_items_tenant_card_service_idx
  on public.rate_card_items (tenant_id, rate_card_id, service_id, task_type, status);
create index tasks_tenant_work_group_status_idx
  on public.tasks (tenant_id, work_group_id, status, id);
create index tasks_tenant_client_status_due_idx
  on public.tasks (tenant_id, client_id, status, planned_due_at, id);
create index tasks_tenant_financial_year_idx
  on public.tasks (tenant_id, financial_year_id, status, id);
create index tasks_tenant_sla_due_idx
  on public.tasks (tenant_id, sla_status, planned_due_at, actual_completed_at, id);
create index task_skill_requirements_tenant_skill_idx
  on public.task_skill_requirements (tenant_id, skill_id, minimum_proficiency, task_id);
create index task_assignments_tenant_employee_status_idx
  on public.task_assignments (tenant_id, employee_id, status, task_id);
create index task_assignments_tenant_task_status_idx
  on public.task_assignments (tenant_id, task_id, status, employee_id);
create index task_submissions_tenant_task_status_idx
  on public.task_submissions (tenant_id, task_id, status, submitted_at, id);
create index approvals_tenant_task_stage_idx
  on public.approvals (tenant_id, task_id, approval_stage, decided_at, id);
create index billable_task_entries_tenant_client_status_idx
  on public.billable_task_entries (tenant_id, client_id, status, id);
create index task_employee_contributions_tenant_employee_idx
  on public.task_employee_contributions (tenant_id, employee_id, task_id);
create index invoices_tenant_client_status_due_idx
  on public.invoices (tenant_id, client_id, status, due_on, id);
create index invoices_tenant_financial_year_idx
  on public.invoices (tenant_id, financial_year_id, status, issued_on, id);
create index invoice_items_tenant_invoice_idx
  on public.invoice_items (tenant_id, invoice_id, id);
create index invoice_items_tenant_task_idx
  on public.invoice_items (tenant_id, task_id, id);
create index payments_tenant_invoice_status_idx
  on public.payments (tenant_id, invoice_id, status, received_at, id);

create or replace view public.task_employee_eligibility_v
with (security_invoker = true)
as
with mandatory_requirements as (
  select tenant_id, task_id, count(*)::integer as mandatory_skill_count
  from public.task_skill_requirements
  where is_mandatory
  group by tenant_id, task_id
),
matched_requirements as (
  select
    tsr.tenant_id,
    tsr.task_id,
    es.employee_id,
    count(*)::integer as matched_mandatory_skill_count
  from public.task_skill_requirements tsr
  join public.employee_skills es
    on es.tenant_id = tsr.tenant_id
   and es.skill_id = tsr.skill_id
   and es.is_verified
   and private.proficiency_rank(es.proficiency_level) >= private.proficiency_rank(tsr.minimum_proficiency)
  where tsr.is_mandatory
  group by tsr.tenant_id, tsr.task_id, es.employee_id
),
active_assignments as (
  select tenant_id, employee_id, count(*)::integer as active_task_count
  from public.task_assignments
  where status = 'active'
  group by tenant_id, employee_id
)
select
  t.tenant_id,
  t.id as task_id,
  e.id as employee_id,
  coalesce(mr.mandatory_skill_count, 0) as mandatory_skill_count,
  coalesce(mm.matched_mandatory_skill_count, 0) as matched_mandatory_skill_count,
  coalesce(aa.active_task_count, 0) as active_task_count,
  (
    e.employment_status = 'active'
    and (t.work_group_id is null or exists (
      select 1
      from public.work_group_memberships wgm
      where wgm.tenant_id = t.tenant_id
        and wgm.work_group_id = t.work_group_id
        and wgm.employee_id = e.id
        and wgm.status = 'active'
    ))
    and coalesce(mr.mandatory_skill_count, 0) = coalesce(mm.matched_mandatory_skill_count, 0)
  ) as is_eligible
from public.tasks t
join public.employees e on e.tenant_id = t.tenant_id
left join mandatory_requirements mr on mr.tenant_id = t.tenant_id and mr.task_id = t.id
left join matched_requirements mm on mm.tenant_id = t.tenant_id and mm.task_id = t.id and mm.employee_id = e.id
left join active_assignments aa on aa.tenant_id = e.tenant_id and aa.employee_id = e.id;

create or replace view public.tenant_sales_summary_v
with (security_invoker = true)
as
with invoice_base as (
  select
    i.tenant_id,
    i.financial_year_id,
    i.id as invoice_id,
    i.total_amount,
    coalesce(sum(p.amount) filter (where p.status = 'successful'), 0)::numeric(18,2) as collected_amount
  from public.invoices i
  left join public.payments p
    on p.tenant_id = i.tenant_id
   and p.invoice_id = i.id
  where i.status not in ('draft', 'cancelled', 'void')
  group by i.tenant_id, i.financial_year_id, i.id, i.total_amount
)
select
  tfy.tenant_id,
  tfy.id as financial_year_id,
  tfy.start_date as period_start,
  tfy.end_date as period_end,
  coalesce(sum(ib.total_amount), 0)::numeric(18,2) as total_sales,
  coalesce(sum(ib.collected_amount), 0)::numeric(18,2) as total_collected,
  coalesce(sum(greatest(ib.total_amount - ib.collected_amount, 0)), 0)::numeric(18,2) as total_outstanding,
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
  hb.label as health_label
from public.tenants t
join public.tenant_sales_summary_v s on s.tenant_id = t.id
left join public.tenant_health_bands hb
  on hb.is_active
 and s.total_sales >= hb.minimum_turnover
 and (hb.maximum_turnover is null or s.total_sales < hb.maximum_turnover);

create or replace view public.employee_performance_summary_v
with (security_invoker = true)
as
with employee_base as (
  select
    e.tenant_id,
    e.id as employee_id,
    tfy.id as financial_year_id,
    tfy.start_date as period_start,
    tfy.end_date as period_end,
    count(ta.id)::numeric as assigned_count,
    count(t.id) filter (where t.status = 'completed')::numeric as completed_task_count,
    count(t.id) filter (
      where t.status = 'completed'
        and t.planned_due_at is not null
        and t.actual_completed_at <= t.planned_due_at
    )::numeric as on_time_task_count,
    count(distinct a.task_id) filter (where a.decision = 'returned')::numeric as returned_task_count,
    count(t.id) filter (where t.sla_status = 'met')::numeric as sla_met_count,
    count(t.id) filter (where t.sla_status = 'breached')::numeric as sla_breached_count,
    avg(t.sla_elapsed_minutes) filter (where t.sla_elapsed_minutes is not null)::numeric(18,2) as average_sla_minutes,
    coalesce(sum(tec.revenue_share_amount), 0)::numeric(18,2) as total_revenue_generated
  from public.employees e
  join public.tenant_financial_years tfy on tfy.tenant_id = e.tenant_id
  left join public.task_assignments ta
    on ta.tenant_id = e.tenant_id
   and ta.employee_id = e.id
  left join public.tasks t
    on t.tenant_id = ta.tenant_id
   and t.id = ta.task_id
   and t.financial_year_id = tfy.id
  left join public.approvals a
    on a.tenant_id = t.tenant_id
   and a.task_id = t.id
  left join public.task_employee_contributions tec
    on tec.tenant_id = e.tenant_id
   and tec.employee_id = e.id
   and tec.task_id = t.id
  group by e.tenant_id, e.id, tfy.id, tfy.start_date, tfy.end_date
),
scored as (
  select
    *,
    case when assigned_count = 0 then 0 else completed_task_count / assigned_count end as completion_rate,
    case when completed_task_count = 0 then 0 else on_time_task_count / completed_task_count end as on_time_rate,
    case when completed_task_count = 0 then 0 else sla_met_count / completed_task_count end as sla_compliance_rate,
    case when completed_task_count = 0 then 1 else greatest(0, 1 - (returned_task_count / completed_task_count)) end as non_return_rate,
    max(total_revenue_generated) over (partition by tenant_id, financial_year_id) as max_revenue_generated
  from employee_base
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
with invoice_totals as (
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
  count(t.id)::integer as total_tasks,
  count(t.id) filter (where t.status = 'completed')::integer as completed_tasks,
  count(t.id) filter (where t.status not in ('completed', 'cancelled'))::integer as pending_tasks,
  coalesce(sum(bte.net_amount) filter (where bte.status in ('approved_for_invoice', 'invoiced')), 0)::numeric(18,2) as total_billable_amount,
  coalesce(it.invoiced_amount, 0)::numeric(18,2) as invoiced_amount,
  coalesce(it.collected_amount, 0)::numeric(18,2) as collected_amount,
  greatest(coalesce(it.invoiced_amount, 0) - coalesce(it.collected_amount, 0), 0)::numeric(18,2) as outstanding_amount
from public.clients c
join public.tenant_financial_years tfy on tfy.tenant_id = c.tenant_id
left join public.tasks t
  on t.tenant_id = c.tenant_id
 and t.client_id = c.id
 and t.financial_year_id = tfy.id
left join public.billable_task_entries bte
  on bte.tenant_id = t.tenant_id
 and bte.task_id = t.id
left join invoice_totals it
  on it.tenant_id = c.tenant_id
 and it.client_id = c.id
 and it.financial_year_id = tfy.id
group by c.tenant_id, c.id, tfy.id, it.invoiced_amount, it.collected_amount;

create or replace view public.task_group_workload_summary_v
with (security_invoker = true)
as
select
  wg.tenant_id,
  wg.id as work_group_id,
  count(wgm.id) filter (where wgm.status = 'active' and wgm.group_role = 'manager')::integer as active_manager_count,
  count(wgm.id) filter (where wgm.status = 'active' and wgm.group_role = 'member')::integer as active_employee_count,
  count(t.id) filter (where t.status not in ('completed', 'cancelled'))::integer as active_task_count,
  count(t.id) filter (
    where t.status not in ('completed', 'cancelled')
      and t.planned_due_at is not null
      and t.planned_due_at < now()
  )::integer as overdue_task_count,
  count(t.id) filter (where t.status = 'completed')::integer as completed_task_count
from public.work_groups wg
left join public.work_group_memberships wgm
  on wgm.tenant_id = wg.tenant_id
 and wgm.work_group_id = wg.id
left join public.tasks t
  on t.tenant_id = wg.tenant_id
 and t.work_group_id = wg.id
group by wg.tenant_id, wg.id;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tenant_financial_years',
    'departments',
    'clients',
    'client_contacts',
    'services',
    'engagements',
    'employees',
    'skills',
    'employee_skills',
    'work_groups',
    'work_group_memberships',
    'client_task_requests',
    'sla_policies',
    'compliance_calendar_rules',
    'rate_cards',
    'rate_card_items',
    'tasks',
    'task_skill_requirements',
    'task_assignments',
    'task_submissions',
    'approvals',
    'billable_task_entries',
    'task_employee_contributions',
    'invoices',
    'invoice_items',
    'payments'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to app_runtime, app_readonly using (private.is_platform_admin() or private.has_tenant_context(tenant_id))',
      table_name || '_select',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to app_runtime with check (private.has_tenant_context(tenant_id))',
      table_name || '_insert',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to app_runtime using (private.has_tenant_context(tenant_id)) with check (private.has_tenant_context(tenant_id))',
      table_name || '_update',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to app_runtime using (private.has_tenant_context(tenant_id))',
      table_name || '_delete',
      table_name
    );
    execute format('grant select, insert, update, delete on public.%I to app_runtime', table_name);
    execute format('grant select on public.%I to app_readonly', table_name);
  end loop;
end
$$;

alter table public.financial_year_templates enable row level security;
alter table public.financial_year_templates force row level security;
create policy financial_year_templates_select
on public.financial_year_templates
for select
to app_runtime, app_readonly
using (true);
create policy financial_year_templates_insert_deny
on public.financial_year_templates
for insert
to app_runtime
with check (false);
create policy financial_year_templates_update_deny
on public.financial_year_templates
for update
to app_runtime
using (false)
with check (false);
create policy financial_year_templates_delete_deny
on public.financial_year_templates
for delete
to app_runtime
using (false);

alter table public.tenant_health_bands enable row level security;
alter table public.tenant_health_bands force row level security;
create policy tenant_health_bands_select
on public.tenant_health_bands
for select
to app_runtime, app_readonly
using (true);
create policy tenant_health_bands_insert_deny
on public.tenant_health_bands
for insert
to app_runtime
with check (false);
create policy tenant_health_bands_update_deny
on public.tenant_health_bands
for update
to app_runtime
using (false)
with check (false);
create policy tenant_health_bands_delete_deny
on public.tenant_health_bands
for delete
to app_runtime
using (false);

grant select on public.financial_year_templates to app_runtime, app_readonly;
grant select on public.tenant_health_bands to app_runtime, app_readonly;
grant select on
  public.task_employee_eligibility_v,
  public.tenant_sales_summary_v,
  public.tenant_health_summary_v,
  public.employee_performance_summary_v,
  public.client_task_revenue_summary_v,
  public.task_group_workload_summary_v
to app_runtime, app_readonly;

grant execute on function private.current_employee_id() to app_runtime, app_readonly;
grant execute on function private.current_client_id() to app_runtime, app_readonly;
grant execute on function private.proficiency_rank(text) to app_runtime, app_readonly;
revoke all on function private.enforce_task_employee_contribution_total() from public;

insert into private.schema_migrations (name)
select name
from (
  values
    ('0001_extensions_schemas_roles.sql'),
    ('0002_foundation_tables.sql'),
    ('0003_indexes_constraints.sql'),
    ('0004_trusted_context_helpers.sql'),
    ('0005_rls_policies.sql'),
    ('0006_grants.sql'),
    ('0007_seed_roles_permissions.sql'),
    ('0008_private_schema_migrations_rls.sql'),
    ('0009_auth_context_resolution.sql'),
    ('0010_invitation_membership_access_model.sql'),
    ('0011_platform_super_admin_bootstrap.sql'),
    ('0012_auth_context_subject_binding.sql')
) as existing(name)
on conflict (name) do nothing;
