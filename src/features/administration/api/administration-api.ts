import { z } from "zod";
import {
  auditRecords,
  clientContacts,
  clients,
  engagements,
  managers,
  tenants,
  workGroups,
} from "@/mocks/administration";
import {
  auditRecordSchema,
  clientContactSchema,
  clientSchema,
  engagementSchema,
  managerSchema,
  paginationSchema,
  tenantSchema,
  workGroupSchema,
  type AuditListRequest,
  type ClientListRequest,
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
  const filtered = tenants
    .filter((tenant) =>
      includes(
        [tenant.name, tenant.code, tenant.owner.name, tenant.owner.email],
        request.query,
      ),
    )
    .filter((tenant) => !request.status || tenant.status === request.status)
    .filter(
      (tenant) =>
        !request.createdAfter || tenant.createdAt >= request.createdAfter,
    )
    .sort((left, right) => {
      if (request.sort === "employees")
        return right.employeeCount - left.employeeCount;
      if (request.sort === "createdAt")
        return right.createdAt.localeCompare(left.createdAt);
      return left.name.localeCompare(right.name);
    });
  return z
    .object({
      items: z.array(tenantSchema),
      page: z.number(),
      pageSize: z.number(),
      pageCount: z.number(),
      totalItems: z.number(),
    })
    .parse(asPage(filtered, page, pageSize));
}

export async function getTenant(tenantId: string) {
  return tenantSchema
    .nullable()
    .parse(tenants.find((tenant) => tenant.id === tenantId) ?? null);
}

export async function listAuditRecords(
  request: AuditListRequest,
  scope?: { tenantName?: string },
) {
  const { page, pageSize } = paginationSchema.parse(request);
  const filtered = auditRecords
    .filter(
      (record) => !scope?.tenantName || record.tenant === scope.tenantName,
    )
    .filter((record) =>
      includes(
        [record.actor, record.tenant, record.action, record.resource],
        request.query,
      ),
    )
    .filter((record) => !request.result || record.result === request.result)
    .sort((left, right) => {
      if (request.sort === "actor")
        return left.actor.localeCompare(right.actor);
      if (request.sort === "tenant")
        return left.tenant.localeCompare(right.tenant);
      return right.timestamp.localeCompare(left.timestamp);
    });
  return z
    .object({
      items: z.array(auditRecordSchema),
      page: z.number(),
      pageSize: z.number(),
      pageCount: z.number(),
      totalItems: z.number(),
    })
    .parse(asPage(filtered, page, pageSize));
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
