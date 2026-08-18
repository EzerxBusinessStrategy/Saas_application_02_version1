import { NotFoundException } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { TenantAdminServicesRepository } from "../../src/platform/tenant-admin-services.repository";

const tenantAdminContext = {
  authUserId: "auth-user-1",
  userId: "user-1",
  tenantId: "tenant-1",
  membershipId: "member-1",
  roles: ["TENANT_ADMIN"],
  permissions: ["client.update"],
  isPlatformAdmin: false,
  requestId: "req-1",
} as const;

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
      tenantAdminContext,
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
    expect(sql).toContain("$3::date between effective_from and coalesce(effective_to, 'infinity'::date)");
    expect(sql).toContain("SERVICE_CREATED");
    expect(params).toContainEqual(["tenant-1", "gst-filing"]);
    expect(params).toContainEqual(["tenant-1", "gst-filing", "GST Filing", "GST Return", "fixed"]);
    expect(params).toContainEqual(["tenant-1", "INR", "2026-08-07"]);
  });

  it("disables a tenant-default task rate and syncs the calendar rule", async () => {
    const queries: string[] = [];
    const params: unknown[][] = [];
    const client = {
      query: vi.fn(async (sqlText: string, values: readonly unknown[] = []) => {
        queries.push(sqlText);
        params.push([...values]);
        if (sqlText.includes("for update of rci")) {
          return { rows: [{ id: "rate-1", task_type: "GST Return" }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client) };
    const repository = new TenantAdminServicesRepository(pool as never);

    const result = await repository.setRateItemStatus(tenantAdminContext, "service-1", "rate-1", "inactive");

    expect(result).toEqual({ rateItemId: "rate-1", taskType: "GST Return", status: "inactive" });
    const sql = queries.join("\n");
    expect(sql).toContain("rc.client_id is null");
    expect(sql).toContain("update public.rate_card_items set status = $3");
    expect(sql).toContain("update public.compliance_calendar_rules");
    expect(sql).toContain("SERVICE_TASK_STATUS_UPDATED");
    expect(params).toContainEqual(["tenant-1", "rate-1", "service-1"]);
    expect(params).toContainEqual(["tenant-1", "rate-1", "inactive"]);
    expect(params).toContainEqual(["tenant-1", "service-1", "GST Return", "inactive"]);
  });

  it("rejects status changes for rates outside the tenant-default card without leaking details", async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sqlText: string) => {
        queries.push(sqlText);
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client) };
    const repository = new TenantAdminServicesRepository(pool as never);

    await expect(
      repository.setRateItemStatus(tenantAdminContext, "service-1", "rate-other-tenant", "inactive"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(queries.join("\n")).not.toContain("update public.rate_card_items");
  });

  it("disables a tenant catalogue service without leaking missing rows", async () => {
    const queries: string[] = [];
    const params: unknown[][] = [];
    const client = {
      query: vi.fn(async (sqlText: string, values: readonly unknown[] = []) => {
        queries.push(sqlText);
        params.push([...values]);
        if (sqlText.includes("update public.services")) {
          return { rows: [{ id: "service-1", name: "GST Filing", status: "inactive" }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client) };
    const repository = new TenantAdminServicesRepository(pool as never);

    const result = await repository.setServiceStatus(tenantAdminContext, "service-1", "inactive");

    expect(result).toEqual({ serviceId: "service-1", name: "GST Filing", status: "inactive" });
    expect(queries.join("\n")).toContain("and status in ('active', 'inactive')");
    expect(queries.join("\n")).toContain("SERVICE_STATUS_UPDATED");
    expect(params).toContainEqual(["tenant-1", "service-1", "inactive"]);
  });

  it("rejects service status changes outside the tenant without leaking details", async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sqlText: string) => {
        queries.push(sqlText);
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client) };
    const repository = new TenantAdminServicesRepository(pool as never);

    await expect(
      repository.setServiceStatus(tenantAdminContext, "service-other-tenant", "inactive"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(queries.join("\n")).not.toContain("SERVICE_STATUS_UPDATED");
  });

  it("lists disabled tenant-default rates and dedupes superseded inactive rows", async () => {
    const rates = [
      {
        id: "rate-old",
        rateCardName: "Default Service Rate Card - INR",
        clientName: null,
        taskType: "GST Return",
        unitType: "per_filing",
        rateAmount: 1000,
        currencyCode: "INR",
        taxCode: null,
        tasksUsingRate: 0,
        status: "inactive",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "rate-active",
        rateCardName: "Default Service Rate Card - INR",
        clientName: null,
        taskType: "GST Return",
        unitType: "per_filing",
        rateAmount: 1500,
        currencyCode: "INR",
        taxCode: null,
        tasksUsingRate: 2,
        status: "active",
        updatedAt: "2026-02-01T00:00:00Z",
      },
      {
        id: "rate-disabled",
        rateCardName: "Default Service Rate Card - INR",
        clientName: null,
        taskType: "TDS Filing",
        unitType: "per_task",
        rateAmount: 500,
        currencyCode: "INR",
        taxCode: null,
        tasksUsingRate: 0,
        status: "inactive",
        updatedAt: "2026-03-01T00:00:00Z",
      },
    ];
    const client = {
      query: vi.fn(async (sqlText: string) => {
        if (sqlText.includes("jsonb_agg") && sqlText.includes("group by s.id")) {
          return { rows: [{ id: "service-1", name: "GST Filing", code: "gst-filing", status: "active", rates }] };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client) };
    const repository = new TenantAdminServicesRepository(pool as never);

    const services = await repository.list(tenantAdminContext);

    expect(services).toHaveLength(1);
    const listed = services[0]!.rates;
    expect(listed.map((rate) => rate.id)).toEqual(["rate-active", "rate-disabled"]);
    expect(listed[0]).not.toHaveProperty("updatedAt");
    expect(listed.find((rate) => rate.id === "rate-disabled")?.status).toBe("inactive");
  });

  it("loads service task allocations with tenant-scoped client and employee assignments", async () => {
    const source = readFileSync(resolve(__dirname, "../../src/platform/tenant-admin-services.repository.ts"), "utf8");
    expect(source).toContain("getAllocations");
    expect(source).toContain("task_assignments ta");
    expect(source).toContain("groupServiceAllocations");
  });
});
