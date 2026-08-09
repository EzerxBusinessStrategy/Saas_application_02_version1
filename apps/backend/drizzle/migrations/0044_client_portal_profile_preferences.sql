alter table public.client_portal_accounts
  add column if not exists portal_name text,
  add column if not exists primary_colour text,
  add column if not exists sidebar_colour text,
  add column if not exists surface_colour text;

alter table public.client_portal_accounts
  drop constraint if exists client_portal_accounts_profile_colours_check,
  add constraint client_portal_accounts_profile_colours_check check (
    (primary_colour is null or primary_colour ~ '^#[0-9A-Fa-f]{6}$')
    and (sidebar_colour is null or sidebar_colour ~ '^#[0-9A-Fa-f]{6}$')
    and (surface_colour is null or surface_colour ~ '^#[0-9A-Fa-f]{6}$')
  );
