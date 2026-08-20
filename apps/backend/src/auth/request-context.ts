export type VerifiedAuthUser = {
  readonly authUserId: string;
  readonly portalType?: "SUPER_ADMIN" | "TENANT" | "EMPLOYEE" | "CLIENT";
  readonly tenantId?: string;
  readonly sessionId?: string;
  readonly email?: string;
  readonly issuer: string;
  readonly audience: readonly string[];
  readonly expiresAt: Date;
};

export type TenantSelectionInput = {
  readonly tenantId?: string;
  readonly tenantCode?: string;
  readonly portal?: string;
  readonly selectedRole?: string;
};

export type RequestContext = {
  readonly requestId: string;
  readonly ipAddress?: string;
  readonly authUserId: string;
  readonly userId: string;
  readonly tenantId?: string;
  readonly membershipId?: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly employeeId?: string;
  readonly clientAccountId?: string;
  readonly isPlatformAdmin: boolean;
  readonly supportAccessSessionId?: string;
};

export type AuthenticatedRequest = {
  verifiedAuthUser?: VerifiedAuthUser;
  requestContext?: RequestContext;
};

export function freezeRequestContext(context: RequestContext): RequestContext {
  return Object.freeze({
    ...context,
    roles: Object.freeze([...context.roles]),
    permissions: Object.freeze([...context.permissions]),
  });
}
