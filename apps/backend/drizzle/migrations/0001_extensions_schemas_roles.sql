create extension if not exists pgcrypto;

create schema if not exists private;
create schema if not exists audit;

create table if not exists private.schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_migrator') then
    create role app_migrator noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    create role app_runtime noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_readonly') then
    create role app_readonly noinherit;
  end if;
end
$$;

alter role app_runtime nobypassrls;
alter role app_runtime nocreatedb nocreaterole;
alter role app_readonly nobypassrls;
alter role app_readonly nocreatedb nocreaterole;
