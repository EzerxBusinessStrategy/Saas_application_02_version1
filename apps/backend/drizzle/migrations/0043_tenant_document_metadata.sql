create table if not exists public.tenant_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid not null,
  title text not null,
  file_name text not null,
  file_type text not null,
  size_bytes integer not null default 0,
  category text not null default 'supporting',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_documents_tenant_id_id_unique unique (tenant_id, id),
  constraint tenant_documents_client_fk foreign key (tenant_id, client_id)
    references public.clients (tenant_id, id),
  constraint tenant_documents_created_by_fk foreign key (tenant_id, created_by)
    references public.tenant_memberships (tenant_id, id),
  constraint tenant_documents_status_check check (status in ('active', 'archived')),
  constraint tenant_documents_size_check check (size_bytes >= 0)
);

create index if not exists tenant_documents_tenant_client_status_idx
  on public.tenant_documents (tenant_id, client_id, status, updated_at desc, id);
