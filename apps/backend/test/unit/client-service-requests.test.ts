import { createHash } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ClientServiceRequestsRepository } from "../../src/platform/client-service-requests.repository";
import type { CreateClientServiceRequest } from "../../src/platform/client-service-requests.dto";

const tenantContext = {
  authUserId: "auth-admin",
  userId: "user-admin",
  tenantId: "tenant-1",
  membershipId: "member-admin",
  roles: ["TENANT_ADMIN"],
  permissions: ["client.update"],
  isPlatformAdmin: false,
  requestId: "req-admin",
};

const clientContext = {
  authUserId: "auth-client",
  userId: "user-client",
  tenantId: "tenant-1",
  membershipId: "member-client",
  clientAccountId: "account-1",
  roles: ["CLIENT_USER"],
  permissions: ["client.read.assigned"],
  isPlatformAdmin: false,
  requestId: "req-client",
};

const serviceId = "22222222-2222-4222-8222-222222222222";
const clientId = "44444444-4444-4444-8444-444444444444";
const requestId = "55555555-5555-4555-8555-555555555555";
const employeeId = "33333333-3333-4333-8333-333333333333";

const catalogueInput: CreateClientServiceRequest = {
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  kind: "catalogue",
  countryCode: "IN",
  currencyCode: "INR",
  title: "GST services",
  description: "Please allot GST filing for this quarter.",
  services: [
    {
      serviceId,
      tasks: [
        {
          taskType: "GSTR-1",
          title: "GSTR-1",
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

function requestRow(status: "submitted" | "accepted" | "rejected" = "submitted") {
  return {
    id: requestId,
    kind: "catalogue" as const,
    title: "GST services",
    description: "Please allot GST filing for this quarter.",
    status,
    client_id: clientId,
    client_name: "Acme Operations",
    country_code: "IN",
    currency_code: "INR",
    estimated_total: "9600",
    review_remarks: null,
    submitted_at: new Date("2026-08-16T10:00:00.000Z"),
    updated_at: new Date("2026-08-16T10:00:00.000Z"),
    reviewed_at: status === "submitted" ? null : new Date("2026-08-16T11:00:00.000Z"),
    snapshot: {
      version: 1,
      kind: "catalogue",
      services: [
        {
          serviceId,
          serviceName: "GST",
          estimatedTotal: 9600,
          tasks: catalogueInput.services[0]!.tasks,
        },
      ],
    },
    request_fingerprint: "same",
  };
}

function createRepository(query: (sql: string, values?: readonly unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>) {
  const client = {
    query: vi.fn(async (sql: string, values: readonly unknown[] = []) => query(sql, values)),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => client) };
  const activation = {
    activateInTransaction: vi.fn(async () => ({
      clientId,
      replayed: false,
      estimatedTotal: 9600,
      currencyCode: "INR",
      services: [
        {
          engagementId: "eng-1",
          serviceId,
          serviceName: "GST",
          assignedEmployeeId: employeeId,
          assignedEmployeeName: "Demo",
          taskCount: 12,
          estimatedTotal: 9600,
          alreadyActive: false,
        },
      ],
    })),
  };
  const repository = new ClientServiceRequestsRepository(
    pool as never,
    { loadBlueprint: vi.fn() } as never,
    activation as never,
  );
  return { repository, client, activation };
}

describe("ClientServiceRequestsRepository", () => {
  it("creates a catalogue request from the authenticated client without generating tasks", async () => {
    const { repository, client } = createRepository(async (sql) => {
      if (sql.includes("from public.client_portal_accounts")) {
        return { rows: [{ client_id: clientId }], rowCount: 1 };
      }
      if (sql.includes("csr.idempotency_key")) return { rows: [], rowCount: 0 };
      if (sql.includes("from public.engagements")) return { rows: [], rowCount: 0 };
      if (sql.includes("csr.status = 'submitted'")) return { rows: [], rowCount: 0 };
      if (sql.includes("from public.services") && sql.includes("status = 'active'")) {
        return { rows: [{ id: serviceId, name: "GST", code: "gst" }], rowCount: 1 };
      }
      if (sql.includes("insert into public.client_service_requests")) {
        return { rows: [{ id: requestId }], rowCount: 1 };
      }
      if (sql.includes("from public.client_service_requests csr") && sql.includes("csr.id = $2")) {
        return { rows: [requestRow()], rowCount: 1 };
      }
      if (sql.includes("from public.client_service_request_items")) {
        return {
          rows: [
            {
              service_id: serviceId,
              service_name: "GST",
              assigned_employee_id: null,
              task_snapshot: { tasks: catalogueInput.services[0]!.tasks },
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const created = await repository.create(clientContext, catalogueInput);

    expect(created.clientId).toBe(clientId);
    expect(created.status).toBe("submitted");
    expect(client.query.mock.calls.some((call) => String(call[0]).includes("insert into public.tasks"))).toBe(false);
    expect(client.query.mock.calls.some((call) => String(call[0]).includes("insert into public.client_service_requests"))).toBe(true);
    const insertValues = client.query.mock.calls.find((call) => String(call[0]).includes("insert into public.client_service_requests"))?.[1];
    expect(insertValues?.[1]).toBe(clientId);
    expect(insertValues?.[4]).toBe("Please allot GST filing for this quarter.");
    const notifySql = String(
      client.query.mock.calls.find((call) => String(call[0]).includes("CLIENT_REQUEST_RECEIVED"))?.[0] ?? "",
    );
    expect(notifySql).toContain("$6::text");
  });

  it("replays the same idempotency key without inserting another request", async () => {
    const { repository, client } = createRepository(async (sql) => {
      if (sql.includes("from public.client_portal_accounts")) {
        return { rows: [{ client_id: clientId }], rowCount: 1 };
      }
      if (sql.includes("csr.idempotency_key")) {
        return { rows: [{ ...requestRow(), request_fingerprint: fingerprintFor(catalogueInput) }], rowCount: 1 };
      }
      if (sql.includes("from public.client_service_request_items")) {
        return {
          rows: [
            {
              service_id: serviceId,
              service_name: "GST",
              assigned_employee_id: null,
              task_snapshot: { tasks: catalogueInput.services[0]!.tasks },
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const created = await repository.create(clientContext, catalogueInput);
    expect(created.replayed).toBe(true);
    expect(client.query.mock.calls.some((call) => String(call[0]).includes("insert into public.client_service_requests"))).toBe(false);
  });

  it("rejects a catalogue request for a service that is already active", async () => {
    const { repository } = createRepository(async (sql) => {
      if (sql.includes("from public.client_portal_accounts")) {
        return { rows: [{ client_id: clientId }], rowCount: 1 };
      }
      if (sql.includes("csr.idempotency_key")) return { rows: [], rowCount: 0 };
      if (sql.includes("from public.engagements")) {
        return { rows: [{ service_id: serviceId }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(repository.create(clientContext, catalogueInput)).rejects.toBeInstanceOf(ConflictException);
  });

  it("accepts a catalogue request by reusing activateInTransaction", async () => {
    const { repository, activation } = createRepository(async (sql) => {
      if (sql.includes("for update of csr")) {
        return { rows: [requestRow("submitted")], rowCount: 1 };
      }
      if (sql.includes("from public.client_service_requests csr") && sql.includes("csr.id = $2")) {
        return { rows: [requestRow("accepted")], rowCount: 1 };
      }
      if (sql.includes("from public.client_service_request_items")) {
        return {
          rows: [
            {
              service_id: serviceId,
              service_name: "GST",
              assigned_employee_id: employeeId,
              task_snapshot: { tasks: catalogueInput.services[0]!.tasks },
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const accepted = await repository.accept(tenantContext, requestId, {
      assignments: [{ serviceId, assignedEmployeeId: employeeId }],
    });

    expect(activation.activateInTransaction).toHaveBeenCalledTimes(1);
    expect(accepted.activatedServices?.[0]?.taskCount).toBe(12);
    expect(accepted.status).toBe("accepted");
  });

  it("accepts a custom request without calling activate", async () => {
    const customRow = {
      ...requestRow("submitted"),
      kind: "custom" as const,
      title: "Need ROC filing",
      snapshot: { version: 1, kind: "custom", services: [] },
    };
    const { repository, activation } = createRepository(async (sql) => {
      if (sql.includes("for update of csr")) {
        return { rows: [customRow], rowCount: 1 };
      }
      if (sql.includes("from public.client_service_requests csr") && sql.includes("csr.id = $2")) {
        return { rows: [{ ...customRow, status: "accepted" }], rowCount: 1 };
      }
      if (sql.includes("from public.client_service_request_items")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    });

    const accepted = await repository.accept(tenantContext, requestId, { assignments: [] });
    expect(activation.activateInTransaction).not.toHaveBeenCalled();
    expect(accepted.status).toBe("accepted");
  });

  it("lists tenant requests with client, employee, task name and request-content filters", async () => {
    const queries: string[] = [];
    const params: unknown[][] = [];
    const { repository } = createRepository(async (sql, values = []) => {
      queries.push(sql);
      params.push([...values]);
      if (sql.includes("from public.client_service_requests csr") && sql.includes("csr.tenant_id = $1")) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    await repository.listForTenant(tenantContext, {
      status: "submitted",
      clientId,
      employeeId,
      taskName: "GSTR-1",
      search: "GST services",
    });

    const listIndex = queries.findIndex(
      (sql) =>
        sql.includes("from public.client_service_requests csr") &&
        sql.includes("assigned.assigned_employee_id = $4::uuid"),
    );
    expect(listIndex).toBeGreaterThanOrEqual(0);
    const sql = queries[listIndex] ?? "";
    expect(sql).toContain("csr.tenant_id = $1");
    expect(sql).toContain("csr.client_id = $2::uuid");
    expect(sql).toContain("task->>'taskType'");
    expect(sql).toContain("csr.title ilike $6");
    expect(sql).toContain("csr.description ilike $6");
    expect(params[listIndex]).toEqual([
      "tenant-1",
      clientId,
      "submitted",
      employeeId,
      "%GSTR-1%",
      "%GST services%",
    ]);
  });
});

function fingerprintFor(input: CreateClientServiceRequest): string {
  const canonical = {
    clientId,
    kind: input.kind,
    countryCode: input.countryCode,
    currencyCode: input.currencyCode,
    title: input.title ?? "",
    description: input.description ?? "",
    services: [...input.services]
      .map((service) => ({
        serviceId: service.serviceId,
        tasks: [...service.tasks]
          .filter((task) => task.enabled !== false)
          .map((task) => ({
            taskType: task.taskType,
            title: task.title ?? "",
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
