export const portalTypes = ["SUPER_ADMIN", "TENANT", "EMPLOYEE", "CLIENT"] as const;
export type PortalType = (typeof portalTypes)[number];

export function portalFromHeader(portal: string | undefined): PortalType | undefined {
  switch (portal) {
    case "super-admin": return "SUPER_ADMIN";
    case "admin": return "TENANT";
    case "employee": return "EMPLOYEE";
    case "client": return "CLIENT";
    default: return undefined;
  }
}

export function portalRedirect(portal: PortalType): string {
  return portal === "SUPER_ADMIN" ? "/super-admin" : portal === "TENANT" ? "/admin" : portal === "EMPLOYEE" ? "/employee" : "/client";
}

export function portalSessionPolicy(portal: PortalType): { expiresInMs: number; idleTimeoutMs?: number } {
  switch (portal) {
    case "SUPER_ADMIN": return { expiresInMs: 2 * 60 * 60 * 1_000, idleTimeoutMs: 30 * 60 * 1_000 };
    case "TENANT": return { expiresInMs: 8 * 60 * 60 * 1_000, idleTimeoutMs: 60 * 60 * 1_000 };
    case "EMPLOYEE": return { expiresInMs: 8 * 60 * 60 * 1_000 };
    case "CLIENT": return { expiresInMs: 24 * 60 * 60 * 1_000 };
  }
}
