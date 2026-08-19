alter table public.users
  add column if not exists avatar_path text,
  add column if not exists avatar_updated_at timestamptz;

alter table public.users
  drop constraint if exists users_avatar_path_format;

alter table public.users
  add constraint users_avatar_path_format
  check (
    avatar_path is null
    or avatar_path ~ '^(platform|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
  ) not valid;

alter table public.users
  validate constraint users_avatar_path_format;

grant update (avatar_path, avatar_updated_at, updated_at) on public.users to app_runtime;

drop policy if exists users_update_own_avatar on public.users;

create policy users_update_own_avatar
on public.users
for update
to app_runtime
using (id = private.current_user_id())
with check (id = private.current_user_id());

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise exception 'Supabase storage schema is required before the avatars bucket can be created.';
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'avatars',
    'avatars',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
end;
$$;
