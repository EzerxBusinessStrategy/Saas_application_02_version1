import { z } from "zod";

export const taskStatuses = ["to-do", "in-progress", "review", "done"] as const;
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
  blocked: z.boolean(),
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

export const clientRequestSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  title: z.string(),
  status: z.enum(["open", "in-progress", "resolved"]),
  updatedOn: z.string(),
  owner: z.string(),
});
export type ClientRequest = z.infer<typeof clientRequestSchema>;

export const achievementSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  unlocked: z.boolean(),
  provisional: z.boolean(),
});
export type Achievement = z.infer<typeof achievementSchema>;
export const achievementProgressSchema = z.object({
  achievementId: z.string(),
  current: z.number().nonnegative(),
  target: z.number().positive(),
});
export type AchievementProgress = z.infer<typeof achievementProgressSchema>;
export const goalSchema = z.object({
  id: z.string(),
  label: z.string(),
  target: z.number().positive(),
});
export type Goal = z.infer<typeof goalSchema>;
export const goalProgressSchema = z.object({
  goalId: z.string(),
  current: z.number().nonnegative(),
  target: z.number().positive(),
});
export type GoalProgress = z.infer<typeof goalProgressSchema>;
export const milestoneSchema = z.object({
  id: z.string(),
  label: z.string(),
  date: z.string(),
  complete: z.boolean(),
});
export type Milestone = z.infer<typeof milestoneSchema>;
export const streakSchema = z.object({
  currentDays: z.number().int().nonnegative(),
  protectedDays: z.number().int().nonnegative(),
  label: z.string(),
});
export type Streak = z.infer<typeof streakSchema>;
export const recognitionSchema = z.object({
  id: z.string(),
  message: z.string(),
  from: z.string(),
  date: z.string(),
});
export type Recognition = z.infer<typeof recognitionSchema>;
export const gamificationPreferencesSchema = z.object({
  enabled: z.boolean(),
  achievementNotifications: z.boolean(),
  reducedMotion: z.boolean(),
});
export type GamificationPreferences = z.infer<
  typeof gamificationPreferencesSchema
>;
export const teamProgressSchema = z.object({
  label: z.string(),
  current: z.number().nonnegative(),
  target: z.number().positive(),
  note: z.string(),
});
export type TeamProgress = z.infer<typeof teamProgressSchema>;

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
