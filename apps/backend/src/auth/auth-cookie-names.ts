export const demoSessionCookie = "ezerx-demo-role";
export const superAdminAccessTokenCookie = "saas-super-admin-access-token";
export const superAdminRefreshTokenCookie = "saas-super-admin-refresh-token";
export const superAdminRememberMeCookie = "saas-super-admin-remember-me";
export const authenticatedWorkspaceCookie = "saas-authenticated-workspace";
export const superAdminSessionCookie = "sa_session";
export const tenantSessionCookie = "tenant_session";
export const employeeSessionCookie = "employee_session";
export const clientSessionCookie = "client_session";

export function portalSessionCookieName(portal: "SUPER_ADMIN" | "TENANT" | "EMPLOYEE" | "CLIENT"): string {
  return portal === "SUPER_ADMIN" ? superAdminSessionCookie : portal === "TENANT" ? tenantSessionCookie : portal === "EMPLOYEE" ? employeeSessionCookie : clientSessionCookie;
}
