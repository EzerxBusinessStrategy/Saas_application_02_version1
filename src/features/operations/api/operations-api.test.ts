import { expect, test } from "vitest";
import {
  assignSupportTicket,
  createSupportTicket,
  decideEmployeeTaskReview,
  getOperationalWorkspace,
  isGamificationVisible,
  listSupportTickets,
  listOperationalTasks,
  progressPercent,
  startEmployeeTask,
  submitEmployeeTaskForReview,
  resolveSupportTicket,
  validateWorkLog,
} from "@/features/operations/api/operations-api";

test("limits manager, employee, and client task results to their assigned scope", async () => {
  await expect(listOperationalTasks("manager")).resolves.toHaveLength(3);
  await expect(listOperationalTasks("employee")).resolves.toHaveLength(2);
  await expect(listOperationalTasks("client")).resolves.toHaveLength(2);
});

test("validates a work log and excludes internal client data", async () => {
  await expect(
    validateWorkLog({
      taskId: "TASK-1042",
      date: "2026-07-21",
      durationMinutes: 60,
      description: "Reviewed source documents.",
    }),
  ).resolves.toMatchObject({ taskId: "TASK-1042" });
  const client = await getOperationalWorkspace("client");
  expect(
    client.documents.every((document) => document.visibility === "client"),
  ).toBe(true);
  expect(
    client.invoices.every((invoice) => invoice.client === "Northstar Labs"),
  ).toBe(true);
  const manager = await getOperationalWorkspace("manager");
  const managerClientIds = new Set(manager.tasks.map((task) => task.clientId));
  expect(
    manager.documents.every((document) =>
      managerClientIds.has(document.clientId),
    ),
  ).toBe(true);
  const employee = await getOperationalWorkspace("employee");
  const employeeClientIds = new Set(
    employee.tasks.map((task) => task.clientId),
  );
  expect(
    employee.documents.every((document) =>
      employeeClientIds.has(document.clientId),
    ),
  ).toBe(true);
});

test("filters task results and handles optional professional progress safely", async () => {
  await expect(
    listOperationalTasks("admin", { priority: "high" }),
  ).resolves.toHaveLength(2);
  expect(progressPercent(0, 4)).toBe(0);
  expect(progressPercent(4, 4)).toBe(100);
  expect(isGamificationVisible({ enabled: false, reducedMotion: true })).toBe(
    false,
  );
  expect(isGamificationVisible({ enabled: true, reducedMotion: true })).toBe(
    true,
  );
});

test("moves employee work through review, rejection, resubmission, and approval", async () => {
  await expect(startEmployeeTask("TASK-1044")).resolves.toMatchObject({
    status: "in-progress",
  });
  await expect(submitEmployeeTaskForReview("TASK-1044")).resolves.toMatchObject({
    status: "review",
    reviewStatus: "pending",
  });
  await expect(decideEmployeeTaskReview("TASK-1044", "reject")).resolves.toMatchObject({
    status: "rejected",
    reviewStatus: "changes-requested",
  });
  await expect(startEmployeeTask("TASK-1044")).resolves.toMatchObject({
    status: "in-progress",
  });
  await submitEmployeeTaskForReview("TASK-1044");
  await expect(decideEmployeeTaskReview("TASK-1044", "approve")).resolves.toMatchObject({
    status: "done",
    reviewStatus: "approved",
  });
});

test("shares client support tickets with the assigned manager and tenant admin", async () => {
  const ticket = await createSupportTicket({
    service: "GST Filing",
    category: "documents",
    subject: "Need the authorised document list",
    description: "Please confirm which source documents are still required for this filing.",
    priority: "high",
  });

  await expect(listSupportTickets("client")).resolves.toContainEqual(
    expect.objectContaining({ id: ticket.id }),
  );
  await expect(listSupportTickets("manager")).resolves.toContainEqual(
    expect.objectContaining({ id: ticket.id }),
  );
  await expect(listSupportTickets("admin")).resolves.toContainEqual(
    expect.objectContaining({ id: ticket.id }),
  );
  await expect(
    assignSupportTicket("manager", ticket.id, {
      id: "emp-riley",
      name: "Riley Shah",
    }),
  ).resolves.toMatchObject({ assignee: "Riley Shah", status: "assigned" });
  await expect(
    resolveSupportTicket(
      "admin",
      ticket.id,
      "The authorised document list has been shared with your client contact.",
    ),
  ).resolves.toMatchObject({ status: "resolved" });
});
