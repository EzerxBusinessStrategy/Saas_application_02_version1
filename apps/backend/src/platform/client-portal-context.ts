import { forbiddenPortal } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";
import type { PoolClient } from "pg";

export type ClientPortalRequestContext = RequestContext & {
  readonly tenantId: string;
  readonly membershipId: string;
  readonly clientAccountId: string;
};

export type ClientPortalScope = ClientPortalRequestContext & {
  readonly clientId: string;
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

export async function resolveClientPortalScope(
  client: PoolClient,
  context: ClientPortalRequestContext,
): Promise<ClientPortalScope> {
  const result = await client.query<{ client_id: string }>(
    `
      select client_id::text
      from public.client_portal_accounts
      where tenant_id = $1
        and id = $2
        and user_id = $3
        and membership_id = $4
        and status = 'active'
    `,
    [context.tenantId, context.clientAccountId, context.userId, context.membershipId],
  );
  const clientId = result.rows[0]?.client_id;
  if (!clientId) throw forbiddenPortal();
  return { ...context, clientId };
}
