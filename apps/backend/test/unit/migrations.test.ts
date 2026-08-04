import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { migrationNames } from "../../src/database/migrations";

describe("database migrations", () => {
  test("tenant invitation cancellation uses the invitations role foreign key", () => {
    expect(migrationNames).toContain("0030_cancel_tenant_with_invitation.sql");

    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/migrations/0030_cancel_tenant_with_invitation.sql"),
      "utf8",
    );

    expect(sql).toContain("join public.roles r on r.id = i.intended_role_id");
    expect(sql).not.toMatch(/\brole_code\s*=/);
    expect(sql).toContain("update public.tenants");
    expect(sql).toContain("set status = 'cancelled'");
  });

  test("repairs only pending tenants with a cancelled Tenant Administrator invitation", () => {
    expect(migrationNames).toContain("0031_backfill_cancelled_tenant_status.sql");

    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/migrations/0031_backfill_cancelled_tenant_status.sql"),
      "utf8",
    );

    expect(sql).toContain("t.status = 'pending_activation'");
    expect(sql).toContain("r.code = 'TENANT_ADMIN'");
    expect(sql).toContain("i.status = 'cancelled'");
  });

  test("creates protected persistent platform configuration for Super Admins", () => {
    expect(migrationNames).toContain("0033_platform_configuration.sql");

    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/migrations/0033_platform_configuration.sql"),
      "utf8",
    );

    expect(sql).toContain("force row level security");
    expect(sql).toContain("platform.configuration.read");
    expect(sql).toContain("platform.configuration.update");
    expect(sql).toContain("platform_configurations_value_check");
  });

  test("records Tenant Administrator sessions and exposes platform-only access status", () => {
    expect(migrationNames).toContain("0036_tenant_administrator_access_audit.sql");

    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/migrations/0036_tenant_administrator_access_audit.sql"),
      "utf8",
    );

    expect(sql).toContain("TENANT_ADMIN_LOGGED_IN");
    expect(sql).toContain("TENANT_ADMIN_LOGGED_OUT");
    expect(sql).toContain("TENANT_ADMIN_PASSWORD_RESET_SUCCEEDED");
    expect(sql).toContain("private.is_platform_admin()");
  });

  test("filters the tenant directory in PostgreSQL by country and financial year", () => {
    expect(migrationNames).toContain("0037_super_admin_tenant_list_filters.sql");

    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/migrations/0037_super_admin_tenant_list_filters.sql"),
      "utf8",
    );

    expect(sql).toContain("list_super_admin_tenants_filtered");
    expect(sql).toContain("p_country_code is null or t.country = p_country_code");
    expect(sql).toContain("p_financial_year_label is null or exists");
    expect(sql).toContain("list_super_admin_tenant_list_filters");
    expect(sql).toContain("private.is_platform_admin()");
    expect(sql).toContain("raise exception 'Platform administrator context is required.'");
  });

  test("persists timed suspension and terminal tenant revocation without deleting data", () => {
    expect(migrationNames).toContain("0038_tenant_timed_suspension_and_revocation.sql");

    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/migrations/0038_tenant_timed_suspension_and_revocation.sql"),
      "utf8",
    );

    expect(sql).toContain("suspension_ends_at timestamptz");
    expect(sql).toContain("'revoked'");
    expect(sql).toContain("tenant.revoke");
    expect(sql).toContain("set_super_admin_tenant_lifecycle");
    expect(sql).toContain("restore_expired_tenant_suspensions");
    expect(sql).toContain("tenant_user.supabase_auth_user_id = nullif(current_setting('app.auth_user_id', true), '')::uuid");
    expect(sql).toContain("update public.auth_session_policies");
    expect(sql).toContain("private.is_platform_admin()");
  });

  test("allows Super Admin lifecycle actions for pending tenant accounts", () => {
    expect(migrationNames).toContain("0039_pending_tenant_lifecycle_actions.sql");

    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/migrations/0039_pending_tenant_lifecycle_actions.sql"),
      "utf8",
    );

    expect(sql).toContain("previous_status not in ('active', 'pending_activation')");
    expect(sql).toContain("previous_status not in ('active', 'suspended', 'pending_activation')");
  });
});
