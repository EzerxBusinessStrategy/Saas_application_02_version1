import { describe, expect, it, vi } from "vitest";
import { EmployeeDashboardRepository } from "../../src/platform/employee-dashboard.repository";

describe("EmployeeDashboardRepository", () => {
  it("includes active assignments with a future due date in the dashboard query", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };
    const repository = new EmployeeDashboardRepository(null);
    const getAssignedTasks = (
      repository as unknown as {
        getAssignedTasks(
          databaseClient: typeof client,
          context: { tenantId: string; membershipId: string; employeeId: string },
        ): Promise<readonly unknown[]>;
      }
    ).getAssignedTasks.bind(repository);

    await getAssignedTasks(client, {
      tenantId: "tenant-1",
      membershipId: "membership-1",
      employeeId: "employee-1",
    });

    const sql = client.query.mock.calls[0]?.[0] as string;
    expect(sql).toContain("and ta.status = 'active'");
    expect(sql).not.toContain("or at.planned_due_at::date = current_date");
    expect(sql).not.toContain("where at.status = 'returned'");
  });
});
