create table if not exists public.user_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  locale text not null default 'en',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences
  drop constraint if exists user_preferences_locale_check,
  add constraint user_preferences_locale_check
    check (locale in ('en', 'bn', 'hi', 'or')),
  drop constraint if exists user_preferences_timezone_check,
  add constraint user_preferences_timezone_check
    check (timezone in (
      'Asia/Kolkata',
      'America/New_York',
      'Europe/London',
      'Asia/Singapore',
      'Australia/Sydney',
      'Europe/Berlin'
    ));

alter table public.user_preferences enable row level security;
alter table public.user_preferences force row level security;

drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own
on public.user_preferences
for select
to app_runtime
using (user_id = private.current_user_id());

drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own
on public.user_preferences
for insert
to app_runtime
with check (user_id = private.current_user_id());

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own
on public.user_preferences
for update
to app_runtime
using (user_id = private.current_user_id())
with check (user_id = private.current_user_id());

drop policy if exists user_preferences_delete_deny on public.user_preferences;
create policy user_preferences_delete_deny
on public.user_preferences
for delete
to app_runtime
using (false);

grant select, insert, update on public.user_preferences to app_runtime;
