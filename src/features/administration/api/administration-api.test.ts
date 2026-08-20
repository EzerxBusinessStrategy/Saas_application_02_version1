import { afterEach, expect, test, vi } from "vitest";
import {
  createTenant,
  getTenantAdminEmailAvailability,
  listAuditRecords,
  listTenantListFilters,
  listTenants,
  resetTenantAdministratorPassword,
  updateTenantStatus,
} from "@/features/administration/api/administration-api";

afterEach(() => {
  vi.restoreAllMocks();
});

test("loads audit records from the real Super Admin audit API route", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        items: [],
        page: 1,
        pageSize: 10,
        pageCount: 1,
        totalItems: 0,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );

  const response = await listAuditRecords({
    page: 1,
    pageSize: 10,
    tenantId: "11111111-1111-4111-8111-111111111111",
    sort: "timestamp",
    query: "tenant",
  });

  expect(response.items).toEqual([]);
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/super-admin/audit-log?page=1&pageSize=10&tenantId=11111111-1111-4111-8111-111111111111&query=tenant&sort=timestamp",
    { cache: "no-store" },
  );
});

test("sends tenant country and financial-year filters to the database API", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ items: [], page: 1, pageSize: 5, pageCount: 1, totalItems: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  await listTenants({ page: 1, pageSize: 5, countryCode: "IN", financialYear: "FY 2026-27" });

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/super-admin/tenants?page=1&pageSize=5&countryCode=IN&financialYear=FY+2026-27",
    { cache: "no-store" },
  );
});

test("loads country and financial-year options from the real Super Admin API route", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ countries: ["IN"], financialYears: [{ countryCode: "IN", label: "FY 2026-27" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  await expect(listTenantListFilters()).resolves.toEqual({
    countries: ["IN"],
    financialYears: [{ countryCode: "IN", label: "FY 2026-27" }],
  });
  expect(fetchMock).toHaveBeenCalledWith("/api/super-admin/tenant-list-filters", { cache: "no-store" });
});

test("creates a tenant with its Tenant Administrator account", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        tenantId: "tenant-1",
        financialYearId: "fy-1",
        membershipId: "membership-1",
        tenantStatus: "active",
      }),
      { status: 201, headers: { "content-type": "application/json" } },
    ),
  );

  await createTenant({
    company: {
      displayName: "ABC",
      legalName: "ABC Limited",
      tenantCode: "ABC001",
      slug: "abc",
      countryCode: "IN",
      reportingCurrencyCode: "INR",
      timezone: "Asia/Kolkata",
      industry: "",
      incorporationDate: "",
      registrationNumber: "",
      taxIdentifier: "",
    },
    financialYear: {
      source: "COUNTRY_SUGGESTION_CONFIRMED",
      label: "FY 2026-27",
      startsOn: "2026-04-01",
      endsOn: "2027-03-31",
      templateId: "",
      overrideReason: "",
    },
    tenantAdministrator: {
      fullName: "Tenant Admin",
      email: "admin@example.com",
      password: "temporary-password",
      phone: "+919876543210",
    },
    administratorMode: "another_person",
    selfAccess: { roles: ["TENANT_ADMIN"], displayTitle: "" },
    confirm: true,
  });

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/super-admin/tenants",
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"email":"admin@example.com"'),
    }),
  );
});

test("checks Tenant Administrator email availability through the Super Admin API route", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ available: false, reason: "EMAIL_ALREADY_EXISTS" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  await expect(getTenantAdminEmailAvailability("admin@abc.com")).resolves.toEqual({
    available: false,
    reason: "EMAIL_ALREADY_EXISTS",
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/super-admin/users/email-availability?email=admin%40abc.com",
    { cache: "no-store" },
  );
});

test("sends a Tenant Administrator password reset to the protected API route", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ tenantId: "tenant-1", email: "admin@example.com", passwordChangedAt: "2026-08-04T00:00:00.000Z" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  await resetTenantAdministratorPassword("tenant-1", "replacement-password");

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/super-admin/tenants/tenant-1/password",
    expect.objectContaining({ method: "POST", body: JSON.stringify({ password: "replacement-password" }) }),
  );
});

test("sends timed suspension and revocation confirmation through the lifecycle API", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ tenantId: "tenant-1", status: "suspended", suspensionEndsAt: "2026-08-05T00:00:00.000Z", revokedAt: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  await updateTenantStatus("tenant-1", "suspended", { suspensionDuration: "24h" });

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/super-admin/tenants/tenant-1",
    expect.objectContaining({
      method: "PATCH",
      body: expect.stringContaining('"suspensionDuration":"24h"'),
    }),
  );
});
