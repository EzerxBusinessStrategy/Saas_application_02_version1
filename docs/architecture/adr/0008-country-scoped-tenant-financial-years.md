# ADR: Country-scoped tenant financial years

Status: Accepted
Date: 2026-08-10
Decision owners: Product and engineering

## Context and problem

Tasks can be created for more than one country, but `tenant_financial_years` was restricted to one overlapping financial year for an entire tenant. The task form could therefore return only the tenant's original country calendar.

## Constraints

- Reuse Super Admin `financial_year_templates` and its fiscal-year formula.
- Keep task and invoice financial years database-authoritative.
- Preserve tenant-scoped foreign keys, RLS, and existing tenant reporting behavior.

## Considered options

- Expose template countries in the frontend only.
- Create a separate task calendar model.
- Scope existing tenant financial years by country.

## Decision and rationale

`tenant_financial_years` is scoped by `(tenant_id, country_code)`. The authenticated Tenant Admin task options request provisions a missing current row from an active Super Admin template using the shared fiscal-year policy. A task is constrained to a fiscal year of the same country. Dashboard defaults continue to prefer the tenant's primary country.

For incorporation-derived templates, the confirmed primary fiscal-year start is used as the v1 anchor; tenant creation date is used only when no fiscal year exists. Neither is a legal incorporation date, so this operational calendar must be replaced by a confirmed legal date before regulatory use.

## Positive and negative consequences

- India, United States, United Kingdom, Singapore, and every other active Super Admin template can be used in the task form.
- Each task invoice retains the task's financial year.
- Default tenant-level reporting remains primary-country based; cross-country reporting needs an explicit country filter in a future release.

## Security and operational consequences

All reads and provisioning occur inside the existing authenticated tenant transaction. The browser never supplies a financial-year identifier. Existing RLS policies remain unchanged.

## Migration and rollback

The migration backfills `country_code`, changes overlapping/current constraints to country scope, and validates the composite task foreign key. It fails rather than silently applying if existing task country data disagrees with its financial year. This is forward-only; a rollback requires a reviewed data consolidation because multi-country fiscal years may have been created.

## Validation plan

Run backend type checks and focused unit tests. Apply the migration manually to a non-production Supabase environment first and verify task options return active templates with a country-specific financial year.

## Related decisions

- [0004: PostgreSQL database architecture](0004-postgresql-database-architecture.md)
