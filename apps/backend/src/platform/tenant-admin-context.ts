import { forbiddenPortal } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";

export type TenantAdminRequestContext = RequestContext & {
  readonly tenantId: string;
  readonly membershipId: string;
};

export function requireTenantAdminContext(context: RequestContext): TenantAdminRequestContext {
  if (
    !context.tenantId ||
    !context.membershipId ||
    context.isPlatformAdmin ||
    !context.roles.some((role) => role === "TENANT_ADMIN" || role === "TENANT_OWNER")
  ) {
    throw forbiddenPortal();
  }
  return context as TenantAdminRequestContext;
}
