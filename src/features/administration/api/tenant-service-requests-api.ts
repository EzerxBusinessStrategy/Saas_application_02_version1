import { z } from "zod";
import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";

const requestTaskSchema = z.object({
  taskType: z.string(),
  title: z.string().optional(),
  frequency: z.string(),
  dueRule: z.object({
    type: z.string(),
    day: z.number().nullish(),
    month: z.number().nullish(),
    days: z.number().nullish(),
    date: z.string().nullish(),
  }),
  unitType: z.string(),
  rateAmount: z.number(),
  taxCode: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});

const requestSchema = z.object({
  id: z.string(),
  kind: z.enum(["catalogue", "custom"]),
  title: z.string(),
  description: z.string(),
  status: z.enum(["submitted", "accepted", "rejected", "cancelled"]),
  clientId: z.string(),
  clientName: z.string(),
  countryCode: z.string(),
  currencyCode: z.string(),
  estimatedTotal: z.number(),
  reviewRemarks: z.string().nullable(),
  replayed: z.boolean(),
  submittedAt: z.string(),
  updatedAt: z.string(),
  reviewedAt: z.string().nullable(),
  services: z.array(
    z.object({
      serviceId: z.string(),
      serviceName: z.string(),
      assignedEmployeeId: z.string().nullable(),
      estimatedTotal: z.number(),
      tasks: z.array(requestTaskSchema),
    }),
  ),
  activatedServices: z
    .array(
      z.object({
        engagementId: z.string(),
        serviceId: z.string(),
        serviceName: z.string(),
        assignedEmployeeId: z.string(),
        assignedEmployeeName: z.string(),
        taskCount: z.number(),
        estimatedTotal: z.number(),
        alreadyActive: z.boolean(),
      }),
    )
    .optional(),
});

export type TenantServiceRequest = z.infer<typeof requestSchema>;

export function tenantServiceRequestErrorMessage(body: unknown, fallback = "Service request failed."): string {
  if (!body || typeof body !== "object") return fallback;
  const record = body as { message?: unknown; error?: { message?: unknown } };
  if (typeof record.error?.message === "string" && record.error.message.trim()) {
    return record.error.message;
  }
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }
  return fallback;
}

async function parseBody(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(tenantServiceRequestErrorMessage(body));
  }
  return body;
}

export async function listTenantServiceRequests(filters?: {
  status?: TenantServiceRequest["status"];
  clientId?: string;
  employeeId?: string;
  taskName?: string;
  search?: string;
}): Promise<readonly TenantServiceRequest[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.clientId) params.set("clientId", filters.clientId);
  if (filters?.employeeId) params.set("employeeId", filters.employeeId);
  if (filters?.taskName?.trim()) params.set("taskName", filters.taskName.trim());
  if (filters?.search?.trim()) params.set("search", filters.search.trim());
  const suffix = params.size ? `?${params.toString()}` : "";
  const response = await fetch(`/api/tenant-admin/service-requests${suffix}`, { cache: "no-store" });
  await redirectToLoginOnUnauthorized(response);
  return z.object({ requests: z.array(requestSchema) }).parse(await parseBody(response)).requests;
}

export async function getTenantServiceRequest(requestId: string): Promise<TenantServiceRequest> {
  const response = await fetch(`/api/tenant-admin/service-requests/${encodeURIComponent(requestId)}`, {
    cache: "no-store",
  });
  await redirectToLoginOnUnauthorized(response);
  return requestSchema.parse(await parseBody(response));
}

export async function acceptTenantServiceRequest(
  requestId: string,
  input: {
    remarks?: string;
    discountPercent?: number;
    assignments: readonly { serviceId: string; assignedEmployeeId: string }[];
  },
): Promise<TenantServiceRequest> {
  const response = await fetch(`/api/tenant-admin/service-requests/${encodeURIComponent(requestId)}/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  await redirectToLoginOnUnauthorized(response);
  return requestSchema.parse(await parseBody(response));
}

export async function rejectTenantServiceRequest(requestId: string, remarks: string): Promise<TenantServiceRequest> {
  const response = await fetch(`/api/tenant-admin/service-requests/${encodeURIComponent(requestId)}/reject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ remarks }),
  });
  await redirectToLoginOnUnauthorized(response);
  return requestSchema.parse(await parseBody(response));
}
