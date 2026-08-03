create extension if not exists pg_trgm;

create index if not exists tenants_search_tsv_gin_idx
  on public.tenants
  using gin (
    to_tsvector(
      'simple',
      coalesce(code, '') || ' ' || coalesce(legal_name, '') || ' ' || coalesce(display_name, '')
    )
  );

create index if not exists tenants_search_trgm_gin_idx
  on public.tenants
  using gin (
    (
      lower(coalesce(code, '') || ' ' || coalesce(legal_name, '') || ' ' || coalesce(display_name, ''))
    ) gin_trgm_ops
  );

create index if not exists users_search_tsv_gin_idx
  on public.users
  using gin (
    to_tsvector(
      'simple',
      coalesce(email_normalized, '') || ' ' || coalesce(display_name, '')
    )
  );

create index if not exists users_search_trgm_gin_idx
  on public.users
  using gin (
    (
      lower(coalesce(email_normalized, '') || ' ' || coalesce(display_name, ''))
    ) gin_trgm_ops
  );
