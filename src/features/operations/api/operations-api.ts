import { z } from "zod";
import {
  achievementProgress,
  achievements,
  clientRequests,
  deliverableReviews,
  gamificationPreferences,
  gamificationTenantPolicy,
  goalProgress,
  goals,
  invoices,
  milestones,
  onboardingSteps,
  operationalDocuments,
  operationalTasks,
  payments,
  recognitions,
  supportTickets,
  sharedDocuments,
  sharedInvoices,
  entities,
  streak,
  teamProgress,
  weeklyComparisons,
  workLogDays,
  workLogs,
} from "@/mocks/operations";
import {
  invoiceSchema,
  documentUploadInputSchema,
  invoiceUploadInputSchema,
  sharedDocumentSchema,
  sharedInvoiceSchema,
  gamificationPreferencesSchema,
  gamificationTenantPolicySchema,
  recognitionInputSchema,
  recognitionSchema,
  supportTicketInputSchema,
  supportTicketSchema,
  taskSchema,
  workLogConsistencySchema,
  workLogInputSchema,
  workLogSchema,
  type OperationalListRequest,
  type DocumentUploadInput,
  type InvoiceUploadInput,
  type OperationalTask,
  type SharedDocument,
  type SharedInvoice,
  type SupportTicket,
} from "@/types/operations";
import type { Workspace } from "@/types/domain";

export const progressPercent = (current: number, target: number) =>
  target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

export const isGamificationVisible = (preferences: {
  enabled: boolean;
  reducedMotion: boolean;
}) => preferences.enabled;

export function getWorkLogConsistency() {
  const days = workLogDays.map((day) => ({ ...day }));
  const scheduled = days.filter((day) => day.expected === "working");
  return workLogConsistencySchema.parse({
    timezone: sessionPolicy.timezone,
    scheduledDays: scheduled.length,
    completedDays: scheduled.filter((day) =>
      ["submitted", "reviewed", "complete"].includes(day.current),
    ).length,
    missingDays: scheduled.filter((day) => day.current === "missing").length,
    approvedLeaveDays: days.filter((day) => day.expected === "approved-leave")
      .length,
    holidayDays: days.filter((day) => day.expected === "holiday").length,
    rejectedDays: scheduled.filter((day) => day.current === "rejected").length,
    days,
  });
}

const taskListSchema = z.array(taskSchema);
const employeeId = "emp-riley";
const managerId = "mgr-avery";
const clientId = "northstar";
let sessionRecognitions = [...recognitions];
let sessionPreferences = { ...gamificationPreferences };
let sessionPolicy = { ...gamificationTenantPolicy };
let sessionDeliverables = [...deliverableReviews];
const sessionTaskOverrides = new Map<string, OperationalTask>();
let sessionSupportTickets = [...supportTickets];
const taskOverrideStorageKey = "operations:task-overrides";
const supportTicketStorageKey = "operations:support-tickets";
const documentStorageKey = "operations:shared-documents";
const invoiceStorageKey = "operations:shared-invoices";
let taskOverridesHydrated = false;
let supportTicketsHydrated = false;
let sessionDocuments = [...sharedDocuments];
let sessionInvoices = [...sharedInvoices];
let documentsHydrated = false;
let invoicesHydrated = false;

function hydrateTaskOverrides() {
  if (taskOverridesHydrated || typeof window === "undefined") return;
  taskOverridesHydrated = true;
  try {
    const storedOverrides = window.sessionStorage.getItem(
      taskOverrideStorageKey,
    );
    if (!storedOverrides) return;
    const parsedOverrides = taskListSchema.safeParse(
      JSON.parse(storedOverrides),
    );
    if (!parsedOverrides.success) return;
    parsedOverrides.data.forEach((task) => {
      sessionTaskOverrides.set(task.id, task);
    });
  } catch {
    // Session storage is an optional convenience for the frontend mock only.
  }
}

function persistTaskOverrides() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      taskOverrideStorageKey,
      JSON.stringify([...sessionTaskOverrides.values()]),
    );
  } catch {
    // The mock workflow remains available in memory if storage is unavailable.
  }
}

function currentSupportTickets() {
  if (!supportTicketsHydrated && typeof window !== "undefined") {
    supportTicketsHydrated = true;
    try {
      const storedTickets = window.localStorage.getItem(supportTicketStorageKey);
      if (storedTickets) {
        const parsedTickets = z.array(supportTicketSchema).safeParse(
          JSON.parse(storedTickets),
        );
        if (parsedTickets.success) sessionSupportTickets = parsedTickets.data;
      }
    } catch {
      // The typed in-memory tickets remain available when browser storage fails.
    }
  }
  return sessionSupportTickets;
}

function saveSupportTickets(tickets: SupportTicket[]) {
  sessionSupportTickets = tickets;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(supportTicketStorageKey, JSON.stringify(tickets));
  } catch {
    // The mock ticket queue remains available in memory when storage is unavailable.
  }
}

function scopedSupportTickets(workspace: Workspace) {
  const tickets = currentSupportTickets();
  if (workspace === "client")
    return tickets.filter((ticket) => ticket.clientId === clientId);
  if (workspace === "manager")
    return tickets.filter((ticket) => ticket.managerId === managerId);
  if (workspace === "admin")
    return tickets.filter((ticket) => ticket.tenantId === "acme");
  return [];
}

function currentTasks() {
  hydrateTaskOverrides();
  return operationalTasks.map((task) => sessionTaskOverrides.get(task.id) ?? task);
}

function updateSessionTask(task: OperationalTask) {
  const next = taskSchema.parse(task);
  sessionTaskOverrides.set(next.id, next);
  persistTaskOverrides();
  return next;
}

function scopedTasks(workspace: Workspace) {
  if (workspace === "manager")
    return currentTasks().filter((task) => task.managerId === managerId);
  if (workspace === "employee")
    return currentTasks().filter((task) => task.assigneeId === employeeId);
  if (workspace === "client")
    return currentTasks().filter((task) => task.clientId === clientId);
  return currentTasks();
}

export async function listOperationalTasks(
  workspace: Workspace,
  request: OperationalListRequest = {},
) {
  const query = request.query?.trim().toLowerCase();
  const items = scopedTasks(workspace).filter(
    (task) =>
      (!query ||
        [
          task.title,
          task.client,
          task.engagement,
          task.workGroup,
          task.assignee,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)) &&
      (!request.status || task.status === request.status) &&
      (!request.priority || task.priority === request.priority) &&
      (!request.client || task.client === request.client) &&
      (!request.assignee || task.assignee === request.assignee) &&
      (!request.manager || task.manager === request.manager) &&
      (!request.engagement || task.engagement === request.engagement) &&
      (!request.workGroup || task.workGroup === request.workGroup) &&
      (!request.sla || task.sla === request.sla) &&
      (!request.due ||
        (request.due === "overdue" && task.dueDate < "2026-07-21") ||
        (request.due === "today" && task.dueDate === "2026-07-21") ||
        (request.due === "upcoming" && task.dueDate > "2026-07-21")),
  );
  return taskListSchema.parse(items);
}

// ponytail: frontend mock persists metadata only; replace with private object storage and server-authorised APIs when the backend is available.
function readStoredRecords<T>(key: string, fallback: T[], schema: z.ZodType<T[]>) {
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = schema.safeParse(JSON.parse(window.localStorage.getItem(key) ?? "null"));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

function saveStoredRecords<T>(key: string, records: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(records));
  } catch {
    // Metadata remains available for the current browser session if storage is unavailable.
  }
}

function currentSharedDocuments() {
  if (!documentsHydrated) {
    documentsHydrated = true;
    sessionDocuments = readStoredRecords(documentStorageKey, sharedDocuments, z.array(sharedDocumentSchema));
  }
  return sessionDocuments;
}

function currentSharedInvoices() {
  if (!invoicesHydrated) {
    invoicesHydrated = true;
    sessionInvoices = readStoredRecords(invoiceStorageKey, sharedInvoices, z.array(sharedInvoiceSchema));
  }
  return sessionInvoices;
}

const documentActors = {
  admin: { id: "tenant-admin", name: "Tenant Administration", clientIds: ["northstar", "wellspring", "bayside"] },
  manager: { id: managerId, name: "Avery Patel", clientIds: ["northstar", "wellspring"] },
  employee: { id: employeeId, name: "Riley Shah", clientIds: ["northstar", "wellspring"] },
  client: { id: clientId, name: "Taylor Morgan", clientIds: [clientId] },
} as const;

const allowedFileExtensions = new Set(["pdf", "doc", "docx", "xls", "xlsx", "csv", "png", "jpg", "jpeg", "webp", "txt", "zip"]);
const maxFileSizeBytes = 20 * 1024 * 1024;

function validateFile(fileName: string, sizeBytes: number) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension || !allowedFileExtensions.has(extension))
    throw new Error("Choose a permitted document type.");
  if (sizeBytes <= 0 || sizeBytes > maxFileSizeBytes)
    throw new Error("Files must be between 1 byte and 20 MB.");
}

function assertClientScope(workspace: "admin" | "manager" | "employee" | "client", clientIdValue: string) {
  if (!documentActors[workspace].clientIds.includes(clientIdValue as never))
    throw new Error("This client is outside your authorised scope.");
}

function documentVisibleTo(workspace: Workspace, record: SharedDocument) {
  if (workspace === "admin") return record.tenantId === "acme";
  if (workspace === "client") return record.clientId === clientId && record.recipientClientIds.includes(clientId);
  if (workspace === "manager")
    return record.uploadedById === managerId || record.recipientManagerIds.includes(managerId) || documentActors.manager.clientIds.includes(record.clientId as never);
  if (workspace === "employee")
    return record.uploadedById === employeeId || record.recipientEmployeeIds.includes(employeeId);
  return false;
}

function invoiceVisibleTo(workspace: Workspace, record: SharedInvoice) {
  if (workspace === "admin") return record.tenantId === "acme";
  if (workspace === "client") return record.clientId === clientId && record.visibility === "client";
  if (workspace === "manager") return record.managerId === managerId && documentActors.manager.clientIds.includes(record.clientId as never);
  return false;
}

export async function listSharedDocuments(workspace: Workspace) {
  return currentSharedDocuments().filter((record) => documentVisibleTo(workspace, record));
}

export async function listSharedInvoices(workspace: Workspace) {
  return currentSharedInvoices().filter((record) => invoiceVisibleTo(workspace, record));
}

export async function createSharedDocument(
  workspace: "admin" | "manager" | "employee" | "client",
  input: DocumentUploadInput,
) {
  const value = documentUploadInputSchema.parse(input);
  const actor = documentActors[workspace];
  const targetClientId = workspace === "client" ? clientId : value.clientId;
  assertClientScope(workspace, targetClientId);
  validateFile(value.fileName, value.sizeBytes);
  const recipientEmployeeIds = value.recipientEmployeeIds ?? [];
  const recipientManagerIds = value.recipientManagerIds ?? [];
  const recipientClientIds = value.recipientClientIds ?? [];
  if (workspace === "employee" && recipientEmployeeIds.length + recipientClientIds.length)
    throw new Error("Employees can share documents only with their manager and Tenant Administration.");
  if (workspace === "employee" && !recipientManagerIds.includes(managerId))
    throw new Error("Select your assigned manager before uploading.");
  if ((workspace === "admin" || workspace === "manager") && !recipientEmployeeIds.length && !recipientManagerIds.length && !recipientClientIds.length)
    throw new Error("Select at least one authorised recipient.");
  if (workspace === "manager" && recipientClientIds.some((id) => !documentActors.manager.clientIds.includes(id as never)))
    throw new Error("A manager can share only with assigned clients.");
  const client = entities.find((item) => item.id === `CL-${targetClientId === "northstar" ? "101" : targetClientId === "wellspring" ? "102" : "103"}`)?.name ?? "Authorised client";
  const now = "Just now";
  const record: SharedDocument = {
    id: `DOC-${Date.now()}`, tenantId: "acme", clientId: targetClientId, client, title: value.title,
    fileName: value.fileName, fileType: value.fileType, sizeBytes: value.sizeBytes, category: value.category,
    engagement: value.engagement ?? null, task: value.task ?? null, uploadedBy: actor.name, uploadedByRole: workspace,
    uploadedById: actor.id, updatedOn: now, status: "active", recipientEmployeeIds,
    recipientManagerIds: workspace === "client" ? [managerId] : recipientManagerIds,
    recipientClientIds: workspace === "client" ? [clientId] : recipientClientIds,
    tenantAdminVisible: true, activity: [{ id: `DOC-ACT-${Date.now()}`, action: "Uploaded and shared", actor: actor.name, at: now }],
  };
  sessionDocuments = [record, ...currentSharedDocuments()];
  saveStoredRecords(documentStorageKey, sessionDocuments);
  return record;
}

export async function createSharedInvoice(
  workspace: "admin" | "manager" | "client",
  input: InvoiceUploadInput,
) {
  const value = invoiceUploadInputSchema.parse(input);
  const actor = documentActors[workspace];
  const targetClientId = workspace === "client" ? clientId : value.clientId;
  assertClientScope(workspace, targetClientId);
  validateFile(value.fileName, value.sizeBytes);
  const client = entities.find((item) => item.id === `CL-${targetClientId === "northstar" ? "101" : targetClientId === "wellspring" ? "102" : "103"}`)?.name ?? "Authorised client";
  const now = "Just now";
  const record: SharedInvoice = {
    id: `INV-${Date.now()}`, tenantId: "acme", clientId: targetClientId, client,
    invoiceNumber: value.invoiceNumber, engagement: value.engagement ?? null, issuedOn: value.issuedOn, dueOn: value.dueOn,
    currency: "INR", amount: value.amount, status: "draft", visibility: workspace === "client" ? "client" : value.visibility ?? "client",
    fileName: value.fileName, fileType: value.fileType, sizeBytes: value.sizeBytes, uploadedBy: actor.name,
    uploadedByRole: workspace, uploadedById: actor.id, managerId, updatedOn: now,
    activity: [{ id: `INV-ACT-${Date.now()}`, action: "Invoice uploaded", actor: actor.name, at: now }],
  };
  sessionInvoices = [record, ...currentSharedInvoices()];
  saveStoredRecords(invoiceStorageKey, sessionInvoices);
  return record;
}

export async function updateSharedDocumentAccess(
  workspace: "admin" | "manager",
  documentId: string,
  recipients: Pick<
    DocumentUploadInput,
    "recipientEmployeeIds" | "recipientManagerIds" | "recipientClientIds"
  >,
) {
  const current = currentSharedDocuments();
  const document = current.find((item) => item.id === documentId);
  if (!document || !documentVisibleTo(workspace, document))
    throw new Error("This document is outside your authorised scope.");
  const recipientClientIds = recipients.recipientClientIds ?? [];
  if (workspace === "manager" && recipientClientIds.some((id) => !documentActors.manager.clientIds.includes(id as never)))
    throw new Error("A manager can share only with assigned clients.");
  const next: SharedDocument = {
    ...document,
    recipientEmployeeIds: recipients.recipientEmployeeIds ?? [],
    recipientManagerIds: recipients.recipientManagerIds ?? [],
    recipientClientIds,
    tenantAdminVisible: true,
    updatedOn: "Just now",
    activity: [...document.activity, { id: `DOC-ACT-${Date.now()}`, action: "Access updated", actor: documentActors[workspace].name, at: "Just now" }],
  };
  sessionDocuments = current.map((item) => (item.id === documentId ? next : item));
  saveStoredRecords(documentStorageKey, sessionDocuments);
  return next;
}

export async function listTaskClients(workspace: Workspace) {
  if (workspace !== "admin") return [];
  return [...new Map(
    currentTasks().map((task) => [
      task.clientId,
      { id: task.clientId, name: task.client, manager: task.manager, engagement: task.engagement },
    ]),
  ).values()];
}

export async function listWorkLogs(workspace: Workspace) {
  const taskIds = new Set(scopedTasks(workspace).map((task) => task.id));
  return z
    .array(workLogSchema)
    .parse(workLogs.filter((log) => taskIds.has(log.taskId)));
}

export async function startEmployeeTask(taskId: string) {
  const task = currentTasks().find((item) => item.id === taskId);
  if (
    !task ||
    task.assigneeId !== employeeId ||
    !["to-do", "rejected"].includes(task.status)
  ) {
    throw new Error("This task cannot be started from its current status.");
  }
  return updateSessionTask({
    ...task,
    status: "in-progress",
    reviewStatus: "not-required",
    approvalStatus: "not-required",
  });
}

export async function submitEmployeeTaskForReview(taskId: string) {
  const task = currentTasks().find((item) => item.id === taskId);
  if (
    !task ||
    task.assigneeId !== employeeId ||
    task.status !== "in-progress"
  ) {
    throw new Error("Only an in-progress assigned task can be submitted.");
  }
  return updateSessionTask({
    ...task,
    status: "review",
    reviewStatus: "pending",
    approvalStatus: "not-required",
  });
}

export async function decideEmployeeTaskReview(
  taskId: string,
  decision: "approve" | "reject",
) {
  const task = currentTasks().find((item) => item.id === taskId);
  if (
    !task ||
    task.managerId !== managerId ||
    task.status !== "review" ||
    task.reviewStatus !== "pending"
  ) {
    throw new Error("This task is not awaiting an assigned manager review.");
  }
  return updateSessionTask(
    decision === "approve"
      ? {
          ...task,
          status: "review",
          reviewStatus: "approved",
          approvalStatus: "pending",
        }
      : {
          ...task,
          status: "rejected",
          reviewStatus: "changes-requested",
          approvalStatus: "rejected",
        },
  );
}

/**
 * Frontend mock for the tenant-owned final approval gate. The production API
 * must derive both the tenant and actor from the authenticated session.
 */
export async function decideTenantTaskApproval(
  taskId: string,
  decision: "approve" | "return",
) {
  const task = currentTasks().find((item) => item.id === taskId);
  if (
    !task ||
    task.tenantId !== "acme" ||
    task.status !== "review" ||
    task.reviewStatus !== "approved" ||
    task.approvalStatus !== "pending"
  ) {
    throw new Error("This task is not awaiting tenant approval.");
  }

  return updateSessionTask(
    decision === "approve"
      ? { ...task, status: "done", approvalStatus: "approved" }
      : {
          ...task,
          status: "rejected",
          reviewStatus: "changes-requested",
          approvalStatus: "rejected",
        },
  );
}

export async function listSupportTickets(workspace: "client" | "manager" | "admin") {
  return z.array(supportTicketSchema).parse(scopedSupportTickets(workspace));
}

export async function createSupportTicket(input: unknown) {
  const value = supportTicketInputSchema.parse(input);
  const duplicate = currentSupportTickets().find(
    (ticket) =>
      ticket.clientId === clientId &&
      ticket.status !== "resolved" &&
      ticket.service === value.service &&
      ticket.subject.trim().toLowerCase() === value.subject.trim().toLowerCase(),
  );
  if (duplicate) {
    throw new Error(
      `A similar active request already exists (${duplicate.id}). Review it before creating another request.`,
    );
  }
  const createdOn = "Just now";
  const ticketNumbers = currentSupportTickets()
    .map((ticket) => Number(ticket.id.match(/(\d+)$/)?.[1]))
    .filter(Number.isFinite);
  const ticketNumber = Math.max(1047, ...ticketNumbers) + 1;
  const ticket = supportTicketSchema.parse({
    id: `SUP-2026-${ticketNumber}`,
    tenantId: "acme",
    clientId,
    client: "Northstar Labs",
    managerId,
    ...value,
    expectedFirstResponse:
      value.businessImpact === "critical"
        ? "Within 1 business hour"
        : value.businessImpact === "high"
          ? "Within 4 business hours"
          : value.businessImpact === "medium"
            ? "Within 8 business hours"
            : "Within 1 business day",
    status: "open",
    requester: "Taylor Morgan",
    assigneeId: null,
    assignee: null,
    createdOn,
    updatedOn: createdOn,
    resolution: null,
    activity: [
      {
        id: `SUP-ACT-${Date.now()}`,
        actor: "Taylor Morgan",
        message: "Ticket submitted from the client portal.",
        createdOn,
        clientVisible: true,
      },
    ],
  });
  saveSupportTickets([ticket, ...currentSupportTickets()]);
  return ticket;
}

export async function assignSupportTicket(
  workspace: "manager" | "admin",
  ticketId: string,
  employee: { id: string; name: string },
) {
  const ticket = scopedSupportTickets(workspace).find((item) => item.id === ticketId);
  if (!ticket) throw new Error("This ticket is outside your authorised support queue.");
  const updatedOn = "Just now";
  const next = supportTicketSchema.parse({
    ...ticket,
    assigneeId: employee.id,
    assignee: employee.name,
    status: "assigned",
    updatedOn,
    activity: [
      ...ticket.activity,
      {
        id: `SUP-ACT-${Date.now()}`,
        actor: workspace === "manager" ? "Avery Patel" : "Tenant Administration",
        message: `Assigned to ${employee.name}.`,
        createdOn: updatedOn,
        clientVisible: true,
      },
    ],
  });
  saveSupportTickets(currentSupportTickets().map((item) => (item.id === ticketId ? next : item)));
  return next;
}

export async function replyToSupportTicket(
  workspace: "manager" | "admin",
  ticketId: string,
  message: string,
) {
  const ticket = scopedSupportTickets(workspace).find((item) => item.id === ticketId);
  const reply = message.trim();
  if (!ticket || reply.length < 5)
    throw new Error("Enter a reply of at least five characters.");
  const updatedOn = "Just now";
  const next = supportTicketSchema.parse({
    ...ticket,
    status: ticket.status === "open" ? "triaged" : ticket.status,
    updatedOn,
    activity: [
      ...ticket.activity,
      {
        id: `SUP-ACT-${Date.now()}`,
        actor: workspace === "manager" ? "Avery Patel" : "Tenant Administration",
        message: reply,
        createdOn: updatedOn,
        clientVisible: true,
      },
    ],
  });
  saveSupportTickets(currentSupportTickets().map((item) => (item.id === ticketId ? next : item)));
  return next;
}

export async function resolveSupportTicket(
  workspace: "manager" | "admin",
  ticketId: string,
  resolution: string,
) {
  const ticket = scopedSupportTickets(workspace).find((item) => item.id === ticketId);
  const resolved = resolution.trim();
  if (!ticket || resolved.length < 10)
    throw new Error("Provide a resolution of at least ten characters.");
  const updatedOn = "Just now";
  const next = supportTicketSchema.parse({
    ...ticket,
    status: "resolved",
    resolution: resolved,
    updatedOn,
    activity: [
      ...ticket.activity,
      {
        id: `SUP-ACT-${Date.now()}`,
        actor: workspace === "manager" ? "Avery Patel" : "Tenant Administration",
        message: `Resolved: ${resolved}`,
        createdOn: updatedOn,
        clientVisible: true,
      },
    ],
  });
  saveSupportTickets(currentSupportTickets().map((item) => (item.id === ticketId ? next : item)));
  return next;
}

export async function validateWorkLog(input: unknown) {
  return workLogInputSchema.parse(input);
}

export async function listInvoices(workspace: Workspace) {
  const items =
    workspace === "client"
      ? invoices.filter((invoice) => invoice.clientId === clientId)
      : invoices;
  return z.array(invoiceSchema).parse(items);
}

export async function getOperationalWorkspace(workspace: Workspace) {
  const tasks = await listOperationalTasks(workspace);
  const isClient = workspace === "client";
  const scopedClientIds = new Set(tasks.map((task) => task.clientId));
  return {
    tasks,
    workLogs: await listWorkLogs(workspace),
    invoices: await listInvoices(workspace),
    payments: isClient
      ? payments.filter((payment) => payment.client === "Northstar Labs")
      : payments,
    documents: operationalDocuments.filter((document) =>
      isClient
        ? document.clientId === clientId && document.visibility === "client"
        : workspace === "manager" || workspace === "employee"
          ? scopedClientIds.has(document.clientId)
          : true,
    ),
    requests: isClient
      ? clientRequests.filter((request) => request.clientId === clientId)
      : clientRequests,
    achievements,
    achievementProgress,
    goals,
    goalProgress,
    milestones,
    streak,
    recognitions,
    preferences: gamificationPreferences,
    teamProgress,
  };
}

export async function getGamificationWorkspace(workspace: Workspace) {
  const operational = await getOperationalWorkspace(workspace);
  const consistency = getWorkLogConsistency();
  const daily = {
    date: "2026-07-21",
    plannedTasks: 2,
    completedTasks: operational.tasks.filter(
      (task) => task.status === "done" && task.dueDate === "2026-07-21",
    ).length,
    overdueTasks: operational.tasks.filter(
      (task) => task.dueDate < "2026-07-21" && task.status !== "done",
    ).length,
    completedWithinSla: operational.tasks.filter(
      (task) => task.status === "done" && task.sla === "on-track",
    ).length,
    loggedMinutes: operational.workLogs
      .filter((log) => log.date === "2026-07-21")
      .reduce((total, log) => total + log.durationMinutes, 0),
    workLogComplete: consistency.days.some(
      (day) =>
        day.date === "2026-07-21" &&
        ["submitted", "reviewed", "complete"].includes(day.current),
    ),
    nextMilestone:
      milestones.find((milestone) => !milestone.complete)?.label ?? null,
  };
  return {
    ...operational,
    daily,
    consistency,
    comparisons: weeklyComparisons,
    achievements: workspace === "employee" ? achievements : [],
    achievementProgress: workspace === "employee" ? achievementProgress : [],
    recognitions:
      workspace === "client"
        ? []
        : workspace === "employee"
          ? sessionRecognitions.filter(
              (recognition) =>
                recognition.recipient === "Riley Shah" &&
                ["private", "manager-recipient", "team"].includes(
                  recognition.visibility,
                ),
            )
          : sessionRecognitions,
    onboarding:
      workspace === "client"
        ? onboardingSteps.filter((step) => step.clientVisible)
        : onboardingSteps,
    deliverables:
      workspace === "client"
        ? sessionDeliverables.filter(
            (deliverable) => deliverable.clientId === clientId,
          )
        : sessionDeliverables,
    preferences: sessionPreferences,
    policy: sessionPolicy,
  };
}

export async function saveGamificationPreferences(input: unknown) {
  sessionPreferences = gamificationPreferencesSchema.parse(input);
  return sessionPreferences;
}

export async function saveGamificationTenantPolicy(input: unknown) {
  sessionPolicy = gamificationTenantPolicySchema.parse(input);
  return sessionPolicy;
}

export async function createRecognition(input: unknown) {
  const value = recognitionInputSchema.parse(input);
  const duplicate = sessionRecognitions.find(
    (item) =>
      item.recipient === value.recipient &&
      item.category === value.category &&
      item.relatedWork === (value.relatedWork || null) &&
      item.message === value.message,
  );
  if (duplicate) return { recognition: duplicate, duplicate: true };
  const recognition = recognitionSchema.parse({
    id: `REC-MOCK-${sessionRecognitions.length + 1}`,
    recipient: value.recipient,
    recipientType: value.recipientType,
    from: "Avery Patel",
    category: value.category,
    message: value.message,
    relatedWork: value.relatedWork || null,
    visibility: value.visibility,
    privateNote: value.privateNote || null,
    date: "Just now",
  });
  sessionRecognitions = [recognition, ...sessionRecognitions];
  return { recognition, duplicate: false };
}

export async function updateDeliverableReview(
  id: string,
  action: "approve" | "request-changes",
  feedback?: string,
) {
  const deliverable = sessionDeliverables.find((item) => item.id === id);
  if (!deliverable) throw new Error("Deliverable not found");
  const next = {
    ...deliverable,
    status:
      action === "approve"
        ? ("approved" as const)
        : ("changes-requested" as const),
    nextAction:
      action === "approve"
        ? "The approved deliverable remains available in your documents."
        : "The delivery team will review your requested changes.",
    clientFeedback: feedback?.trim()
      ? [
          ...deliverable.clientFeedback,
          {
            id: `FDB-MOCK-${deliverable.clientFeedback.length + 1}`,
            author: "Taylor Morgan",
            message: feedback.trim(),
            date: "Just now",
          },
        ]
      : deliverable.clientFeedback,
  };
  sessionDeliverables = sessionDeliverables.map((item) =>
    item.id === id ? next : item,
  );
  return next;
}
