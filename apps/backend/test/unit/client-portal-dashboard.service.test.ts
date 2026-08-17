import { expect, test, vi } from "vitest";
import type { RequestContext } from "../../src/auth/request-context";
import { ClientPortalDashboardService } from "../../src/platform/client-portal-dashboard.service";
import type { ClientPortalDashboardRepository } from "../../src/platform/client-portal-dashboard.repository";

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

test("passes the selected date range to the tenant-scoped dashboard query and returns it", async () => {
  const read = vi.fn().mockResolvedValue({
      summary: {
        active_services: "0",
        pending_tasks: "0",
        completed_tasks: "0",
        open_requests: "0",
        outstanding_invoices: "0",
        currency_code: "INR",
      },
    services: [],
    requests: [],
    invoices: [],
  });
  const service = new ClientPortalDashboardService({
    read,
  } as unknown as ClientPortalDashboardRepository);

  const result = await service.read(clientContext, { from: "2026-09-01", to: "2026-09-30" });

  expect(read).toHaveBeenCalledWith(clientContext, {
    from: "2026-09-01",
    to: "2026-09-30",
    source: "query",
  });
  expect(result.period).toEqual({
    from: "2026-09-01",
    to: "2026-09-30",
    source: "query",
  });
  expect(result.pendingTasks).toBe(0);
  expect(result.completedTasks).toBe(0);
});

test("computes the service discount from the tenant-provided percent, not invoice discounts", async () => {
  const read = vi.fn().mockResolvedValue({
    summary: {
      active_services: "1",
      pending_tasks: "8",
      completed_tasks: "0",
      open_requests: "0",
      outstanding_invoices: "0",
      currency_code: "INR",
    },
    services: [
      {
        id: "service-1",
        engagement_name: "Taxation",
        service_name: "Taxation",
        status: "active",
        next_due_at: null,
        open_tasks: "8",
        completed_tasks: "0",
        total_tasks: "8",
        assigned_employee_name: "Demo",
        estimated_total: "800000",
        discount_percent: "2.50",
        task_total: "800000",
        currency_code: "INR",
        tasks: Array.from({ length: 8 }, (_, index) => ({
          id: `task-${index}`,
          title: `tax (${index})`,
          status: "assigned",
          plannedDueAt: null,
          rateAmount: 100_000,
          currencyCode: "INR",
        })),
      },
    ],
    requests: [],
    invoices: [],
  });
  const service = new ClientPortalDashboardService({
    read,
  } as unknown as ClientPortalDashboardRepository);

  const result = await service.read(clientContext, {});

  const summarized = result.services[0]!;
  expect(summarized.taskTotal).toBe(800_000);
  expect(summarized.discountPercent).toBe(2.5);
  expect(summarized.discountAmount).toBe(20_000);
  expect(summarized.amountDue).toBe(780_000);
});

test("shows no discount when the tenant accepted without one", async () => {
  const read = vi.fn().mockResolvedValue({
    summary: {
      active_services: "1",
      pending_tasks: "1",
      completed_tasks: "0",
      open_requests: "0",
      outstanding_invoices: "0",
      currency_code: "INR",
    },
    services: [
      {
        id: "service-1",
        engagement_name: "Taxation",
        service_name: "Taxation",
        status: "active",
        next_due_at: null,
        open_tasks: "1",
        completed_tasks: "0",
        total_tasks: "1",
        assigned_employee_name: "Demo",
        estimated_total: "100000",
        discount_percent: "0",
        task_total: "100000",
        currency_code: "INR",
        tasks: [
          {
            id: "task-1",
            title: "tax (2026-09)",
            status: "assigned",
            plannedDueAt: null,
            rateAmount: 100_000,
            currencyCode: "INR",
          },
        ],
      },
    ],
    requests: [],
    invoices: [],
  });
  const service = new ClientPortalDashboardService({
    read,
  } as unknown as ClientPortalDashboardRepository);

  const result = await service.read(clientContext, {});

  const summarized = result.services[0]!;
  expect(summarized.discountPercent).toBe(0);
  expect(summarized.discountAmount).toBe(0);
  expect(summarized.amountDue).toBe(100_000);
});
