import { describe, expect, it, vi } from "vitest";
import { publishTaskWorkflowNotification, resumeReturnedTaskTimer } from "../../src/platform/task-workflow-support";

type QueryResult = { rowCount?: number; rows: Array<Record<string, unknown>> };
type FakeClient = { query: ReturnType<typeof vi.fn> };

function queryResult(rows: Array<Record<string, unknown>> = [], rowCount = rows.length): QueryResult {
  return { rows, rowCount };
}

describe("task workflow notification persistence", () => {
  it("writes notification recipients and one outbox event through a single bulk SQL statement", async () => {
    const client: FakeClient = { query: vi.fn(async () => queryResult()) };

    await publishTaskWorkflowNotification(client as never, {
      tenantId: "tenant-1",
      actorUserId: "actor-1",
      taskId: "task-1",
      employeeId: "employee-1",
      audience: "managers",
      type: "TASK_SUBMITTED_FOR_MANAGER_REVIEW",
      title: "Task ready for review",
      message: "Review the task.",
      actionUrl: "/employee/task-reviews",
      eventKey: "task-submitted-manager-review:task-1",
    });

    expect(client.query).toHaveBeenCalledTimes(1);
    const [sql, values] = client.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("insert into public.notification_recipients");
    expect(sql).toContain("insert into public.notification_outbox");
    expect(sql).toContain("employee_manager_assignments");
    expect(sql).toContain("on conflict (notification_id, recipient_user_id) do nothing");
    expect(values).toEqual([
      "tenant-1",
      "actor-1",
      "task-1",
      "employee-1",
      "TASK_SUBMITTED_FOR_MANAGER_REVIEW",
      "Task ready for review",
      "Review the task.",
      "/employee/task-reviews",
      "task-submitted-manager-review:task-1",
    ]);
  });

  it("uses an employee-only recipient query for returned-task notifications", async () => {
    const client: FakeClient = { query: vi.fn(async () => queryResult()) };

    await publishTaskWorkflowNotification(client as never, {
      tenantId: "tenant-1",
      actorUserId: "manager-user-1",
      taskId: "task-1",
      employeeId: "employee-1",
      audience: "employee",
      type: "TASK_RETURNED_BY_MANAGER",
      title: "Task returned",
      message: "Please correct the evidence.",
      actionUrl: "/employee/tasks?task=task-1",
      eventKey: "task-returned-by-manager:task-1",
    });

    const [sql] = client.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("where e.tenant_id = $1 and e.id = $4");
    expect(sql).not.toContain("from public.employee_manager_assignments ema");
  });
});

describe("returned task timer resumption", () => {
  it("does not start a second timer when the employee already has an active segment", async () => {
    const client: FakeClient = {
      query: vi.fn(async (_sql: string, _values: unknown[]) => queryResult([], 1)),
    };

    await expect(resumeReturnedTaskTimer(client as never, "tenant-1", "task-1", "employee-1")).resolves.toBe(false);
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query.mock.calls[1]?.[0]).toContain("ended_at is null");
  });

  it("creates exactly one session and open segment when no active timer exists", async () => {
    const responses = [
      queryResult(),
      queryResult(),
      queryResult([{ id: "session-1" }]),
      queryResult(),
    ];
    const client: FakeClient = { query: vi.fn(async () => responses.shift() ?? queryResult()) };

    await expect(resumeReturnedTaskTimer(client as never, "tenant-1", "task-1", "employee-1")).resolves.toBe(true);
    expect(client.query).toHaveBeenCalledTimes(4);
    expect(client.query.mock.calls[2]?.[0]).toContain("task_work_sessions");
    expect(client.query.mock.calls[3]?.[0]).toContain("task_work_segments");
    expect(client.query.mock.calls[3]?.[1]).toEqual(["tenant-1", "task-1", "employee-1", "session-1"]);
  });

  it("does not create a segment when session creation returns no id", async () => {
    const responses = [queryResult(), queryResult(), queryResult()];
    const client: FakeClient = { query: vi.fn(async () => responses.shift() ?? queryResult()) };

    await expect(resumeReturnedTaskTimer(client as never, "tenant-1", "task-1", "employee-1")).resolves.toBe(false);
    expect(client.query).toHaveBeenCalledTimes(3);
  });
});
