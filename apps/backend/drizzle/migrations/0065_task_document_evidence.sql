alter table public.tenant_documents
  add column if not exists task_id uuid;

alter table public.tenant_documents
  drop constraint if exists tenant_documents_task_fk;

alter table public.tenant_documents
  add constraint tenant_documents_task_fk
  foreign key (tenant_id, task_id)
  references public.tasks (tenant_id, id)
  not valid;

alter table public.tenant_documents
  validate constraint tenant_documents_task_fk;

create index if not exists tenant_documents_tenant_task_active_idx
  on public.tenant_documents (tenant_id, task_id, updated_at desc, id)
  where status = 'active' and task_id is not null;
