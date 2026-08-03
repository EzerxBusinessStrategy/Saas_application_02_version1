import type { Workspace } from "@/types/domain";

export type TenantContext = {
  id: string;
  name: string;
  status: string;
};

export type Notification = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  href?: string;
  read: boolean;
  workspaces?: Workspace[];
};

export type WorkspaceOption = {
  value: Workspace;
  label: string;
};
