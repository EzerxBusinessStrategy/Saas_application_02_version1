import { FastifyRequest } from "fastify";
import { invalidTenantSelectionInput } from "./auth-errors";
import { AuthenticatedRequest, TenantSelectionInput } from "./request-context";

export function tenantSelectionFromRequest(
  request: FastifyRequest & AuthenticatedRequest,
): TenantSelectionInput {
  const tenantId = optionalSingleHeader(request.headers["x-tenant-id"]);
  const tenantCode = optionalSingleHeader(request.headers["x-tenant-code"]);
  const portal = optionalSingleHeader(request.headers["x-portal"]);
  const selectedRole = optionalSingleHeader(request.headers["x-role"]);

  if (tenantId && tenantCode) {
    throw invalidTenantSelectionInput("Use either x-tenant-id or x-tenant-code, not both.");
  }
  if (tenantId && !isUuid(tenantId)) {
    throw invalidTenantSelectionInput("x-tenant-id must be a UUID.");
  }
  if (tenantCode && !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(tenantCode)) {
    throw invalidTenantSelectionInput("x-tenant-code is invalid.");
  }
  if (portal && !["super-admin", "admin", "employee", "client"].includes(portal)) {
    throw invalidTenantSelectionInput("x-portal is invalid.");
  }
  if (selectedRole && !/^[A-Z][A-Z0-9_]{1,63}$/.test(selectedRole)) {
    throw invalidTenantSelectionInput("x-role is invalid.");
  }

  return {
    tenantId: tenantId ?? request.verifiedAuthUser?.tenantId,
    tenantCode,
    portal,
    selectedRole,
  };
}

function optionalSingleHeader(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
