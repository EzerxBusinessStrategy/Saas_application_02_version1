import type { Workspace } from "@/types/domain";

export const appWorkspaces = [
  "super-admin",
  "admin",
  "employee",
  "client",
] as const satisfies readonly Workspace[];

export type AppWorkspace = (typeof appWorkspaces)[number];

const appWorkspaceSet = new Set<string>(appWorkspaces);

export function isAppWorkspace(value: string): value is AppWorkspace {
  return appWorkspaceSet.has(value);
}

export function normalizeAppWorkspace(value: string): AppWorkspace | null {
  if (value === "manager") return "employee";
  return isAppWorkspace(value) ? value : null;
}
