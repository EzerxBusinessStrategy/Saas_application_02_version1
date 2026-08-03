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
});
