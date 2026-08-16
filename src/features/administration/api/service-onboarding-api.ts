import { z } from "zod";

async function parseJsonResponse(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message ?? body?.error?.message ?? "Request failed.");
  }
  return body;
}

const frequencySchema = z.enum(["monthly", "quarterly", "annually", "one_time"]);
const unitTypeSchema = z.enum(["per_task", "per_hour", "per_filing", "per_unit"]);
const dueRuleTypeSchema = z.enum([
  "fixed_day_of_month",
  "fixed_month_day",
  "days_after_period_end",
  "quarterly_due_date",
]);

export const serviceBlueprintDueRuleSchema = z.object({
  type: dueRuleTypeSchema,
  day: z.number().int().min(1).max(31).optional(),
  month: z.number().int().min(1).max(12).optional(),
  days: z.number().int().min(0).max(90).optional(),
  date: z.string().optional(),
});

export const serviceBlueprintTaskSchema = z.object({
  taskType: z.string(),
  frequency: frequencySchema,
  dueRule: serviceBlueprintDueRuleSchema,
  unitType: unitTypeSchema,
  rateAmount: z.number(),
  taxCode: z.string().nullable().optional(),
  rateCardItemId: z.string().nullable().optional(),
  calendarRuleId: z.string().nullable().optional(),
  enabled: z.boolean(),
});

const serviceBlueprintSchema = z.object({
  serviceId: z.string(),
  name: z.string(),
  code: z.string(),
  countryCode: z.string(),
  currencyCode: z.enum(["INR", "USD", "GBP"]).or(z.string()),
  estimatedAnnualTotal: z.number(),
  tasks: z.array(serviceBlueprintTaskSchema),
});

const employeeServiceCapabilitiesSchema = z.object({
  employeeId: z.string(),
  capabilities: z.array(
    z.object({
      serviceId: z.string(),
      serviceName: z.string(),
      status: z.enum(["active", "inactive"]),
    }),
  ),
});

const catalogTaskSchema = z.object({
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

const serviceOnboardingCatalogSchema = z.object({
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
      tasks: z.array(catalogTaskSchema),
    }),
  ),
});

const serviceOnboardingAssigneesSchema = z.object({
  serviceId: z.string(),
  employees: z.array(
    z.object({
      employeeId: z.string(),
      name: z.string(),
      serviceCapable: z.boolean(),
      activeTasks: z.number(),
      weeklyCapacityHours: z.number(),
    }),
  ),
});

const activateClientServicesResponseSchema = z.object({
  clientId: z.string(),
  replayed: z.boolean(),
  estimatedTotal: z.number(),
  currencyCode: z.string(),
  services: z.array(
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
  ),
});

export type ServiceBlueprint = z.infer<typeof serviceBlueprintSchema>;
export type ServiceBlueprintTask = z.infer<typeof serviceBlueprintTaskSchema>;
export type ServiceBlueprintDueRule = z.infer<typeof serviceBlueprintDueRuleSchema>;
export type EmployeeServiceCapabilities = z.infer<typeof employeeServiceCapabilitiesSchema>;
export type ServiceOnboardingCatalog = z.infer<typeof serviceOnboardingCatalogSchema>;
export type ServiceOnboardingCatalogItem = ServiceOnboardingCatalog["services"][number];
export type ServiceOnboardingAssignee = z.infer<typeof serviceOnboardingAssigneesSchema>["employees"][number];
export type ActivateClientServicesResponse = z.infer<typeof activateClientServicesResponseSchema>;

export type UpsertServiceBlueprintInput = {
  countryCode: string;
  currencyCode: "INR" | "USD" | "GBP";
  effectiveFrom: string;
  tasks: readonly {
    taskType: string;
    frequency: ServiceBlueprintTask["frequency"];
    dueRule: ServiceBlueprintDueRule;
    unitType: ServiceBlueprintTask["unitType"];
    rateAmount: number;
    taxCode?: string;
    enabled?: boolean;
  }[];
};

export type ActivateClientServicesInput = {
  idempotencyKey: string;
  countryCode?: string;
  currencyCode?: "INR" | "USD" | "GBP";
  startDate?: string;
  services: readonly {
    serviceId: string;
    assignedEmployeeId: string;
    tasks: readonly {
      taskType: string;
      title?: string;
      frequency: ServiceBlueprintTask["frequency"];
      dueRule: ServiceBlueprintDueRule;
      unitType: ServiceBlueprintTask["unitType"];
      rateAmount: number;
      taxCode?: string;
      enabled?: boolean;
    }[];
  }[];
};

export function yearlyOccurrenceCount(frequency: ServiceBlueprintTask["frequency"]): number {
  switch (frequency) {
    case "monthly":
      return 12;
    case "quarterly":
      return 4;
    case "annually":
    case "one_time":
      return 1;
    default: {
      const exhaustive: never = frequency;
      return exhaustive;
    }
  }
}

export function estimatedServiceTotal(
  tasks: readonly { frequency: ServiceBlueprintTask["frequency"]; rateAmount: number; enabled?: boolean }[],
): number {
  return tasks.reduce((sum, task) => {
    if (task.enabled === false) return sum;
    return sum + task.rateAmount * yearlyOccurrenceCount(task.frequency);
  }, 0);
}

export async function getServiceBlueprint(serviceId: string): Promise<ServiceBlueprint> {
  const response = await fetch(`/api/tenant-admin/services/${encodeURIComponent(serviceId)}/blueprint`, {
    cache: "no-store",
  });
  return serviceBlueprintSchema.parse(await parseJsonResponse(response));
}

export async function upsertServiceBlueprint(
  serviceId: string,
  input: UpsertServiceBlueprintInput,
): Promise<ServiceBlueprint> {
  const response = await fetch(`/api/tenant-admin/services/${encodeURIComponent(serviceId)}/blueprint`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return serviceBlueprintSchema.parse(await parseJsonResponse(response));
}

export async function getEmployeeServiceCapabilities(employeeId: string): Promise<EmployeeServiceCapabilities> {
  const response = await fetch(
    `/api/tenant-admin/employees/${encodeURIComponent(employeeId)}/service-capabilities`,
    { cache: "no-store" },
  );
  return employeeServiceCapabilitiesSchema.parse(await parseJsonResponse(response));
}

export async function replaceEmployeeServiceCapabilities(
  employeeId: string,
  serviceIds: readonly string[],
): Promise<EmployeeServiceCapabilities> {
  const response = await fetch(
    `/api/tenant-admin/employees/${encodeURIComponent(employeeId)}/service-capabilities`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ serviceIds }),
    },
  );
  return employeeServiceCapabilitiesSchema.parse(await parseJsonResponse(response));
}

export async function getClientServiceOnboardingCatalog(clientId: string): Promise<ServiceOnboardingCatalog> {
  const response = await fetch(
    `/api/tenant-admin/clients/${encodeURIComponent(clientId)}/service-onboarding/catalog`,
    { cache: "no-store" },
  );
  return serviceOnboardingCatalogSchema.parse(await parseJsonResponse(response));
}

export async function listClientServiceOnboardingAssignees(
  clientId: string,
  serviceId: string,
): Promise<ServiceOnboardingAssignee[]> {
  const params = new URLSearchParams({ serviceId });
  const response = await fetch(
    `/api/tenant-admin/clients/${encodeURIComponent(clientId)}/service-onboarding/assignees?${params.toString()}`,
    { cache: "no-store" },
  );
  return serviceOnboardingAssigneesSchema.parse(await parseJsonResponse(response)).employees;
}

export async function activateClientServices(
  clientId: string,
  input: ActivateClientServicesInput,
): Promise<ActivateClientServicesResponse> {
  const response = await fetch(
    `/api/tenant-admin/clients/${encodeURIComponent(clientId)}/service-onboarding/activate`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return activateClientServicesResponseSchema.parse(await parseJsonResponse(response));
}
