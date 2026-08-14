do $$
declare
  bucket_id text;
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise exception 'Supabase storage schema is required before portal document buckets can be created.';
  end if;

  foreach bucket_id in array array[
    'super-admin-documents',
    'tenant-documents',
    'manager-documents',
    'employee-documents',
    'client-documents'
  ]
  loop
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      bucket_id,
      bucket_id,
      false,
      20971520,
      array[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'text/plain',
        'image/png',
        'image/jpeg',
        'image/webp',
        'application/zip',
        'application/x-zip-compressed'
      ]
    )
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end loop;
end;
$$;

alter table public.tenant_documents
  add column if not exists idempotency_key uuid;

alter table public.invoices
  add column if not exists idempotency_key uuid;

create unique index if not exists tenant_documents_idempotency_unique
  on public.tenant_documents (tenant_id, created_by, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists invoices_idempotency_unique
  on public.invoices (tenant_id, created_by, idempotency_key)
  where idempotency_key is not null;

alter table public.tenant_documents
  drop constraint if exists tenant_documents_storage_bucket_check;

alter table public.tenant_documents
  add constraint tenant_documents_storage_bucket_check
  check (
    storage_bucket is null
    or storage_bucket in (
      'super-admin-documents',
      'tenant-documents',
      'manager-documents',
      'employee-documents',
      'client-documents'
    )
  ) not valid;

alter table public.tenant_documents
  validate constraint tenant_documents_storage_bucket_check;
