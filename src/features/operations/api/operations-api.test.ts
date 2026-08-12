import { afterEach, expect, test, vi } from "vitest";
import {
  assignSupportTicket,
  createSupportTicket,
  decideTenantTaskApproval,
  isGamificationVisible,
  listSupportTickets,
  listOperationalTasks,
  progressPercent,
  resolveSupportTicket,
  listTenantAdminEmployeeDirectory,
  validateWorkLog,
} from "@/features/operations/api/operations-api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("reads a populated Tenant Admin employee directory without serving a stale empty roster", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        employees: [{ id: "employee-1", name: "Aarav Mehta", employeeCode: "EMP-001", email: "aarav@example.test", isManager: false }],
        departments: [],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);

  await expect(listTenantAdminEmployeeDirectory()).resolves.toMatchObject({
    employees: [{ id: "employee-1", name: "Aarav Mehta" }],
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("confirms an initially empty employee directory before displaying it", async () => {
  vi.useFakeTimers();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ employees: [], departments: [] }), { status: 200 }),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          employees: [{ id: "employee-1", name: "Aarav Mehta", employeeCode: "EMP-001", email: "aarav@example.test", isManager: false }],
          departments: [],
        }),
        { status: 200 },
      ),
    );
  vi.stubGlobal("fetch", fetchMock);

  const directory = listTenantAdminEmployeeDirectory();
  await vi.advanceTimersByTimeAsync(250);

  await expect(directory).resolves.toMatchObject({ employees: [{ id: "employee-1" }] });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("sends Tenant Admin rework remarks with the approval decision", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        id: "task-1",
        title: "GST filing",
        description: null,
        clientId: "client-1",
        clientName: "ABC Pvt Ltd",
        serviceId: "service-1",
        serviceName: "GST Filing",
        workGroupId: null,
        workGroupName: null,
        priority: "high",
        status: "returned",
        slaStatus: "running",
        plannedDueAt: null,
        assigneeCount: 1,
        assignees: [{ id: "employee-1", name: "Rahul" }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);

  await decideTenantTaskApproval(
    "task-1",
    "return",
    "Correct the GST amount and attach the revised worksheet.",
  );

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/tenant-admin/tasks/task-1/approval",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        decision: "return",
        remarks: "Correct the GST amount and attach the revised worksheet.",
      }),
    }),
  );
});

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
