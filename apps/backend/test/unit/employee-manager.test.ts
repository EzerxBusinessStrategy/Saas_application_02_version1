import { describe, expect, it, vi } from "vitest";
import { EmployeeManagerService } from "../../src/platform/employee-manager.service";
import { TenantAdminTasksRepository } from "../../src/platform/tenant-admin-tasks.repository";

describe("EmployeeManagerService", () => {
  it("lets an authorised manager complete a shared review and unlock invoice billing", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const client = {
      query: vi.fn(async (sqlText: string, values: readonly unknown[] = []) => {
        calls.push({ sql: sqlText, values });
        if (sqlText.includes("from public.task_submissions ts")) {
          return { rows: [{ id: "submission-1", employee_id: "employee-1" }], rowCount: 1 };
        }
        if (sqlText.includes("select title from public.tasks")) {
          return { rows: [{ title: "GST filing" }], rowCount: 1 };
        }
        if (sqlText.includes("update public.billable_task_entries")) {
          return { rows: [{ id: "entry-1" }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const service = new EmployeeManagerService(null, {} as TenantAdminTasksRepository);
    const serviceForTest = service as unknown as {
      withContext(context: unknown, work: (transactionClient: typeof client) => Promise<unknown>): Promise<unknown>;
    };
    serviceForTest.withContext = async (_context, work) => work(client);

    await service.decideReview(
      {
        requestId: "request-1",
        authUserId: "auth-user-1",
        userId: "user-1",
        tenantId: "tenant-1",
        membershipId: "manager-membership-1",
        employeeId: "manager-employee-1",
        roles: ["EMPLOYEE", "MANAGER"],
        permissions: [],
        isPlatformAdmin: false,
      },
      "task-1",
      { decision: "approve", remarks: "" },
    );

    expect(
      calls.find((call) => call.sql.includes("update public.task_submissions"))?.values,
    ).toEqual(["tenant-1", "submission-1", "manager_approved"]);
    expect(
      calls.find((call) => call.sql.includes("update public.tasks set status"))?.values,
    ).toEqual(["tenant-1", "task-1", "completed", "ready_for_billing", "manager-membership-1"]);
    expect(calls.find((call) => call.sql.includes("insert into public.approvals"))?.sql).toContain("'manager_review'");
    const notificationValues = calls.find((call) => call.sql.includes("insert into public.notifications"))?.values;
    expect(notificationValues).toContain("INVOICE_READY_TO_GENERATE");
    expect(notificationValues).toContain("invoice-ready:task-1");
  });
});
