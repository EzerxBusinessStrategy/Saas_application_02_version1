create table public.tenant_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  review_type text not null,
  status text not null default 'pending',
  due_date date,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_reviews_tenant_id_id_unique unique (tenant_id, id),
  constraint tenant_reviews_type_check check (review_type ~ '^[A-Z][A-Z0-9_]*$'),
  constraint tenant_reviews_status_check check (status in ('pending', 'in_progress', 'overdue', 'completed', 'cancelled'))
);

create index tenant_reviews_tenant_status_due_idx
  on public.tenant_reviews (tenant_id, status, due_date, id);

alter table public.tenant_reviews enable row level security;
alter table public.tenant_reviews force row level security;

create policy tenant_reviews_select
on public.tenant_reviews
for select
to app_runtime, app_readonly
using (private.is_platform_admin() or private.has_tenant_context(tenant_id));

create policy tenant_reviews_insert
on public.tenant_reviews
for insert
to app_runtime
with check (private.has_tenant_context(tenant_id));

create policy tenant_reviews_update
on public.tenant_reviews
for update
to app_runtime
using (private.has_tenant_context(tenant_id))
with check (private.has_tenant_context(tenant_id));

create policy tenant_reviews_delete
on public.tenant_reviews
for delete
to app_runtime
using (private.has_tenant_context(tenant_id));

grant select, insert, update, delete on public.tenant_reviews to app_runtime;
grant select on public.tenant_reviews to app_readonly;
