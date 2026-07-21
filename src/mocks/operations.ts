import type { Entity } from "@/types/domain";
import type {
  Achievement,
  AchievementProgress,
  ClientRequest,
  GamificationPreferences,
  Goal,
  GoalProgress,
  Invoice,
  Milestone,
  OperationalDocument,
  OperationalTask,
  Payment,
  Recognition,
  Streak,
  TeamProgress,
  WorkLog,
} from "@/types/operations";
export const entities: Entity[] = [
  {
    id: "CL-101",
    name: "Northstar Labs",
    owner: "Avery Patel",
    status: "on-track",
    updated: "12 minutes ago",
  },
  {
    id: "CL-102",
    name: "Wellspring Co.",
    owner: "Jordan Lee",
    status: "at-risk",
    updated: "1 hour ago",
  },
  {
    id: "CL-103",
    name: "Bayside Health",
    owner: "Maya Chen",
    status: "complete",
    updated: "Yesterday",
  },
];

export const operationalTasks: OperationalTask[] = [
  {
    id: "TASK-1042",
    tenantId: "acme",
    clientId: "northstar",
    client: "Northstar Labs",
    engagement: "GST Filing",
    workGroup: "GST Review",
    managerId: "mgr-avery",
    manager: "Avery Patel",
    assigneeId: "emp-riley",
    assignee: "Riley Shah",
    title: "Confirm onboarding checklist",
    description:
      "Validate client-provided onboarding documents before the filing work starts.",
    priority: "high",
    complexity: "standard",
    status: "in-progress",
    sla: "on-track",
    dueDate: "2026-07-21",
    checklist: [
      { label: "Verify authorised contact", complete: true },
      { label: "Review source documents", complete: false },
      { label: "Confirm delivery date", complete: false },
    ],
    dependencyIds: [],
    attachmentCount: 3,
    commentCount: 2,
    reviewStatus: "not-required",
    approvalStatus: "not-required",
    blocked: false,
  },
  {
    id: "TASK-1043",
    tenantId: "acme",
    clientId: "northstar",
    client: "Northstar Labs",
    engagement: "GST Filing",
    workGroup: "GST Review",
    managerId: "mgr-avery",
    manager: "Avery Patel",
    assigneeId: "emp-aarav",
    assignee: "Aarav Mehta",
    title: "Reconcile June service usage",
    description:
      "Reconcile approved service activity with the engagement evidence.",
    priority: "medium",
    complexity: "complex",
    status: "review",
    sla: "watch",
    dueDate: "2026-07-22",
    checklist: [
      { label: "Match source records", complete: true },
      { label: "Record exceptions", complete: true },
    ],
    dependencyIds: ["TASK-1042"],
    attachmentCount: 2,
    commentCount: 4,
    reviewStatus: "pending",
    approvalStatus: "not-required",
    blocked: false,
  },
  {
    id: "TASK-1044",
    tenantId: "acme",
    clientId: "wellspring",
    client: "Wellspring Co.",
    engagement: "Compliance Review",
    workGroup: "Delivery",
    managerId: "mgr-avery",
    manager: "Avery Patel",
    assigneeId: "emp-riley",
    assignee: "Riley Shah",
    title: "Publish monthly delivery report",
    description:
      "Prepare the approved delivery summary and request a manager review.",
    priority: "high",
    complexity: "specialist",
    status: "to-do",
    sla: "at-risk",
    dueDate: "2026-07-24",
    checklist: [
      { label: "Compile delivery evidence", complete: false },
      { label: "Request review", complete: false },
    ],
    dependencyIds: ["TASK-1043"],
    attachmentCount: 0,
    commentCount: 1,
    reviewStatus: "pending",
    approvalStatus: "pending",
    blocked: true,
  },
  {
    id: "TASK-1045",
    tenantId: "acme",
    clientId: "bayside",
    client: "Bayside Health",
    engagement: "Accounts Support",
    workGroup: "Operations",
    managerId: "mgr-priya",
    manager: "Priya Nair",
    assigneeId: "emp-zoe",
    assignee: "Zoe Martin",
    title: "Archive signed agreement",
    description:
      "Store the client-approved agreement in the authorised document record.",
    priority: "low",
    complexity: "standard",
    status: "done",
    sla: "on-track",
    dueDate: "2026-07-18",
    checklist: [
      { label: "Check signatures", complete: true },
      { label: "File agreement", complete: true },
    ],
    dependencyIds: [],
    attachmentCount: 1,
    commentCount: 1,
    reviewStatus: "approved",
    approvalStatus: "approved",
    blocked: false,
  },
];

export const workLogs: WorkLog[] = [
  {
    id: "LOG-301",
    taskId: "TASK-1042",
    employeeId: "emp-riley",
    employee: "Riley Shah",
    date: "2026-07-21",
    durationMinutes: 150,
    description:
      "Reviewed onboarding documents and recorded the outstanding evidence.",
    status: "draft",
    reviewerComment: null,
  },
  {
    id: "LOG-302",
    taskId: "TASK-1043",
    employeeId: "emp-aarav",
    employee: "Aarav Mehta",
    date: "2026-07-20",
    durationMinutes: 210,
    description:
      "Reconciled the June activity records and submitted the exception note.",
    status: "submitted",
    reviewerComment: null,
  },
  {
    id: "LOG-303",
    taskId: "TASK-1044",
    employeeId: "emp-riley",
    employee: "Riley Shah",
    date: "2026-07-19",
    durationMinutes: 90,
    description:
      "Outlined the delivery report and identified missing evidence.",
    status: "rejected",
    reviewerComment: "Please link the source document before resubmitting.",
  },
];

export const invoices: Invoice[] = [
  {
    id: "INV-2407",
    clientId: "northstar",
    client: "Northstar Labs",
    engagement: "GST Filing",
    issuedOn: "2026-07-01",
    dueOn: "2026-07-31",
    amount: 125000,
    paidAmount: 50000,
    status: "partial",
  },
  {
    id: "INV-2408",
    clientId: "wellspring",
    client: "Wellspring Co.",
    engagement: "Compliance Review",
    issuedOn: "2026-07-05",
    dueOn: "2026-07-20",
    amount: 84200,
    paidAmount: 0,
    status: "overdue",
  },
  {
    id: "INV-2409",
    clientId: "bayside",
    client: "Bayside Health",
    engagement: "Accounts Support",
    issuedOn: "2026-07-08",
    dueOn: "2026-08-08",
    amount: 56000,
    paidAmount: 0,
    status: "sent",
  },
];
export const payments: Payment[] = [
  {
    id: "PAY-901",
    invoiceId: "INV-2407",
    client: "Northstar Labs",
    amount: 50000,
    receivedOn: "2026-07-12",
    method: "bank-transfer",
    status: "received",
  },
  {
    id: "PAY-902",
    invoiceId: "INV-2408",
    client: "Wellspring Co.",
    amount: 84200,
    receivedOn: "2026-07-22",
    method: "upi",
    status: "pending",
  },
];
export const operationalDocuments: OperationalDocument[] = [
  {
    id: "DOC-81",
    clientId: "northstar",
    client: "Northstar Labs",
    name: "GST filing evidence checklist.pdf",
    category: "supporting",
    updatedOn: "2026-07-21",
    visibility: "client",
  },
  {
    id: "DOC-82",
    clientId: "wellspring",
    client: "Wellspring Co.",
    name: "Delivery report draft.docx",
    category: "deliverable",
    updatedOn: "2026-07-20",
    visibility: "internal",
  },
  {
    id: "DOC-83",
    clientId: "bayside",
    client: "Bayside Health",
    name: "Signed service agreement.pdf",
    category: "agreement",
    updatedOn: "2026-07-18",
    visibility: "client",
  },
];
export const clientRequests: ClientRequest[] = [
  {
    id: "REQ-71",
    clientId: "northstar",
    title: "Confirm delivery meeting time",
    status: "open",
    updatedOn: "2026-07-21",
    owner: "Avery Patel",
  },
  {
    id: "REQ-72",
    clientId: "northstar",
    title: "Provide prior-period reconciliation",
    status: "in-progress",
    updatedOn: "2026-07-20",
    owner: "Riley Shah",
  },
];
export const achievements: Achievement[] = [
  {
    id: "ACH-1",
    title: "Ready for review",
    description: "Submitted three complete work-log entries this week.",
    unlocked: true,
    provisional: true,
  },
  {
    id: "ACH-2",
    title: "Quality handoff",
    description: "Complete the next checklist before its delivery review.",
    unlocked: false,
    provisional: true,
  },
];
export const achievementProgress: AchievementProgress[] = [
  { achievementId: "ACH-2", current: 2, target: 3 },
];
export const goals: Goal[] = [
  { id: "GOAL-1", label: "Weekly task goal", target: 4 },
  { id: "GOAL-2", label: "Work-log completion", target: 5 },
];
export const goalProgress: GoalProgress[] = [
  { goalId: "GOAL-1", current: 2, target: 4 },
  { goalId: "GOAL-2", current: 3, target: 5 },
];
export const milestones: Milestone[] = [
  {
    id: "MILE-1",
    label: "Northstar onboarding evidence complete",
    date: "2026-07-22",
    complete: false,
  },
  {
    id: "MILE-2",
    label: "Bayside agreement archived",
    date: "2026-07-18",
    complete: true,
  },
];
export const streak: Streak = {
  currentDays: 3,
  protectedDays: 2,
  label: "Scheduled-day consistency",
};
export const recognitions: Recognition[] = [
  {
    id: "REC-1",
    message: "Clear exception notes made the review easier.",
    from: "Avery Patel",
    date: "2026-07-20",
  },
];
export const gamificationPreferences: GamificationPreferences = {
  enabled: true,
  achievementNotifications: true,
  reducedMotion: false,
};
export const teamProgress: TeamProgress[] = [
  {
    label: "Review queue",
    current: 4,
    target: 6,
    note: "Two submitted work logs need a decision.",
  },
  {
    label: "Weekly delivery goal",
    current: 11,
    target: 16,
    note: "Approved leave and holidays do not reduce this progress.",
  },
];
