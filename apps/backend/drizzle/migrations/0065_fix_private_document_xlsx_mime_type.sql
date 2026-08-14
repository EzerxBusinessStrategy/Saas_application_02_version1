do $$
declare
  bucket_id text;
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise exception 'Supabase storage schema is required before document bucket MIME types can be updated.';
  end if;

  foreach bucket_id in array array[
    'super-admin-documents',
    'tenant-documents',
    'manager-documents',
    'employee-documents',
    'client-documents'
  ]
  loop
    update storage.buckets
    set allowed_mime_types = array[
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
    where id = bucket_id;
  end loop;
end;
$$;
