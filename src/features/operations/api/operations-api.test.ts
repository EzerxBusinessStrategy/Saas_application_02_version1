import { expect, test } from "vitest";
import {
  assignSupportTicket,
  createSharedDocument,
  createSharedInvoice,
  createSupportTicket,
  decideEmployeeTaskReview,
  decideTenantTaskApproval,
  getOperationalWorkspace,
  isGamificationVisible,
  listSupportTickets,
  listOperationalTasks,
  listSharedDocuments,
  listSharedInvoices,
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

test("moves employee work through manager review and tenant approval", async () => {
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
    status: "review",
    reviewStatus: "approved",
    approvalStatus: "pending",
  });
  await expect(decideTenantTaskApproval("TASK-1044", "approve")).resolves.toMatchObject({
    status: "done",
    approvalStatus: "approved",
  });
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

test("reflects an admin-shared document only in the selected recipient portal", async () => {
  const document = await createSharedDocument("admin", {
    clientId: "northstar",
    title: "Employee-only evidence",
    fileName: "employee-evidence.pdf",
    fileType: "PDF",
    sizeBytes: 1200,
    category: "evidence",
    recipientEmployeeIds: ["emp-riley"],
  });
  await expect(listSharedDocuments("employee")).resolves.toContainEqual(
    expect.objectContaining({ id: document.id }),
  );
  await expect(listSharedDocuments("client")).resolves.not.toContainEqual(
    expect.objectContaining({ id: document.id }),
  );
});

test("keeps employee and manager sharing within their authorised frontend scope", async () => {
  await expect(
    createSharedDocument("employee", {
      clientId: "northstar",
      title: "Unsafe client share",
      fileName: "unsafe.pdf",
      fileType: "PDF",
      sizeBytes: 1200,
      category: "employee-submission",
      recipientManagerIds: ["mgr-avery"],
      recipientClientIds: ["northstar"],
    }),
  ).rejects.toThrow("only with their manager");
  await expect(
    createSharedDocument("manager", {
      clientId: "bayside",
      title: "Out-of-scope client",
      fileName: "scope.pdf",
      fileType: "PDF",
      sizeBytes: 1200,
      category: "supporting",
      recipientClientIds: ["bayside"],
    }),
  ).rejects.toThrow("outside your authorised scope");
});

test("shares client uploads with manager and tenant administration but not employees", async () => {
  const document = await createSharedDocument("client", {
    clientId: "northstar",
    title: "Client source document",
    fileName: "client-source.pdf",
    fileType: "PDF",
    sizeBytes: 1200,
    category: "client-upload",
  });
  await expect(listSharedDocuments("manager")).resolves.toContainEqual(
    expect.objectContaining({ id: document.id }),
  );
  await expect(listSharedDocuments("admin")).resolves.toContainEqual(
    expect.objectContaining({ id: document.id }),
  );
  await expect(listSharedDocuments("employee")).resolves.not.toContainEqual(
    expect.objectContaining({ id: document.id }),
  );
});

test("keeps internal manager invoices out of the client portal", async () => {
  const invoice = await createSharedInvoice("manager", {
    clientId: "northstar",
    invoiceNumber: "INT-2026-1",
    issuedOn: "2026-07-23",
    dueOn: "2026-08-23",
    amount: 2500,
    visibility: "internal",
    fileName: "internal-invoice.pdf",
    fileType: "PDF",
    sizeBytes: 1200,
  });
  await expect(listSharedInvoices("manager")).resolves.toContainEqual(
    expect.objectContaining({ id: invoice.id }),
  );
  await expect(listSharedInvoices("client")).resolves.not.toContainEqual(
    expect.objectContaining({ id: invoice.id }),
  );
});
