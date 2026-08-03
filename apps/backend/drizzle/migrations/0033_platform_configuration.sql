create table public.platform_configurations (
  key text primary key,
  value text not null,
  updated_by_user_id uuid references public.users (id),
  updated_at timestamptz not null default now(),
  constraint platform_configurations_key_check
    check (key in ('platform_name', 'default_brand_colour', 'email_sender_name')),
  constraint platform_configurations_value_check
    check (length(trim(value)) between 1 and 160)
);

alter table public.platform_configurations enable row level security;
alter table public.platform_configurations force row level security;

create policy platform_configurations_select
on public.platform_configurations
for select
to app_runtime, app_readonly
using (private.is_platform_admin());

create policy platform_configurations_insert
on public.platform_configurations
for insert
to app_runtime
with check (private.is_platform_admin());

create policy platform_configurations_update
on public.platform_configurations
for update
to app_runtime
using (private.is_platform_admin())
with check (private.is_platform_admin());

create policy platform_configurations_delete_deny
on public.platform_configurations
for delete
to app_runtime
using (false);

grant select on public.platform_configurations to app_runtime, app_readonly;
grant insert, update on public.platform_configurations to app_runtime;

insert into public.platform_configurations (key, value)
values
  ('platform_name', 'SaaS App'),
  ('default_brand_colour', '#3C50E0'),
  ('email_sender_name', 'SaaS App')
on conflict (key) do nothing;

insert into public.permissions (code, description, resource, action)
values
  ('platform.configuration.read', 'Read platform configuration.', 'platform_configuration', 'read'),
  ('platform.configuration.update', 'Update platform configuration.', 'platform_configuration', 'update')
on conflict (code) do update
set description = excluded.description,
    resource = excluded.resource,
    action = excluded.action;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from (values
  ('SUPER_ADMIN', 'platform.configuration.read'),
  ('SUPER_ADMIN', 'platform.configuration.update')
) as seed(role_code, permission_code)
join public.roles r on r.code = seed.role_code
join public.permissions p on p.code = seed.permission_code
on conflict do nothing;
