import type { WorkspaceOption } from "@/types/app-shell";
import type { Workspace } from "@/types/domain";
import { appWorkspaces } from "@/lib/workspace-routing";

export const workspaceOptions: WorkspaceOption[] = [
  { value: "super-admin", label: "Platform" },
  { value: "admin", label: "Tenant administration" },
  { value: "employee", label: "Employee" },
  { value: "client", label: "Client portal" },
];

export const workspaces = appWorkspaces satisfies readonly Workspace[];
