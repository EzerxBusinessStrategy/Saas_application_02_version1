import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, vi } from "vitest";
import type { RequestContext } from "../../src/auth/request-context";
import { TaskFeedbackService } from "../../src/platform/task-feedback.service";
import type { TaskFeedbackRepository } from "../../src/platform/task-feedback.repository";

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

const employeeContext = {
  authUserId: "auth-employee",
  userId: "user-employee",
  tenantId: "tenant-1",
  membershipId: "member-employee",
  roles: ["EMPLOYEE"],
  permissions: ["task.read.assigned"],
  isPlatformAdmin: false,
  requestId: "req-employee",
} as RequestContext;

test("task feedback repository scopes client queries to authenticated client", () => {
  const source = readFileSync(
    resolve(__dirname, "../../src/platform/task-feedback.repository.ts"),
    "utf8",
  );

  expect(source).toContain("resolveClientPortalScope");
  expect(source).toContain("scope.clientId");
  expect(source).toContain("client_task_feedback");
  expect(source).toContain("ctf.employee_id = $");
  expect(source).toContain("ctf.client_id = $");
  expect(source).toContain("coalesce(ctf.status, 'submitted') = $");
  expect(source).toContain("ctf.created_at >=");
  expect(source).toContain("expire_unanswered_client_task_feedback");
  expect(source).toContain("on conflict (tenant_id, idempotency_key) do nothing");
  expect(source).toContain("submitted_by_user_id, idempotency_key");
  expect(source).not.toContain("idempotency_key, status");
});

test("employee feedback listing resolves employee from membership, not request body", () => {
  const source = readFileSync(
    resolve(__dirname, "../../src/platform/task-feedback.repository.ts"),
    "utf8",
  );

  expect(source).toContain("e.membership_id = $2");
  expect(source).toContain("listForEmployee");
});

test("submit validates ratings between 1 and 5", async () => {
  const submitForClient = vi.fn().mockResolvedValue({
    id: "feedback-1",
    taskId: "task-1",
    taskTitle: "tax",
    invoiceId: "invoice-1",
    employeeId: "employee-1",
    employeeName: "Rahul",
    taskRating: 5,
    employeeRating: 4,
    replayed: false,
    createdAt: "2026-08-17T12:00:00.000Z",
  });
  const service = new TaskFeedbackService({
    submitForClient,
  } as unknown as TaskFeedbackRepository);

  const result = await service.submit(clientContext, {
    taskId: "task-1",
    invoiceId: "invoice-1",
    taskRating: 5,
    employeeRating: 4,
    idempotencyKey: "idem-1",
  });

  expect(submitForClient).toHaveBeenCalled();
  expect(result.taskRating).toBe(5);
  expect(result.employeeRating).toBe(4);
});

test("employee log uses employee context only", async () => {
  const listForEmployee = vi.fn().mockResolvedValue({ items: [], total: 0 });
  const service = new TaskFeedbackService({
    listForEmployee,
  } as unknown as TaskFeedbackRepository);

  await service.listEmployeeLog(employeeContext);
  expect(listForEmployee).toHaveBeenCalled();
});
