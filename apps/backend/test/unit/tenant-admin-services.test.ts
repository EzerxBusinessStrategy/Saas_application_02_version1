import { describe, expect, it, vi } from "vitest";
import { TenantAdminServicesRepository } from "../../src/platform/tenant-admin-services.repository";

describe("TenantAdminServicesRepository", () => {
  it("creates a tenant-scoped service with a reusable rate-card item", async () => {
    const queries: string[] = [];
    const params: unknown[][] = [];
    const client = {
      query: vi.fn(async (sqlText: string, values: readonly unknown[] = []) => {
        queries.push(sqlText);
        params.push([...values]);
        if (sqlText.includes("insert into public.services")) return { rows: [{ id: "service-1" }], rowCount: 1 };
        if (sqlText.includes("insert into public.rate_cards")) return { rows: [{ id: "rate-card-1" }], rowCount: 1 };
        if (sqlText.includes("where s.tenant_id = $1") && sqlText.includes("and s.id = $2")) {
          return {
            rows: [{
              id: "service-1",
              name: "GST Filing",
              code: "gst-filing",
              status: "active",
              rates: [{
                id: "rate-1",
                rateCardName: "Default Service Rate Card - INR",
                clientName: null,
                taskType: "GST Return",
                unitType: "per_filing",
                rateAmount: 1500,
                currencyCode: "INR",
                taxCode: null,
                tasksUsingRate: 0,
              }],
            }],
          };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client) };
    const repository = new TenantAdminServicesRepository(pool as never);

    await repository.create(
      {
        authUserId: "auth-user-1",
        userId: "user-1",
        tenantId: "tenant-1",
        membershipId: "member-1",
        roles: ["TENANT_ADMIN"],
        permissions: ["client.update"],
        isPlatformAdmin: false,
        requestId: "req-1",
      },
      {
        name: "GST Filing",
        taskType: "GST Return",
        unitType: "per_filing",
        rateAmount: 1500,
        currencyCode: "INR",
        taxCode: "",
        effectiveFrom: "2026-08-07",
      },
    );

    const sql = queries.join("\n");
    expect(sql).toContain("insert into public.services");
    expect(sql).toContain("insert into public.rate_card_items");
    expect(sql).toContain("SERVICE_CREATED");
    expect(params).toContainEqual(["tenant-1", "gst-filing"]);
    expect(params).toContainEqual(["tenant-1", "gst-filing", "GST Filing", "GST Return", "fixed"]);
  });
});

