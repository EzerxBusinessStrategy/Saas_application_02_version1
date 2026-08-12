import { describe, expect, it, vi } from "vitest";
import { EmployeeTasksRepository } from "../../src/platform/employee-tasks.repository";

describe("EmployeeTasksRepository", () => {
  it("creates a new manager-review notification for every task submission", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const client = {
      query: vi.fn(async (sqlText: string, values: readonly unknown[] = []) => {
        calls.push({ sql: sqlText, values });
        if (sqlText.includes("insert into public.task_submissions")) {
          return { rows: [{ id: "submission-2" }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const repository = new EmployeeTasksRepository(null);
    const repositoryForTest = repository as unknown as {
      withEmployee(context: unknown, work: (transactionClient: typeof client, employee: { id: string; name: string }) => Promise<unknown>): Promise<unknown>;
      lockEmployee(): Promise<void>;
      assertOwnedTask(): Promise<void>;
      findActiveSegment(): Promise<null>;
      audit(): Promise<void>;
      workedSeconds(): Promise<number>;
      getTask(): Promise<Record<string, unknown>>;
    };
    repositoryForTest.withEmployee = async (_context, work) => work(client, { id: "employee-1", name: "Employee" });
    repositoryForTest.lockEmployee = async () => undefined;
    repositoryForTest.assertOwnedTask = async () => undefined;
    repositoryForTest.findActiveSegment = async () => null;
    repositoryForTest.audit = async () => undefined;
    repositoryForTest.workedSeconds = async () => 0;
    repositoryForTest.getTask = async () => ({ id: "task-1", title: "GST filing" });

    await repository.submit(
      {
        requestId: "request-1",
        authUserId: "auth-user-1",
        userId: "user-1",
        tenantId: "tenant-1",
        membershipId: "employee-membership-1",
        employeeId: "employee-1",
        roles: ["EMPLOYEE"],
        permissions: [],
        isPlatformAdmin: false,
      },
      "task-1",
      "Ready for review.",
    );

    expect(
      calls.find((call) => call.sql.includes("update public.task_assignments"))?.values,
    ).toEqual(["tenant-1", "task-1", "employee-1"]);
    expect(
      calls.find((call) => call.sql.includes("update public.tasks set status = 'manager_review'"))?.values,
    ).toEqual(["tenant-1", "task-1", "employee-membership-1"]);
    expect(
      calls.find((call) => call.sql.includes("insert into public.notifications"))?.values,
    ).toContain("task-submitted-manager-review:submission-2");
  });
});
