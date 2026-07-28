-- Generic template only. Review before using in a migration.
create table example_records (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);
