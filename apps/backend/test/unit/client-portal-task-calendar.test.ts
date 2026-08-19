import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, vi } from "vitest";
import type { RequestContext } from "../../src/auth/request-context";
import { ClientPortalTaskCalendarService } from "../../src/platform/client-portal-task-calendar.service";
import type { ClientPortalTaskCalendarRepository } from "../../src/platform/client-portal-task-calendar.repository";

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
} as RequestContext;

test("client task calendar queries use the authenticated account's business client scope", () => {
  const source = readFileSync(
    resolve(__dirname, "../../src/platform/client-portal-task-calendar.repository.ts"),
    "utf8",
  );

  expect(source).toContain("resolveClientPortalScope");
  expect(source).toContain("scope.clientId");
  expect(source).toContain("t.planned_due_at is not null");
  expect(source).toContain("ta.status not in ('removed', 'cancelled')");
  expect(source).toContain("left join public.tenant_memberships tm");
  expect(source).not.toContain("context.clientAccountId");
});

test("maps calendar tasks with assignees for the client portal response", async () => {
  const list = vi.fn().mockResolvedValue({
    timezone: "Asia/Kolkata",
    tasks: [
      {
        id: "task-1",
        title: "tax",
        status: "completed",
        plannedDueAt: new Date("2026-08-28T10:00:00.000Z"),
        serviceName: "GST",
        serviceId: "svc-1",
        priority: "normal",
        frequency: "monthly",
        assignees: [{ id: "employee-1", name: "Rahul" }],
      },
    ],
  });
  const service = new ClientPortalTaskCalendarService({
    list,
  } as unknown as ClientPortalTaskCalendarRepository);

  const result = await service.list(clientContext, { from: "2026-08-01", to: "2026-08-31" });

  expect(list).toHaveBeenCalledWith(clientContext, { from: "2026-08-01", to: "2026-08-31" });
  expect(result.total).toBe(1);
  expect(result.tasks[0]).toMatchObject({
    title: "tax",
    serviceName: "GST",
    frequency: "monthly",
    assignees: [{ name: "Rahul" }],
  });
});
