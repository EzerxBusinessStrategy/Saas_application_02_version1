import { z } from "zod";
import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";

const clientPortalDashboardSchema = z.object({
  period: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    source: z.enum(["query", "last_30_days", "upcoming_year"]),
  }),
  activeServices: z.number(),
  pendingTasks: z.number(),
  completedTasks: z.number(),
  openRequests: z.number(),
  outstandingInvoices: z.number(),
  currencyCode: z.string().length(3),
  services: z.array(
    z.object({
      id: z.string(),
      engagementName: z.string(),
      serviceName: z.string(),
      status: z.string(),
      nextDueAt: z.string().datetime().nullable(),
      openTasks: z.number(),
      completedTasks: z.number(),
      totalTasks: z.number(),
      progressPercent: z.number().min(0).max(100).optional().default(0),
      assignedEmployeeName: z.string().nullable().optional().default(null),
      estimatedTotal: z.number().nullable().optional().default(null),
      taskTotal: z.number().optional().default(0),
      discountAmount: z.number().optional().default(0),
      discountPercent: z.number().optional().default(0),
      amountDue: z.number().optional().default(0),
      totalDue: z.number().optional().default(0),
      currencyCode: z.string().nullable().optional().default(null),
      tasks: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
            status: z.string(),
            plannedDueAt: z.string().datetime().nullable(),
            rateAmount: z.number().optional().default(0),
            currencyCode: z.string().optional().default("INR"),
          }),
        )
        .optional()
        .default([]),
    }),
  ),
  requests: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: z.string(),
      serviceName: z.string(),
      countryCode: z.string(),
      requestedDueDate: z.string().nullable(),
      submittedAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
    }),
  ),
  invoices: z.array(
    z.object({
      id: z.string(),
      invoiceNumber: z.string(),
      taskTitle: z.string().nullable(),
      status: z.string(),
      issuedOn: z.string(),
      dueOn: z.string().nullable(),
      currencyCode: z.string().length(3),
      totalAmount: z.number(),
      paidAmount: z.number(),
      outstandingAmount: z.number(),
    }),
  ),
});

export type ClientPortalDashboard = z.infer<typeof clientPortalDashboardSchema>;

export async function getClientPortalDashboard(options?: {
  from?: string;
  to?: string;
}): Promise<ClientPortalDashboard> {
  const params = new URLSearchParams();
  if (options?.from && options.to) {
    params.set("from", options.from);
    params.set("to", options.to);
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`/api/client-portal/dashboard${suffix}`, {
    cache: "no-store",
  });
  await redirectToLoginOnUnauthorized(response);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "Client dashboard could not load.",
    );
  }
  return clientPortalDashboardSchema.parse(body);
}
