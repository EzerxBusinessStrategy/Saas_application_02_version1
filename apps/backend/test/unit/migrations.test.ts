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

  test("allows tenant notification reads only through current tenant context", () => {
    expect(migrationNames).toContain("0040_tenant_admin_notifications_rls.sql");

    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/migrations/0040_tenant_admin_notifications_rls.sql"),
      "utf8",
    );

    expect(sql).toContain("private.has_tenant_context(tenant_id)");
    expect(sql).toContain("recipient_user_id = private.current_user_id()");
    expect(sql).toContain("private.notification_belongs_to_current_tenant(notification_recipients.notification_id)");
    expect(sql).toContain("security definer");
  });

  test("normalizes and blocks duplicate Tenant Administrator emails during tenant creation", () => {
    expect(migrationNames).toContain("0041_tenant_admin_email_uniqueness.sql");

    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/migrations/0041_tenant_admin_email_uniqueness.sql"),
      "utf8",
    );

    expect(sql).toContain("normalized_admin_email text := lower(trim(p_admin_email))");
    expect(sql).toContain("from public.users");
    expect(sql).toContain("email_normalized = normalized_admin_email");
    expect(sql).toContain("raise exception 'Tenant Administrator email already exists.'");
    expect(sql).toContain("where code = 'TENANT_ADMIN'");
  });

  test("uses portal credential and session timestamps for Tenant Administrator access", () => {
    expect(migrationNames).toContain("0061_super_admin_tenant_login_status.sql");

    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/migrations/0061_super_admin_tenant_login_status.sql"),
      "utf8",
    );

    expect(sql).toContain("from authn.credentials c");
    expect(sql).toContain("c.portal_type = 'TENANT'");
    expect(sql).toContain("from authn.sessions s");
    expect(sql).toContain("max(s.revoked_at) as last_logout_at");
  });

  test("adds visible portal login and logout audit support without a second session store", () => {
    expect(migrationNames).toContain("0062_portal_session_audit_events.sql");

    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/migrations/0062_portal_session_audit_events.sql"),
      "utf8",
    );

    expect(sql).toContain("'LOGGED_OUT'");
    expect(sql).toContain("audit_events_auth_session_created_idx");
    expect(sql).toContain("audit.write_portal_session_audit_event");
    expect(sql).toContain("security definer");
    expect(sql).not.toContain("create table");
  });

  test("adds private storage references without exposing document objects publicly", () => {
    expect(migrationNames).toContain("0063_private_document_storage.sql");

    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/migrations/0063_private_document_storage.sql"),
      "utf8",
    );

    expect(sql).toContain("storage_bucket text");
    expect(sql).toContain("storage_key text");
    expect(sql).toContain("content_type text");
    expect(sql).toContain("'tenant-documents'");
    expect(sql).toContain("false");
    expect(sql).toContain("tenant_documents_storage_object_unique");
  });

  test("creates private source buckets and tenant-scoped idempotency protection", () => {
    expect(migrationNames).toContain("0064_portal_private_document_buckets.sql");

    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/migrations/0064_portal_private_document_buckets.sql"),
      "utf8",
    );

    expect(sql).toContain("'super-admin-documents'");
    expect(sql).toContain("'tenant-documents'");
    expect(sql).toContain("'manager-documents'");
    expect(sql).toContain("'employee-documents'");
    expect(sql).toContain("'client-documents'");
    expect(sql).toContain("tenant_documents_idempotency_unique");
    expect(sql).toContain("invoices_idempotency_unique");
    expect(sql).toContain("public = false");
  });

  test("adds service capability and engagement snapshot tables without rewriting existing records", () => {
    expect(migrationNames).toContain("0066_service_blueprint_activation.sql");
    expect(migrationNames.indexOf("0066_service_blueprint_activation.sql")).toBeGreaterThan(
      migrationNames.indexOf("0064_portal_private_document_buckets.sql"),
    );

    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/migrations/0066_service_blueprint_activation.sql"),
      "utf8",
    );

    expect(sql).toContain("create table public.employee_service_capabilities");
    expect(sql).toContain("create table public.engagement_service_configurations");
    expect(sql).toContain("employee_service_capabilities_unique");
    expect(sql).toContain("engagement_service_configurations_idempotency_unique");
    expect(sql).toContain("enable row level security");
    expect(sql).not.toContain("drop table public.tasks");
    expect(sql).not.toContain("drop table public.clients");
    expect(sql).not.toContain("drop table public.services");
    expect(sql).not.toContain("drop table public.engagements");
    expect(sql).not.toMatch(/alter table public\.tasks\s+drop/i);
  });

  test("adds client service request tables without rewriting existing records", () => {
    expect(migrationNames).toContain("0067_client_service_requests.sql");
    expect(migrationNames.indexOf("0067_client_service_requests.sql")).toBeGreaterThan(
      migrationNames.indexOf("0066_service_blueprint_activation.sql"),
    );

    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/migrations/0067_client_service_requests.sql"),
      "utf8",
    );

    expect(sql).toContain("create table public.client_service_requests");
    expect(sql).toContain("create table public.client_service_request_items");
    expect(sql).toContain("client_service_requests_idempotency_unique");
    expect(sql).toContain("client_service_request_items_request_service_unique");
    expect(sql).toContain("enable row level security");
    expect(sql).not.toContain("drop table public.tasks");
    expect(sql).not.toContain("drop table public.clients");
    expect(sql).not.toContain("drop table public.services");
    expect(sql).not.toContain("drop table public.engagements");
    expect(sql).not.toMatch(/alter table public\.tasks\s+drop/i);
  });

  test("adds client service comments without rewriting existing records", () => {
    expect(migrationNames).toContain("0068_client_service_comments.sql");
    expect(migrationNames.indexOf("0068_client_service_comments.sql")).toBeGreaterThan(
      migrationNames.indexOf("0067_client_service_requests.sql"),
    );

    const sql = readFileSync(
      resolve(__dirname, "../../drizzle/migrations/0068_client_service_comments.sql"),
      "utf8",
    );

    expect(sql).toContain("create table public.client_service_comments");
    expect(sql).toContain("client_service_comments_idempotency_unique");
    expect(sql).toContain("foreign key (tenant_id, client_id)");
    expect(sql).toContain("foreign key (tenant_id, service_id)");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("force row level security");
    expect(sql).toContain("grant select, insert on public.client_service_comments to app_runtime");
    expect(sql).not.toContain("drop table public.tasks");
    expect(sql).not.toContain("drop table public.clients");
    expect(sql).not.toContain("drop table public.services");
    expect(sql).not.toContain("drop table public.engagements");
  });
});
