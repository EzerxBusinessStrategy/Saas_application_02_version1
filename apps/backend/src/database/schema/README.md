# Database Schema Source of Truth

The SQL migrations under `apps/backend/drizzle/migrations` are the source of
truth for PostgreSQL-specific behavior: roles, ownership, grants, RLS policies,
trusted-context helpers, check constraints, composite tenant-safe foreign keys,
and seed data.

The Drizzle schema files mirror Phase 2 tables for typed query construction.
Do not generate a migration from Drizzle output until the generated SQL has
been reviewed against the migration source of truth and the architecture docs.
