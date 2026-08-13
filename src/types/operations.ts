import { z } from "zod";

export const taskStatuses = [
  "to-do",
  "in-progress",
  "review",
  "rejected",
  "done",
] as const;
export const taskPriorities = ["high", "medium", "low"] as const;
export const taskComplexities = ["standard", "complex", "specialist"] as const;
export const slaStates = ["on-track", "watch", "at-risk"] as const;

export const taskSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  clientId: z.string(),
  client: z.string(),
  engagement: z.string(),
  workGroup: z.string(),
  managerId: z.string(),
  manager: z.string(),
  assigneeId: z.string(),
  assignee: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(taskPriorities),
  complexity: z.enum(taskComplexities),
  status: z.enum(taskStatuses),
  sla: z.enum(slaStates),
  dueDate: z.string(),
  checklist: z.array(z.object({ label: z.string(), complete: z.boolean() })),
  dependencyIds: z.array(z.string()),
  attachmentCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  reviewStatus: z.enum([
    "not-required",
    "pending",
    "changes-requested",
    "approved",
  ]),
  approvalStatus: z.enum(["not-required", "pending", "rejected", "approved"]),
  reviewComment: z.string().nullable().optional(),
  blocked: z.boolean(),
  timer: z
    .object({
      status: z.enum(["not_started", "active", "paused", "submitted"]),
      workedSeconds: z.number().int().nonnegative(),
      activeSegmentStartedAt: z.string().datetime().nullable(),
      serverTime: z.string().datetime(),
    })
    .optional(),
});
export type OperationalTask = z.infer<typeof taskSchema>;

export const workLogSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  employeeId: z.string(),
  employee: z.string(),
  date: z.string(),
  durationMinutes: z.number().int().positive().max(720),
  description: z.string().min(5),
  status: z.enum(["draft", "submitted", "reviewed", "rejected"]),
  reviewerComment: z.string().nullable(),
});
export type WorkLog = z.infer<typeof workLogSchema>;
export const workLogInputSchema = workLogSchema.pick({
  taskId: true,
  date: true,
  durationMinutes: true,
  description: true,
});
export type WorkLogInput = z.infer<typeof workLogInputSchema>;

export const invoiceSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  client: z.string(),
  engagement: z.string(),
  issuedOn: z.string(),
  dueOn: z.string(),
  amount: z.number().nonnegative(),
  paidAmount: z.number().nonnegative(),
  status: z.enum(["draft", "sent", "partial", "paid", "overdue"]),
});
export type Invoice = z.infer<typeof invoiceSchema>;

export const paymentSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  client: z.string(),
  amount: z.number().nonnegative(),
  receivedOn: z.string(),
  method: z.enum(["bank-transfer", "upi", "cheque"]),
  status: z.enum(["received", "pending", "reversed"]),
});
export type Payment = z.infer<typeof paymentSchema>;

export const documentSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  client: z.string(),
  name: z.string(),
  category: z.enum(["deliverable", "agreement", "supporting", "invoice"]),
  updatedOn: z.string(),
  visibility: z.enum(["client", "internal"]),
});
export type OperationalDocument = z.infer<typeof documentSchema>;

export const sharedDocumentSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  clientId: z.string(),
  client: z.string(),
  title: z.string().min(1).max(120),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  category: z.enum([
    "agreement",
    "deliverable",
    "evidence",
    "compliance",
    "finance",
    "report",
    "client-upload",
    "employee-submission",
    "internal",
    "supporting",
    "other",
  ]),
  engagement: z.string().nullable(),
  task: z.string().nullable(),
  uploadedBy: z.string(),
  uploadedByRole: z.enum(["admin", "manager", "employee", "client"]),
  uploadedById: z.string(),
  updatedOn: z.string(),
  status: z.enum(["active", "archived"]),
  clientDecisionStatus: z.enum(["pending", "approved", "rejected"]).default("pending"),
  clientDecisionAt: z.string().nullable().default(null),
  clientDecisionBy: z.string().nullable().default(null),
  clientDecisionComment: z.string().nullable().default(null),
  recipientEmployeeIds: z.array(z.string()),
  recipientManagerIds: z.array(z.string()),
  recipientTenantAdminIds: z.array(z.string()).default([]),
  recipientClientIds: z.array(z.string()),
  tenantAdminVisible: z.boolean(),
  shareReason: z.string().nullable().default(null),
  activity: z.array(
    z.object({ id: z.string(), action: z.string(), actor: z.string(), at: z.string() }),
  ),
});
export type SharedDocument = z.infer<typeof sharedDocumentSchema>;

export const documentUploadInputSchema = sharedDocumentSchema
  .pick({
    clientId: true,
    title: true,
    fileName: true,
    fileType: true,
    sizeBytes: true,
    category: true,
    engagement: true,
    task: true,
    recipientEmployeeIds: true,
    recipientManagerIds: true,
    recipientTenantAdminIds: true,
    recipientClientIds: true,
    shareReason: true,
  })
  .partial({
    engagement: true,
    task: true,
    recipientEmployeeIds: true,
    recipientManagerIds: true,
    recipientTenantAdminIds: true,
    recipientClientIds: true,
    shareReason: true,
  });
export type DocumentUploadInput = z.infer<typeof documentUploadInputSchema>;

export const sharedInvoiceSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  clientId: z.string(),
  client: z.string(),
  taskTitle: z.string().nullable().optional(),
  invoiceNumber: z.string().min(1).max(64),
  engagement: z.string().nullable(),
  issuedOn: z.string(),
  dueOn: z.string(),
  currency: z.literal("INR"),
  amount: z.number().nonnegative(),
  status: z.enum(["draft", "sent", "partial", "paid", "overdue"]),
  visibility: z.enum(["client", "internal"]),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  uploadedBy: z.string(),
  uploadedByRole: z.enum(["admin", "manager", "client"]),
  uploadedById: z.string(),
  managerId: z.string(),
  updatedOn: z.string(),
  activity: z.array(
    z.object({ id: z.string(), action: z.string(), actor: z.string(), at: z.string() }),
  ),
});
export type SharedInvoice = z.infer<typeof sharedInvoiceSchema>;

export const invoiceUploadInputSchema = sharedInvoiceSchema
  .pick({
    clientId: true,
    invoiceNumber: true,
    engagement: true,
    issuedOn: true,
    dueOn: true,
    amount: true,
    visibility: true,
    fileName: true,
    fileType: true,
    sizeBytes: true,
  })
  .partial({ engagement: true, visibility: true });
export type InvoiceUploadInput = z.infer<typeof invoiceUploadInputSchema>;

export const clientRequestSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  title: z.string(),
  status: z.enum(["open", "in-progress", "resolved"]),
  updatedOn: z.string(),
  owner: z.string(),
});
export type ClientRequest = z.infer<typeof clientRequestSchema>;

export const supportTicketStatuses = [
  "open",
  "triaged",
  "assigned",
  "waiting-on-client",
  "resolved",
] as const;
export const supportTicketBusinessImpacts = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
export const supportTicketCategories = [
  "filing-submission",
  "document-evidence",
  "payment-invoice",
  "report-certificate",
  "incorrect-information",
  "account-access",
  "deadline-clarification",
  "technical-problem",
  "service-delivery",
  "general-enquiry",
  "other",
] as const;
const supportTicketAttachmentSchema = z.object({
  name: z.string().min(1).max(180),
  type: z.string().min(1).max(120),
  size: z.number().int().nonnegative().max(20 * 1024 * 1024),
});
export const supportTicketSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  clientId: z.string(),
  client: z.string(),
  managerId: z.string(),
  service: z.string(),
  category: z.enum(supportTicketCategories),
  subject: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  businessImpact: z.enum(supportTicketBusinessImpacts),
  affectedUsers: z.number().int().min(1).max(10000),
  affectedUrl: z.string().url().max(500).optional(),
  preferredContactMethod: z.enum(["email", "phone", "no-callback"]),
  notifyByEmail: z.boolean(),
  notifyInApp: z.boolean(),
  attachments: z.array(supportTicketAttachmentSchema).max(5),
  expectedFirstResponse: z.string(),
  status: z.enum(supportTicketStatuses),
  requester: z.string(),
  assigneeId: z.string().nullable(),
  assignee: z.string().nullable(),
  createdOn: z.string(),
  updatedOn: z.string(),
  resolution: z.string().nullable(),
  activity: z.array(
    z.object({
      id: z.string(),
      actor: z.string(),
      message: z.string(),
      createdOn: z.string(),
      clientVisible: z.boolean(),
    }),
  ),
});
export type SupportTicket = z.infer<typeof supportTicketSchema>;
export const supportTicketInputSchema = supportTicketSchema.pick({
  service: true,
  category: true,
  subject: true,
  description: true,
  businessImpact: true,
  affectedUsers: true,
  affectedUrl: true,
  preferredContactMethod: true,
  notifyByEmail: true,
  notifyInApp: true,
  attachments: true,
});
export type SupportTicketInput = z.infer<typeof supportTicketInputSchema>;

export type OperationalListRequest = {
  query?: string;
  status?: OperationalTask["status"];
  priority?: OperationalTask["priority"];
  client?: string;
  assignee?: string;
  manager?: string;
  engagement?: string;
  workGroup?: string;
  sla?: OperationalTask["sla"];
  due?: "overdue" | "today" | "upcoming";
};
