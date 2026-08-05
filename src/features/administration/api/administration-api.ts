import { z } from "zod";
import {
  managers,
  workGroups,
} from "@/mocks/administration";
import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";
import {
  auditRecordSchema,
  clientContactSchema,
  clientDetailSchema,
  clientOptionSchema,
  clientSchema,
  createTenantResponseSchema,
  emailAvailabilitySchema,
  managerSchema,
  paginationSchema,
  tenantSchema,
  tenantCreationOptionsSchema,
  tenantListFiltersSchema,
  workGroupSchema,
  type AuditListRequest,
  type ClientContactInput,
  type ClientListRequest,
  type ClientListResponse,
  type CreateTenantInput,
  type TenantListRequest,
} from "@/types/administration";

export async function listTenants(request: TenantListRequest) {
  const { page, pageSize } = paginationSchema.parse(request);
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (request.query) params.set("query", request.query);
  if (request.status) params.set("status", request.status);
  if (request.createdAfter) params.set("createdAfter", request.createdAfter);
  if (request.countryCode) params.set("countryCode", request.countryCode);
  if (request.financialYear) params.set("financialYear", request.financialYear);
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
      password: input.tenantAdministrator.password,
      phone: input.tenantAdministrator.phone || undefined,
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

export async function getTenantAdminEmailAvailability(email: string) {
  const params = new URLSearchParams({ email });
  const response = await fetch(`/api/super-admin/users/email-availability?${params.toString()}`, {
    cache: "no-store",
  });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Tenant Administrator email could not be checked.");
  return emailAvailabilitySchema.parse(await response.json());
}

export async function listTenantListFilters() {
  const response = await fetch("/api/super-admin/tenant-list-filters", { cache: "no-store" });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Tenant filters could not load.");
  return tenantListFiltersSchema.parse(await response.json());
}

export async function updateTenantStatus(
  tenantId: string,
  status: "active" | "suspended" | "revoked",
  options?: { suspensionDuration?: "24h" | "48h" | "72h" | "96h" | "1w" | "1m" | "6m"; revokeConfirmation?: "REVOKE" },
) {
  const response = await fetch(`/api/super-admin/tenants/${tenantId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status,
      ...options,
      reason: `Super Admin ${status === "suspended" ? "suspended" : status === "revoked" ? "revoked" : "reactivated"} the tenant from the tenant directory.`,
    }),
  });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Tenant status could not be updated.");
  return z.object({
    tenantId: z.string(),
    status: z.enum(["active", "suspended", "revoked"]),
    suspensionEndsAt: z.string().nullable(),
    revokedAt: z.string().nullable(),
  }).parse(await response.json());
}

export async function resetTenantAdministratorPassword(tenantId: string, password: string) {
  const response = await fetch(`/api/super-admin/tenants/${tenantId}/password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Tenant Administrator password could not be updated.");
  }
  return z.object({
    tenantId: z.string(),
    email: z.string().email(),
    passwordChangedAt: z.string(),
  }).parse(await response.json());
}

export async function listAuditRecords(
  request: AuditListRequest,
) {
  const { page, pageSize } = paginationSchema.parse(request);
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (request.tenantId) params.set("tenantId", request.tenantId);
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
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (request.query) params.set("query", request.query);
  if (request.status) params.set("status", request.status);
  if (request.service) params.set("service", request.service);
  if (request.manager) params.set("manager", request.manager);
  if (request.deadline) params.set("deadline", request.deadline);
  if (typeof request.revenueMin === "number" && Number.isFinite(request.revenueMin)) {
    params.set("revenueMin", String(request.revenueMin));
  }
  if (request.sort) params.set("sort", request.sort);
  const response = await fetch(`/api/tenant-admin/clients?${params.toString()}`, { cache: "no-store" });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Client directory could not load.");
  return z
    .object({
      items: z.array(clientSchema),
      page: z.number(),
      pageSize: z.number(),
      pageCount: z.number(),
      totalItems: z.number(),
      filters: z.object({
        services: z.array(clientOptionSchema),
        managers: z.array(clientOptionSchema),
      }),
    })
    .parse(await response.json()) satisfies ClientListResponse;
}

export async function getClient(clientId: string) {
  const response = await fetch(`/api/tenant-admin/clients/${encodeURIComponent(clientId)}`, { cache: "no-store" });
  await redirectToLoginOnUnauthorized(response);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Client details could not load.");
  return clientDetailSchema.parse(await response.json());
}

export async function createClientContact(clientId: string, input: ClientContactInput) {
  const response = await fetch(`/api/tenant-admin/clients/${encodeURIComponent(clientId)}/contacts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Client contact could not be created.");
  return clientContactSchema.parse(await response.json());
}

export async function updateClientContact(clientId: string, contactId: string, input: Partial<ClientContactInput> & { status?: "active" | "archived" }) {
  const response = await fetch(
    `/api/tenant-admin/clients/${encodeURIComponent(clientId)}/contacts/${encodeURIComponent(contactId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Client contact could not be updated.");
  return clientContactSchema.parse(await response.json());
}

export async function listWorkGroups() {
  return z.array(workGroupSchema).parse(workGroups);
}

export async function listManagers() {
  return z.array(managerSchema).parse(managers);
}
