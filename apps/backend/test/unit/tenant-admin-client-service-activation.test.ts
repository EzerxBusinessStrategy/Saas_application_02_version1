import { createHash } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { TenantAdminClientServiceActivationRepository } from "../../src/platform/tenant-admin-client-service-activation.repository";
import type { ActivateClientServicesRequest } from "../../src/platform/tenant-admin-client-service-activation.dto";

const context = {
  authUserId: "auth-user-1",
  userId: "user-1",
  tenantId: "tenant-1",
  membershipId: "member-1",
  roles: ["TENANT_ADMIN"],
  permissions: ["client.update"],
  isPlatformAdmin: false,
  requestId: "req-1",
};

const input: ActivateClientServicesRequest = {
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  countryCode: "IN",
  currencyCode: "INR",
  services: [
    {
      serviceId: "22222222-2222-4222-8222-222222222222",
      assignedEmployeeId: "33333333-3333-4333-8333-333333333333",
      tasks: [
        {
          taskType: "GSTR-1",
          frequency: "monthly",
          dueRule: { type: "fixed_day_of_month", day: 11 },
          unitType: "per_task",
          rateAmount: 800,
          taxCode: "",
          enabled: true,
        },
      ],
    },
  ],
};

function fingerprint(clientId: string, request: ActivateClientServicesRequest): string {
  const canonical = {
    clientId,
    countryCode: request.countryCode,
    currencyCode: request.currencyCode,
    services: [...request.services]
      .map((service) => ({
        serviceId: service.serviceId,
        assignedEmployeeId: service.assignedEmployeeId,
        tasks: [...service.tasks]
          .filter((task) => task.enabled !== false)
          .map((task) => ({
            taskType: task.taskType,
            frequency: task.frequency,
            dueRule: task.dueRule,
            rateAmount: task.rateAmount,
            unitType: task.unitType,
          }))
          .sort((left, right) => left.taskType.localeCompare(right.taskType)),
      }))
      .sort((left, right) => left.serviceId.localeCompare(right.serviceId)),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function createRepository(query: (sql: string, values?: readonly unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>) {
  const client = {
    query: vi.fn(async (sql: string, values: readonly unknown[] = []) => query(sql, values)),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => client) };
  const repository = new TenantAdminClientServiceActivationRepository(pool as never, {} as never);
  return { repository, client };
}

describe("TenantAdminClientServiceActivationRepository", () => {
  it("replays the same idempotency key without creating more tasks", async () => {
    const clientId = "44444444-4444-4444-8444-444444444444";
    const { repository, client } = createRepository(async (sql) => {
      if (sql.includes("from public.clients")) return { rows: [{ name: "ABC Pvt Ltd" }], rowCount: 1 };
      if (sql.includes("esc.idempotency_key")) {
        return {
          rows: [
            {
              engagement_id: "eng-1",
              service_id: input.services[0]!.serviceId,
              service_name: "GST Compliance",
              assigned_employee_id: input.services[0]!.assignedEmployeeId,
              assigned_employee_name: "Rahul Sharma",
              estimated_total: "9600",
              currency_code: "INR",
              request_fingerprint: fingerprint(clientId, input),
              task_count: "5",
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const result = await repository.activate(context, clientId, input);

    expect(result.replayed).toBe(true);
    expect(result.services).toHaveLength(1);
    expect(result.services[0]?.taskCount).toBe(5);
    expect(client.query.mock.calls.some((call) => String(call[0]).includes("insert into public.tasks"))).toBe(false);
    expect(client.query.mock.calls.some((call) => String(call[0]).includes("insert into public.engagements"))).toBe(false);
  });

  it("rejects a reused idempotency key with a different request body", async () => {
    const { repository } = createRepository(async (sql) => {
      if (sql.includes("from public.clients")) return { rows: [{ name: "ABC Pvt Ltd" }], rowCount: 1 };
      if (sql.includes("esc.idempotency_key")) {
        return {
          rows: [
            {
              engagement_id: "eng-1",
              service_id: input.services[0]!.serviceId,
              service_name: "GST Compliance",
              assigned_employee_id: input.services[0]!.assignedEmployeeId,
              assigned_employee_name: "Rahul Sharma",
              estimated_total: "9600",
              currency_code: "INR",
              request_fingerprint: "different-fingerprint",
              task_count: "5",
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(repository.activate(context, "44444444-4444-4444-8444-444444444444", input)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("scopes activation lookups to the trusted tenant and client", async () => {
    const { repository, client } = createRepository(async (sql) => {
      if (sql.includes("from public.clients")) return { rows: [{ name: "ABC Pvt Ltd" }], rowCount: 1 };
      if (sql.includes("esc.idempotency_key")) {
        return {
          rows: [
            {
              engagement_id: "eng-1",
              service_id: input.services[0]!.serviceId,
              service_name: "GST Compliance",
              assigned_employee_id: input.services[0]!.assignedEmployeeId,
              assigned_employee_name: "Rahul Sharma",
              estimated_total: "9600",
              currency_code: "INR",
              request_fingerprint: fingerprint("44444444-4444-4444-8444-444444444444", input),
              task_count: "5",
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await repository.activate(context, "44444444-4444-4444-8444-444444444444", input);
    const sql = client.query.mock.calls.map((call) => String(call[0])).join("\n");
    expect(sql).toContain("begin");
    expect(sql).toContain("e.client_id = $3");
    expect(sql).toContain("esc.tenant_id = $1");
  });
});
