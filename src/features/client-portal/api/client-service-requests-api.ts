import { z } from "zod";
import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";
import {
  estimatedServiceTotal,
  serviceBlueprintDueRuleSchema,
  type ServiceBlueprintDueRule,
  type ServiceBlueprintTask,
} from "@/features/administration/api/service-onboarding-api";

const frequencySchema = z.enum(["monthly", "quarterly", "annually", "one_time"]);
const unitTypeSchema = z.enum(["per_task", "per_hour", "per_filing", "per_unit"]);

const catalogueTaskSchema = z.object({
  taskType: z.string(),
  frequency: frequencySchema,
  dueRule: serviceBlueprintDueRuleSchema.or(z.record(z.string(), z.unknown())).transform((value) => {
    const parsed = serviceBlueprintDueRuleSchema.safeParse(value);
    if (parsed.success) return parsed.data;
    const record = value as Record<string, unknown>;
    return {
      type: "fixed_day_of_month" as const,
      day: typeof record.day === "number" ? record.day : 11,
    };
  }),
  unitType: unitTypeSchema,
  rateAmount: z.number(),
  taxCode: z.string().nullable().optional(),
  rateCardItemId: z.string().nullable().optional(),
  calendarRuleId: z.string().nullable().optional(),
});

const catalogueSchema = z.object({
  clientId: z.string(),
  clientName: z.string(),
  services: z.array(
    z.object({
      serviceId: z.string(),
      name: z.string(),
      code: z.string(),
      estimatedAnnualTotal: z.number(),
      currencyCode: z.string(),
      alreadyActive: z.boolean(),
      alreadyRequested: z.boolean(),
      tasks: z.array(catalogueTaskSchema),
    }),
  ),
});

const requestTaskSchema = z.object({
  taskType: z.string(),
  title: z.string().optional(),
  frequency: z.string(),
  dueRule: z.object({
    type: z.string(),
    day: z.number().optional(),
    month: z.number().optional(),
    days: z.number().optional(),
    date: z.string().optional(),
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

export type ClientServiceCatalogue = z.infer<typeof catalogueSchema>;
export type ClientServiceCatalogueItem = ClientServiceCatalogue["services"][number];
export type ClientServiceRequest = z.infer<typeof requestSchema>;
export type ClientServiceRequestTaskInput = {
  taskType: string;
  title?: string;
  frequency: ServiceBlueprintTask["frequency"];
  dueRule: ServiceBlueprintDueRule;
  unitType: ServiceBlueprintTask["unitType"];
  rateAmount: number;
  taxCode?: string;
  enabled?: boolean;
};

export { estimatedServiceTotal };

export async function getClientServiceCatalogue(): Promise<ClientServiceCatalogue> {
  const response = await fetch("/api/client-portal/service-catalogue", { cache: "no-store" });
  await redirectToLoginOnUnauthorized(response);
  return catalogueSchema.parse(await parseBody(response));
}

export async function listClientServiceRequests(): Promise<readonly ClientServiceRequest[]> {
  const response = await fetch("/api/client-portal/service-requests", { cache: "no-store" });
  await redirectToLoginOnUnauthorized(response);
  return z.object({ requests: z.array(requestSchema) }).parse(await parseBody(response)).requests;
}

export async function createClientCatalogueRequest(input: {
  idempotencyKey: string;
  kind: "catalogue" | "custom";
  countryCode?: string;
  currencyCode?: "INR" | "USD" | "GBP";
  title?: string;
  description?: string;
  services?: readonly {
    serviceId: string;
    tasks: readonly ClientServiceRequestTaskInput[];
  }[];
}): Promise<ClientServiceRequest> {
  const response = await fetch("/api/client-portal/service-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  await redirectToLoginOnUnauthorized(response);
  return requestSchema.parse(await parseBody(response));
}

async function parseBody(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof body?.message === "string" ? body.message : "Client service request failed.");
  }
  return body;
}
