import { z } from "zod";
import {
  clientContacts,
  clients,
  engagements,
  managers,
  workGroups,
} from "@/mocks/administration";
import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";
import {
  auditRecordSchema,
  clientContactSchema,
  clientSchema,
  createTenantResponseSchema,
  engagementSchema,
  managerSchema,
  paginationSchema,
  tenantSchema,
  tenantCreationOptionsSchema,
  workGroupSchema,
  type AuditListRequest,
  type ClientListRequest,
  type CreateTenantInput,
  type PaginatedResponse,
  type TenantListRequest,
} from "@/types/administration";

const asPage = <T>(
  items: T[],
  page: number,
  pageSize: number,
): PaginatedResponse<T> => ({
  items: items.slice((page - 1) * pageSize, page * pageSize),
  page,
  pageSize,
  pageCount: Math.max(1, Math.ceil(items.length / pageSize)),
  totalItems: items.length,
});

const includes = (values: Array<string | undefined>, query?: string) =>
  !query ||
  values.some((value) => value?.toLowerCase().includes(query.toLowerCase()));

export async function listTenants(request: TenantListRequest) {
  const { page, pageSize } = paginationSchema.parse(request);
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (request.query) params.set("query", request.query);
  if (request.status) params.set("status", request.status);
  if (request.createdAfter) params.set("createdAfter", request.createdAfter);
  if (request.sort) params.set("sort", request.sort);
  const response = await fetch(`/api/super-admin/tenants?${params.toString()}`, { cache: "no-store" });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Tenant directory could not load.");
  return z
    .object({
      items: z.array(tenantSchema),
      page: z.number(),
      pageSize: z.number(),
      pageCount: z.number(),
      totalItems: z.number(),
    })
    .parse(await response.json());
}

export async function getTenant(tenantId: string) {
  const response = await fetch(`/api/super-admin/tenants/${tenantId}`, { cache: "no-store" });
  await redirectToLoginOnUnauthorized(response);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Tenant details could not load.");
  return tenantSchema.parse(await response.json());
}

export async function getTenantCreationOptions(countryCode?: string, incorporationDate?: string) {
  const params = new URLSearchParams();
  if (countryCode) params.set("countryCode", countryCode);
  if (incorporationDate) params.set("incorporationDate", incorporationDate);
  const response = await fetch(`/api/super-admin/tenant-creation-options?${params.toString()}`, {
    cache: "no-store",
  });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Tenant creation options could not load.");
  return tenantCreationOptionsSchema.parse(await response.json());
}

export async function createTenant(input: CreateTenantInput) {
  // Build a clean payload matching the backend schema exactly.
  // Strip frontend-only fields (confirm, incorporationDate) and
  // normalize empty optional strings to undefined so they are omitted.
  const payload = {
    company: {
      displayName: input.company.displayName,
      legalName: input.company.legalName,
      tenantCode: input.company.tenantCode,
      slug: input.company.slug,
      countryCode: input.company.countryCode,
      reportingCurrencyCode: input.company.reportingCurrencyCode,
      timezone: input.company.timezone,
      industry: input.company.industry || undefined,
      registrationNumber: input.company.registrationNumber || undefined,
      taxIdentifier: input.company.taxIdentifier || undefined,
    },
    financialYear: {
      source: input.financialYear.source,
      label: input.financialYear.label,
      startsOn: input.financialYear.startsOn,
      endsOn: input.financialYear.endsOn,
      // Only include templateId if it is a non-empty string (real UUID)
      templateId: input.financialYear.templateId || undefined,
      overrideReason: input.financialYear.overrideReason || undefined,
    },
    tenantAdministrator: {
      fullName: input.tenantAdministrator.fullName,
      email: input.tenantAdministrator.email,
      phone: input.tenantAdministrator.phone || undefined,
      expiresAt: input.tenantAdministrator.expiresAt || undefined,
    },
  };

  const response = await fetch("/api/super-admin/tenants", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    // Show the first validation detail if available, otherwise the top-level message
    const detail = body?.error?.details?.[0];
    const message = detail
      ? `${detail.path}: ${detail.message}`
      : (body?.error?.message ?? body?.message ?? "Tenant could not be created.");
    throw new Error(message);
  }
  return createTenantResponseSchema.parse(await response.json());
}

export async function listAuditRecords(
  request: AuditListRequest,
) {
  const { page, pageSize } = paginationSchema.parse(request);
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (request.query) params.set("query", request.query);
  if (request.result) params.set("result", request.result);
  if (request.sort) params.set("sort", request.sort);
  const response = await fetch(`/api/super-admin/audit-log?${params.toString()}`, { cache: "no-store" });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Audit records could not load.");
  return z
    .object({
      items: z.array(auditRecordSchema),
      page: z.number(),
      pageSize: z.number(),
      pageCount: z.number(),
      totalItems: z.number(),
    })
    .parse(await response.json());
}

export async function listClients(request: ClientListRequest) {
  const { page, pageSize } = paginationSchema.parse(request);
  const filtered = clients
    .filter((client) =>
      includes(
        [
          client.name,
          client.code,
          client.primaryContact.name,
          client.primaryContact.email,
        ],
        request.query,
      ),
    )
    .filter((client) => !request.status || client.status === request.status)
    .filter(
      (client) => !request.service || client.services.includes(request.service),
    )
    .filter(
      (client) => !request.manager || client.managers.includes(request.manager),
    )
    .filter(
      (client) =>
        !request.deliveryHealth ||
        client.deliveryHealth === request.deliveryHealth,
    )
    .filter(
      (client) =>
        !request.balance ||
        request.balance === "any" ||
        (request.balance === "outstanding"
          ? client.outstandingAmount > 0
          : client.outstandingAmount === 0),
    )
    .filter(
      (client) =>
        !request.deadline ||
        request.deadline === "any" ||
        (request.deadline === "upcoming"
          ? Boolean(client.upcomingDeadline)
          : !client.upcomingDeadline),
    )
    .sort((left, right) => {
      if (request.sort === "balance")
        return right.outstandingAmount - left.outstandingAmount;
      if (request.sort === "deadline")
        return (left.upcomingDeadline ?? "9999").localeCompare(
          right.upcomingDeadline ?? "9999",
        );
      return left.name.localeCompare(right.name);
    });
  return z
    .object({
      items: z.array(clientSchema),
      page: z.number(),
      pageSize: z.number(),
      pageCount: z.number(),
      totalItems: z.number(),
    })
    .parse(asPage(filtered, page, pageSize));
}

export async function getClient(clientId: string) {
  return clientSchema
    .nullable()
    .parse(clients.find((client) => client.id === clientId) ?? null);
}

export async function listClientContacts() {
  return z.array(clientContactSchema).parse(clientContacts);
}

export async function listEngagements() {
  return z.array(engagementSchema).parse(engagements);
}

export async function listWorkGroups() {
  return z.array(workGroupSchema).parse(workGroups);
}

export async function listManagers() {
  return z.array(managerSchema).parse(managers);
}
