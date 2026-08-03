import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool, PoolConfig } from "pg";

export type MigrationResult = {
  readonly applied: readonly string[];
  readonly skipped: readonly string[];
};

export const migrationNames = [
  "0001_extensions_schemas_roles.sql",
  "0002_foundation_tables.sql",
  "0003_indexes_constraints.sql",
  "0004_trusted_context_helpers.sql",
  "0005_rls_policies.sql",
  "0006_grants.sql",
  "0007_seed_roles_permissions.sql",
  "0008_private_schema_migrations_rls.sql",
  "0009_auth_context_resolution.sql",
  "0010_invitation_membership_access_model.sql",
  "0011_platform_super_admin_bootstrap.sql",
  "0012_auth_context_subject_binding.sql",
  "0013_task_revenue_performance_health_workflow.sql",
  "0014_fix_reporting_view_aggregation.sql",
  "0015_super_admin_dashboard_reporting.sql",
  "0016_tenant_reviews.sql",
  "0017_super_admin_search_indexes.sql",
  "0018_super_admin_notifications.sql",
  "0019_tenant_event_notifications.sql",
  "0020_auth_session_policies.sql",
  "0021_platform_alerts_review_lifecycle.sql",
  "0022_super_admin_tenant_creation.sql",
  "0023_super_admin_list_tenants_fn.sql",
  "0024_fix_audit_user_fk.sql",
  "0025_fix_notification_trigger_ambiguous_column.sql",
  "0026_fix_resolve_auth_context_check.sql",
] as const;

export async function runMigrations(
  pool: Pool,
  migrationsDir = path.resolve(__dirname, "../../drizzle/migrations"),
): Promise<MigrationResult> {
  await pool.query("create schema if not exists private");
  await pool.query(`
    create table if not exists private.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const name of migrationNames) {
    const alreadyApplied = await pool.query<{ name: string }>(
      "select name from private.schema_migrations where name = $1",
      [name],
    );
    if (alreadyApplied.rowCount) {
      skipped.push(name);
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, name), "utf8");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into private.schema_migrations (name) values ($1) on conflict do nothing", [
        name,
      ]);
      await client.query("commit");
      applied.push(name);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  return { applied, skipped };
}

export async function runMigrationsFromConfig(config: PoolConfig): Promise<MigrationResult> {
  const pool = new Pool(config);
  try {
    return await runMigrations(pool);
  } finally {
    await pool.end();
  }
}
