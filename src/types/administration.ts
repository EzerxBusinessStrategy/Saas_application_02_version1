import { z } from "zod";

export const tenantStatuses = ["active", "suspended"] as const;
export const deliveryHealthStates = ["healthy", "watch", "at-risk"] as const;
export const availabilityStates = ["available", "limited", "full"] as const;

export const tenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  owner: z.object({ name: z.string(), email: z.string() }),
  status: z.enum(tenantStatuses),
  employeeCount: z.number().int().nonnegative(),
  clientCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  usagePercent: z.number().min(0).max(100),
});
export type Tenant = z.infer<typeof tenantSchema>;

export const auditRecordSchema = z.object({
  id: z.string(),
  actor: z.string(),
  tenant: z.string(),
  action: z.string(),
  resource: z.string(),
  timestamp: z.string(),
  ipAddress: z.string(),
  reason: z.string().nullable(),
  result: z.enum(["success", "failed", "pending"]),
  detail: z.string(),
});
export type AuditRecord = z.infer<typeof auditRecordSchema>;

export const clientSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  primaryContact: z.object({ name: z.string(), email: z.string() }),
  activeServices: z.number().int().nonnegative(),
  services: z.array(z.string()),
  managers: z.array(z.string()),
  deliveryHealth: z.enum(deliveryHealthStates),
  outstandingAmount: z.number().nonnegative(),
  upcomingDeadline: z.string().nullable(),
  status: z.enum(["active", "onboarding", "paused", "archived"]),
  createdAt: z.string(),
  openTasks: z.number().int().nonnegative(),
  atRiskTasks: z.number().int().nonnegative(),
  onboardingProgress: z.number().min(0).max(100),
  documentProgress: z.number().min(0).max(100),
});
export type Client = z.infer<typeof clientSchema>;

export const clientContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  email: z.string().email(),
  phone: z.string(),
  preference: z.enum(["email", "phone", "portal"]),
  status: z.enum(["active", "archived"]),
  primary: z.boolean(),
  notes: z.string(),
});
export type ClientContact = z.infer<typeof clientContactSchema>;

export const clientContactInputSchema = clientContactSchema.omit({
  id: true,
  status: true,
});
export type ClientContactInput = z.infer<typeof clientContactInputSchema>;

export const engagementSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  service: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(["active", "planning", "on-hold", "complete"]),
  priority: z.enum(["high", "medium", "low"]),
  complexity: z.enum(["standard", "complex", "specialist"]),
  slaStatus: z.enum(["on-track", "watch", "at-risk"]),
  manager: z.string(),
  employees: z.number().int().nonnegative(),
  openTasks: z.number().int().nonnegative(),
  progress: z.number().min(0).max(100),
  billingModel: z.string(),
  milestones: z.array(z.string()),
});
export type ServiceEngagement = z.infer<typeof engagementSchema>;

export const workGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  client: z.string(),
  engagement: z.string(),
  manager: z.string(),
  members: z.number().int().nonnegative(),
  capacityPercent: z.number().min(0).max(200),
  workloadPercent: z.number().min(0).max(100),
  openTasks: z.number().int().nonnegative(),
  slaStatus: z.enum(["on-track", "watch", "at-risk"]),
  status: z.enum(["active", "on-hold", "complete"]),
});
export type WorkGroup = z.infer<typeof workGroupSchema>;

export const workGroupInputSchema = workGroupSchema.omit({ id: true });
export type WorkGroupInput = z.infer<typeof workGroupInputSchema>;

export const managerSchema = z.object({
  id: z.string(),
  name: z.string(),
  department: z.string(),
  workGroups: z.number().int().nonnegative(),
  employees: z.number().int().nonnegative(),
  clients: z.number().int().nonnegative(),
  openTasks: z.number().int().nonnegative(),
  pendingReviews: z.number().int().nonnegative(),
  teamUtilisation: z.number().min(0).max(100),
  slaPerformance: z.number().min(0).max(100),
  status: z.enum(["active", "on-leave"]),
});
export type Manager = z.infer<typeof managerSchema>;

export const supportAccessSchema = z.object({
  tenantId: z.string().min(1),
  reason: z
    .string()
    .trim()
    .min(10, "Explain the support need in at least 10 characters."),
  durationMinutes: z.coerce.number().int().min(15).max(240),
});
export type SupportAccessRequest = z.infer<typeof supportAccessSchema>;

export const createTenantSchema = z.object({
  name: z.string().trim().min(2, "Enter the organisation name."),
  code: z
    .string()
    .trim()
    .regex(
      /^[A-Z0-9-]{3,16}$/,
      "Use 3–16 uppercase letters, numbers, or hyphens.",
    ),
  ownerName: z.string().trim().min(2, "Enter the tenant owner's name."),
  ownerEmail: z.string().trim().email("Enter a valid owner email."),
  primaryColour: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Use a six-digit hex colour."),
  timeZone: z.string().min(1, "Choose a time zone."),
  inviteOwner: z.boolean(),
  confirm: z
    .boolean()
    .refine((value) => value, "Confirm the tenant details before continuing."),
}).extend({
  legalName: z.string().trim().max(120).optional(),
  businessEmail: z.string().trim().email("Enter a valid business email.").optional().or(z.literal("")),
  country: z.string().min(1, "Choose a country."),
  currency: z.enum(["INR", "USD", "GBP"]),
  administratorPhone: z.string().trim().max(30).optional(),
  plan: z.enum(["essential", "professional", "enterprise"]),
  billingCycle: z.enum(["monthly", "annual"]),
  userLimit: z.coerce.number().int().min(1).max(10000),
  modules: z.array(z.string()).min(1, "Select at least one enabled module."),
  sidebarColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a six-digit hex colour."),
  defaultTheme: z.enum(["light", "dark", "system"]),
  portalSlug: z.string().trim().regex(/^[a-z0-9-]{3,40}$/, "Use 3–40 lowercase letters, numbers, or hyphens."),
  activationMethod: z.literal("invitation"),
});
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const tenantBrandingDraftSchema = z.object({
  companyName: z.string().trim().min(2, "Enter a company name.").max(80),
  primaryColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a six-digit hex colour."),
  sidebarColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a six-digit hex colour."),
  surfaceColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a six-digit hex colour."),
  defaultTheme: z.enum(["light", "dark", "system", "custom"]),
  density: z.enum(["compact", "comfortable", "relaxed", "spacious"]),
  headingFont: z.enum(["System", "Arial", "Georgia", "Verdana", "Trebuchet"]),
  allowUserThemeOverride: z.boolean(),
  portalSubtitle: z.string().trim().max(120).optional(),
});
export type TenantBrandingDraft = z.infer<typeof tenantBrandingDraftSchema>;

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
});
export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  pageCount: number;
  totalItems: number;
};

export type TenantListRequest = z.infer<typeof paginationSchema> & {
  query?: string;
  status?: (typeof tenantStatuses)[number];
  createdAfter?: string;
  sort?: "name" | "createdAt" | "employees";
};

export type ClientListRequest = z.infer<typeof paginationSchema> & {
  query?: string;
  status?: Client["status"];
  service?: string;
  manager?: string;
  deliveryHealth?: Client["deliveryHealth"];
  balance?: "any" | "outstanding" | "clear";
  deadline?: "any" | "upcoming" | "none";
  sort?: "name" | "balance" | "deadline";
};

export type AuditListRequest = z.infer<typeof paginationSchema> & {
  query?: string;
  result?: AuditRecord["result"];
  sort?: "timestamp" | "actor" | "tenant";
};
