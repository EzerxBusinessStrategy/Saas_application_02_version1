import { forbiddenPortal } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";

export type ClientPortalRequestContext = RequestContext & {
  readonly tenantId: string;
  readonly membershipId: string;
  readonly clientAccountId: string;
};

export function requireClientPortalContext(context: RequestContext): ClientPortalRequestContext {
  if (
    !context.tenantId ||
    !context.membershipId ||
    !context.clientAccountId ||
    context.isPlatformAdmin ||
    !context.roles.includes("CLIENT_USER")
  ) {
    throw forbiddenPortal();
  }
  return context as ClientPortalRequestContext;
}
