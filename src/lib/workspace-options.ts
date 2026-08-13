import type { WorkspaceOption } from "@/types/app-shell";
import type { Workspace } from "@/types/domain";

export const workspaceOptions: WorkspaceOption[] = [
  { value: "super-admin", label: "Platform" },
  { value: "admin", label: "Tenant administration" },
  { value: "employee", label: "Employee" },
  { value: "client", label: "Client portal" },
];

export const workspaces = workspaceOptions.map((option) => option.value) as Workspace[];
