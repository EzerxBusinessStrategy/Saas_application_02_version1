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
  type WorkLog,
  type SharedDocument,
  type SharedInvoice,
  type SupportTicket,
} from "@/types/operations";
import type { Workspace } from "@/types/domain";
import { getClientPortalDashboard } from "@/features/client-portal/api/client-portal-dashboard-api";
import { listClientPortalDeliverables } from "@/features/client-portal/api/client-portal-deliverables-api";

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
const tenantAdminTaskPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
const tenantAdminTaskStatusSchema = z.enum([
  "draft",
  "requested",
  "open",
  "assigned",
  "in_progress",
  "submitted",
  "manager_review",
  "returned",
  "tenant_approval",
  "approved",
  "completed",
  "cancelled",
]);
const tenantAdminTaskSlaStatusSchema = z.enum([
  "not_started",
  "running",
  "met",
  "near_breach",
  "breached",
  "not_applicable",
]);
const taskOptionSchema = z.object({ id: z.string(), name: z.string() });
const tenantAdminRateItemSchema = z.object({
  id: z.string(),
  clientId: z.string().nullable(),
  serviceId: z.string(),
  label: z.string(),
  taskType: z.string(),
  unitType: z.enum(["per_task", "per_hour", "per_filing", "per_unit"]),
  rateAmount: z.number(),
  currencyCode: z.string(),
  taxCode: z.string().nullable(),
});
const tenantAdminServiceRateSchema = z.object({
  id: z.string(),
  rateCardName: z.string(),
  clientName: z.string().nullable(),
  taskType: z.string(),
  unitType: z.enum(["per_task", "per_hour", "per_filing", "per_unit"]),
  rateAmount: z.number(),
  currencyCode: z.string(),
  taxCode: z.string().nullable(),
  tasksUsingRate: z.number(),
});
const tenantAdminServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  status: z.enum(["active", "inactive", "archived"]),
  rates: z.array(tenantAdminServiceRateSchema),
});
const tenantAdminServicesResponseSchema = z.object({
  services: z.array(tenantAdminServiceSchema),
});
const tenantAdminTaskOptionsSchema = z.object({
  clients: z.array(taskOptionSchema),
  services: z.array(taskOptionSchema),
  employees: z.array(taskOptionSchema.extend({
    employeeCode: z.string().nullable(),
    isManager: z.boolean().default(false),
    skills: z.array(z.string()).default([]),
    categories: z.array(z.string()).default([]),
    experienceLevel: z.enum(["junior", "mid", "senior", "lead"]).nullable().default(null),
    managerId: z.string().nullable().default(null),
    managerName: z.string().nullable().default(null),
    activeTasks: z.number().int().nonnegative().default(0),
    workGroups: z.array(taskOptionSchema).default([]),
    employmentStatus: z.string().default("active"),
    weeklyCapacityHours: z.number().int().positive().default(40),
  })),
  workGroups: z.array(taskOptionSchema.extend({ clientId: z.string().nullable() })),
  rateItems: z.array(tenantAdminRateItemSchema),
  countries: z.array(z.object({
    countryCode: z.string().length(2),
    name: z.string(),
    financialYearId: z.string(),
    financialYearLabel: z.string(),
    startsOn: z.string(),
    endsOn: z.string(),
  })).default([]),
});
const tenantAdminEmployeeOptionSchema = taskOptionSchema.extend({
  employeeCode: z.string().nullable(),
  email: z.string().email(),
  departmentId: z.string().nullable().default(null),
  departmentName: z.string().nullable().default(null),
  isManager: z.boolean().default(false),
  skills: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  experienceLevel: z.enum(["junior", "mid", "senior", "lead"]).nullable().default(null),
  managerId: z.string().nullable().default(null),
  managerName: z.string().nullable().default(null),
  activeTasks: z.number().int().nonnegative().default(0),
  workGroups: z.array(taskOptionSchema).default([]),
  employmentStatus: z.string().default("active"),
  weeklyCapacityHours: z.number().int().positive().default(40),
});
const tenantAdminWorkGroupSchema = taskOptionSchema.extend({
  clientId: z.string().nullable(),
  clientName: z.string().nullable(),
  managerEmployeeId: z.string(),
  managerName: z.string(),
  memberCount: z.number(),
  members: z.array(tenantAdminEmployeeOptionSchema),
  status: z.enum(["active", "inactive", "archived"]),
});
const tenantAdminWorkGroupsResponseSchema = z.object({
  workGroups: z.array(tenantAdminWorkGroupSchema),
});
const tenantAdminEmployeesResponseSchema = z.object({
  employees: z.array(tenantAdminEmployeeOptionSchema),
  departments: z.array(taskOptionSchema).default([]),
});
const tenantProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  currencyCode: z.string(),
  timezone: z.string(),
});
const emailAvailabilitySchema = z.object({
  available: z.boolean(),
  reason: z.literal("EMAIL_ALREADY_EXISTS").optional(),
});
const tenantFinanceDocumentSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  client: z.string(),
  title: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  sizeBytes: z.number(),
  category: sharedDocumentSchema.shape.category,
  uploadedBy: z.string(),
  updatedOn: z.string(),
  status: z.enum(["active", "archived"]),
  clientDecisionStatus: z.enum(["pending", "approved", "rejected"]),
  clientDecisionAt: z.string().nullable(),
  clientDecisionBy: z.string().nullable(),
  clientDecisionComment: z.string().nullable(),
  shareReason: z.string().nullable().optional(),
});
const tenantFinanceDocumentsResponseSchema = z.object({ documents: z.array(tenantFinanceDocumentSchema) });
const employeeDocumentRecipientOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
});
const employeeDocumentOptionsSchema = z.object({
  clients: z.array(z.object({ id: z.string(), name: z.string() })),
  tenantAdmins: z.array(employeeDocumentRecipientOptionSchema),
  managers: z.array(employeeDocumentRecipientOptionSchema),
});
const employeeDocumentSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  client: z.string(),
  title: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  sizeBytes: z.number(),
  category: sharedDocumentSchema.shape.category,
  uploadedBy: z.string(),
  uploadedById: z.string(),
  updatedOn: z.string(),
  status: z.enum(["active", "archived"]),
  clientDecisionStatus: z.enum(["pending", "approved", "rejected"]),
  clientDecisionAt: z.string().nullable(),
  clientDecisionBy: z.string().nullable(),
  clientDecisionComment: z.string().nullable(),
  recipientTenantAdminIds: z.array(z.string()),
  recipientManagerIds: z.array(z.string()),
  shareReason: z.string().nullable().optional(),
});
const employeeDocumentsResponseSchema = z.object({ documents: z.array(employeeDocumentSchema) });
export type EmployeeDocumentRecipientOption = z.infer<typeof employeeDocumentRecipientOptionSchema>;
export type EmployeeDocumentOptions = z.infer<typeof employeeDocumentOptionsSchema>;
const tenantFinanceInvoiceSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  client: z.string(),
  taskTitle: z.string().nullable(),
  invoiceNumber: z.string(),
  issuedOn: z.string(),
  dueOn: z.string().nullable(),
  currency: z.string().length(3),
  amount: z.number(),
  status: z.string(),
  visibility: z.enum(["client", "internal"]),
  uploadedBy: z.string(),
  updatedOn: z.string(),
});
const tenantFinanceInvoicesResponseSchema = z.object({ invoices: z.array(tenantFinanceInvoiceSchema) });
type TenantFinanceInvoice = z.infer<typeof tenantFinanceInvoiceSchema>;
const tenantBillableTaskEntrySchema = z.object({
  id: z.string(),
  taskId: z.string(),
  taskTitle: z.string(),
  clientId: z.string(),
  client: z.string(),
  currency: z.string().length(3),
  grossAmount: z.number(),
  discountAmount: z.number(),
  netAmount: z.number(),
});
const tenantBillableTaskEntriesResponseSchema = z.object({ entries: z.array(tenantBillableTaskEntrySchema) });
const tenantAdminTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  clientId: z.string(),
  clientName: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  workGroupId: z.string().nullable(),
  workGroupName: z.string().nullable(),
  priority: tenantAdminTaskPrioritySchema,
  status: tenantAdminTaskStatusSchema,
  slaStatus: tenantAdminTaskSlaStatusSchema,
  plannedDueAt: z.string().nullable(),
  assigneeCount: z.number(),
  assignees: z.array(taskOptionSchema),
});
const tenantAdminTasksResponseSchema = z.object({
  tasks: z.array(tenantAdminTaskSchema),
});
const employeeTaskTimerSchema = z.object({
  status: z.enum(["not_started", "active", "paused", "submitted"]),
  workedSeconds: z.number().int().nonnegative(),
  activeSegmentStartedAt: z.string().datetime().nullable(),
  serverTime: z.string().datetime(),
});
const employeeTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  clientId: z.string(),
  clientName: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  workGroupId: z.string().nullable(),
  workGroupName: z.string().nullable(),
  assignedBy: z.string().nullable(),
  priority: tenantAdminTaskPrioritySchema,
  status: tenantAdminTaskStatusSchema,
  plannedDueAt: z.string().datetime().nullable(),
  needsChanges: z.boolean(),
  latestManagerNote: z.string().nullable(),
  timer: employeeTaskTimerSchema,
});
const employeeTasksResponseSchema = z.object({ tasks: z.array(employeeTaskSchema) });
const employeeWorkLogsResponseSchema = z.object({
  logs: z.array(
    z.object({
      date: z.string(),
      taskId: z.string(),
      taskTitle: z.string(),
      clientName: z.string(),
      workedSeconds: z.number().int().nonnegative(),
      segments: z.array(
        z.object({
          startedAt: z.string().datetime(),
          endedAt: z.string().datetime().nullable(),
          workedSeconds: z.number().int().nonnegative(),
        }),
      ),
    }),
  ),
});
export type TenantAdminTaskOptions = z.infer<typeof tenantAdminTaskOptionsSchema>;
export type TenantAdminEmployeeOption = z.infer<typeof tenantAdminEmployeeOptionSchema>;
export type TenantProfile = z.infer<typeof tenantProfileSchema>;
export type UpdateTenantAdminEmployeeAssignmentInput = {
  departmentId?: string | null;
  skills?: string[];
  experienceLevel?: "junior" | "mid" | "senior" | "lead" | null;
  managerId?: string | null;
  workGroupIds?: string[];
};
export type TenantAdminWorkGroup = z.infer<typeof tenantAdminWorkGroupSchema>;
export type TenantAdminTask = z.infer<typeof tenantAdminTaskSchema>;
export type TenantAdminService = z.infer<typeof tenantAdminServiceSchema>;
type EmployeeTask = z.infer<typeof employeeTaskSchema>;
export type CreateTenantAdminServiceInput = {
  name: string;
  taskType: string;
  unitType: "per_task" | "per_hour" | "per_filing" | "per_unit";
  rateAmount: number;
  currencyCode: "INR" | "USD" | "GBP";
  taxCode?: string;
  effectiveFrom: string;
};
export type CreateTenantAdminEmployeeInput = {
  name: string;
  email: string;
  password: string;
  employeeCode?: string;
  isManager?: boolean;
  skills?: string[];
  experienceLevel?: "junior" | "mid" | "senior" | "lead";
  weeklyCapacityHours?: number;
};
export type UpsertTenantAdminWorkGroupInput = {
  name: string;
  clientId?: string;
  managerEmployeeId: string;
  employeeIds: string[];
  status?: "active" | "inactive" | "archived";
};
export type CreateTenantAdminTaskInput = {
  clientId: string;
  serviceId: string;
  countryCode: string;
  title: string;
  description?: string;
  priority: z.infer<typeof tenantAdminTaskPrioritySchema>;
  plannedDueAt?: string;
  workGroupId?: string;
  employeeIds: string[];
  billing:
    | {
        rateSource: "existing";
        rateCardItemId: string;
        quantity: number;
        discountType?: "percentage" | "fixed";
        discountValue?: number;
      }
    | {
        rateSource: "new";
        taskType: string;
        unitType: "per_task" | "per_hour" | "per_filing" | "per_unit";
        rateAmount: number;
        currencyCode: string;
        taxCode?: string;
        effectiveFrom: string;
        saveToRateCard: boolean;
        oneTimeReason?: string;
        quantity: number;
        discountType?: "percentage" | "fixed";
        discountValue?: number;
      };
};
export type TenantBillableTaskEntry = z.infer<typeof tenantBillableTaskEntrySchema>;
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
  if (workspace === "admin") {
    const response = await fetch("/api/tenant-admin/finance/documents", { cache: "no-store" });
      return tenantFinanceDocumentsResponseSchema.parse(await parseJsonResponse(response)).documents.map((document): SharedDocument => ({
        ...document,
        tenantId: "tenant",
        engagement: null,
        task: null,
      uploadedByRole: "admin",
      uploadedById: "tenant-admin",
        recipientEmployeeIds: [],
        recipientManagerIds: [],
        recipientTenantAdminIds: [],
        recipientClientIds: [document.clientId],
        tenantAdminVisible: true,
        shareReason: document.shareReason ?? null,
        activity: [{ id: `${document.id}-created`, action: "Created", actor: document.uploadedBy, at: document.updatedOn }],
    }));
  }
  if (workspace === "client") {
    return (await listClientPortalDeliverables()).map((document) => sharedDocumentSchema.parse({
      ...document,
      tenantId: "tenant",
      clientId,
      client: "Client account",
      engagement: null,
      task: null,
      uploadedByRole: "admin",
      uploadedById: "tenant-admin",
      status: "active",
      clientDecisionBy: null,
      recipientEmployeeIds: [],
      recipientManagerIds: [],
      recipientTenantAdminIds: [],
      recipientClientIds: [clientId],
      tenantAdminVisible: true,
      activity: [{ id: `${document.id}-shared`, action: "Shared", actor: document.uploadedBy, at: document.updatedOn }],
    }));
  }
  if (workspace === "employee") return listEmployeeDocuments();
  return currentSharedDocuments().filter((record) => documentVisibleTo(workspace, record));
}

export async function listEmployeeDocumentOptions(): Promise<EmployeeDocumentOptions> {
  const response = await fetch("/api/employee/documents/options", { cache: "no-store" });
  return employeeDocumentOptionsSchema.parse(await parseJsonResponse(response));
}

export async function listEmployeeDocuments(): Promise<SharedDocument[]> {
  const response = await fetch("/api/employee/documents", { cache: "no-store" });
  return employeeDocumentsResponseSchema.parse(await parseJsonResponse(response)).documents.map(mapEmployeeDocument);
}

function mapEmployeeDocument(document: z.infer<typeof employeeDocumentSchema>): SharedDocument {
  return sharedDocumentSchema.parse({
    ...document,
    tenantId: "tenant",
    engagement: null,
    task: null,
    uploadedByRole: "employee",
    recipientEmployeeIds: [],
    recipientClientIds: [],
    tenantAdminVisible: document.recipientTenantAdminIds.length > 0,
    shareReason: document.shareReason ?? null,
    activity: [{ id: `${document.id}-shared`, action: "Uploaded and shared", actor: document.uploadedBy, at: document.updatedOn }],
  });
}

function mapTenantFinanceInvoice(invoice: TenantFinanceInvoice): SharedInvoice {
  const status: SharedInvoice["status"] =
    invoice.status === "draft" ||
    invoice.status === "sent" ||
    invoice.status === "partial" ||
    invoice.status === "paid" ||
    invoice.status === "overdue"
      ? invoice.status
      : "sent";

  return {
    ...invoice,
    tenantId: "tenant",
    engagement: null,
    dueOn: invoice.dueOn ?? "",
    currency: "INR",
    status,
    fileName: `${invoice.invoiceNumber}.pdf`,
    fileType: "PDF",
    sizeBytes: 0,
    uploadedByRole: "admin",
    uploadedById: "tenant-admin",
    managerId: "",
    activity: [{ id: `${invoice.id}-created`, action: "Created", actor: invoice.uploadedBy, at: invoice.updatedOn }],
  };
}

export async function listSharedInvoices(workspace: Workspace) {
  if (workspace === "admin") {
    const response = await fetch("/api/tenant-admin/finance/invoices", { cache: "no-store" });
    return tenantFinanceInvoicesResponseSchema.parse(await parseJsonResponse(response)).invoices.map(mapTenantFinanceInvoice);
  }
  if (workspace === "client") {
    const dashboard = await getClientPortalDashboard();
    return dashboard.invoices.map((invoice): SharedInvoice => ({
      id: invoice.id,
      tenantId: "tenant",
      clientId,
      client: "Client account",
      taskTitle: invoice.taskTitle,
      invoiceNumber: invoice.invoiceNumber,
      engagement: null,
      issuedOn: invoice.issuedOn,
      dueOn: invoice.dueOn ?? "",
      currency: "INR",
      amount: invoice.totalAmount,
      status: invoice.status === "paid" ? "paid" : invoice.status === "overdue" ? "overdue" : "sent",
      visibility: "client",
      fileName: `${invoice.invoiceNumber}.pdf`,
      fileType: "PDF",
      sizeBytes: 0,
      uploadedBy: "Tenant Administration",
      uploadedByRole: "admin",
      uploadedById: "tenant-admin",
      managerId: "",
      updatedOn: invoice.issuedOn,
      activity: [{ id: `${invoice.id}-sent`, action: "Sent", actor: "Tenant Administration", at: invoice.issuedOn }],
    }));
  }
  return currentSharedInvoices().filter((record) => invoiceVisibleTo(workspace, record));
}

export async function createSharedDocument(
  workspace: "admin" | "manager" | "employee" | "client",
  input: DocumentUploadInput,
): Promise<SharedDocument> {
  const value = documentUploadInputSchema.parse(input);
  if (workspace === "admin") {
    const response = await fetch("/api/tenant-admin/finance/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: value.clientId,
        title: value.title,
        fileName: value.fileName,
        fileType: value.fileType,
        sizeBytes: value.sizeBytes,
        category: value.category,
        recipientEmployeeIds: value.recipientEmployeeIds ?? [],
        shareReason: value.shareReason ?? "",
      }),
    });
    const document = tenantFinanceDocumentSchema.parse(await parseJsonResponse(response));
      return {
        ...document,
        tenantId: "tenant",
        engagement: value.engagement ?? null,
        task: value.task ?? null,
      uploadedByRole: "admin",
      uploadedById: "tenant-admin",
        recipientEmployeeIds: value.recipientEmployeeIds ?? [],
        recipientManagerIds: value.recipientManagerIds ?? [],
        recipientTenantAdminIds: value.recipientTenantAdminIds ?? [],
        recipientClientIds: value.recipientClientIds ?? [value.clientId],
        tenantAdminVisible: true,
        shareReason: document.shareReason ?? value.shareReason ?? null,
        activity: [{ id: `${document.id}-created`, action: "Created", actor: document.uploadedBy, at: document.updatedOn }],
    };
  }
  if (workspace === "employee") {
    const response = await fetch("/api/employee/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: value.clientId,
        title: value.title,
        fileName: value.fileName,
        fileType: value.fileType,
        sizeBytes: value.sizeBytes,
        category: value.category,
        recipientTenantAdminIds: value.recipientTenantAdminIds ?? [],
        recipientManagerIds: value.recipientManagerIds ?? [],
      }),
    });
    return mapEmployeeDocument(employeeDocumentSchema.parse(await parseJsonResponse(response)));
  }
  const actor = documentActors[workspace];
  const targetClientId = workspace === "client" ? clientId : value.clientId;
  assertClientScope(workspace, targetClientId);
  validateFile(value.fileName, value.sizeBytes);
  const recipientEmployeeIds = value.recipientEmployeeIds ?? [];
  const recipientManagerIds = value.recipientManagerIds ?? [];
  const recipientClientIds = value.recipientClientIds ?? [];
  if (workspace === "manager" && !recipientEmployeeIds.length && !recipientManagerIds.length && !recipientClientIds.length)
    throw new Error("Select at least one authorised recipient.");
  if (workspace === "manager" && recipientClientIds.some((id) => !documentActors.manager.clientIds.includes(id as never)))
    throw new Error("A manager can share only with assigned clients.");
  const client = entities.find((item) => item.id === `CL-${targetClientId === "northstar" ? "101" : targetClientId === "wellspring" ? "102" : "103"}`)?.name ?? "Authorised client";
  const now = "Just now";
    const record: SharedDocument = {
      id: `DOC-${Date.now()}`, tenantId: "acme", clientId: targetClientId, client, title: value.title,
      fileName: value.fileName, fileType: value.fileType, sizeBytes: value.sizeBytes, category: value.category,
      engagement: value.engagement ?? null, task: value.task ?? null, uploadedBy: actor.name, uploadedByRole: workspace,
      uploadedById: actor.id, updatedOn: now, status: "active", clientDecisionStatus: "pending", clientDecisionAt: null, clientDecisionBy: null, clientDecisionComment: null, recipientEmployeeIds,
      recipientManagerIds: workspace === "client" ? [managerId] : recipientManagerIds,
      recipientTenantAdminIds: value.recipientTenantAdminIds ?? [],
      recipientClientIds: workspace === "client" ? [clientId] : recipientClientIds,
      tenantAdminVisible: true, shareReason: value.shareReason ?? null, activity: [{ id: `DOC-ACT-${Date.now()}`, action: "Uploaded and shared", actor: actor.name, at: now }],
  };
  sessionDocuments = [record, ...currentSharedDocuments()];
  saveStoredRecords(documentStorageKey, sessionDocuments);
  return record;
}

export async function createSharedInvoice(
  workspace: "admin" | "manager" | "client",
  input: InvoiceUploadInput,
): Promise<SharedInvoice> {
  const value = invoiceUploadInputSchema.parse(input);
  if (workspace === "admin") {
    const response = await fetch("/api/tenant-admin/finance/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: value.clientId,
        invoiceNumber: value.invoiceNumber,
        issuedOn: value.issuedOn,
        dueOn: value.dueOn,
        amount: value.amount,
        currencyCode: "INR",
        visibility: value.visibility ?? "client",
      }),
    });
    const invoice = tenantFinanceInvoiceSchema.parse(await parseJsonResponse(response));
    return {
      ...invoice,
      tenantId: "tenant",
      engagement: value.engagement ?? null,
      dueOn: invoice.dueOn ?? value.dueOn,
      currency: "INR",
      status: "sent",
      fileName: value.fileName,
      fileType: value.fileType,
      sizeBytes: value.sizeBytes,
      uploadedByRole: "admin",
      uploadedById: "tenant-admin",
      managerId: "",
      activity: [{ id: `${invoice.id}-created`, action: "Created", actor: invoice.uploadedBy, at: invoice.updatedOn }],
    };
  }
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
    "recipientEmployeeIds" | "recipientManagerIds" | "recipientTenantAdminIds" | "recipientClientIds"
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
      recipientTenantAdminIds: recipients.recipientTenantAdminIds ?? document.recipientTenantAdminIds,
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

async function parseJsonResponse(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body?.message === "string"
        ? body.message
        : typeof body?.error?.message === "string"
          ? body.error.message
          : "Request failed.";
    throw new Error(message);
  }
  return body;
}

export async function listTenantAdminTaskOptions(): Promise<TenantAdminTaskOptions> {
  const response = await fetch("/api/tenant-admin/tasks/options", { cache: "no-store" });
  return tenantAdminTaskOptionsSchema.parse(await parseJsonResponse(response));
}

export async function getTenantProfile(): Promise<TenantProfile> {
  const response = await fetch("/api/tenant-admin/dashboard/profile", { cache: "no-store" });
  return tenantProfileSchema.parse(await parseJsonResponse(response));
}

export async function updateTenantProfile(name: string): Promise<TenantProfile> {
  const response = await fetch("/api/tenant-admin/dashboard/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return tenantProfileSchema.parse(await parseJsonResponse(response));
}

export async function listTenantAdminServices(): Promise<TenantAdminService[]> {
  const response = await fetch("/api/tenant-admin/services", { cache: "no-store" });
  return tenantAdminServicesResponseSchema.parse(await parseJsonResponse(response)).services;
}

export async function createTenantAdminService(input: CreateTenantAdminServiceInput): Promise<TenantAdminService> {
  const response = await fetch("/api/tenant-admin/services", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return tenantAdminServiceSchema.parse(await parseJsonResponse(response));
}

export async function createTenantAdminEmployee(input: CreateTenantAdminEmployeeInput): Promise<TenantAdminEmployeeOption> {
  const response = await fetch("/api/tenant-admin/tasks/employees", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return tenantAdminEmployeeOptionSchema.parse(await parseJsonResponse(response));
}

export async function getTenantAdminEmployeeEmailAvailability(email: string) {
  const params = new URLSearchParams({ email });
  const response = await fetch(`/api/tenant-admin/tasks/employees/email-availability?${params.toString()}`, {
    cache: "no-store",
  });
  return emailAvailabilitySchema.parse(await parseJsonResponse(response));
}

export async function listTenantAdminEmployees(): Promise<TenantAdminEmployeeOption[]> {
  return (await listTenantAdminEmployeeDirectory()).employees;
}

export async function listTenantAdminEmployeeDirectory() {
  // A recently awakened API can transiently return an empty directory before its
  // tenant context is ready. Confirm that state before rendering an empty roster.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("/api/tenant-admin/tasks/employees", { cache: "no-store" });
    const directory = tenantAdminEmployeesResponseSchema.parse(await parseJsonResponse(response));
    if (directory.employees.length || attempt === 2) return directory;
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw new Error("Employee directory could not be loaded.");
}

export async function setTenantAdminEmployeeManager(employeeId: string, isManager: boolean): Promise<TenantAdminEmployeeOption> {
  const response = await fetch(`/api/tenant-admin/tasks/employees/${encodeURIComponent(employeeId)}/manager`, {
    method: isManager ? "PATCH" : "DELETE",
  });
  return tenantAdminEmployeeOptionSchema.parse(await parseJsonResponse(response));
}

export async function updateTenantAdminEmployeeCapacity(employeeId: string, weeklyCapacityHours: number): Promise<TenantAdminEmployeeOption> {
  const response = await fetch(`/api/tenant-admin/tasks/employees/${encodeURIComponent(employeeId)}/capacity`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ weeklyCapacityHours }),
  });
  return tenantAdminEmployeeOptionSchema.parse(await parseJsonResponse(response));
}

export async function updateTenantAdminEmployeeAssignment(
  employeeId: string,
  input: UpdateTenantAdminEmployeeAssignmentInput,
): Promise<TenantAdminEmployeeOption> {
  const response = await fetch(`/api/tenant-admin/tasks/employees/${encodeURIComponent(employeeId)}/assignment`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return tenantAdminEmployeeOptionSchema.parse(await parseJsonResponse(response));
}

export async function listTenantAdminWorkGroups(): Promise<TenantAdminWorkGroup[]> {
  const response = await fetch("/api/tenant-admin/tasks/work-groups", { cache: "no-store" });
  return tenantAdminWorkGroupsResponseSchema.parse(await parseJsonResponse(response)).workGroups;
}

export async function createTenantAdminWorkGroup(input: UpsertTenantAdminWorkGroupInput): Promise<TenantAdminWorkGroup> {
  const response = await fetch("/api/tenant-admin/tasks/work-groups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return tenantAdminWorkGroupSchema.parse(await parseJsonResponse(response));
}

export async function updateTenantAdminWorkGroup(workGroupId: string, input: UpsertTenantAdminWorkGroupInput): Promise<TenantAdminWorkGroup> {
  const response = await fetch(`/api/tenant-admin/tasks/work-groups/${encodeURIComponent(workGroupId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return tenantAdminWorkGroupSchema.parse(await parseJsonResponse(response));
}

export async function listTenantAdminTasks(clientId?: string): Promise<TenantAdminTask[]> {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", clientId);
  const response = await fetch(`/api/tenant-admin/tasks${params.size ? `?${params}` : ""}`, { cache: "no-store" });
  return tenantAdminTasksResponseSchema.parse(await parseJsonResponse(response)).tasks;
}

export async function listEmployeeTasks(): Promise<OperationalTask[]> {
  const response = await fetch("/api/employee/tasks", { cache: "no-store" });
  return employeeTasksResponseSchema.parse(await parseJsonResponse(response)).tasks.map(mapEmployeeTask);
}

export async function startEmployeeTask(taskId: string): Promise<OperationalTask> {
  return mutateEmployeeTask(taskId, "start");
}

export async function pauseEmployeeTask(taskId: string): Promise<OperationalTask> {
  return mutateEmployeeTask(taskId, "pause");
}

export async function resumeEmployeeTask(taskId: string): Promise<OperationalTask> {
  return mutateEmployeeTask(taskId, "resume");
}

export async function submitEmployeeTaskForReview(taskId: string, taskComment = ""): Promise<OperationalTask> {
  return mutateEmployeeTask(taskId, "submit", { taskComment });
}

async function mutateEmployeeTask(taskId: string, action: "start" | "pause" | "resume" | "submit", body?: unknown): Promise<OperationalTask> {
  const response = await fetch(`/api/employee/tasks/${encodeURIComponent(taskId)}/${action}`, {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return mapEmployeeTask(employeeTaskSchema.parse(await parseJsonResponse(response)));
}

function mapEmployeeTask(task: EmployeeTask): OperationalTask {
  return {
    id: task.id,
    tenantId: "authenticated",
    clientId: task.clientId,
    client: task.clientName,
    engagement: task.serviceName,
    workGroup: task.workGroupName ?? "Direct assignment",
    managerId: "",
    manager: task.assignedBy ?? "Tenant assignment",
    assigneeId: "current",
    assignee: "Current employee",
    title: task.title,
    description: task.description,
    priority: mapTenantPriority(task.priority),
    complexity: "standard",
    status: mapEmployeeStatus(task.status),
    sla: "on-track",
    dueDate: task.plannedDueAt ? task.plannedDueAt.slice(0, 10) : "No due date",
    checklist: [],
    dependencyIds: [],
    attachmentCount: 0,
    commentCount: 0,
    reviewStatus:
      task.status === "returned"
        ? "changes-requested"
        : ["submitted", "manager_review", "tenant_approval"].includes(task.status)
          ? "pending"
          : "not-required",
    approvalStatus: task.status === "tenant_approval" ? "pending" : "not-required",
    blocked: task.needsChanges,
    timer: task.timer,
  };
}

function mapTenantPriority(priority: EmployeeTask["priority"]): OperationalTask["priority"] {
  if (priority === "high" || priority === "urgent") return "high";
  if (priority === "low") return "low";
  return "medium";
}

function mapEmployeeStatus(status: EmployeeTask["status"]): OperationalTask["status"] {
  if (status === "in_progress") return "in-progress";
  if (status === "returned") return "rejected";
  if (["submitted", "manager_review", "tenant_approval", "approved"].includes(status)) return "review";
  if (status === "completed") return "done";
  return "to-do";
}

export async function createTenantAdminTask(input: CreateTenantAdminTaskInput): Promise<TenantAdminTask> {
  const response = await fetch("/api/tenant-admin/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return tenantAdminTaskSchema.parse(await parseJsonResponse(response));
}

export async function listTenantBillableTaskEntries(): Promise<TenantBillableTaskEntry[]> {
  const response = await fetch("/api/tenant-admin/finance/billable-tasks", { cache: "no-store" });
  return tenantBillableTaskEntriesResponseSchema.parse(await parseJsonResponse(response)).entries;
}

export async function createInvoiceFromTask(input: {
  billableTaskEntryId: string;
  invoiceNumber: string;
  issuedOn: string;
  dueOn: string;
  discountType?: "percentage" | "fixed";
  discountValue?: number;
}) {
  const response = await fetch("/api/tenant-admin/finance/invoices/from-task", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return mapTenantFinanceInvoice(tenantFinanceInvoiceSchema.parse(await parseJsonResponse(response)));
}

export async function sendTenantInvoice(invoiceId: string) {
  const response = await fetch(`/api/tenant-admin/finance/invoices/${encodeURIComponent(invoiceId)}/send`, { method: "POST" });
  return mapTenantFinanceInvoice(tenantFinanceInvoiceSchema.parse(await parseJsonResponse(response)));
}

export async function listWorkLogs(workspace: Workspace) {
  if (workspace === "employee") {
    const response = await fetch("/api/employee/work-logs", { cache: "no-store" });
    return employeeWorkLogsResponseSchema.parse(await parseJsonResponse(response)).logs.map((log): WorkLog => ({
      id: `${log.taskId}:${log.date}`,
      taskId: log.taskId,
      employeeId: "current",
      employee: "Current employee",
      date: log.date,
      durationMinutes: Math.max(1, Math.round(log.workedSeconds / 60)),
      description: `${log.taskTitle} - ${log.clientName}`,
      status: "reviewed",
      reviewerComment: null,
    }));
  }
  const taskIds = new Set(scopedTasks(workspace).map((task) => task.id));
  return z
    .array(workLogSchema)
    .parse(workLogs.filter((log) => taskIds.has(log.taskId)));
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

export async function decideTenantTaskApproval(
  taskId: string,
  decision: "approve" | "return",
): Promise<TenantAdminTask> {
  const response = await fetch(`/api/tenant-admin/tasks/${encodeURIComponent(taskId)}/approval`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  return tenantAdminTaskSchema.parse(await parseJsonResponse(response));
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
