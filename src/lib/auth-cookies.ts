import {
  authenticatedWorkspaceCookie,
  demoSessionCookie,
  superAdminAccessTokenCookie,
  superAdminRefreshTokenCookie,
  superAdminRememberMeCookie,
  superAdminSessionCookie,
  tenantSessionCookie,
  employeeSessionCookie,
  clientSessionCookie,
} from "../../apps/backend/src/auth/auth-cookie-names";

export {
  authenticatedWorkspaceCookie,
  demoSessionCookie,
  superAdminAccessTokenCookie,
  superAdminRefreshTokenCookie,
  superAdminRememberMeCookie,
  superAdminSessionCookie,
  tenantSessionCookie,
  employeeSessionCookie,
  clientSessionCookie,
};

export type PortalKey = "super-admin" | "tenant" | "employee" | "client";

export function sessionCookieForPortal(portal: PortalKey): string {
  return portal === "super-admin" ? superAdminSessionCookie : portal === "tenant" ? tenantSessionCookie : portal === "employee" ? employeeSessionCookie : clientSessionCookie;
}
