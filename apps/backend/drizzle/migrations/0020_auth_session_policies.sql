create table public.auth_session_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id),
  supabase_session_id text not null,
  remember_me boolean not null default false,
  issued_at timestamptz not null default now(),
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  constraint auth_session_policies_session_unique unique (supabase_session_id),
  constraint auth_session_policies_expires_after_issue_check check (absolute_expires_at > issued_at)
);

create index auth_session_policies_user_active_idx
  on public.auth_session_policies (user_id, absolute_expires_at, supabase_session_id)
  where revoked_at is null;

alter table public.auth_session_policies enable row level security;
alter table public.auth_session_policies force row level security;

create policy auth_session_policies_select
on public.auth_session_policies
for select
to app_runtime
using (user_id = private.current_user_id());

create policy auth_session_policies_insert
on public.auth_session_policies
for insert
to app_runtime
with check (user_id = private.current_user_id());

create policy auth_session_policies_update
on public.auth_session_policies
for update
to app_runtime
using (user_id = private.current_user_id())
with check (user_id = private.current_user_id());

create policy auth_session_policies_delete_deny
on public.auth_session_policies
for delete
to app_runtime
using (false);

grant select, insert, update on public.auth_session_policies to app_runtime;
