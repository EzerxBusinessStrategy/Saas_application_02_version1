import request from "supertest";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AuthContextRepository, AuthContextRow } from "../../src/auth/auth-context.repository";
import { SessionPolicyRepository } from "../../src/auth/session-policy.repository";
import { SupabaseJwtVerifier } from "../../src/auth/supabase-jwt-verifier.service";
import { TenantAnalyticsRepository } from "../../src/platform/tenant-analytics.repository";
import { createTestApp } from "../helpers/test-app";

describe("tenant analytics", () => {
  let app: NestFastifyApplication | undefined;
  afterEach(async () => { await app?.close(); vi.restoreAllMocks(); });

  test("returns tenant-scoped analytics only to a permitted Super Admin", async () => {
    vi.spyOn(AuthContextRepository.prototype, "findBySupabaseAuthUserId").mockResolvedValue([platformContext]);
    vi.spyOn(TenantAnalyticsRepository.prototype, "get").mockResolvedValue({ tenants: [{ id: "11111111-1111-4111-8111-111111111111", name: "abc", code: "A001", status: "cancelled", currency_code: "GBP" }], selectedTenant: null, financialYears: [], selectedFinancialYear: null, metrics: { turnover: "0", collected: "0", outstanding: "0", invoices: "0", payments: "0", clients: "0", active_employees: "0", total_tasks: "0", completed_tasks: "0", sla_compliant_tasks: "0", sla_measured_tasks: "0", assigned_tasks: "0" }, trend: [], clientRevenue: [] });
    app = await createAnalyticsTestApp();
    const response = await request(app.getHttpServer()).get("/api/v1/super-admin/tenant-analytics?from=2026-07-01&to=2026-07-31").set("authorization", "Bearer verified-token").expect(200);
    expect(response.body).toMatchObject({ tenants: [{ name: "abc", status: "cancelled" }], metrics: { turnover: "0.00", slaCompliance: 0 } });
  });

  test("denies a tenant user even when report.read is assigned", async () => {
    vi.spyOn(AuthContextRepository.prototype, "findBySupabaseAuthUserId").mockResolvedValue([{ ...platformContext, tenant_id: "11111111-1111-4111-8111-111111111111", membership_id: "22222222-2222-4222-8222-222222222222", role_codes: ["TENANT_ADMIN"] }]);
    app = await createAnalyticsTestApp();
    await request(app.getHttpServer()).get("/api/v1/super-admin/tenant-analytics").set("authorization", "Bearer verified-token").expect(403);
  });
});

const platformContext = { user_id: "33333333-3333-4333-8333-333333333333", user_email: "super-admin@example.com", user_display_name: "Super Admin", user_status: "active", tenant_id: null, tenant_code: null, tenant_display_name: null, tenant_status: null, membership_id: null, membership_status: null, membership_display_name: null, membership_timezone: null, role_codes: ["SUPER_ADMIN"], permission_codes: ["report.read"] } satisfies AuthContextRow;
async function createAnalyticsTestApp(): Promise<NestFastifyApplication> { const app = await createTestApp(); vi.spyOn(app.get(SupabaseJwtVerifier), "verifyBearerToken").mockResolvedValue({ authUserId: "77777777-7777-4777-8777-777777777777", sessionId: "test-session", email: "super-admin@example.com", issuer: "https://auth.example.test/auth/v1", audience: ["authenticated"], expiresAt: new Date(Date.now() + 300_000) }); vi.spyOn(app.get(SessionPolicyRepository), "assertActive").mockResolvedValue({ auth_context_version: 1 }); return app; }
