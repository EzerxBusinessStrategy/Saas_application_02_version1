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
