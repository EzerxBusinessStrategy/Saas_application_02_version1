import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  clientSessionCookie,
  employeeSessionCookie,
  superAdminSessionCookie,
  tenantSessionCookie,
} from "@/lib/auth-cookies";
import { locales, timezones, type AppLocale, type AppTimezone } from "@/i18n/config";
import { rolePermissions } from "@/lib/permissions";
import { backendApiBaseUrl } from "@/lib/server/backend-api-url";
import { roles, type Role, type User, type Workspace } from "@/types/domain";

type PortalKey = "super-admin" | "tenant" | "employee" | "client";

const portalForWorkspace: Record<Workspace, PortalKey> = {
  "super-admin": "super-admin",
  admin: "tenant",
  manager: "employee",
  employee: "employee",
  client: "client",
};

const loginForWorkspace: Record<Workspace, string> = {
  "super-admin": "/super-admin/login",
  admin: "/admin/login",
  manager: "/employee/login",
  employee: "/employee/login",
  client: "/client/login",
};

const cookieForPortal: Record<PortalKey, string> = {
  "super-admin": superAdminSessionCookie,
  tenant: tenantSessionCookie,
  employee: employeeSessionCookie,
  client: clientSessionCookie,
};

const rolesForWorkspace: Record<Workspace, readonly Role[]> = {
  "super-admin": ["SUPER_ADMIN"],
  admin: ["TENANT_OWNER", "TENANT_ADMIN", "FINANCE_USER", "HR_OPERATIONS_USER"],
  manager: ["MANAGER"],
  employee: ["MANAGER", "EMPLOYEE"],
  client: ["CLIENT_USER"],
};

type MeResponse = {
  readonly user?: { readonly displayName?: unknown; readonly email?: unknown };
  readonly roles?: unknown;
  readonly preferences?: { readonly locale?: unknown; readonly timezone?: unknown };
};

export async function getAuthenticatedWorkspaceUser(workspace: Workspace): Promise<User> {
  const portal = portalForWorkspace[workspace];
  const token = (await cookies()).get(cookieForPortal[portal])?.value;
  if (!token) redirect(loginForWorkspace[workspace]);

  let response: Response;
  try {
    response = await fetch(`${backendApiBaseUrl()}/me`, {
      headers: {
        cookie: `${cookieForPortal[portal]}=${encodeURIComponent(token)}`,
        "x-portal": portal === "tenant" ? "admin" : portal,
      },
      cache: "no-store",
    });
  } catch {
    throw new Error("The authentication service is unavailable.");
  }

  if (response.status === 401) redirect(loginForWorkspace[workspace]);
  if (!response.ok) throw new Error("The authenticated profile could not be loaded.");

  const profile = (await response.json()) as MeResponse;
  const profileRoles = Array.isArray(profile.roles)
    ? profile.roles.filter((role): role is Role => typeof role === "string" && roles.includes(role as Role))
    : [];
  const activeRoles = profileRoles.filter((role) => rolesForWorkspace[workspace].includes(role));
  const role = activeRoles[0];
  if (!role) redirect("/no-permission");

  const email = typeof profile.user?.email === "string" ? profile.user.email : "";
  const name = typeof profile.user?.displayName === "string" && profile.user.displayName.trim()
    ? profile.user.displayName.trim()
    : email || "Account";

  return {
    name,
    email,
    initials: initialsFor(name),
    role,
    roles: activeRoles,
    permissions: [...new Set(activeRoles.flatMap((activeRole) => rolePermissions[activeRole]))],
    preferences: preferencesFrom(profile.preferences),
  };
}

function initialsFor(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function preferencesFrom(value: MeResponse["preferences"]): User["preferences"] | undefined {
  if (!value || typeof value.locale !== "string" || typeof value.timezone !== "string") return undefined;
  const locale = locales.includes(value.locale as AppLocale) ? (value.locale as AppLocale) : undefined;
  const timezone = timezones.some((clock) => clock.timezone === value.timezone) ? (value.timezone as AppTimezone) : undefined;
  return locale && timezone ? { locale, timezone } : undefined;
}
