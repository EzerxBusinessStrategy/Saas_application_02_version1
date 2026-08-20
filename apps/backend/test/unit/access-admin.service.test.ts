import { describe, expect, test, vi } from "vitest";
import { AccessAdminRepository } from "../../src/auth/access-admin.repository";
import { AccessAdminService } from "../../src/auth/access-admin.service";
import { PasswordService } from "../../src/auth/core/password.service";
import { RequestContext } from "../../src/auth/request-context";

const context: RequestContext = {
  requestId: "request-1",
  authUserId: "77777777-7777-4777-8777-777777777777",
  userId: "33333333-3333-4333-8333-333333333333",
  roles: ["SUPER_ADMIN"],
  permissions: ["tenant.create"],
  isPlatformAdmin: true,
};

describe("AccessAdminService", () => {
  test("creates a portal tenant credential without a Supabase identity", async () => {
    const repository = {
      listTenantCreationTemplates: vi.fn().mockResolvedValue([]),
      userEmailExists: vi.fn().mockResolvedValue(false),
      createTenantWithDirectTenantAdministrator: vi.fn().mockResolvedValue({
        tenant_id: "11111111-1111-4111-8111-111111111111",
        financial_year_id: "22222222-2222-4222-8222-222222222222",
        user_id: "33333333-3333-4333-8333-333333333333",
        membership_id: "44444444-4444-4444-8444-444444444444",
      }),
    };
    const passwords = { hash: vi.fn().mockResolvedValue("$argon2id$portal-hash") } as unknown as PasswordService;
    const service = new AccessAdminService(repository as unknown as AccessAdminRepository, passwords);

    const result = await service.createTenantWithOwnerInvitation(context, {
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
    });

    expect(passwords.hash).toHaveBeenCalledWith("temporary-password");
    expect(repository.createTenantWithDirectTenantAdministrator).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        tenantAdministrator: expect.objectContaining({ email: "admin@abc.com" }),
      }),
      "$argon2id$portal-hash",
    );
    expect(result).toEqual({
      tenantId: "11111111-1111-4111-8111-111111111111",
      financialYearId: "22222222-2222-4222-8222-222222222222",
      membershipId: "44444444-4444-4444-8444-444444444444",
      tenantStatus: "active",
    });
  });

  test("blocks tenant creation when the Tenant Administrator email already exists locally", async () => {
    const repository = {
      listTenantCreationTemplates: vi.fn().mockResolvedValue([]),
      userEmailExists: vi.fn().mockResolvedValue(true),
      createTenantWithDirectTenantAdministrator: vi.fn(),
    };
    const service = new AccessAdminService(repository as unknown as AccessAdminRepository, new PasswordService());

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

  test("requires an incorporation date for an incorporation-derived country", async () => {
    const repository = {
      listTenantCreationTemplates: vi.fn().mockResolvedValue([{
        id: "11111111-1111-4111-8111-111111111111",
        country_code: "GB",
        policy_mode: "INCORPORATION_DERIVED",
      }]),
      userEmailExists: vi.fn(),
      createTenantWithDirectTenantAdministrator: vi.fn(),
    };
    const service = new AccessAdminService(repository as unknown as AccessAdminRepository, new PasswordService());

    await expect(service.createTenantWithOwnerInvitation(context, {
      company: {
        displayName: "ABC", legalName: "ABC Limited", tenantCode: "ABC001", slug: "abc",
        countryCode: "GB", reportingCurrencyCode: "GBP", timezone: "Europe/London",
      },
      financialYear: {
        source: "CUSTOM_CONFIRMED", label: "FY 2026", startsOn: "2026-04-01", endsOn: "2027-03-31", overrideReason: "Company policy",
      },
      tenantAdministrator: {
        fullName: "Tenant Admin", email: "admin@abc.com", password: "temporary-password", phone: "+441234567890",
      },
    })).rejects.toMatchObject({ response: { code: "INCORPORATION_DATE_REQUIRED" } });

    expect(repository.createTenantWithDirectTenantAdministrator).not.toHaveBeenCalled();
  });

  test("provisions the authenticated Super Admin into the tenant without a second credential", async () => {
    const repository = {
      listTenantCreationTemplates: vi.fn().mockResolvedValue([]),
      userEmailExists: vi.fn(),
      createTenantWithDirectTenantAdministrator: vi.fn(),
      createTenantForCurrentUser: vi.fn().mockResolvedValue({
        tenant_id: "11111111-1111-4111-8111-111111111111",
        financial_year_id: "22222222-2222-4222-8222-222222222222",
        user_id: context.userId,
        membership_id: "44444444-4444-4444-8444-444444444444",
      }),
    };
    const passwords = { hash: vi.fn() } as unknown as PasswordService;
    const service = new AccessAdminService(repository as unknown as AccessAdminRepository, passwords);

    const result = await service.createTenantWithOwnerInvitation(context, {
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
      administratorMode: "myself",
      selfAccess: {
        roles: ["TENANT_ADMIN", "MANAGER"],
        displayTitle: "Founder",
      },
    });

    expect(passwords.hash).not.toHaveBeenCalled();
    expect(repository.userEmailExists).not.toHaveBeenCalled();
    expect(repository.createTenantWithDirectTenantAdministrator).not.toHaveBeenCalled();
    expect(repository.createTenantForCurrentUser).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        administratorMode: "myself",
        selfAccess: { roles: ["TENANT_ADMIN", "MANAGER"], displayTitle: "Founder" },
      }),
    );
    expect(result.membershipId).toBe("44444444-4444-4444-8444-444444444444");
  });
});
