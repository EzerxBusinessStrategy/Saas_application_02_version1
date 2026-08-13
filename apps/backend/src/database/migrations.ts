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
  "0027_super_admin_pending_invitation_id.sql",
  "0028_super_admin_cancel_tenant_invitation.sql",
  "0029_fix_cancel_tenant_invitation_role_lookup.sql",
  "0030_cancel_tenant_with_invitation.sql",
  "0031_backfill_cancelled_tenant_status.sql",
  "0032_super_admin_tenant_status_lifecycle.sql",
  "0033_platform_configuration.sql",
  "0034_direct_tenant_admin_provisioning.sql",
  "0035_direct_tenant_administrator_phone.sql",
  "0036_tenant_administrator_access_audit.sql",
  "0037_super_admin_tenant_list_filters.sql",
  "0038_tenant_timed_suspension_and_revocation.sql",
  "0039_pending_tenant_lifecycle_actions.sql",
  "0040_tenant_admin_notifications_rls.sql",
  "0041_tenant_admin_email_uniqueness.sql",
  "0042_client_portal_accounts.sql",
  "0043_tenant_document_metadata.sql",
  "0044_client_portal_profile_preferences.sql",
  "0045_employee_task_work_time.sql",
  "0046_employee_document_recipients.sql",
  "0047_task_submission_comment.sql",
  "0048_manager_employee_capability.sql",
  "0049_auth_identify_email.sql",
  "0050_employee_manager_assignments.sql",
  "0051_task_billable_entry_approval_lifecycle.sql",
  "0052_country_scoped_tenant_financial_years.sql",
  "0053_request_path_performance.sql",
  "0054_task_notification_outbox.sql",
  "0055_user_localization_preferences.sql",
  "0056_audit_event_detail_context.sql",
  "0057_portal_authentication.sql",
  "0058_portal_auth_provisioning_and_session_policy.sql",
  "0059_portal_tenant_provisioning.sql",
  "0060_authn_credentials_ist_view.sql",
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
