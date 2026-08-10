create or replace function private.identify_login_email(p_email text)
returns table (
  display_name text
)
language sql
stable
security definer
set search_path = public, private
as $$
  select u.display_name
  from public.users u
  where u.status = 'active'
    and (
      u.email_normalized = lower(trim(p_email))
      or lower(trim(u.email)) = lower(trim(p_email))
    )
  order by u.created_at desc
  limit 1;
$$;

revoke all on function private.identify_login_email(text) from public;
grant execute on function private.identify_login_email(text) to app_runtime;

create or replace function private.user_email_exists(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.users u
    where u.email_normalized = lower(trim(p_email))
       or lower(trim(u.email)) = lower(trim(p_email))
  );
$$;

revoke all on function private.user_email_exists(text) from public;
grant execute on function private.user_email_exists(text) to app_runtime;
