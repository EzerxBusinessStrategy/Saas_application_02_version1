create table public.client_service_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid not null,
  service_id uuid not null,
  body text not null,
  created_by_user_id uuid not null references public.users (id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint client_service_comments_tenant_id_id_unique unique (tenant_id, id),
  constraint client_service_comments_idempotency_unique unique (tenant_id, idempotency_key),
  constraint client_service_comments_body_check check (char_length(trim(body)) >= 2 and char_length(body) <= 2000),
  constraint client_service_comments_client_fk
    foreign key (tenant_id, client_id)
    references public.clients (tenant_id, id),
  constraint client_service_comments_service_fk
    foreign key (tenant_id, service_id)
    references public.services (tenant_id, id)
);

create index client_service_comments_tenant_client_service_idx
  on public.client_service_comments (tenant_id, client_id, service_id, created_at desc, id);

alter table public.client_service_comments enable row level security;
alter table public.client_service_comments force row level security;

create policy client_service_comments_select
on public.client_service_comments
for select
to app_runtime, app_readonly
using (private.is_platform_admin() or private.has_tenant_context(tenant_id));

create policy client_service_comments_insert
on public.client_service_comments
for insert
to app_runtime
with check (private.has_tenant_context(tenant_id));

create policy client_service_comments_update
on public.client_service_comments
for update
to app_runtime
using (false);

create policy client_service_comments_delete
on public.client_service_comments
for delete
to app_runtime
using (false);

grant select, insert on public.client_service_comments to app_runtime;
grant select on public.client_service_comments to app_readonly;
