import { afterEach, expect, test, vi } from "vitest";
import {
  cancelTenantAdminInvitation,
  createTenant,
  listAuditRecords,
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
    sort: "timestamp",
    query: "tenant",
  });

  expect(response.items).toEqual([]);
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/super-admin/audit-log?page=1&pageSize=10&query=tenant&sort=timestamp",
    { cache: "no-store" },
  );
});

test("creates tenant with the final Tenant Administrator invitation email", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        tenantId: "tenant-1",
        financialYearId: "fy-1",
        invitationId: "invite-1",
        tenantStatus: "pending_activation",
        invitationStatus: "pending",
        invitationDeliveryStatus: "sent",
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
      phone: "",
      expiresAt: "",
    },
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

test("cancels a pending Tenant Administrator invitation through the tenant action route", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ invitationId: "invite-1", status: "cancelled" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  await cancelTenantAdminInvitation("tenant-1");

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/super-admin/tenants/tenant-1/invitation/cancel",
    expect.objectContaining({ method: "POST" }),
  );
});
