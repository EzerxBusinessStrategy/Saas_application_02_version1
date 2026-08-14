import { z } from "zod";
import {
  invoiceSchema,
  documentUploadInputSchema,
  invoiceUploadInputSchema,
  sharedDocumentSchema,
  sharedInvoiceSchema,
  taskSchema,
  type DocumentUploadInput,
  type DocumentUploadWithFileInput,
  type InvoiceUploadInput,
  type InvoiceUploadWithFileInput,
  type OperationalTask,
  type WorkLog,
  type SharedDocument,
  type SharedInvoice,
} from "@/types/operations";
import type { Workspace } from "@/types/domain";
import { getClientPortalDashboard } from "@/features/client-portal/api/client-portal-dashboard-api";
import { listClientPortalDeliverables } from "@/features/client-portal/api/client-portal-deliverables-api";

async function parseJsonResponse(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message ?? body?.error?.message ?? "Request failed.");
  }
  return body;
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
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
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
const tenantAdminDepartmentSchema = taskOptionSchema.extend({
  status: z.enum(["active", "inactive", "archived"]),
  employeeCount: z.number().int().nonnegative(),
});
const tenantAdminDepartmentsResponseSchema = z.object({
  departments: z.array(tenantAdminDepartmentSchema),
  employees: z.array(tenantAdminEmployeeOptionSchema),
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
  tasks: z.array(z.object({ id: z.string(), clientId: z.string(), title: z.string() })),
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
  latestSubmissionStatus: z.enum(["submitted", "returned", "manager_approved", "tenant_approved", "cancelled"]).nullable(),
  latestReviewRemarks: z.string().nullable(),
});
const tenantAdminTasksResponseSchema = z.object({
  tasks: z.array(tenantAdminTaskSchema),
});
const taskReviewDetailSchema = z.object({
  task: tenantAdminTaskSchema,
  comments: z.array(z.object({
    id: z.string(), author: z.string(), kind: z.enum(["submission", "review"]), message: z.string(), createdAt: z.string(),
  })),
  workLogs: z.array(z.object({
    id: z.string(), employee: z.string(), workedSeconds: z.number(), startedAt: z.string(), endedAt: z.string().nullable(),
  })),
  attachments: z.array(z.object({
    id: z.string(), title: z.string(), fileName: z.string(), fileType: z.string(), sizeBytes: z.number(), uploadedBy: z.string(), updatedAt: z.string(),
  })),
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
          startedAt: z.string().datetime({ offset: true }),
          endedAt: z.string().datetime({ offset: true }).nullable(),
          workedSeconds: z.number().int().nonnegative(),
        }),
      ),
    }),
  ),
});
export type TenantAdminTaskOptions = z.infer<typeof tenantAdminTaskOptionsSchema>;
export type TenantAdminEmployeeOption = z.infer<typeof tenantAdminEmployeeOptionSchema>;
export type TenantAdminDepartment = z.infer<typeof tenantAdminDepartmentSchema>;
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
export type TaskReviewDetail = z.infer<typeof taskReviewDetailSchema>;
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
  departmentId?: string;
  newDepartmentName?: string;
};
export type CreateTenantAdminDepartmentInput = { name: string };
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
  throw new Error("Documents are not available for this portal.");
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
  throw new Error("Invoices are not available for this portal.");
}

export async function createSharedDocument(
  workspace: "admin" | "employee",
  input: DocumentUploadWithFileInput,
): Promise<SharedDocument> {
  const value = documentUploadInputSchema.parse(input);
  const idempotencyKey = crypto.randomUUID();
  const uploaded = await uploadPrivateDocumentFile(
    workspace === "admin" ? "/api/tenant-admin/finance/documents" : "/api/employee/documents",
    input.file,
    { clientId: value.clientId, fileName: value.fileName, sizeBytes: value.sizeBytes, idempotencyKey },
  );
  if (workspace === "admin") {
    const response = await fetch("/api/tenant-admin/finance/documents", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify({
        clientId: value.clientId,
        title: value.title,
        fileName: value.fileName,
        fileType: value.fileType,
        sizeBytes: value.sizeBytes,
        category: value.category,
        storageKey: uploaded.storageKey,
        contentType: uploaded.contentType,
        idempotencyKey,
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
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify({
        clientId: value.clientId,
        taskId: value.taskId,
        title: value.title,
        fileName: value.fileName,
        fileType: value.fileType,
        sizeBytes: value.sizeBytes,
        category: value.category,
        storageKey: uploaded.storageKey,
        contentType: uploaded.contentType,
        idempotencyKey,
        recipientTenantAdminIds: value.recipientTenantAdminIds ?? [],
        recipientManagerIds: value.recipientManagerIds ?? [],
      }),
    });
    return mapEmployeeDocument(employeeDocumentSchema.parse(await parseJsonResponse(response)));
  }

  throw new Error("Document uploads are not available for this portal.");
}

export async function createSharedInvoice(
  workspace: "admin",
  input: InvoiceUploadWithFileInput,
): Promise<SharedInvoice> {
  const value = invoiceUploadInputSchema.parse(input);
  const idempotencyKey = crypto.randomUUID();
  const uploaded = await uploadPrivateDocumentFile(
    "/api/tenant-admin/finance/documents",
    input.file,
    { clientId: value.clientId, fileName: value.fileName, sizeBytes: value.sizeBytes, idempotencyKey },
  );
  const response = await fetch("/api/tenant-admin/finance/invoices", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify({
        clientId: value.clientId,
        invoiceNumber: value.invoiceNumber,
        issuedOn: value.issuedOn,
        dueOn: value.dueOn,
        amount: value.amount,
        currencyCode: "INR",
        visibility: value.visibility ?? "client",
        fileName: value.fileName,
        fileType: value.fileType,
        sizeBytes: value.sizeBytes,
        storageKey: uploaded.storageKey,
        contentType: uploaded.contentType,
        idempotencyKey,
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

export async function getPrivateDocumentDownloadUrl(workspace: "admin" | "employee", documentId: string): Promise<string> {
  const endpoint = workspace === "admin"
    ? `/api/tenant-admin/finance/documents/${encodeURIComponent(documentId)}/download`
    : `/api/employee/documents/${encodeURIComponent(documentId)}/download`;
  const response = await fetch(endpoint, { cache: "no-store" });
  return z.object({ url: z.string().url() }).parse(await parseJsonResponse(response)).url;
}

async function uploadPrivateDocumentFile(
  endpoint: string,
  file: File,
  metadata: { clientId: string; fileName: string; sizeBytes: number; idempotencyKey: string },
): Promise<{ storageKey: string; contentType: string }> {
  const contentType = file.type || inferContentType(file.name);
  const response = await fetch(`${endpoint}/upload-url`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": metadata.idempotencyKey },
    body: JSON.stringify({ ...metadata, contentType }),
  });
  const upload = z.object({ storageKey: z.string(), signedUrl: z.string().url() }).parse(await parseJsonResponse(response));
  const storageResponse = await fetch(upload.signedUrl, {
    method: "PUT",
    headers: { "content-type": contentType },
    body: file,
  });
  if (!storageResponse.ok) {
    throw new Error("The file could not be uploaded. Please try again.");
  }
  return { storageKey: upload.storageKey, contentType };
}

function inferContentType(fileName: string): string {
  const extension = fileName.toLowerCase().split(".").pop();
  return ({ pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", txt: "text/plain", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", zip: "application/zip" } as Record<string, string>)[extension ?? ""] ?? "application/octet-stream";
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

export async function listTenantAdminDepartments() {
  const response = await fetch("/api/tenant-admin/tasks/departments", { cache: "no-store" });
  return tenantAdminDepartmentsResponseSchema.parse(await parseJsonResponse(response));
}

export async function createTenantAdminDepartment(
  input: CreateTenantAdminDepartmentInput,
): Promise<TenantAdminDepartment> {
  const response = await fetch("/api/tenant-admin/tasks/departments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return tenantAdminDepartmentSchema.parse(await parseJsonResponse(response));
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

export async function getTenantAdminTaskReviewDetail(taskId: string): Promise<TaskReviewDetail> {
  const response = await fetch(`/api/tenant-admin/tasks/${encodeURIComponent(taskId)}/review-detail`, { cache: "no-store" });
  return taskReviewDetailSchema.parse(await parseJsonResponse(response));
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
      task.needsChanges
        ? "changes-requested"
        : ["submitted", "manager_review", "tenant_approval"].includes(task.status)
          ? "pending"
          : "not-required",
    approvalStatus: task.status === "tenant_approval" ? "pending" : "not-required",
    reviewComment: task.latestManagerNote,
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
  throw new Error("Work logs are available only through the Employee portal.");
}

export async function decideTenantTaskApproval(
  taskId: string,
  decision: "approve" | "return",
  remarks = "",
): Promise<TenantAdminTask> {
  const response = await fetch(`/api/tenant-admin/tasks/${encodeURIComponent(taskId)}/approval`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision, remarks }),
  });
  return tenantAdminTaskSchema.parse(await parseJsonResponse(response));
}
