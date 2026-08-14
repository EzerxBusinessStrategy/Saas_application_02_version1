alter table public.tenant_documents
  add column if not exists storage_bucket text,
  add column if not exists storage_key text,
  add column if not exists content_type text;

create unique index if not exists tenant_documents_storage_object_unique
  on public.tenant_documents (storage_bucket, storage_key)
  where storage_bucket is not null and storage_key is not null;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'tenant-documents',
      'tenant-documents',
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
  end if;
end;
$$;
