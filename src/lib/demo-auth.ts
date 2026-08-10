import type { Role, Workspace } from "@/types/domain";
import { demoSessionCookie } from "@/lib/auth-cookies";

export { demoSessionCookie };
export const internalDemoEmail = "abcd1234@gmail.com";
export const demoPassword = "1234";

export const loginRoles = [
  "SUPER_ADMIN",
  "TENANT_ADMIN",
  "EMPLOYEE",
  "CLIENT_USER",
] as const;
type DemoLoginRole = (typeof loginRoles)[number];
const demoLoginRoles = [
  "TENANT_ADMIN",
  "EMPLOYEE",
  "CLIENT_USER",
] as const;
type MockLoginRole = (typeof demoLoginRoles)[number];

const roleWorkspace: Record<(typeof loginRoles)[number], Workspace> = {
  SUPER_ADMIN: "super-admin",
  TENANT_ADMIN: "admin",
  EMPLOYEE: "employee",
  CLIENT_USER: "client",
};

export function workspaceForRole(role: Role) {
  return loginRoles.includes(role as DemoLoginRole)
    ? roleWorkspace[role as DemoLoginRole]
    : undefined;
}

export function isWorkspaceAllowed(role: Role, workspace: Workspace) {
  return workspaceForRole(role) === workspace;
}

export function validateDemoLogin({
  identifier,
  password,
  role,
}: {
  identifier: string;
  password: string;
  role: Role;
}) {
  if (!demoLoginRoles.includes(role as MockLoginRole)) return null;
  const workspace = workspaceForRole(role);
  if (!workspace || password !== demoPassword) return null;

  return identifier.trim().toLowerCase() === internalDemoEmail ? { role, workspace } : null;
}

export function roleFromSession(value?: string) {
  return demoLoginRoles.includes(value as MockLoginRole)
    ? (value as Role)
    : null;
}
