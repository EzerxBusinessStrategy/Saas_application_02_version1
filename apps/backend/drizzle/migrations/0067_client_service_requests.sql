create table public.client_service_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid not null,
  kind text not null,
  title text not null,
  description text not null default '',
  country_code text not null,
  currency_code text not null,
  status text not null default 'submitted',
  snapshot jsonb not null,
  estimated_total numeric(18, 2) not null default 0,
  submitted_by_user_id uuid references public.users (id),
  reviewed_by_user_id uuid references public.users (id),
  reviewed_at timestamptz,
  review_remarks text,
  idempotency_key text not null,
  request_fingerprint text not null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_service_requests_tenant_id_id_unique unique (tenant_id, id),
  constraint client_service_requests_idempotency_unique unique (tenant_id, idempotency_key),
  constraint client_service_requests_kind_check check (kind in ('catalogue', 'custom')),
  constraint client_service_requests_status_check check (status in ('submitted', 'accepted', 'rejected', 'cancelled')),
  constraint client_service_requests_country_check check (country_code ~ '^[A-Z]{2}$'),
  constraint client_service_requests_currency_check check (currency_code ~ '^[A-Z]{3}$'),
  constraint client_service_requests_snapshot_check check (jsonb_typeof(snapshot) = 'object'),
  constraint client_service_requests_total_check check (estimated_total >= 0),
  constraint client_service_requests_review_check check (
    (reviewed_at is null and reviewed_by_user_id is null)
    or (reviewed_at is not null and reviewed_by_user_id is not null)
  ),
  constraint client_service_requests_client_fk
    foreign key (tenant_id, client_id)
    references public.clients (tenant_id, id)
);

create table public.client_service_request_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  request_id uuid not null,
  client_id uuid not null,
  service_id uuid not null,
  task_snapshot jsonb not null,
  assigned_employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_service_request_items_tenant_id_id_unique unique (tenant_id, id),
  constraint client_service_request_items_request_service_unique unique (tenant_id, request_id, service_id),
  constraint client_service_request_items_snapshot_check check (jsonb_typeof(task_snapshot) = 'object' or jsonb_typeof(task_snapshot) = 'array'),
  constraint client_service_request_items_request_fk
    foreign key (tenant_id, request_id)
    references public.client_service_requests (tenant_id, id)
    on delete cascade,
  constraint client_service_request_items_client_fk
    foreign key (tenant_id, client_id)
    references public.clients (tenant_id, id),
  constraint client_service_request_items_service_fk
    foreign key (tenant_id, service_id)
    references public.services (tenant_id, id),
  constraint client_service_request_items_employee_fk
    foreign key (tenant_id, assigned_employee_id)
    references public.employees (tenant_id, id)
);

create index client_service_requests_tenant_client_status_idx
  on public.client_service_requests (tenant_id, client_id, status, submitted_at desc, id);

create index client_service_requests_tenant_status_idx
  on public.client_service_requests (tenant_id, status, submitted_at desc, id);

create unique index client_service_requests_submitted_fingerprint_uidx
  on public.client_service_requests (tenant_id, client_id, request_fingerprint)
  where status = 'submitted';

create index client_service_request_items_tenant_request_idx
  on public.client_service_request_items (tenant_id, request_id, service_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'client_service_requests',
    'client_service_request_items'
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
