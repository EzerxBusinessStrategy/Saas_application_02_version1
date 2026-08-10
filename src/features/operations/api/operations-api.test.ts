import { expect, test } from "vitest";
import {
  assignSupportTicket,
  createSupportTicket,
  isGamificationVisible,
  listSupportTickets,
  listOperationalTasks,
  progressPercent,
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

test("shares client support tickets with the assigned manager and tenant admin", async () => {
  const ticket = await createSupportTicket({
    service: "GST Filing",
    category: "document-evidence",
    subject: "Need the authorised document list",
    description: "Please confirm which source documents are still required for this filing.",
    businessImpact: "high",
    affectedUsers: 2,
    affectedUrl: "https://clientportal.example/gst/filing",
    preferredContactMethod: "email",
    notifyByEmail: true,
    notifyInApp: true,
    attachments: [],
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

test("rejects a duplicate active client support request", async () => {
  const input = {
    service: "GST Filing",
    category: "filing-submission",
    subject: "Unable to download the GST filing report",
    description: "The approved GST filing report download does not start for our client contact.",
    businessImpact: "medium",
    affectedUsers: 1,
    preferredContactMethod: "email",
    notifyByEmail: true,
    notifyInApp: true,
    attachments: [],
  };
  await createSupportTicket(input);
  await expect(createSupportTicket(input)).rejects.toThrow("similar active request");
});
