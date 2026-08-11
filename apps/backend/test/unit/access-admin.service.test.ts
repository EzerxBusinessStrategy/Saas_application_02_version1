import { describe, expect, test, vi } from "vitest";
import { AccessAdminRepository } from "../../src/auth/access-admin.repository";
import { AccessAdminService } from "../../src/auth/access-admin.service";
import { RequestContext } from "../../src/auth/request-context";
import { AppConfig } from "../../src/config/app-config";

const context: RequestContext = {
  requestId: "request-1",
  authUserId: "77777777-7777-4777-8777-777777777777",
  userId: "33333333-3333-4333-8333-333333333333",
  roles: ["SUPER_ADMIN"],
  permissions: ["tenant.create"],
  isPlatformAdmin: true,
};

const config: AppConfig = {
  environment: "test",
  appName: "SaaS App Backend",
  port: 0,
  logLevel: "silent",
  apiBasePath: "/api/v1",
  corsOrigins: ["https://app.example.com"],
  requestBodyLimitBytes: 1024,
  trustProxy: false,
  databasePoolMax: 1,
  supabaseUrl: "https://auth.example.test",
  supabaseAdminKey: "service-role-key",
  supabaseJwksTimeoutMs: 1500,
};

describe("AccessAdminService", () => {
  test("blocks tenant creation when the Tenant Administrator email already exists locally", async () => {
    const repository = {
      listTenantCreationTemplates: vi.fn().mockResolvedValue([]),
      userEmailExists: vi.fn().mockResolvedValue(true),
      createTenantWithDirectTenantAdministrator: vi.fn(),
    };
    const service = new AccessAdminService(repository as unknown as AccessAdminRepository, config);

    await expect(service.createTenantWithOwnerInvitation(context, {
      company: {
        displayName: "ABC",
        legalName: "ABC Private Limited",
        tenantCode: "ABC001",
        slug: "abc",
        countryCode: "IN",
        reportingCurrencyCode: "INR",
        timezone: "Asia/Kolkata",
      },
      financialYear: {
        source: "CUSTOM_CONFIRMED",
        label: "FY 2026",
        startsOn: "2026-04-01",
        endsOn: "2027-03-31",
        overrideReason: "Company policy",
      },
      tenantAdministrator: {
        fullName: "Tenant Admin",
        email: " Admin@ABC.com ",
        password: "temporary-password",
        phone: "+919876543210",
      },
    })).rejects.toMatchObject({
      response: {
        code: "EMAIL_ALREADY_EXISTS",
      },
    });

    expect(repository.userEmailExists).toHaveBeenCalledWith(context, "admin@abc.com");
    expect(repository.createTenantWithDirectTenantAdministrator).not.toHaveBeenCalled();
  });
});
