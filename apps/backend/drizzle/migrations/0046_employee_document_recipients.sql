alter table public.tenant_documents enable row level security;
alter table public.tenant_documents force row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tenant_documents' and policyname = 'tenant_documents_select'
  ) then
    create policy tenant_documents_select
    on public.tenant_documents
    for select
    to app_runtime, app_readonly
    using (private.is_platform_admin() or private.has_tenant_context(tenant_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tenant_documents' and policyname = 'tenant_documents_insert'
  ) then
    create policy tenant_documents_insert
    on public.tenant_documents
    for insert
    to app_runtime
    with check (private.has_tenant_context(tenant_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tenant_documents' and policyname = 'tenant_documents_update'
  ) then
    create policy tenant_documents_update
    on public.tenant_documents
    for update
    to app_runtime
    using (private.has_tenant_context(tenant_id))
    with check (private.has_tenant_context(tenant_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tenant_documents' and policyname = 'tenant_documents_delete_deny'
  ) then
    create policy tenant_documents_delete_deny
    on public.tenant_documents
    for delete
    to app_runtime
    using (false);
  end if;
end $$;

grant select, insert, update on public.tenant_documents to app_runtime;
grant select on public.tenant_documents to app_readonly;

create table public.tenant_document_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  document_id uuid not null,
  recipient_membership_id uuid not null,
  recipient_role text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint tenant_document_recipients_tenant_id_id_unique unique (tenant_id, id),
  constraint tenant_document_recipients_document_member_unique unique (tenant_id, document_id, recipient_membership_id),
  constraint tenant_document_recipients_document_fk foreign key (tenant_id, document_id)
    references public.tenant_documents (tenant_id, id),
  constraint tenant_document_recipients_member_fk foreign key (tenant_id, recipient_membership_id)
    references public.tenant_memberships (tenant_id, id),
  constraint tenant_document_recipients_created_by_fk foreign key (tenant_id, created_by)
    references public.tenant_memberships (tenant_id, id),
  constraint tenant_document_recipients_role_check check (recipient_role in ('TENANT_ADMIN', 'MANAGER', 'EMPLOYEE'))
);

create index tenant_document_recipients_member_idx
  on public.tenant_document_recipients (tenant_id, recipient_membership_id, created_at desc, document_id);

create index tenant_document_recipients_document_idx
  on public.tenant_document_recipients (tenant_id, document_id, recipient_role);

alter table public.tenant_document_recipients enable row level security;
alter table public.tenant_document_recipients force row level security;

create policy tenant_document_recipients_select
on public.tenant_document_recipients
for select
to app_runtime, app_readonly
using (private.is_platform_admin() or private.has_tenant_context(tenant_id));

create policy tenant_document_recipients_insert
on public.tenant_document_recipients
for insert
to app_runtime
with check (private.has_tenant_context(tenant_id));

create policy tenant_document_recipients_update_deny
on public.tenant_document_recipients
for update
to app_runtime
using (false)
with check (false);

create policy tenant_document_recipients_delete_deny
on public.tenant_document_recipients
for delete
to app_runtime
using (false);

grant select, insert on public.tenant_document_recipients to app_runtime;
grant select on public.tenant_document_recipients to app_readonly;
