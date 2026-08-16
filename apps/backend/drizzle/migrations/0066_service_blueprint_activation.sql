create table public.employee_service_capabilities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  employee_id uuid not null,
  service_id uuid not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_service_capabilities_tenant_id_id_unique unique (tenant_id, id),
  constraint employee_service_capabilities_unique unique (tenant_id, employee_id, service_id),
  constraint employee_service_capabilities_status_check check (status in ('active', 'inactive')),
  constraint employee_service_capabilities_employee_fk
    foreign key (tenant_id, employee_id)
    references public.employees (tenant_id, id),
  constraint employee_service_capabilities_service_fk
    foreign key (tenant_id, service_id)
    references public.services (tenant_id, id)
);

create table public.engagement_service_configurations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  engagement_id uuid not null,
  service_id uuid not null,
  assigned_employee_id uuid not null,
  country_code text not null,
  configuration_snapshot jsonb not null,
  estimated_total numeric(18, 2) not null default 0,
  currency_code text not null,
  status text not null default 'active',
  activated_at timestamptz not null default now(),
  idempotency_key text not null,
  request_fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint engagement_service_configurations_tenant_id_id_unique unique (tenant_id, id),
  constraint engagement_service_configurations_engagement_unique unique (tenant_id, engagement_id),
  constraint engagement_service_configurations_idempotency_unique unique (tenant_id, idempotency_key, service_id),
  constraint engagement_service_configurations_country_check check (country_code ~ '^[A-Z]{2}$'),
  constraint engagement_service_configurations_currency_check check (currency_code ~ '^[A-Z]{3}$'),
  constraint engagement_service_configurations_status_check check (status in ('draft', 'active', 'cancelled')),
  constraint engagement_service_configurations_snapshot_check check (jsonb_typeof(configuration_snapshot) = 'object'),
  constraint engagement_service_configurations_total_check check (estimated_total >= 0),
  constraint engagement_service_configurations_engagement_fk
    foreign key (tenant_id, engagement_id)
    references public.engagements (tenant_id, id),
  constraint engagement_service_configurations_service_fk
    foreign key (tenant_id, service_id)
    references public.services (tenant_id, id),
  constraint engagement_service_configurations_employee_fk
    foreign key (tenant_id, assigned_employee_id)
    references public.employees (tenant_id, id)
);

create index employee_service_capabilities_tenant_employee_idx
  on public.employee_service_capabilities (tenant_id, employee_id, status);

create index employee_service_capabilities_tenant_service_idx
  on public.employee_service_capabilities (tenant_id, service_id, status);

create index engagement_service_configurations_tenant_service_idx
  on public.engagement_service_configurations (tenant_id, service_id, status, id);

create unique index engagements_tenant_client_service_active_uidx
  on public.engagements (tenant_id, client_id, service_id)
  where status in ('draft', 'active');

create unique index tasks_generated_rule_occurrence_uidx
  on public.tasks (tenant_id, engagement_id, compliance_calendar_rule_id, planned_due_at)
  where engagement_id is not null
    and compliance_calendar_rule_id is not null
    and planned_due_at is not null
    and status <> 'cancelled';

create unique index tasks_generated_custom_occurrence_uidx
  on public.tasks (tenant_id, engagement_id, title, planned_due_at)
  where engagement_id is not null
    and compliance_calendar_rule_id is null
    and planned_due_at is not null
    and status <> 'cancelled';

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'employee_service_capabilities',
    'engagement_service_configurations'
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
