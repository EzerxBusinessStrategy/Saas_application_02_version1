export const superAdminSessionCookie = "sa_session";
export const tenantSessionCookie = "tenant_session";
export const employeeSessionCookie = "employee_session";
export const clientSessionCookie = "client_session";

export type PortalKey = "super-admin" | "tenant" | "employee" | "client";

export function sessionCookieForPortal(portal: PortalKey): string {
  switch (portal) {
    case "super-admin":
      return superAdminSessionCookie;
    case "tenant":
      return tenantSessionCookie;
    case "employee":
      return employeeSessionCookie;
    case "client":
      return clientSessionCookie;
    default: {
      const unreachable: never = portal;
      return unreachable;
    }
  }
}
